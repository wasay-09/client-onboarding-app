# AI Workflow — building this with Claude Code, coherently

> How to work so you **never re-paste context**, and every module comes out consistent. Read
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`MODULE_PLAYBOOK.md`](./MODULE_PLAYBOOK.md) first.

## The context problem, solved by files (not by re-explaining)

Claude Code auto-loads `CLAUDE.md` at the start of **every** session, and also loads a
`CLAUDE.md` from a **subdirectory** when you're working inside it. That is your "don't pass
context each time" mechanism. The layering:

| Where | Holds | Loaded |
|---|---|---|
| Root `CLAUDE.md` | The invariants + pointers to `docs/` | Every session (keep it **short**) |
| `docs/*.md` | The full architecture, playbook, roadmap | When relevant / when pointed to |
| `apps/api/src/modules/<name>/CLAUDE.md` (optional) | Module-specific context | When working in that module |
| `specs/YYYY-MM-<name>.md` | One module's requirements & decisions | You point the session at it |

**Per-module loop:** start a fresh chat → "implement `specs/2026-07-payroll.md` following
`docs/MODULE_PLAYBOOK.md`" → it already has the invariants from `CLAUDE.md`. That's the whole
context handoff. Keep `CLAUDE.md` lean — it's loaded every time; push detail into `docs/`.

## `docs/` vs `.claude/skills/` — what goes where (complementary, not either/or)

A common confusion. They do different jobs:

| | `docs/*.md` | `.claude/skills/<name>/SKILL.md` |
|---|---|---|
| Purpose | **Knowledge** — what the system is and *why* | **Procedure** — a repeatable task Claude *runs* |
| Used how | Passive: read when relevant / linked from `CLAUDE.md` | Active: invoked as `/name`, executed step by step |
| Shape | Prose, diagrams, decisions | YAML frontmatter (`name`, `description`) + numbered steps; may bundle scripts/templates |
| Examples | ARCHITECTURE, ROADMAP, MODULE_PLAYBOOK | `/new-module`, `/add-field` |

**Rule of thumb:** if you'd want Claude to *do the same steps the same way every time*, it's a
**skill**. If it's something Claude should *know*, it's a **doc**. They reference each other — the
`/new-module` skill's first step is "read `docs/MODULE_PLAYBOOK.md`." So the architecture docs are
**correct where they are** (`docs/`); add *procedures* under `.claude/skills/`. Don't move the
architecture into skills.

## Should you build custom skills, use community skills, or rely on "invariants"?

Do **all three**, in this priority order — they solve different problems:

**1. Invariants / rules first (cheapest, strongest).** A rule that holds regardless of task.
Put it where it's *enforced*, not just documented:
- `CLAUDE.md` (always in context) — the 9 invariants.
- **ESLint boundary rule** — forbids cross-module deep imports (boundaries the machine checks).
- **CI gate** — typecheck + lint + build + test must pass to merge.
A machine-checked invariant never drifts. This is the foundation; without it, skills paper over a
moving target.

**2. Custom skills — your highest-leverage build.** Skills are repeatable *procedures* unique to
*your* conventions. Generic skills can't know your module anatomy, so **write your own.** Priority:
- **`/new-module`** — scaffolds a module per `MODULE_PLAYBOOK.md` so every module is identical.
- Later: `/add-field` (edit shared schema correctly), `/add-migration` (Drizzle workflow).
A skill = a checklist the AI runs the same way every time = coherence across modules.

**3. Community / GitHub skills — convenience, vetted.** Use for *generic, non-project-specific*
chores: PR review, conventional commits, changelog generation, test scaffolding. **Vet each one** —
a skill is instructions your agent will execute, so treat it like a dependency you audit. Don't
bulk-install; each adds behavior and context you're trusting.

> If by "invariants" you meant a specific tool, the principle is unchanged: encode rules where a
> machine enforces them (lint/CI/CLAUDE.md). Tools are optional; the enforced rule is the point.

## The `/new-module` skill (create in Phase 1)

Drop this at `.claude/skills/new-module/SKILL.md` once the monorepo exists:

```markdown
---
name: new-module
description: Scaffold a new backend+frontend module following docs/MODULE_PLAYBOOK.md. Use when the client delivers a new form/part.
---
You are scaffolding a new module named $ARGUMENTS.

1. Read docs/ARCHITECTURE.md and docs/MODULE_PLAYBOOK.md.
2. Confirm there is a spec at specs/*-<name>.md; if not, ask for it first.
3. Create:
   - packages/shared/schema/<name>.ts  (reuse sharedCore fields; declare only new ones)
   - apps/api/src/modules/<name>/{store,service,routes,index}.ts
   - apps/api/src/db/schema/<name>.ts  ONLY if a Tier-1 table is justified by the tier rules
4. For each new datum, apply the placement rules: JSONB by default; column only if
   queried/joined/constrained/shared; reference the kernel for employer/plan/person.
5. service.ts must re-run the shared validate() and validate the request envelope with Zod.
6. Register the router in apps/api/src/app.ts and the section in packages/shared/schema/plans.ts.
7. Add a happy-path and a validation-failure test.
8. Run: pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test. Fix until green.
9. Output the Definition-of-Done checklist from MODULE_PLAYBOOK.md with each item checked.

Never let a module read another module's tables. FKs point toward the kernel only.
```

## Subagents (optional, later)

A custom subagent (e.g. a `code-reviewer` that checks the invariants, or a `module-builder`) can
help once modules pile up. Not needed early — `CLAUDE.md` + the `/new-module` skill + per-module
specs cover the coherence need.

## Testing, lint & CI policy

**Do have tests — but be selective** (requirements churn, so don't test volatile things). Test
where breakage is *silent* and the code is *stable*:
- **Always (highest ROI):** the pure logic in `packages/shared` — `validate()`, `isVisible()`,
  `displayValue()`, PDF data mapping. Everything depends on these; bugs are invisible; tests are cheap.
- **Per module:** `service.ts` happy path + one validation-failure path. That's the module's contract.
- **Skip:** volatile form/UI layout, anything the TypeScript compiler already guarantees, styling.

Tooling: **Vitest**. Write the test in the **same PR** as the code (it's in the module Definition of Done).

**Don't run lint/typecheck by hand each time — make it an automatic gate:**
1. **CI (GitHub Actions)** runs `typecheck + lint + build + test` on every branch and **blocks merge** on failure. The real safety net.
2. **Pre-commit hook** (husky + lint-staged) for fast local feedback — optional but nice.
3. **Claude Code hook** (`PostToolUse`/`Stop` in `.claude/settings.json`) can auto-run checks after the agent edits, so you never have to ask.
4. Invariant 9 also tells the agent to run the checks before declaring a task done.

You don't verify each time — the gate does. Your job is to read the PR and the DoD checklist.

### Ready-to-use auto-check hook (install in Phase 1)

After the monorepo exists, add `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "sh .claude/hooks/check.sh" } ] }
    ]
  }
}
```

and `.claude/hooks/check.sh` (it runs only when TypeScript files changed, so chat turns are untouched):

```sh
#!/usr/bin/env sh
# Auto-check when the agent finishes — only if .ts/.tsx files changed.
if [ -z "$(git status --porcelain | grep -E '\.tsx?$')" ]; then
  exit 0
fi
pnpm -r lint && pnpm -r typecheck || exit 2   # exit 2 → Claude is asked to fix before stopping
```

> To run it *before* the monorepo migration, swap the last line's command for
> `npm run lint && npx tsc -b || exit 2`. We defer installing it to Phase 1 so it aligns with the
> pnpm/workspace commands and sits next to the CI setup.

## Habits that keep it coherent

- **One module per branch**, one spec per module.
- **Point the session at the spec + the playbook**; let `CLAUDE.md` supply the invariants.
- Keep `CLAUDE.md` short; put detail in `docs/`.
- Let the **compiler and CI** be the reviewer — green typecheck/lint/build before merge.
- When a decision changes, update the **Decision Log** in `ARCHITECTURE.md` so it doesn't get re-litigated.

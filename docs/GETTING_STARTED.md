# Getting Started — your operating guide

> Day-to-day instructions for building this with Claude Code. Pairs with
> [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) (the *why*); this is the *do this, then this*.

## How the pieces fit (and what goes where)

| Piece | Holds | How it's used |
|---|---|---|
| `CLAUDE.md` | The invariants + pointers | **Auto-loaded every session.** You never paste these. |
| `docs/*.md` | Knowledge: architecture, roadmap, playbook | You point a session at the relevant one. |
| `specs/*.md` | One file per module/change: its requirements | You point a session at it. |
| `.claude/skills/<name>/SKILL.md` | A procedure Claude *runs* | Invoked as `/name`. |
| CI + hooks | lint / typecheck / tests | Run automatically — you don't do it by hand. |

A session's full context handoff is just: **invariants (automatic) + the spec + the relevant doc.**
That's the answer to "don't pass context each time."

---

## Part A — One-time setup: stand up the architecture (Phase 1)

Do this once. Use **plan mode** so you review before any file moves.

1. Branch: `git checkout -b feat/phase-1-monorepo`
2. New Claude Code chat. Enter **plan mode** (press Shift+Tab until it shows "plan mode", or say
   "plan only, don't edit yet").
3. Prompt:
   > Read docs/ARCHITECTURE.md (§4 repo layout) and docs/ROADMAP.md (Phase 1). Propose a plan to
   > restructure into the pnpm-workspace monorepo with ZERO behavior change — move the app to
   > `apps/web` and extract `schema/`, `pdf/`, `types.ts`, `visibility.ts` into `packages/shared`.
   > List every file move and import change. Don't write code yet.
4. Review the plan, then: "Looks good — execute it."
5. Verify: `pnpm -r build` passes and `pnpm --filter web dev` runs the app exactly as before.
6. PR titled "Phase 1: monorepo extract (no behavior change)". Merge when CI is green.

Then, in small follow-up PRs:
7. **CI + lint gate:**
   > Add a GitHub Actions workflow that runs `pnpm -r typecheck`, `lint`, `build`, `test` on every
   > PR. Add an ESLint rule forbidding imports from another module's internals (only its
   > `index.ts` is importable).
8. **The scaffolder skill:**
   > Create `.claude/skills/new-module/SKILL.md` using the content in docs/AI_WORKFLOW.md.
9. **The auto-check hook:**
   > Add `.claude/settings.json` + `.claude/hooks/check.sh` using the ready snippet in
   > docs/AI_WORKFLOW.md, so lint + typecheck run automatically when I finish.

After this, the architecture exists and is self-maintaining. Phases 2–4 follow the same pattern:
point a chat at `docs/ROADMAP.md` and ask for that phase.

---

## Part B — The per-module loop (every time the client gives you a module)

Repeat for payroll, census, funds, advisor, service agreement, etc.

1. **Capture the spec.** Paste the client's description:
   > Draft `specs/2026-07-<name>.md` following our spec style: what it collects, the flow, which
   > shared-core fields it reuses (ask-once), and what new data it introduces. Don't code yet.

   **Review/edit the spec yourself** — this is the one place your judgment matters most.
2. **Branch:** `git checkout -b feat/module-<name>`
3. **Scaffold + build.** New chat:
   > /new-module <name>

   (or, without the skill: "Implement `specs/2026-07-<name>.md` following docs/MODULE_PLAYBOOK.md.")
4. **Let the gate check it.** The agent (and CI) run typecheck/lint/build/test. Don't verify by hand.
5. **Review** the Definition-of-Done checklist the agent outputs + the diff. Watch specifically for:
   no cross-module table access, sensible JSONB-vs-column choices, fields declared once in `shared`.
6. **PR → CI green → merge.** Behind a feature flag if the flow isn't finished.

Each module is additive; earlier modules don't change.

---

## Part C — Creating & maintaining skills

- A skill is a folder `.claude/skills/<name>/SKILL.md` with frontmatter (`name`, `description`)
  and numbered steps; it may bundle helper scripts/templates.
- **Don't make one skill per module.** Make a few *general, reusable* skills:
  - `/new-module` — the big one (scaffold per the playbook).
  - later: `/add-field` (edit the shared schema correctly), `/add-migration` (Drizzle workflow).
- To create one, just ask:
  > Create a skill at `.claude/skills/<name>/SKILL.md` that <does X>, following docs/MODULE_PLAYBOOK.md.
- **Keep skills mirroring the playbook.** When `MODULE_PLAYBOOK.md` changes, update `/new-module`.

---

## Quick reference

| You want to… | Do this |
|---|---|
| Start the backend architecture | Part A (plan mode → execute → PR) |
| Add a module the client gave you | Part B (`spec` → `/new-module` → PR) |
| Add/remove questionnaire fields | Edit `packages/shared/schema` — no migration |
| Change DB structure | Drizzle migration (reversible); expand/contract for big ones |
| Avoid manual lint/test | CI gate + hooks do it; you read the PR |
| Hand context to a new chat | Point at the spec + the doc; invariants load from `CLAUDE.md` |

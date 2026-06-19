# Module Playbook — how to build ONE module

> Follow this for **every** new part the client delivers. The client hands work over module by
> module; this playbook makes each module look identical, so integrating it is *registration*,
> not a rewrite. Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) first.

## What a module is

A self-contained slice of the product (e.g. payroll, census, funds, advisor, service agreement).
It owns its own UI sections, API routes, business logic, and tables. It **references** the shared
kernel (organization, plan, case, parties) but never reaches into another module.

## Module anatomy (the fixed template)

```
apps/api/src/modules/<name>/
  routes.ts     # HTTP endpoints, namespaced /api/<name>/...   (thin: validate → call service)
  service.ts    # business logic — the ONLY thing other modules may call
  store.ts      # DB access — owns this module's tables / JSONB key
  schema.ts     # this module's SectionDefs (re-exported into packages/shared)
  index.ts      # public surface: exports the router + the service. Nothing else is importable.
packages/shared/schema/<name>.ts   # field definitions (single source of truth)
apps/api/src/db/schema/<name>.ts   # Drizzle table definitions (Tier-1 tables, if any)
```

**Boundary rules (enforced by ESLint, not just convention):**
- Other modules import **only** from `modules/<name>/index.ts`.
- A module talks to another module **only through its `service.ts`** — never its `store.ts` or tables.
- Foreign keys point **toward the kernel**, never to a peer module.

## Step-by-step: adding a module

1. **Write a spec** in `specs/YYYY-MM-<name>.md` — what it collects, its flow, what kernel data it
   reuses (ask-once), what new data it introduces. (This is the per-module context for the AI.)
2. **Define fields in `packages/shared/schema/<name>.ts`** — reuse `sharedCore` fields; only declare
   what's genuinely new. Register the section(s) in `plans.ts` where they apply.
3. **Decide data placement** for each new piece using the tier rules:
   - questionnaire answer → **JSONB** (no migration);
   - needs query/join/constraint/sharing → **Tier-1 table** (add a Drizzle migration);
   - already in the kernel (employer, plan, person) → **reference it**, don't re-collect.
4. **Build `store.ts` → `service.ts` → `routes.ts`** in that order. `service.ts` re-runs the shared
   `validate()` for answers and Zod for the request envelope. `routes.ts` stays thin.
5. **Register** the router in `apps/api/src/app.ts` and the section in `plans.ts`. (Integration = registration.)
6. **Frontend** consumes it via the API client only.
7. **Tests**: a service-level test for the happy path + one validation-failure path.
8. **Verify**: `pnpm -r typecheck && lint && build && test` all green. Then open a PR.

## The promote-on-evidence rule

Keep new data in JSONB by default. Move it to a real column/table **only** when you actually need
to: query/filter on it, join it, enforce uniqueness/a constraint, or share it across modules.
When a **second** module needs data that currently lives inside one module, promote it to the
**shared kernel** and point both modules' FKs at it. Don't predict sharing — react to it.

## Definition of done (a module is "done" when)

- [ ] Spec exists in `specs/`.
- [ ] Fields declared once in `packages/shared`; reuses `sharedCore` where possible.
- [ ] Data placed per the tier rules; any new table has a reversible migration.
- [ ] No cross-module table access; cross-module calls go through `service.ts`; FKs toward kernel only.
- [ ] Server re-validates with shared `validate()`.
- [ ] Router + sections registered.
- [ ] Tests pass; typecheck + lint + build green in CI.
- [ ] Behind a feature flag if the flow isn't complete yet.

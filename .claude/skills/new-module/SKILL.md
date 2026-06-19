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
8. Run: pnpm -r typecheck && pnpm lint && pnpm -r build && pnpm -r test. Fix until green.
9. Output the Definition-of-Done checklist from MODULE_PLAYBOOK.md with each item checked.

Never let a module read another module's tables. FKs point toward the kernel only.

> Note: lint runs once at the repo root (`pnpm lint`), not per package. The schema
> file is the single source of truth — declare each field once in packages/shared and
> import it everywhere via the @fbsi/shared package root (never a deep path).

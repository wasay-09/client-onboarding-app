# Client Onboarding App — Retirement Plan TPA

A web app for a retirement-plan third-party administrator (TPA). An end user selects a
**plan type**, fills out the matching **Plan Design Questionnaire**, and downloads a
formatted **PDF**. This is **Phase 1** of a larger onboarding product.

## Product principle: ask each detail once
Many of the client's forms repeat the same fields (company name, EIN, plan name, address,
primary contact). The product must **never ask for a repeated detail twice**. This codebase
is structured around a single shared data model so later forms can reuse already-collected
values. Even though only one form exists today, the schema is built so that future forms
import the shared sections and only prompt for what's missing.

## The five plan types & why two are bigger
| Plan | Sections used |
|------|---------------|
| 401(k), 403(b) | Shared core (28 fields) **+ Design Considerations (~38 fields)** |
| 457(b), SIMPLE IRA, Solo 401(k) | Shared core only |

The shared 28 fields are identical across all five source questionnaires. Only the 401(k)
and 403(b) forms carry the long "Design Considerations" section (employer match, profit
sharing, safe harbor, loans, distributions, vesting, etc.) with heavy conditional logic.

## Architecture — schema-driven (one definition, three uses)
Each field is declared **once** in `packages/shared` (a pnpm-workspace monorepo). That single
definition drives the form UI, the validation, and the PDF, and is imported everywhere via the
`@fbsi/shared` package root (never a deep path).

```
packages/shared/                # @fbsi/shared — the contract (used by web, scripts, later api)
  index.ts                      # barrel: the public surface consumers import
  types.ts                      # FieldDef / SectionDef / PlanType
  schema/
    sharedCore.ts               # the 28 fields common to all plans (3 subsections)
    designConsiderations.ts     # ~38 fields, 401k/403b only, with showWhen conditions
    operational.ts              # plan setup / contacts / payroll / advisor / funds sections
    solo.ts                     # Solo 401(k) extra section
    plans.ts                    # PLANS: maps each plan -> which sections it uses
    visibility.ts               # isVisible(), validate(), displayValue() — shared by form + PDF
  pdf/
    QuestionnairePdf.tsx        # @react-pdf/renderer document
    ServiceAgreementPdf.tsx     # service-agreement document
    OnboardingPackagePdf.tsx    # combined cover + SA + summary
    serviceAgreementContent.ts  # SLA articles, fee schedules, templates
    generatePdf.tsx             # build blob + trigger download
apps/web/                       # the React + Vite app (imports @fbsi/shared)
  src/
    components/
      PlanPicker.tsx            # step 1
      QuestionnaireForm.tsx     # step 2 (react-hook-form + FormProvider)
      fields/Field.tsx          # renders one field by type (text/date/radio/yesno/...)
    App.tsx                     # 3 steps: pick -> fill -> done
```

### How conditional fields work
A field with `showWhen: { field, equals }` is hidden — and skipped in both validation and the
PDF — unless the condition matches. `visibility.ts` evaluates this (recursively, so a field
nested under another conditional only shows when its whole chain is visible). The form and the
PDF call the **same** `isVisible()`, so what you see is exactly what prints.

### "Other" free-text option
A radio field with `allowOther: true` renders an extra "Other" choice plus a companion text
input stored under `<name>__other`. `displayValue()` resolves it for the PDF.

## Tech stack
- React + Vite + TypeScript
- react-hook-form (form state) + custom validation in `visibility.ts`
- Tailwind CSS (brand cue: navy `#030D28`, Plus Jakarta Sans — from the original marketing page)
- @react-pdf/renderer (PDF generation, fully client-side)

No backend, no persistence, no login. Pure client-side; deployable as static files.

## Run
```bash
pnpm install
pnpm dev         # local dev (web app)
pnpm build       # typecheck + production build (all workspaces)
pnpm smoke       # headless: validate + render a PDF for every plan type
```

## Source forms
Originals: `/Users/elphinstone/Downloads/OneDrive_1_6-12-2026/` (PDFs) with markdown
conversions in `.../markdown/`. Field labels/options here are taken verbatim from the
questionnaire markdown.

> Known caveat: the 457(b)/SIMPLE/Solo source PDFs are larger than their extracted text,
> so it's worth confirming once that those plans truly contain only the shared section. The
> markdown shows them as shared-core-only, and the app is built to that.

## Roadmap (later phases — not built yet)
1. **Other onboarding forms** — Plan Setup, FBSI advisor/contact/payroll/fund, census import,
   auto-enroll. These reuse the shared core (the "ask once" payoff) and add **repeating-row
   tables** (employee census, fund lineup).
2. **Service Agreements** — long legal documents that are ~95% fixed boilerplate with a few
   merge fields (employer name, plan name, effective date, signatures) + fee schedules.
   Generated from already-collected data, then signed.
3. **E-signature + submission.**

When adding a new form, add its sections under `packages/shared/schema/`, register them, and
reuse `sharedCore` fields rather than re-declaring them.

---

# Phase 2+ — Backend, Database & Modular Architecture (PLANNED)

> Phase 1 (above) is the working client-side app. Phase 2 adds persistence, an API, auth, and
> document/signature storage. **The full plan lives in `docs/` — read these before any backend work:**
> - [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) — **start here**: the day-to-day operating guide (kickoff + per-module loop + copy-paste prompts)
> - [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system spine, stack, data model, and the rules that keep it coherent
> - [`docs/MODULE_PLAYBOOK.md`](docs/MODULE_PLAYBOOK.md) — how to build ONE module (follow for every new part)
> - [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased build order with a definition-of-done per phase
> - [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) — how to work in this repo with Claude Code (skills, specs, context)

**Context:** the client delivers requirements **one module at a time** and doesn't yet know all
modules/flows, so the backend/DB will change often. The data is connected (financial product).
The architecture is built to absorb that: a **modular monolith** (one repo, one Postgres DB) with
a shared schema package, JSONB answers, and a small shared kernel modules reference.

## Non-negotiable invariants (don't violate without a Decision Log entry)
1. **One source of truth for fields** — declared once in `packages/shared`, imported via the `@fbsi/shared` package root. Never redefined in API, DB, or PDF.
2. **The schema is the contract** — web, api, and pdf all import the shared package; types flow from there.
3. **Validate on the server** — the API re-runs the shared `validate()`; never trust the client.
4. **Frontend talks only to our own API** — never directly to Supabase/DB.
5. **JSONB for answers, columns for the kernel** — adding a questionnaire field needs no migration; only shared/queried/constrained data becomes a column.
6. **Modules reference the shared kernel, never each other's tables** — cross-module access via a module's service API; FKs point toward the kernel.
7. **Promote to a real table only on evidence** — when you need to query, join, constrain, or share it.
8. **Every change ships with a spec** (`specs/`); changed decisions go in the Decision Log (`docs/ARCHITECTURE.md`).
9. **Nothing merges without** typecheck + lint + build (+ tests) passing.

Stack: TypeScript everywhere · pnpm monorepo · React+Vite (`apps/web`) · Fastify (`apps/api`) ·
PostgreSQL via Supabase · Drizzle ORM · Vitest · GitHub Actions. Chosen to be mainstream and
strongly typed so the toolchain catches AI mistakes. See `docs/ARCHITECTURE.md` for the why.

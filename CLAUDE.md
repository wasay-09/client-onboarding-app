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
Each field is declared **once** in `src/schema/`. That single definition drives the form UI,
the validation, and the PDF.

```
src/
  types.ts                      # FieldDef / SectionDef / PlanType
  schema/
    sharedCore.ts               # the 28 fields common to all plans (3 subsections)
    designConsiderations.ts     # ~38 fields, 401k/403b only, with showWhen conditions
    plans.ts                    # PLANS: maps each plan -> which sections it uses
    visibility.ts               # isVisible(), validate(), displayValue() — shared by form + PDF
  components/
    PlanPicker.tsx              # step 1
    QuestionnaireForm.tsx       # step 2 (react-hook-form + FormProvider)
    fields/Field.tsx            # renders one field by type (text/date/radio/yesno/...)
  pdf/
    QuestionnairePdf.tsx        # @react-pdf/renderer document
    generatePdf.ts             # build blob + trigger download
  App.tsx                       # 3 steps: pick -> fill -> done
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
npm install
npm run dev      # local dev
npm run build    # typecheck + production build
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

When adding a new form, add its sections under `src/schema/`, register them, and reuse
`sharedCore` fields rather than re-declaring them.

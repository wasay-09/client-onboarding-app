# Spec: Ask once across sessions (Phase 3)

Status: implemented · Branch: `feat/ask-once-across-sessions` · Date: 2026-06-20

Makes the product principle — **never ask for a repeated detail twice** — work *across sessions*.
Before this, every `POST /api/cases` inserted a brand-new `organization` + `plan` + `case`, so a
returning user created duplicate organizations and re-typed everything; the only read path was
`GET /api/cases/:id` (by id from the URL hash). Now the write side **reuses** the org (by its EIN
natural key) and plan, and a new read endpoint returns the user's most recent answers to **pre-fill**
a new questionnaire. Builds directly on Phase 4 auth (`request.user.id`, `withUserScope`, RLS).

DoD: a returning user is **not re-asked** fields already on record, and **no duplicate
organizations** are created.

## What changed & why

### 1. EIN promoted to the organization's natural key (`db/schema/kernel.ts`, `drizzle/0003_*.sql`)
- **What:** A partial unique index `UNIQUE(owner_id, ein) WHERE ein IS NOT NULL` on `organization`.
  EINs are normalized to **digits-only** before storage/lookup, so `'12-3456789'` and `'123456789'`
  are the same employer. Migration `0003` first backfills existing rows
  (`regexp_replace(ein, '\D', '', 'g')`), then creates the index.
- **Why:** This is the promote-on-evidence trigger (invariant 7) — we now need to *enforce
  uniqueness* to reuse the row. Scoped **per owner**, not global: a global unique would leak another
  tenant's existence (via insert failure) and fight RLS. Partial so null EINs and pre-auth
  (`owner_id` null) rows never collide. The raw, formatted EIN stays in `answers.ein` (JSONB) and is
  what the PDF renders — no display change. Reversible: drop the index.

### 2. Write side reuses org + plan (`kernel/cases/store.ts`)
- **What:** `CaseStore.create()` is now find-or-create, inside the same `withUserScope` transaction:
  reuse the org matched by `(owner_id, normalized ein)`, else insert; reuse the plan matched by
  `(organization_id, plan_type)`, else insert; **always** insert a new `cases` row. A `normalizeEin()`
  helper (digits-only; empty→null) is exported from the store.
- **Why:** "Ask once" identity — one canonical org per employer, one plan per type, while each
  submission stays its own case (history → "most recent answers"). Plan reuse is app-level only (no
  hard unique constraint) — an org could legitimately hold two plans of a type later; we don't
  over-constrain a Tier-0 table on a guess. The unique index is the race/integrity backstop.

### 3. Read side: `GET /api/cases/latest` (`kernel/cases/{store,service,routes}.ts`)
- **What:** Returns the caller's most recent case `{ id, planType, answers, status, pdfUrl,
  createdAt }`, or `204 No Content` when they have none; `401` when unauthenticated. Registered
  before `/api/cases/:id` (Fastify prefers the static segment, so `latest` is never captured as an
  id). `store.getLatest()` orders by `created_at desc` inside `withUserScope`.
- **Why:** The web needs "what we already know about this user" without a case id. Scoped by org
  ownership **and** RLS, so it can never return another org's data.

### 4. Web: pre-fill + review (`apps/web/src/api.ts`, `App.tsx`, `components/QuestionnaireForm.tsx`)
- **What:** `getLatestCase()` (null on 204/404). On plan selection, `App` fetches the latest case and
  passes its `answers` as `initialValues` to `QuestionnaireForm`, which seeds
  `useForm({ defaultValues })`. Prefilled section steps show a banner: "Pre-filled from your last
  submission — review and update anything that changed." Best-effort: any fetch failure starts blank.
- **Why:** Returning users confirm/edit rather than re-type. **Pre-fill + review** (no auto-skip)
  keeps every value visible and correctable — appropriate for a financial product. Reuses
  `sharedCore` `FormValues`; no field re-declaration (invariants 1/2).

## Key files
- `apps/api/src/db/schema/kernel.ts`, `apps/api/drizzle/0003_certain_klaw.sql` (+ `meta`)
- `apps/api/src/kernel/cases/{store,service,routes}.ts`
- `apps/web/src/{api.ts,App.tsx}`, `apps/web/src/components/QuestionnaireForm.tsx`
- `apps/api/tests/ask-once.test.ts`

## Verify (DoD)
- `pnpm -r typecheck && pnpm lint && pnpm -r build && pnpm -r test` (22 API tests, pglite) + `pnpm smoke`.
  - `ask-once.test.ts`: resubmit with a reformatted EIN → **one** org, plan reused, 2 cases;
    different plan type → one org, 2 plans; two users + same EIN → one org each (no leak);
    `/latest` → newest answers, `204` when none, `401` unauthenticated.
- Live (local: `AUTH_BYPASS=1` API + un-gated web): submit a plan, start a new questionnaire → fields
  come up pre-filled with the banner; resubmit the same EIN (with/without dashes) → DB shows one
  organization for that owner, cases accumulate.

## Deferred
- `planType`-aware `/latest` (prefill plan-specific answers from the most recent case *of that type*).
- Multi-org selection when a user owns several employers (currently prefills the most recent overall).
- A hard `(organization_id, plan_type)` plan constraint (promote on evidence if one-plan-per-type holds).

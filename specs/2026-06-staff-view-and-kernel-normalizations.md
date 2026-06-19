# Spec: Internal staff view + kernel normalizations (document, parties)

Status: implemented · Branch: `feat/staff-view-kernel-normalizations` · Date: 2026-06-20

Adds the **internal staff dashboard** (FBSI staff list/search/open any submitted case) and performs
the next two **kernel normalizations** (promote-on-evidence, invariant 7): the canonical PDF is
promoted from a `cases.pdf_path`/`pdf_hash` string into a first-class **`document`** table, and
contacts are promoted out of `answers` JSONB into a canonical **`party`** table. Existing client
submit + `#case=` reload flows are unchanged. RLS stays defense-in-depth; the API is the primary
wall. Local dev stays zero-config.

## What changed & why

### 1. Role extraction + staff gate (`src/auth/{verify,guards}.ts`, `src/auth/plugin.ts`, `src/config.ts`)
- **What:** `AuthUser` gains `role`, read from the Supabase custom claim `app_metadata.role` (not the
  reserved top-level `role` claim, which is the Postgres role `authenticated`). `isStaff(user)` =
  role ∈ {staff, admin}. A `requireStaff` preHandler returns **403** for a verified non-staff caller
  (the `/api/staff` namespace is privileged — no per-resource existence to leak, unlike the owner
  routes' 404). New config `devUserRole` (default `admin`, read only on the `AUTH_BYPASS` branch) so
  un-gated local dev reaches the dashboard.
- **Why:** FBSI staff administer plans across all client employers; they need a cross-owner read
  surface. Roles ride the standard Supabase claim, set by an admin via the admin API — no schema.

### 2. Staff slice — cross-owner reads (`src/kernel/staff/*`, `src/db/scope.ts`, `drizzle/0006_staff_read_policies.sql`)
- **What:** A read-only kernel slice: `GET /api/staff/cases` (list + `q` search over org name / EIN /
  plan name, `planType`/`status` filters, capped pagination + `total`), `GET /api/staff/cases/:id`
  (answers + org + plan + parties + documents + `pdfHash`; never the storage key), and
  `…/:id/pdf` (reuses the stream/signed-url path). All gated by `requireStaff`. A new
  `withStaffScope(db, userId, fn)` mirrors `withUserScope` but also stamps a tx-local `app.is_staff`
  GUC; migration `0006` adds **permissive `FOR SELECT` policies** (`org_staff`/`plan_staff`/
  `cases_staff`) keyed on it. `document`/`party` carry their own `*_staff` policies (0004/0005).
- **Why:** RLS scopes by `owner_id`, which is wrong for staff. The API role-gate is the primary wall;
  the additive staff SELECT policy keeps RLS as a second wall (and proves in pglite/CI). Postgres ORs
  permissive policies, so owner isolation is untouched: a non-staff session never sets `app.is_staff`
  → `current_setting(...,true)` is NULL → the staff policies contribute nothing. **`*_staff` are
  SELECT-only**, so staff stay read-only at the DB wall too.
- **Tenant note:** user↔org membership is deferred, so today `owner_id` is the tenant boundary and
  staff read **all** cases in this single-TPA deployment. **Swap point:** when membership lands, the
  staff RLS predicate + the list query swap to a tenant filter — same place `org_owner` swaps.

### 3. `document` table — replaces pdf_path (`db/schema/kernel.ts`, `kernel/documents/*`, `drizzle/0004`, `drizzle/0007`)
- **What:** `document(id, case_id→cases, organization_id→organization, type, storage_key, sha256,
  signed_at, created_at)` — FKs toward the kernel; `organization_id` denormalized so RLS scopes by
  org exactly like `cases`. `signed_at` is signature-workflow prep. `DocumentStore` writes/reads it;
  `CaseService.create` stores an `onboarding_package` document instead of `cases.setPdf`, and
  `getPdf`/`getPdfSignedUrl`/`getOnboardingHash` read it. `GET /api/cases/:id` still returns
  `pdfHash`, now sourced from the document (response contract unchanged). Expand/contract: `0004`
  creates the table + **backfills** one document per existing case with a `pdf_path`; `0007` **drops**
  `cases.pdf_path`/`pdf_hash` (single-instance atomic deploy; reverse SQL in the migration headers).
- **Why:** A case will accrue multiple documents (service agreement, signed copies); a single string
  can't model that, nor carry `signed_at`. The staff view + signature workflow are the evidence.

### 4. `party` table — contacts out of JSONB (`db/schema/kernel.ts`, `kernel/parties/projection.ts`, `kernel/cases/store.ts`, `drizzle/0005`)
- **What:** `party(id, organization_id→organization, source_case_id→cases, role, name, email, phone,
  title, is_authorized_signer, created_at)`, deduped by a **partial functional** unique index
  `(organization_id, role, lower(email)) where email present` (hand-written; Drizzle can't model it
  — flagged in `kernel.ts`). On every submission, `projectParties()` runs **inside the case-insert
  transaction** (atomic, owner-scoped): singular contacts (primary_contact, advisor, payroll, ach,
  trustee) + the repeating-row tables (additionalContacts/Trustees/Advisors via the shared
  `parseTable`) are read-then-write upserted (the partial functional index isn't an `ON CONFLICT`
  target). **Raw contacts stay in `answers` for the PDF** — `party` is the normalized copy, mirroring
  `organization.ein` vs `answers.ein`. **Going-forward only** — no historical backfill.
- **Why:** The upcoming payroll + advisor modules need structured contacts — the "second module needs
  it" trigger to promote into the kernel. Re-submitting an org reuses each canonical person.

### 5. Web — role plumbing + dashboard (`apps/web/src/{auth-context,auth,api,App}.tsx`, `components/Staff*.tsx`)
- **What:** `AuthState` gains `role` (from `session.user.app_metadata.role`; `admin` when un-gated).
  `api.ts` adds `listStaffCases`/`getStaffCase`/`openStaffCasePdf` (fetch-to-blob, like `openCasePdf`).
  `App.tsx` adds a lightweight `#staff` **hash route** (no router — mirrors the existing `case=`
  convention) and a role-gated **Staff** nav link. `StaffDashboard` (debounced search, filters,
  paged table) + `StaffCaseDetail` (a drawer that re-renders the submission read-only via the shared
  `getPlan`/`isVisible`/`displayValue` — what staff see is what the PDF prints).
- **Why:** Reuse the shared schema for the detail view; keep the client pick→fill→done flow intact.

## Key files
- `apps/api/src/auth/{verify,guards,plugin,types}.ts`, `apps/api/src/config.ts`, `apps/api/src/app.ts`
- `apps/api/src/db/{scope}.ts`, `apps/api/src/db/schema/kernel.ts`
- `apps/api/src/kernel/{documents,parties,staff}/*`, `apps/api/src/kernel/cases/{store,service,routes}.ts`
- `apps/api/drizzle/0004_document_table.sql`, `0005_party_table.sql`, `0006_staff_read_policies.sql`, `0007_drop_case_pdf_columns.sql`
- `apps/web/src/{auth-context,auth,api,App}.tsx`, `apps/web/src/components/{StaffDashboard,StaffCaseDetail}.tsx`
- `apps/api/tests/staff.test.ts`

## Verify (DoD)
- `pnpm -r typecheck && pnpm lint && pnpm -r build && pnpm --filter api test` (33 API tests, pglite) + `pnpm smoke`.
  - `staff.test.ts`: unauthenticated → 401; verified non-staff → **403**; staff/admin → 200; list spans
    both owners; `?q=` + `planType=` filter; detail returns answers + a `primary_contact` party + 64-hex
    `pdfHash`; `…/pdf` streams `%PDF`; unknown id → 404; **owner isolation unchanged** (non-owner still
    404 on `/api/cases/:id`; `withUserScope` hides other owners while `withStaffScope` sees all).
  - `cases.test.ts` green: `pdfHash` now sourced from the document; party projection runs on create.
- Live (un-gated dev): API `AUTH_BYPASS=1`, web with no `VITE_SUPABASE_*`. Submit still works + `#case=`
  reloads; the **Staff** link shows (role `admin`), the dashboard lists/searches, detail opens, PDF streams.

## Deferred
- user↔org membership / multi-tenant TPA (the staff RLS predicate + list query are the swap point).
- Historical party backfill (going-forward only); exploding documents beyond `onboarding_package`.
- `pg_trgm` GIN index on `organization.name`/`plan.name` if `ilike '%q%'` search ever hurts at scale.
- ~~Signature finalization writing `document.signed_at` + the append-only audit log keyed on `sha256`.~~
  Done — see `specs/2026-06-signature-finalization.md` (`signature_event` table, migration `0008`).

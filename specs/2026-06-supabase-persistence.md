# Spec: Supabase persistence + Azure-VM deploy (Phase 2 → production)

Status: implemented · Branch: `feat/supabase-persistence` · Date: 2026-06-19

Makes the Phase-2 spine real and deployable: the API points at **Supabase Postgres**, PDFs
live in **Supabase Storage**, and the app deploys on an **Azure VM behind nginx at
`/onboarding`** alongside an existing site. The zero-config local path (pglite + local files)
is untouched — Supabase is selected purely by env presence.

## What changed & why

### 1. `SupabaseStorage` behind the existing `PdfStorage` interface (`src/storage.ts`)
- **What:** New `SupabaseStorage` (uses `@supabase/supabase-js` with the service-role key):
  `put()` uploads to a private bucket, `get()` downloads bytes, and a new optional
  `signedUrl()` mints a short-lived URL. `createStorage()` returns it when
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_STORAGE_BUCKET` are all set,
  else `LocalPdfStorage` (unchanged).
- **Why:** Production object storage behind the same seam; the key stays server-side
  (invariant 4). Mirrors the env-driven DB-driver pattern.

### 2. SHA-256 of every PDF (Phase 4 audit-log prep)
- **What:** New nullable `cases.pdf_hash` column (migration `0001`). `service.create()`
  computes `sha256(bytes)`; `store.setPdf()` persists path + hash; `GET /api/cases/:id`
  returns `pdfHash`.
- **Why:** Document-integrity metadata for the eventual append-only signature audit log;
  cheap to record now, painful to backfill later.

### 3. PDF serve mode (`stream` default, `signed-url` optional)
- **What:** `GET /cases/:id/pdf` streams bytes through the API by default; with
  `PDF_SERVE_MODE=signed-url` it 302s to a Supabase signed URL (falls back to streaming if
  the backend can't sign, e.g. local).
- **Why:** Streaming keeps PDFs same-origin under the `/onboarding` subpath; signed URLs are
  an egress-saving opt-in. Either way the SPA only knows the API URL.

### 4. Postgres driver hardening (`src/db/client.ts`)
- **What:** `postgres(url, { prepare: false })`. SSL comes from `?sslmode=require` in the URL.
- **Why:** Works with both Supabase pooler modes (transaction pooler can't reuse named
  prepared statements); negligible cost for our tiny query set.

### 5. Standalone migrate command
- **What:** `src/db/migrate-run.ts` + `pnpm --filter api db:migrate`.
- **Why:** Run/verify migrations against Supabase as a deploy step (boot-time migration stays).

### 6. Web: subpath build
- **What:** `vite.config.ts` `base = process.env.VITE_BASE ?? '/'`. Build for prod with
  `VITE_BASE=/onboarding/ VITE_API_URL=/onboarding`. No app-code change.
- **Why:** Serve the SPA under `/onboarding` behind nginx; the relative `VITE_API_URL` keeps
  it origin-independent. Local dev (root + `localhost:3001`) is unchanged.

### 7. Deploy config + guide
- **What:** `docs/DEPLOY.md` (Supabase setup → VM install → env → migrate → systemd → SPA →
  nginx → verify), plus copy-paste samples in `deploy/` (`nginx-onboarding.conf`,
  `onboarding-api.service`, `onboarding-api.env.example`) and an optional `apps/api/Dockerfile`.
- **Why:** Reproducible deploy that mounts a separate app at `/onboarding` on the existing
  domain without touching the existing site (beyond two nginx `location` blocks).

## Key files
- `apps/api/src/{config,storage}.ts`, `apps/api/src/db/{client,migrate-run}.ts`
- `apps/api/src/db/schema/kernel.ts`, `apps/api/drizzle/0001_*.sql`
- `apps/api/src/kernel/cases/{store,service,routes}.ts`, `apps/api/src/app.ts`
- `apps/api/package.json` (`@supabase/supabase-js`, `db:migrate`), `apps/api/.env.example`
- `apps/web/vite.config.ts`, `apps/web/.env.example`
- `docs/DEPLOY.md`, `deploy/*`, `apps/api/Dockerfile`, `.dockerignore`
- `apps/api/tests/cases.test.ts` (Config literal + `pdf_hash` assertion)

## Verify (DoD)
- `pnpm -r typecheck && pnpm lint && pnpm -r build && pnpm -r test` (5 API tests, pglite).
- Subpath build emits `/onboarding/...` asset URLs (`VITE_BASE` verified).
- Live: case created on the deployed app persists in Supabase (`cases.pdf_hash` populated) and
  its PDF is served from Supabase Storage; local dev runs with zero config.

## Deferred
- **Phase 3 (ask-once cross-session):** look up existing org/plan and pre-fill the delta.
- **Phase 4:** Supabase Auth populates `owner_id`; append-only signature audit log keyed on
  `pdf_hash`; RLS by `organization_id`. (`verify-full` SSL + a Storage retention policy fit here.)

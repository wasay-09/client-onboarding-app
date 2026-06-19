# Spec: Identity + tenant isolation (Phase 4 — auth)

Status: implemented · Branch: `feat/identity-tenant-isolation` · Date: 2026-06-19

Turns on **Supabase Auth**. The web app signs in (email + password) and sends the user's JWT to
**our own API** (never to Supabase directly — invariant 4); Fastify verifies it and attaches the
caller. The previously-empty ownership columns are now **populated on create**, every read is
**scoped to the caller's own organization**, and **Postgres Row-Level Security** enforces the same
boundary at the DB as defense-in-depth. Business logic stays in the API; RLS is the second wall.
Local dev stays zero-config: with no Supabase env the web runs un-gated and the API honours an
explicit `AUTH_BYPASS`.

## What changed & why

### 1. JWT verification (`src/auth/verify.ts`, `src/auth/plugin.ts`, `src/auth/types.ts`)
- **What:** A `jose`-based verifier picks its key source once: `SUPABASE_JWT_SECRET` set → HS256
  with the shared secret; else JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (asymmetric
  keys). It checks signature, `exp`, and `aud="authenticated"`, and yields `{ id, email }`. A
  Fastify `onRequest` hook gates every route except `GET /health` + CORS preflight, replying `401`
  when the bearer token is missing/invalid, else setting `request.user`.
- **Why:** We verify the Supabase token ourselves (invariant 4) and deliberately avoid Supabase's
  `auth.uid()` / `request.jwt.claims` so the auth layer stays portable and testable offline. The
  dual key source means the same code works whether the project uses the legacy secret or new
  asymmetric signing keys.

### 2. Ownership populated + reads scoped (`kernel/cases/{store,service,routes}.ts`)
- **What:** Service/store methods take a `userId`. `create()` stamps `organization.owner_id` and
  `cases.owner_id`. `get()` filters by org ownership (a join on `organization.owner_id = userId`).
  Routes read `request.user.id`; a case the caller doesn't own returns `404` (not `403` — don't
  leak existence). The PDF route is scoped the same way.
- **Why:** Primary tenant isolation is the API's job (invariant: business logic in one place). A
  user is the owner of the organizations they create; user↔org membership is deferred (invariant 7).

### 3. Row-Level Security (`src/db/scope.ts`, `drizzle/0002_rls_org_isolation.sql`)
- **What:** Migration `0002` adds a non-bypass role `app_authenticated`, enables RLS on
  `organization`/`plan`/`cases`, and adds policies keyed on a tx-local GUC `app.current_user_id`
  (org scoped by `owner_id`; plan/cases scoped by `organization_id`). `withUserScope(db, userId,
  fn)` runs every DB op in a transaction that first `SET LOCAL ROLE app_authenticated` +
  `set_config('app.current_user_id', …, true)`, so the policies apply.
- **Why:** The API connects as a privileged role that bypasses RLS, so the role drop is what makes
  the policies bite. `SET LOCAL` / `set_config(is_local=true)` are transaction-scoped → safe under
  the Supabase transaction pooler. The mechanic is identical in pglite and Supabase, so RLS is
  proven in CI with zero infra.

### 4. Config + safety rail (`src/config.ts`)
- **What:** New `supabaseJwtSecret`, `authBypass`, `devUserId`. `AUTH_BYPASS=1` skips verification
  and acts as `devUserId` for local dev. `loadConfig()` **refuses to start** if bypass is on while
  `DATABASE_URL` is set.
- **Why:** A dev escape hatch that can never silently disable auth against a real (Supabase) DB.

### 5. Web: sign-in + JWT on API calls (`apps/web/src/*`)
- **What:** `supabase.ts` (configured-or-null client), `auth-context.ts` + `auth.tsx`
  (`AuthProvider`/`useAuth`), `AuthGate.tsx`, `components/SignIn.tsx` (email + password with
  sign-up). `api.ts` attaches `Authorization: Bearer <token>` and the PDF download fetches with the
  header (a plain `<a href>` can't); `App.tsx` re-prompts sign-in on `401` instead of silently
  falling back to local generation, and shows the signed-in email + Sign out.
- **Why:** The SPA authenticates with Supabase but only ever calls our API. When Supabase env is
  absent the gate is skipped so local dev pairs with `AUTH_BYPASS`.

## Key files
- `apps/api/src/auth/{verify,plugin,types}.ts`, `apps/api/src/app.ts`
- `apps/api/src/db/scope.ts`, `apps/api/drizzle/0002_rls_org_isolation.sql`
- `apps/api/src/kernel/cases/{store,service,routes}.ts`, `apps/api/src/config.ts`
- `apps/api/package.json` (`jose`), `apps/api/.env.example`, `deploy/onboarding-api.env.example`
- `apps/web/src/{supabase,auth-context,auth,AuthGate,api,App}.tsx?`,
  `apps/web/src/components/SignIn.tsx`, `apps/web/src/main.tsx`
- `apps/web/package.json` (`@supabase/supabase-js`), `apps/web/.env.example`
- `apps/api/tests/{cases,rls,config}.test.ts`

## Verify (DoD)
- `pnpm -r typecheck && pnpm lint && pnpm -r build && pnpm -r test` (17 API tests, pglite).
  - `cases.test.ts`: unauthenticated → 401; forged token → 401; `/health` public; cross-user
    read/PDF → 404; owner → 200.
  - `rls.test.ts`: a raw scoped `SELECT * FROM cases` returns the owner's row and **0 rows** for a
    non-owner; a non-owner INSERT into the owner's org is rejected (WITH CHECK).
  - `config.test.ts`: `AUTH_BYPASS` + `DATABASE_URL` refused.
- Live: with Supabase Auth on, two users can't see each other's cases; logged-out → 401. Local dev
  runs with `AUTH_BYPASS=1` (API) + no `VITE_SUPABASE_*` (web).

## Deferred
- User↔org membership / multi-user orgs (promote on evidence — swap the `owner_id` check in the RLS
  policies + the `get()` join for a membership lookup).
- Signature finalization + append-only audit log keyed on `pdf_hash` (the other half of Phase 4).
- Role tiers (admin vs client), OAuth/magic-link sign-in, password reset.

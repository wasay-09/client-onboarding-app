# Spec: Server-side signature finalization + append-only audit log (Phase 4)

Status: implemented · Branch: `feat/signature-finalization` · Date: 2026-06-20

Completes Phase 4's second half (ROADMAP): a signed agreement becomes a **tamper-evident
server record tied to an authenticated user**, backed by an **append-only audit log** for
ESIGN/UETA validity. Builds directly on the client-side consent/e-signature capture from
`specs/2026-06-signature-workflow.md` (which left this explicitly "Deferred — needs a
backend") and consumes the `document` table from
`specs/2026-06-staff-view-and-kernel-normalizations.md` (whose `signed_at`/`sha256` were
called "signature-workflow prep").

## What changed & why

### 1. `signature_event` — the append-only audit log (`db/schema/kernel.ts`, `drizzle/0008`)
- **What:** A new kernel table — `id`, `document_id→document`, `case_id→cases`,
  `organization_id→organization` (denormalized so RLS scopes by org like `document`),
  `event_type`, `signer_user_id` (the authenticated caller = identity binding),
  `signer_name`/`signer_title`/`signer_email` (email from the verified JWT), `method`,
  `consented` + `consent_at`, `document_sha256` (a **frozen copy** of the signed PDF's
  hash), `ip`, `user_agent`, `created_at` (the audit timestamp). FKs point only toward the
  kernel. Migration `0008` is self-contained (table + grants + RLS + policies + reverse
  SQL header), mirroring `0004`/`0006`.
- **Append-only at the DB wall:** the migration grants `app_authenticated` only
  `SELECT, INSERT` (deliberately **no UPDATE/DELETE**), so a row can never be altered or
  removed after the fact — enforced by Postgres, not merely by app convention. RLS:
  `signature_event_by_org` (owner SELECT+INSERT, scoped by org ownership) +
  `signature_event_staff` (cross-owner `FOR SELECT`, keyed on the `app.is_staff` GUC).
- **Tamper-evidence:** `document_sha256` is the SHA-256 of the exact server-made PDF that
  embeds the captured signature. Re-hashing the stored bytes and comparing to the immutable
  audit row detects any change — and the row keeps its own hash copy even if the `document`
  row were touched by someone with elevated access. Why ESIGN/UETA: §7 requires recorded
  signer + method + IP + user-agent + timestamp + document hash — all captured here.

### 2. Finalization folded into `POST /api/cases` (`kernel/cases/service.ts`, `routes.ts`)
- **What:** The signature already rides in `answers` and the server already renders +
  hashes the canonical PDF (which embeds the signature image) — so finalization happens in
  the same submit, no new endpoint or web rework. `deriveSignatureEvents(planType, answers)`
  re-derives, **server-side**, which finalized events the submission carries (invariant 3 —
  never trust the client to declare "signed"): an `sla_signature` only when consented +
  authorized + named + drawn/typed + acknowledged; a `data_certification` when the accuracy
  box is checked and signed by name. A 401(k)/403(b) submission can yield **both**; the
  delegate path (`slaSignerAuthorized = No`) is "pending route", **not** a finalized
  signature → no event.
- **Atomic write:** `DocumentStore.create(input, events, ctx, userId)` now inserts the
  `document` AND the audit event(s) in **one `withUserScope` transaction**, so a signed
  document and its tamper-evident record are written together or not at all. An
  `sla_signature` also stamps `document.signed_at`; a certification leaves it null (it
  attests data accuracy — it is not an executed agreement).
- **Identity + request capture:** `signer_user_id` = the verified `request.user.id`;
  `signer_email` = the JWT email; `ip` = `request.ip`; `user_agent` = the request header.

### 3. `TRUST_PROXY` so the audit IP is real (`config.ts`, `app.ts`, deploy)
- **What:** New `TRUST_PROXY` env → Fastify `trustProxy`. ON in the nginx deploy (which
  already forwards `X-Forwarded-For`/`X-Real-IP`), so `request.ip` is the real client, not
  the loopback. OFF locally/when the API is exposed directly, so a caller can't spoof its
  own IP. Added to `deploy/onboarding-api.env.example` + a `docs/DEPLOY.md` Step-3 note.

### 4. Reading the record (owner + staff)
- **Owner** (`GET /api/cases/:id`): a new `signature` summary — `{ signed, events: [{
  eventType, signerName, signerTitle, method, consented, documentSha256, createdAt }] }`.
  Deliberately **omits IP/user-agent** (that audit metadata is for staff). `SignatureStore`
  is the owner read surface (RLS-scoped `listByCase`).
- **Staff** (`GET /api/staff/cases/:id`): a `signatureEvents` array with the **full** trail
  incl. IP/user-agent/signer-account, read via `withStaffScope` + the `*_staff` SELECT
  policy. `StaffCaseDetail.tsx` renders it as a read-only "Signature Audit Trail" section.

## Key files
- `apps/api/src/db/schema/kernel.ts`, `apps/api/drizzle/0008_bitter_apocalypse.sql`
- `apps/api/src/kernel/signatures/{derive,store,index}.ts` (new slice)
- `apps/api/src/kernel/documents/store.ts` (atomic document + events)
- `apps/api/src/kernel/cases/{service,routes,index}.ts`, `apps/api/src/{config,app}.ts`
- `apps/api/src/kernel/staff/{store,routes}.ts`
- `apps/web/src/api.ts`, `apps/web/src/components/StaffCaseDetail.tsx`
- `apps/api/tests/signatures.test.ts`
- `deploy/onboarding-api.env.example`, `docs/DEPLOY.md`

## Verify (DoD)
`pnpm -r typecheck && pnpm lint && pnpm -r build && pnpm --filter api test && pnpm smoke`.
- `signatures.test.ts` (7 tests, pglite): a 401(k) with a completed signature → 201, the
  case reports `signed: true` with `sla_signature` + `data_certification` events whose
  `documentSha256` equals the `pdfHash`; `document.signed_at` is set; audit rows are bound
  to the user (`signer_user_id`, `signer_email`) and carry the request IP (from
  `X-Forwarded-For` via `trustProxy`) + user-agent. **Append-only**: a raw `UPDATE`/`DELETE`
  on `signature_event` as `app_authenticated` is rejected at the grant. A 457(b) records a
  `data_certification` only (document stays unsigned). The delegate path writes no events.
  Tenant isolation: another owner gets 404 on the case and zero events under RLS.
- DoD met: a signed agreement is a tamper-evident server record (immutable audit row + the
  exact PDF's SHA-256) tied to an authenticated user.

## Deferred (next signature increment — NOT built)
- Emailing a signing link to a delegated signer + a dedicated `POST /cases/:id/sign`
  ceremony (today the delegate path still only "captures intent + marks pending").
- Multi-party routing; later signature events (plan documents, custodial/MATC, advisor RIA).
- Recording a typed-vs-drawn distinction on `method` (kept generic — ESIGN doesn't require
  it); embedding a third-party ESIGN vendor (e.g. Anvil) if stronger identity proofing is
  needed than account auth + consent + audit.

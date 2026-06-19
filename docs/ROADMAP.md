# Roadmap — phased build order

> Each phase ships and is independently verifiable. **Do not start a phase until the previous
> phase's Definition of Done is green.** Phase gates are what keep each step low-risk and
> reversible. Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) first.

## Phase 0 — Foundations (no app code)
**Goal:** decisions are written down so they can't erode.
- These `docs/` exist and are agreed: ARCHITECTURE, MODULE_PLAYBOOK, ROADMAP, AI_WORKFLOW.
- `CLAUDE.md` points to them and lists the invariants (already done).
- **DoD:** you (and the client, in plain language) have signed off on the approach.

## Phase 1 — Monorepo extract (zero behavior change)
**Goal:** restructure without changing what the app does.
- Introduce pnpm workspaces. Move the current app to `apps/web`.
- Extract `schema/`, `pdf/`, `types.ts`, `visibility.ts` into `packages/shared`; `apps/web` imports it.
- Add ESLint boundary rule (no cross-module deep imports) and GitHub Actions CI (typecheck + lint + build).
- Install the local auto-check hook (`.claude/settings.json` + `.claude/hooks/check.sh`) — ready snippet in AI_WORKFLOW.md.
- Create the `.claude/skills/new-module` skill (see AI_WORKFLOW.md).
- **DoD:** `pnpm -r build` passes; the app runs and behaves **exactly** as before.

## Phase 2 — API + persistence (minimal spine only)
**Goal:** a submission survives a refresh; PDF is server-made.
- Stand up `apps/api` (Fastify) + Supabase Postgres + Drizzle.
- Build **only the minimal kernel**: `organization`, `plan`, `case`, `answers` (JSONB), ownership columns.
  **Do not** model module tables (contacts, documents, signatures) yet — they arrive with their modules.
- Endpoints: `POST /cases` (validate via shared `validate()`, generate + store PDF, return id + URL),
  `GET /cases/:id`. Frontend posts instead of generating locally.
- **DoD:** create a case, refresh the browser, reload it from the API; PDF served from storage.

## Phase 3 — Ask-once across sessions ✅
**Goal:** the "ask once" payoff goes cross-session.
- ✅ Look up an existing organization/plan and pre-fill known fields; collect only the delta.
  EIN is the org's per-owner natural key (normalized, `UNIQUE(owner_id, ein)`); `POST /cases` reuses
  the org + plan instead of duplicating; `GET /cases/latest` feeds a pre-fill + review form.
  See `specs/2026-06-ask-once-across-sessions.md`.
- **DoD:** ✅ a returning user is not re-asked fields already on record; ✅ no duplicate orgs created.

## Phase 4 — Auth + signature finalization
**Goal:** identity + legally meaningful signatures.
- ✅ Turn on Supabase Auth (ownership columns from Phase 2 are now populated). Web sends the JWT to
  our API; the API verifies it, scopes reads by org, and Postgres RLS enforces the same boundary as
  defense-in-depth. See `specs/2026-06-identity-tenant-isolation.md`.
- ✅ Server-side signature finalization + append-only audit log (signer, method, IP, user-agent,
  timestamp, document hash). Finalization is folded into `POST /cases` (the signature already
  rides in `answers`); `signature_event` is append-only at the DB grant and freezes the signed
  PDF's SHA-256. See `specs/2026-06-signature-finalization.md`.
- **DoD (auth):** ✅ an authenticated user sees only their org's data; unauthenticated + cross-org
  requests are rejected; RLS enforced.
- **DoD (signatures):** ✅ a signed agreement is a tamper-evident server record tied to an authenticated user.

## Ongoing — client modules (repeat the playbook)
Each module the client delivers (payroll, census, funds, advisor, service agreement, auto-enroll…)
is a single pass through [`MODULE_PLAYBOOK.md`](./MODULE_PLAYBOOK.md): spec → fields → data
placement → store/service/routes → register → test → verify. Additive and isolated by design.

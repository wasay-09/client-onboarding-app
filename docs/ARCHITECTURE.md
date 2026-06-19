# Architecture — Backend, Database & Modular System (Phase 2+)

> **Read this first.** This is the durable plan for turning the Phase-1 client-side app
> into a persistent, multi-module product. It is written so a fresh Claude Code session can
> implement any part of it without re-deriving the design.
>
> Companion docs:
> - [`MODULE_PLAYBOOK.md`](./MODULE_PLAYBOOK.md) — how to build **one** module (follow for every new part)
> - [`ROADMAP.md`](./ROADMAP.md) — the phased build order with a definition-of-done per phase
> - [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) — how to work in this repo with Claude Code coherently

---

## 1. The problem this design is solving

Three facts shape every decision below:

1. **Requirements are emergent.** The client delivers the product **one module at a time** and
   does not yet know the full set of modules or flows. The backend and database **will** change
   frequently, and sometimes structurally.
2. **The data is connected.** This is a financial product. Modules (plan, payroll, census, funds,
   advisor, service agreement, signatures) reference the same employer, plan, and people. Data is
   **not** cleanly separable, and we don't yet know all the relationships.
3. **A solo dev builds it with Claude Code.** The stack must be mainstream and strongly typed so
   the AI is fluent in it and the compiler catches mistakes.

**Design goal:** the cost of a change must be **proportional to its conceptual size**, never to
how much code already exists. A small request ("add 10 fields to the census form") must stay a
small edit. Connected data and unknown future modules are **absorbed**, not feared.

---

## 2. Strategy in one paragraph

A **modular monolith**: one repository, one deployable backend, one PostgreSQL database — with
**hard internal boundaries** between modules and a **single shared schema package** as the
contract. Each module is built independently (its own folder, branch, spec) but integrates by
*registration*, not by wiring up a new system. Connected data lives in a small **shared kernel**
that modules reference; modules never reach into each other. We do **not** use microservices —
splitting unknown, connected, financial data across services/databases now would force
distributed joins and transactions and is the fastest path to integrity bugs and merge hell.

Why this fits the three facts: schema-driven fields + JSONB answers make the *frequent* changes
free; module boundaries make *new* modules additive; a single relational DB lets *relationships*
emerge and be enforced by Postgres as we learn them.

---

## 3. Tech stack (chosen for the project **and** for AI fluency)

Every choice is mainstream, heavily represented in training data, stable, and TypeScript-first
so the compiler is a safety net for AI-written code.

| Layer | Choice | Why this + why AI-friendly |
|---|---|---|
| Language | **TypeScript everywhere** | One language across web/api/pdf; the schema package is literally shared. Compiler catches AI mistakes. |
| Monorepo | **pnpm workspaces** (Turborepo optional later) | Shared types in one place = no drift. Conventional, well-documented. |
| Frontend | **React + Vite** (existing → `apps/web`) | Already built and working. AI is extremely fluent. |
| Backend | **Node + Fastify** (`apps/api`) | Mature, typed, huge ecosystem, tons of examples. Plain request/response is easy for AI to reason about. |
| Shared | **`packages/shared`** | Field schema, types, validation, PDF components — the single contract. |
| Database | **PostgreSQL via Supabase** | Relational integrity for connected financial data. Supabase = managed Postgres + Auth + Storage with good security defaults. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Pure-TS schema, types flow to the app, first-class JSONB, SQL-close, reversible migrations. (Prisma is the more conservative AI-familiar alternative if preferred.) |
| Validation | Existing **schema-driven `validate()`** for answers; **Zod** for API request/response envelopes | Answers keep one source of truth (the field schema); Zod guards the structural API contract. |
| Auth | **Supabase Auth** (deferred — see Roadmap) | Don't hand-roll auth on PII. Design ownership columns from day one. |
| File storage | **Supabase Storage** (S3-compatible) | Generated/signed PDFs live here; DB stores metadata + hash. |
| PDF | **@react-pdf/renderer**, server-side, from `packages/shared` | Runs in Node; the canonical/signed PDF is server-made, not client-made. |
| Testing | **Vitest** | Integrates with the Vite/TS toolchain; AI is fluent. |
| CI | **GitHub Actions** | typecheck + lint + build + test gate on every branch. |
| Hosting | web → **Cloudflare Pages/Vercel**; api → **Railway/Render/Fly**; db/auth/storage → **Supabase** | All have free tiers and first-class docs. |

> **The one rule that makes Supabase safe:** Supabase is *infrastructure*, not *architecture*.
> The frontend talks **only to our Fastify API**, never directly to Supabase. All business logic
> lives in the API (reusing `validate()` and the PDF components). Row-Level Security is
> defense-in-depth, not where logic lives. This keeps logic in one place and the system portable.

---

## 4. Target repo layout

```
client-onboarding-app/
  apps/
    web/                  # current Vite app (imports packages/shared)
    api/                  # Fastify service
      src/
        modules/<name>/   # one folder per module (see MODULE_PLAYBOOK.md)
        kernel/           # shared-kernel tables + services (org, plan, case, parties)
        db/               # drizzle schema, migrations, client
        app.ts            # builds the server, registers module routers
  packages/
    shared/               # types.ts, schema/, pdf/, visibility.ts  ← the contract
  docs/
    ARCHITECTURE.md  MODULE_PLAYBOOK.md  ROADMAP.md  AI_WORKFLOW.md
    adr/                  # optional: graduate the Decision Log below into per-file ADRs
  specs/                  # one short spec per change (existing convention)
  .claude/
    skills/new-module/    # custom scaffolder skill (created in Phase 1)
```

---

## 5. The data model: stability tiers + the shared kernel

Sort **every** piece of data into one of three tiers by how often it changes and how expensive
that change is. Route frequent change into the cheap tiers; keep the expensive tier tiny.

| Tier | What lives here | Change frequency | Cost |
|---|---|---|---|
| **2 — Answers** | All questionnaire fields, as **JSONB** keyed by `FieldDef.name` | Constant | ~Free — edit `schema.ts`, **no migration** |
| **1 — Module tables** | Each module's own tables (e.g. census rows, fund lineup) | Per module | Additive & isolated — new tables, nothing existing moves |
| **0 — Shared kernel** | `organization`, `plan`, `case`, `parties/contacts`, ownership | Rare (by design) | Expensive — so kept small and governed |

### The shared kernel = the connective tissue for connected data

```
                 ┌─────────────────────────────┐
                 │        SHARED KERNEL        │  ask-once identity:
                 │  organization · plan ·      │  one canonical row per
                 │  case · parties/contacts    │  real-world thing
                 └──────────────┬──────────────┘
       ┌──────────────┬─────────┼─────────┬───────────────┐
       ▼              ▼         ▼          ▼               ▼
  ┌─────────┐   ┌─────────┐ ┌───────┐ ┌─────────┐   ┌───────────┐
  │ payroll │   │ census  │ │ funds │ │ advisor │   │  service  │
  │ module  │   │ module  │ │module │ │ module  │   │ agreement │
  └─────────┘   └─────────┘ └───────┘ └─────────┘   └───────────┘
  modules reference the kernel via foreign keys — never each other directly
```

**Rules for connected data:**
1. **One canonical record per real-world thing.** The employer is one `organization` row,
   referenced everywhere. Never copy "employer name" into module tables — duplication is rot.
2. **Foreign keys point *toward* the kernel, never between peer modules.** Postgres enforces
   integrity. A web of FKs *between* modules is the coupling we forbid.
3. **Cross-module data goes through the owning module's service API**, never by reading its tables.
4. **Promote on the "second module" signal.** When a *second* module needs data currently inside
   one module, that's the trigger to lift it into the kernel. We don't predict what's shared — we
   observe it and promote. This is how we survive "I don't know the relationships yet."

### Why this absorbs frequent + major change
- **Frequent (add/change fields):** Tier 2 JSONB → schema edit, no migration.
- **New module:** Tier 1 → additive folder + its own tables + migration; existing modules untouched.
- **Structural ("a case can have multiple plans"):** a Drizzle migration, blast radius bounded by
  the API contract. In the monorepo, a breaking change is a **compile error** — TypeScript lists
  every call site to fix. Use **expand/contract** (add new → backfill → switch reads → drop old)
  so big changes never need a big-bang. Cross-module atomic operations are **one Postgres
  transaction** (ACID) — the integrity guarantee finance needs, free in a single DB.

---

## 6. Non-negotiable invariants

These hold regardless of which module is being built. Violating one requires a Decision Log entry.

1. **One source of truth for fields** — declared once in `packages/shared`. Never redefined in API, DB, or PDF.
2. **The schema is the contract** — web, api, and pdf import `packages/shared`; types flow from there.
3. **Validate on the server** — the API re-runs the shared `validate()`. Never trust the client.
4. **Frontend talks only to our API** — never directly to Supabase/DB.
5. **JSONB for answers, columns for the kernel** — only shared/queried/constrained data becomes a column.
6. **Modules reference the kernel, never each other's tables** — cross-module access via service APIs; FKs toward the kernel.
7. **Promote to a real table only on evidence** — when you need to query, join, constrain, or share it.
8. **Every change ships with a spec** (`specs/`); decisions change → add to the Decision Log / `docs/adr/`.
9. **Nothing merges without** typecheck + lint + build (+ tests) passing.

The strongest invariants are **machine-enforced**: typecheck, an ESLint boundary rule (no
cross-module deep imports), and the CI gate. Encode rules there, not just in prose.

---

## 7. Security & PII baseline (financial data)

The employee census will eventually contain **SSNs and DOBs**. From day one:
- TLS everywhere; encryption at rest (Supabase default).
- Postgres **Row-Level Security** scoped by `organization_id` (defense-in-depth).
- An **append-only audit log** for signatures (signer, method, IP, user-agent, timestamp, document hash) — required for ESIGN/UETA validity.
- **Minimize SSN storage** — don't persist an SSN unless a downstream step truly needs it; if so, isolate it.
- Secrets in env/secret manager, never in the repo.

---

## 8. Decision Log

Concise, dated rationale so decisions don't silently erode. Graduate to `docs/adr/NNNN-*.md` if they grow.

- **2026-06 — Modular monolith, not microservices.** Unknown + connected + financial data ⇒ keep one DB for integrity, joins, and ACID; get isolation from internal module boundaries.
- **2026-06 — Monorepo + shared schema package.** Single source of truth for fields/types/validation/PDF; prevents drift between web/api/pdf.
- **2026-06 — JSONB for answers + stability tiers.** Frequent field changes must be free (no migration); only the small kernel is normalized.
- **2026-06 — Shared kernel for connected data; promote-on-evidence.** Relationships emerge; we don't model them blind.
- **2026-06 — Supabase as infrastructure; frontend talks only to our API.** Managed DB/Auth/Storage with good PII defaults, but business logic stays in one place and the system stays portable.
- **2026-06 — Stack chosen for AI fluency.** TS everywhere, Fastify, Drizzle, Vite, Vitest, GitHub Actions — mainstream, typed, well-documented.
- **2026-06 — Phase 1 monorepo extract executed.** App → `apps/web`; `types`/`schema`/`pdf` → `packages/shared`, published as **`@fbsi/shared`** — a barrel over the TS source (no build step; Vite, vite-node, and `tsc` consume the source directly). The shared internal folder layout was preserved so no shared-internal imports changed; only external consumers (web + scripts) were retargeted to `@fbsi/shared`. **Lint runs once at the repo root** (`pnpm lint`); typecheck and build run per package (`pnpm -r ...`). ESLint forbids deep `@fbsi/shared/*` imports so the package root stays the contract. Verified zero behavior change via byte-identical PDF smoke output.
- **2026-06 — Phase 2 API spine: env-driven DB driver.** `apps/api` (Fastify) selects its Drizzle driver by env: `DATABASE_URL` set → Postgres (Supabase/any) via `postgres-js`; unset → embedded **pglite** (file-persisted for dev, `:memory:` for tests). One Drizzle schema + one set of migrations serve both, and tests run against a real Postgres engine with zero external infra. This makes Supabase a deployment config detail, not a code dependency, and keeps the DoD verifiable locally.
- **2026-06 — Server-made PDF + storage interface.** The canonical PDF is rendered server-side from the same `@fbsi/shared` components (`renderToBuffer`) and persisted via a `PdfStorage` interface — `LocalPdfStorage` (filesystem) now, `SupabaseStorage` (S3-compatible) as the documented prod swap. The frontend POSTs to the API and reloads a case by id from the URL (refresh-survival); if the API is unreachable it falls back to local generation.
- **2026-06 — Supabase persistence wired + PDF hash + serve mode.** `SupabaseStorage` is implemented behind `PdfStorage` (service-role key, server-side only; private `onboarding-pdfs` bucket), selected when the `SUPABASE_*` env is present — else `LocalPdfStorage`, so local dev/tests stay zero-config. Every canonical PDF's **SHA-256 is stored** (`cases.pdf_hash`, migration `0001`) as Phase-4 audit-log prep. `GET /cases/:id/pdf` **streams** by default (same-origin); `PDF_SERVE_MODE=signed-url` opts into a short-lived Supabase URL. The postgres-js client uses `prepare:false` (compatible with both Supabase pooler modes) with SSL from `?sslmode=require`; a standalone `db:migrate` complements boot-time migration. See `specs/2026-06-supabase-persistence.md`.
- **2026-06 — Deploy topology: Azure VM + nginx subpath (overrides §9's default hosts).** The product ships under `/onboarding` on an existing domain/VM, not Cloudflare Pages + Render. nginx serves the static SPA (built with `base=/onboarding/`) and reverse-proxies `/onboarding/api/` (prefix stripped) to a local Fastify service (systemd, bound to `127.0.0.1:3001`); Supabase remains the managed DB + Storage, reached via outbound TLS. Same-origin ⇒ **no CORS** in prod and PDFs stream from our own origin (invariant 4 intact). The app stays portable — only the host changed, not the architecture. Guide: `docs/DEPLOY.md`.

---

## 9. Hosting & cost — free through development and testing

The stack runs **free** through development and closed/open testing, with a small, predictable cost
only at real launch.

| Component | Free option | Free tier (approx, 2026 — verify current limits) | Caveat | At launch |
|---|---|---|---|---|
| Web (Vite SPA) | **Cloudflare Pages** | Unlimited static bandwidth/requests | Prefer over Vercel **Hobby**, whose free tier forbids commercial use | Free |
| API (Fastify) | **Render free** (or Fly small) | 1 free web service | Spins down on idle → ~50s cold start | ~$7/mo (Render Starter) |
| DB + Auth + Storage | **Supabase free** | ~500 MB DB · 1 GB storage · 50k MAU | Project pauses after ~7 days idle (fine during active dev) | $25/mo (Pro) for always-on + backups |
| CI | **GitHub Actions** | 2,000 min/mo (private); unlimited (public) | — | Free |
| ORM / tests / lint | Drizzle · Vitest · ESLint | Open source | — | Free |

**Net: $0 through testing.** At launch, realistically **~$30/mo** (Supabase Pro + an always-on API
host); web + CI stay free.

Cost-driven cautions:
- **Vercel Hobby is non-commercial** — for a client product host the frontend on **Cloudflare Pages**
  (free, commercial-OK) or pay for Vercel Pro.
- **Supabase free projects pause when idle (~7 days)** — fine while building/testing; a beta with
  daily traffic stays awake. Move to Pro before launch.
- If keeping the API free *even at launch* matters more than Node familiarity, **Hono on Cloudflare
  Workers** is the zero-cost always-on alternative (different runtime, but our shared package still applies).

**Not locked in:** Supabase is plain Postgres (movable to Neon/RDS), the API is standard Node, the web
build is static — you can swap any one host without touching the others.

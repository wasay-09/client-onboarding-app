# Spec: Phase 1 — monorepo extract (zero behavior change)

Status: implemented · Branch: `feat/phase-1-monorepo` · Date: 2026-06-19

Restructures the single-package Vite app into a **pnpm-workspace monorepo** and stands up the
self-maintaining guardrails, per `docs/ROADMAP.md` (Phase 1) and `docs/GETTING_STARTED.md`
(Part A). **No runtime behavior changes** — fields, validation, and PDF output are identical.

## What changed & why

### 1. pnpm workspaces
- **What:** Added `pnpm-workspace.yaml` (`apps/*`, `packages/*`); root `package.json` is now the
  workspace root (`packageManager: pnpm@10.15.1`) holding orchestration + dev scripts. Replaced
  `package-lock.json` with `pnpm-lock.yaml`.
- **Why:** Shared types/schema in one place with no drift; the contract the whole product builds on.

### 2. `apps/web` — the React + Vite app
- **What:** Moved the app (`src/`, `index.html`, `vite/postcss/tailwind` configs, the three
  `tsconfig*.json`, `public/`) into `apps/web/`. New `apps/web/package.json` (name `web`) depends
  on `@fbsi/shared` via `workspace:*`. Build script unchanged (`tsc -b && vite build`).
- **Why:** Make the web app one workspace among future peers (`apps/api` in Phase 2).

### 3. `packages/shared` — the single source of truth (`@fbsi/shared`)
- **What:** Moved `types.ts`, `schema/` (incl. `visibility.ts`), and `pdf/` into `packages/shared/`.
  Added `package.json` (name `@fbsi/shared`, `exports: { ".": "./index.ts" }`), a `tsconfig.json`
  mirroring the app's options (+ `DOM` lib, since `generatePdf.tsx` uses `document`/`URL`), and a
  barrel `index.ts` that re-exports the public surface.
- **No build step:** the package exports its **TS source**; Vite, vite-node, and `tsc` consume it
  directly. The shared **internal folder layout was preserved**, so no shared-internal import
  changed — only the external consumers were retargeted (below).
- **Why:** One declaration of every field drives form + validation + PDF, importable by web today
  and api later.

### 4. Imports retargeted to the package root
- **What:** The 5 web files (`App.tsx`, `PlanPicker`, `QuestionnaireForm`, `ServiceAgreementText`,
  `fields/Field`) and the 2 root scripts (`smoke.tsx`, `generate_draft_pdfs.tsx`) now import from
  `@fbsi/shared` (the barrel), never a deep path.
- **Why:** The package root is the contract; deep imports are forbidden (see boundary rule).

### 5. Guardrails (the architecture becomes self-maintaining)
- **ESLint boundary rule** (`eslint.config.js`): `no-restricted-imports` forbids `@fbsi/shared/*`
  deep paths; a `scripts/**` override adds Node globals. Lint runs **once at the repo root**.
- **CI** (`.github/workflows/ci.yml`): on PR/push runs `pnpm -r typecheck`, `pnpm lint`,
  `pnpm -r build`. (Tests join in Phase 2.)
- **Auto-check hook** (`.claude/settings.json` + `.claude/hooks/check.sh`): on agent Stop, if
  `.ts/.tsx` changed, runs `pnpm lint && pnpm -r typecheck`.
- **`/new-module` skill** (`.claude/skills/new-module/SKILL.md`): scaffolds a module per
  `docs/MODULE_PLAYBOOK.md`.

## Key files
- `pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml` — workspace setup.
- `packages/shared/{package.json,tsconfig.json,index.ts}` — the shared package + barrel.
- `apps/web/package.json` — the web workspace.
- `eslint.config.js` — boundary rule + repo-wide lint + scripts Node globals.
- `.github/workflows/ci.yml`, `.claude/settings.json`, `.claude/hooks/check.sh`,
  `.claude/skills/new-module/SKILL.md` — guardrails.
- Retargeted imports: `apps/web/src/{App,components/PlanPicker,components/QuestionnaireForm,
  components/ServiceAgreementText,components/fields/Field}.tsx`, `scripts/{smoke,generate_draft_pdfs}.tsx`.

## Decisions (recorded in docs/ARCHITECTURE.md Decision Log)
- Single `@fbsi/shared` **barrel** (one contract) rather than deep subpath imports.
- Shared exports **TS source** (no build step) — simplest, one source of truth.
- Dev **scripts stay at the repo root** — they use `process.cwd()`, so cwd-relative I/O is unchanged.
- **Lint at root**, typecheck/build per package.

## Verify (all green; DoD)
`pnpm install` · `pnpm -r typecheck` · `pnpm lint` · `pnpm -r build` (**DoD**) ·
`pnpm smoke` → `ALL PASS` with **byte-identical** PDFs to pre-migration (401k 14887b, 403b 14892b,
457b 6401b, SIMPLE 6399b, Solo 9642b) · `pnpm --filter web dev` boots and serves the app.

## Deferred (Phase 2+)
- `apps/api` (Fastify) + Supabase Postgres + Drizzle; server-side `validate()` + PDF.
- `pnpm -r test` (Vitest) joins the CI gate once the first tests land.
- Module-to-module boundary enforcement (beyond the shared-package rule) when modules exist.

# Deploy — Azure VM (Ubuntu) + nginx, mounted at `/onboarding`

How to run this app in production alongside an **existing, separate site** on the same
Azure VM and domain, with **Supabase** (managed Postgres + Storage) as the data layer.
The onboarding app stays an independent process; it only shares the **domain** and the
**nginx** that already fronts your site.

```
              Azure VM  (one public IP, your existing TLS cert)
              ┌────────────────────────────────────────────────┐
Browser ─────▶│  nginx (terminates HTTPS)                        │
example.com   │   /                 → existing site (unchanged)  │
              │   /onboarding        → onboarding SPA (static)    │
              │   /onboarding/api/*  → 127.0.0.1:3001 (Fastify)   │
              └───────────────────────────┬────────────────────┘
                                           │ outbound TLS (5432 pooler / 443 storage)
                                           ▼
                                  Supabase (Postgres + Storage)
```

Why this is clean: SPA and API live under one origin, so **there is no CORS** in prod;
PDFs stream from your own origin; the API binds to `127.0.0.1` and is reachable only
through nginx. Nothing about the existing site changes except two nginx `location` blocks.

> **Invariant 4 holds:** the browser only ever calls `/onboarding/api/...`. The Supabase
> service-role key lives only in the API's env on the VM — never in the SPA bundle.

---

## Step 1 — Supabase (create the project + bucket, collect 4 values)

1. Create a Supabase project. Pick a **region near the VM** and set a strong **DB password**.
2. **Storage → New bucket**: name `onboarding-pdfs`, **Private** (not public).
3. Collect these — they become the API's env (Step 3):

   | Env var | Where in Supabase | Notes |
   |---|---|---|
   | `DATABASE_URL` | Database → Connection string → **Session pooler** (port **5432**) | Use the **session pooler**, not the direct `db.<ref>.supabase.co` host (that's IPv6-only on free and won't reach the VM). Append `?sslmode=require`. |
   | `SUPABASE_URL` | API → Project URL | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | API → `service_role` secret | **Server-only.** Bypasses RLS; never expose it. |
   | `SUPABASE_STORAGE_BUCKET` | the bucket from step 2 | `onboarding-pdfs` |

   `DATABASE_URL` format:
   ```
   postgresql://postgres.<ref>:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   You do **not** need the `anon` key — the browser never talks to Supabase.

> Azure egress to ports 5432/443 is open by default; no inbound rule is needed for the DB.

---

## Step 2 — Get the code on the VM + install

```bash
# Node 22 (matches CI) + pnpm via corepack
sudo install -d -o $USER /opt/onboarding
git clone <your-repo> /opt/onboarding/client-onboarding-app
cd /opt/onboarding/client-onboarding-app
corepack enable                      # provides pnpm at the pinned version
pnpm install --frozen-lockfile       # installs devDeps too — vite-node runs the API
```

The API runs via `vite-node` (its `build` is typecheck-only), so **do not** install with
`--prod`; `vite-node` is a devDependency.

---

## Step 3 — Configure the API env (secrets stay off the repo)

```bash
sudo cp deploy/onboarding-api.env.example /etc/onboarding-api.env
sudo nano /etc/onboarding-api.env      # paste the 4 Supabase values + WEB_ORIGIN
sudo chown onboarding:onboarding /etc/onboarding-api.env   # the service account
sudo chmod 600 /etc/onboarding-api.env
```

Set `WEB_ORIGIN=https://<your-domain>` (defense-in-depth) and leave `PDF_SERVE_MODE=stream`.

---

## Step 4 — Run the database migrations

```bash
# Reads DATABASE_URL from the env file and applies drizzle/*.sql to Supabase.
set -a; . /etc/onboarding-api.env; set +a
pnpm --filter api db:migrate         # prints "migrations applied (db: postgres)"
```

This creates `organization`, `plan`, `cases` (incl. `pdf_hash`). Migrations also run on
boot, so this step is mainly to verify connectivity before serving traffic.

---

## Step 5 — Run the API as a service

```bash
sudo cp deploy/onboarding-api.service /etc/systemd/system/
# Edit User / WorkingDirectory / ExecStart paths to match the VM (see the file's header;
# `which pnpm` and `which node` give the absolute paths).
sudo systemctl daemon-reload
sudo systemctl enable --now onboarding-api
curl -s http://127.0.0.1:3001/health   # -> {"ok":true}
```

---

## Step 6 — Build the SPA for the subpath and publish it

```bash
VITE_BASE=/onboarding/ VITE_API_URL=/onboarding pnpm --filter web build
sudo install -d /var/www/onboarding
sudo rsync -a --delete apps/web/dist/ /var/www/onboarding/
```

- `VITE_BASE=/onboarding/` prefixes asset URLs (else they 404 under the subpath).
- `VITE_API_URL=/onboarding` makes the SPA call `…/onboarding/api/...` (relative → same origin).

---

## Step 7 — nginx

Paste the blocks from [`deploy/nginx-onboarding.conf`](../deploy/nginx-onboarding.conf) into
the existing `server { }` block for your domain, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

They (a) 301 `/onboarding` → `/onboarding/`, (b) proxy `/onboarding/api/` → the local API
with the prefix stripped, and (c) serve the SPA from `/var/www/onboarding`.

---

## Step 8 — Verify (Definition of Done)

1. Open `https://<your-domain>/onboarding` → pick a plan → submit.
2. Refresh the page → it reloads the case from the API (`#case=<id>`), proving DB persistence.
3. Click **Download Package** → a `%PDF` streams back from `/onboarding/api/cases/:id/pdf`.
4. In Supabase: a row in `cases` (with `pdf_hash` populated) and the object in the
   `onboarding-pdfs` bucket.

✅ A case created on the deployed app persists in Supabase and its PDF is served from
Supabase Storage. Local dev still runs with **zero config** (no env → pglite + local files).

---

## Updating / redeploying

```bash
cd /opt/onboarding/client-onboarding-app && git pull
pnpm install --frozen-lockfile
pnpm --filter api db:migrate                    # apply any new migrations
sudo systemctl restart onboarding-api           # API
VITE_BASE=/onboarding/ VITE_API_URL=/onboarding pnpm --filter web build
sudo rsync -a --delete apps/web/dist/ /var/www/onboarding/   # SPA
```

## Notes & options
- **Logs:** `journalctl -u onboarding-api -f`.
- **Signed-URL serving:** set `PDF_SERVE_MODE=signed-url` to 302 the browser to a 5-minute
  Supabase URL (saves API egress). Default `stream` keeps everything same-origin — preferred
  under a subpath. (Either way the SPA only knows the API URL.)
- **Container alternative:** [`apps/api/Dockerfile`](../apps/api/Dockerfile) runs the API in
  Docker instead of systemd; point `--env-file` at the same env and publish to `127.0.0.1:3001`.
- **Supabase free tier pauses after ~7 days idle** — fine for dev/testing; move to Pro before
  launch (see `ARCHITECTURE.md` §9).

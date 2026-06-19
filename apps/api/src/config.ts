// Central runtime config from env. The API runs with ZERO config locally:
// no DATABASE_URL -> embedded pglite; no Supabase env -> local filesystem storage.
export interface Config {
  port: number
  /** Set -> Postgres (Supabase/any) via postgres-js. Unset -> embedded pglite. */
  databaseUrl: string | undefined
  /** pglite data dir when databaseUrl is unset. Use ':memory:' for ephemeral. */
  pgliteDir: string
  /** LocalPdfStorage root directory (used when Supabase Storage env is absent). */
  storageDir: string
  /** CORS allow-origin for the web app in dev. '*' allows any (same-origin prod needs none). */
  webOrigin: string
  /** Supabase project URL — set (with the keys below) -> SupabaseStorage. */
  supabaseUrl: string | undefined
  /** Supabase service-role secret. SERVER-ONLY — never sent to the browser (invariant 4). */
  supabaseServiceRoleKey: string | undefined
  /** Supabase Storage bucket for PDFs (e.g. 'onboarding-pdfs'). */
  supabaseBucket: string | undefined
  /** How GET /cases/:id/pdf serves the file: stream it through the API (default,
   *  keeps everything same-origin) or 302 to a short-lived signed URL. */
  pdfServeMode: 'stream' | 'signed-url'
  /** Supabase Auth JWT secret (HS256). Set -> verify tokens locally with it.
   *  Unset -> verify asymmetric tokens via JWKS at supabaseUrl. SERVER-ONLY. */
  supabaseJwtSecret: string | undefined
  /** Local-dev escape hatch: skip JWT verification and act as `devUserId`.
   *  Refused against a real DATABASE_URL (see loadConfig) so it can't touch prod. */
  authBypass: boolean
  /** The user id assumed when authBypass is on. */
  devUserId: string
  /** The role assumed when authBypass is on, so local un-gated dev can reach the
   *  staff dashboard. Read ONLY on the bypass branch → no effect in a real deployment. */
  devUserRole: string
  /** Number of trusted reverse-proxy hops in front of the API, so request.ip (recorded
   *  in the signature audit log) is the real client. This must be a HOP COUNT, not a
   *  boolean: with "trust all", request.ip is the left-most X-Forwarded-For token, which
   *  the client controls (nginx APPENDS the real peer to the right). Trusting exactly N
   *  hops makes request.ip the address the closest trusted proxy set — unspoofable. 1 in
   *  the nginx deploy (Decision Log §195); 0 = off (direct exposure → use the socket IP). */
  trustProxy: number
}

/** A stable, obviously-fake UUID used as the actor when AUTH_BYPASS is on. */
const DEFAULT_DEV_USER_ID = '00000000-0000-4000-8000-000000000001'

/** Parse TRUST_PROXY as a count of trusted proxy hops. `true` is accepted as 1 (a single
 *  proxy) for convenience; anything non-positive/unset/garbage → 0 (off). A boolean "trust
 *  all" is deliberately NOT supported — it would make request.ip client-spoofable. */
function parseTrustProxy(raw: string | undefined): number {
  if (raw === 'true') return 1
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL || undefined
  const authBypass = process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true'

  // Safety rail: the bypass disables auth entirely, so it must never run against a
  // real Postgres (which in deployment is Supabase, holding real tenant data).
  if (authBypass && databaseUrl) {
    throw new Error(
      'AUTH_BYPASS is on but DATABASE_URL is set — refusing to disable auth against a real database. ' +
        'Unset one of them.',
    )
  }

  return {
    port: Number(process.env.PORT ?? 3001),
    databaseUrl,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pgdata',
    storageDir: process.env.STORAGE_DIR ?? '.data/pdfs',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    supabaseUrl: process.env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || undefined,
    pdfServeMode: process.env.PDF_SERVE_MODE === 'signed-url' ? 'signed-url' : 'stream',
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || undefined,
    authBypass,
    devUserId: process.env.DEV_USER_ID || DEFAULT_DEV_USER_ID,
    devUserRole: process.env.DEV_USER_ROLE || 'admin',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  }
}

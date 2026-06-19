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
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3001),
    databaseUrl: process.env.DATABASE_URL || undefined,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pgdata',
    storageDir: process.env.STORAGE_DIR ?? '.data/pdfs',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    supabaseUrl: process.env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || undefined,
    pdfServeMode: process.env.PDF_SERVE_MODE === 'signed-url' ? 'signed-url' : 'stream',
  }
}

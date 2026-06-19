// Central runtime config from env. The API runs with ZERO config locally:
// no DATABASE_URL -> embedded pglite; storage -> local filesystem.
export interface Config {
  port: number
  /** Set -> Postgres (Supabase/any) via postgres-js. Unset -> embedded pglite. */
  databaseUrl: string | undefined
  /** pglite data dir when databaseUrl is unset. Use ':memory:' for ephemeral. */
  pgliteDir: string
  /** LocalPdfStorage root directory. */
  storageDir: string
  /** CORS allow-origin for the web app in dev. */
  webOrigin: string
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3001),
    databaseUrl: process.env.DATABASE_URL || undefined,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pgdata',
    storageDir: process.env.STORAGE_DIR ?? '.data/pdfs',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  }
}

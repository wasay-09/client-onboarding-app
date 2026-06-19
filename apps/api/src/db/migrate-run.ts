// Standalone migration runner: `pnpm --filter api db:migrate`.
// Applies pending Drizzle migrations against whatever DATABASE_URL points at
// (Supabase in prod; embedded pglite if unset). Use as a deploy/release step;
// migrations also run on boot (server.ts).
import { loadConfig } from '../config'
import { createDatabase } from './client'
import { runMigrations } from './migrate'

const config = loadConfig()
const database = createDatabase(config)
try {
  await runMigrations(database)
  console.log(`migrations applied (db: ${database.kind})`)
} finally {
  await database.close()
}

import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PGlite } from '@electric-sql/pglite'
import postgres from 'postgres'
import type { Config } from '../config'
import * as schema from './schema/kernel'

// One shared db type for the whole app. Pglite and postgres-js expose the same
// pg-core query builder, so the store code is identical regardless of driver.
export type DB = PostgresJsDatabase<typeof schema>

export interface Database {
  db: DB
  kind: 'pglite' | 'postgres'
  close(): Promise<void>
}

/**
 * DATABASE_URL set  -> Postgres (Supabase / Neon / any) via postgres-js.
 * DATABASE_URL unset -> embedded pglite (file-persisted, or ':memory:' for tests).
 */
export function createDatabase(config: Config): Database {
  if (config.databaseUrl) {
    const client = postgres(config.databaseUrl)
    const db = drizzlePostgres(client, { schema })
    return { db, kind: 'postgres', close: () => client.end() }
  }

  const client = new PGlite(config.pgliteDir === ':memory:' ? undefined : config.pgliteDir)
  // Same pg-core query API at runtime; cast unifies the static type.
  const db = drizzlePglite(client, { schema }) as unknown as DB
  return { db, kind: 'pglite', close: () => client.close() }
}

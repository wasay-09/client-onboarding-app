import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import type { Database } from './client'

// drizzle-kit generate writes SQL here (see drizzle.config.ts).
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** Apply pending migrations. Safe to call on every boot. */
export async function runMigrations(database: Database): Promise<void> {
  // Both migrators accept the drizzle db; dispatch only differs by import.
  if (database.kind === 'postgres') {
    await migratePostgres(database.db as never, { migrationsFolder })
  } else {
    await migratePglite(database.db as never, { migrationsFolder })
  }
}

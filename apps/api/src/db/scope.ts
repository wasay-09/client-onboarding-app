import { sql } from 'drizzle-orm'
import type { DB } from './client'

/** The transaction handle Drizzle hands to a `db.transaction` callback. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

/**
 * Run `fn` inside a transaction scoped to `userId`, so Postgres Row-Level Security
 * applies. The API's login role bypasses RLS (superuser/postgres), so we first drop
 * to the non-bypass `app_authenticated` role and stamp the caller in a tx-local GUC
 * that the policies read. `SET LOCAL` + set_config(..., is_local=true) are
 * transaction-scoped, so this is safe under Supabase's transaction pooler.
 *
 * This is defense-in-depth: callers also scope by ownership in their queries
 * (business logic stays in the API). RLS is the second wall.
 */
export function withUserScope<T>(db: DB, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
    await tx.execute(sql`set local role app_authenticated`)
    return fn(tx)
  })
}

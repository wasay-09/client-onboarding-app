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

/**
 * Like `withUserScope`, but for the internal staff dashboard: it additionally stamps the
 * tx-local `app.is_staff` GUC, which the permissive `*_staff` RLS policies read to allow a
 * cross-owner SELECT (migration 0006 + the document/party policies). `app.current_user_id`
 * is still set (it identifies the staff actor for future audit logging). Staff reads are
 * the only callers of this; the API's `requireStaff` preHandler is the primary gate, RLS
 * the second wall. Read-only by design — the `*_staff` policies are FOR SELECT only.
 */
export function withStaffScope<T>(db: DB, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
    await tx.execute(sql`select set_config('app.is_staff', 'on', true)`)
    await tx.execute(sql`set local role app_authenticated`)
    return fn(tx)
  })
}

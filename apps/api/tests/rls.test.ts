import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Config } from '../src/config'
import { createDatabase, type Database } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { withUserScope } from '../src/db/scope'
import { cases } from '../src/db/schema/kernel'
import { CaseStore } from '../src/kernel/cases'

// Proves the DB wall directly — independent of the API/app-layer filters. A raw
// `SELECT * FROM cases` inside withUserScope must return ONLY the caller's rows,
// purely because of Row-Level Security + the role drop + the tx-local GUC.

const config: Config = {
  port: 0,
  databaseUrl: undefined,
  pgliteDir: ':memory:',
  storageDir: '.data/test-pdfs',
  webOrigin: '*',
  supabaseUrl: undefined,
  supabaseServiceRoleKey: undefined,
  supabaseBucket: undefined,
  pdfServeMode: 'stream',
  supabaseJwtSecret: 'unused-here',
  authBypass: false,
  devUserId: '00000000-0000-4000-8000-000000000001',
}

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

let database: Database

beforeAll(async () => {
  database = createDatabase(config)
  await runMigrations(database)
  const store = new CaseStore(database.db)
  // store.create sets owner_id = userId on the org + case (no validation here).
  await store.create({ planType: '457b', answers: { companyName: 'Acme' } }, USER_A)
})

afterAll(async () => {
  await database.close()
})

describe('Row-Level Security', () => {
  it('shows the owner their row via a raw scoped select', async () => {
    const rows = await withUserScope(database.db, USER_A, (tx) => tx.select().from(cases))
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerId).toBe(USER_A)
  })

  it('hides the row from a non-owner via RLS (0 rows)', async () => {
    const rows = await withUserScope(database.db, USER_B, (tx) => tx.select().from(cases))
    expect(rows).toHaveLength(0)
  })

  it('blocks a non-owner from inserting a case into the owner\'s org (WITH CHECK)', async () => {
    // Read the existing org id as the owner, then try to attach a case to it as B.
    const [{ organizationId }] = await withUserScope(database.db, USER_A, (tx) =>
      tx.select({ organizationId: cases.organizationId }).from(cases),
    )
    await expect(
      withUserScope(database.db, USER_B, (tx) =>
        tx.insert(cases).values({
          id: '33333333-3333-3333-3333-333333333333',
          organizationId,
          planId: organizationId, // FK irrelevant — RLS rejects before/around it
          planType: '457b',
          answers: {},
          ownerId: USER_B,
        }),
      ),
    ).rejects.toThrow()
  })

  it('confirms the privileged connection bypasses RLS (why the role drop is required)', async () => {
    // The unscoped login role (superuser/postgres) sees everything — this is exactly
    // why withUserScope drops to the non-bypass role before querying.
    const all = await database.db.select().from(cases)
    expect(all.length).toBeGreaterThanOrEqual(1)
  })
})

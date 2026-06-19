import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import type { FormValues } from '@fbsi/shared'
import type { Config } from '../src/config'
import { createDatabase, type Database } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { withUserScope } from '../src/db/scope'
import { organization, plan, cases } from '../src/db/schema/kernel'
import { buildApp } from '../src/app'

// Phase 3 "ask once across sessions": on resubmit, the org (by EIN natural key)
// and plan are REUSED, not duplicated; GET /api/cases/latest returns the caller's
// most recent answers for pre-fill. RLS scopes every lookup to the caller.

const JWT_SECRET = 'test-jwt-secret-not-a-real-secret'

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
  supabaseJwtSecret: JWT_SECRET,
  authBypass: false,
  devUserId: '00000000-0000-4000-8000-000000000001',
}

// A distinct user per test so RLS-scoped counts stay isolated on the shared DB.
const USER_REUSE = '11111111-0000-0000-0000-000000000001'
const USER_PLANS = '11111111-0000-0000-0000-000000000002'
const USER_LATEST = '11111111-0000-0000-0000-000000000003'
const USER_A = '11111111-0000-0000-0000-00000000000a'
const USER_B = '11111111-0000-0000-0000-00000000000b'

async function tokenFor(sub: string): Promise<string> {
  return new SignJWT({ email: `${sub.slice(0, 4)}@example.com` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET))
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

// Valid shared-core + contacts answers (covers 457b and SIMPLE IRA, which are
// shared-core-only plans). Override `ein`/`companyName` per case.
function answers(overrides: Partial<FormValues> = {}): FormValues {
  return {
    companyName: 'Acme Widgets LLC',
    companyAddress: '123 Main St, Springfield, IL 62704',
    entityType: 'Limited Liability Co.',
    controlledGroup: 'No',
    affiliatedServiceGroup: 'No',
    ein: '12-3456789',
    dateBusinessCommenced: '2010-05-01',
    taxYearEnd: '12/31',
    employerEmail: 'hr@acme.com',
    employerPhone: '555-123-4567',
    planName: 'Acme Widgets Plan',
    planTrustee: 'Jane Doe',
    planEffectiveDate: '2026-01-01',
    planYearEnd: '12/31',
    planNumber: '001',
    investmentProduct: 'Mutual Funds',
    anotherQualifiedPlan: 'No',
    primaryContactName: 'John Smith',
    primaryContactEmail: 'john@acme.com',
    primaryContactPhone: '555-222-3333',
    primaryIsAuthorizedSigner: 'Yes',
    ...overrides,
  }
}

let app: FastifyInstance
let database: Database

beforeAll(async () => {
  database = createDatabase(config)
  await runMigrations(database)
  app = buildApp(config, database)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await database.close()
})

async function post(token: string, planType: string, a: FormValues) {
  return app.inject({ method: 'POST', url: '/api/cases', headers: bearer(token), payload: { planType, answers: a } })
}

// RLS-scoped row counts for a user (proves both the app logic and the DB wall).
const countOrgs = (userId: string) =>
  withUserScope(database.db, userId, (tx) => tx.select().from(organization)).then((r) => r.length)
const countPlans = (userId: string) =>
  withUserScope(database.db, userId, (tx) => tx.select().from(plan)).then((r) => r.length)
const countCases = (userId: string) =>
  withUserScope(database.db, userId, (tx) => tx.select().from(cases)).then((r) => r.length)

describe('3a — reuse org/plan by EIN (no duplicates)', () => {
  it('reuses the org + plan on resubmit, even with differently-formatted EINs', async () => {
    const token = await tokenFor(USER_REUSE)
    const r1 = await post(token, '457b', answers({ ein: '12-3456789' }))
    expect(r1.statusCode).toBe(201)
    // Same employer, EIN typed without the dash -> normalizes to the same key.
    const r2 = await post(token, '457b', answers({ ein: '123456789', companyName: 'Acme Widgets (renamed)' }))
    expect(r2.statusCode).toBe(201)

    expect(await countOrgs(USER_REUSE)).toBe(1) // <- the DoD: no duplicate organization
    expect(await countPlans(USER_REUSE)).toBe(1) // same plan type reused
    expect(await countCases(USER_REUSE)).toBe(2) // but each submission is its own case
  })

  it('reuses the org but adds a plan for a different plan type', async () => {
    const token = await tokenFor(USER_PLANS)
    expect((await post(token, '457b', answers())).statusCode).toBe(201)
    expect((await post(token, 'simpleira', answers())).statusCode).toBe(201)

    expect(await countOrgs(USER_PLANS)).toBe(1)
    expect(await countPlans(USER_PLANS)).toBe(2)
    expect(await countCases(USER_PLANS)).toBe(2)
  })
})

describe('3a — tenant safety', () => {
  it('two users with the same EIN get separate orgs (one per owner)', async () => {
    const [tokenA, tokenB] = [await tokenFor(USER_A), await tokenFor(USER_B)]
    expect((await post(tokenA, '457b', answers({ ein: '99-9999999' }))).statusCode).toBe(201)
    expect((await post(tokenB, '457b', answers({ ein: '99-9999999' }))).statusCode).toBe(201)

    // Each owner sees exactly their own one org — never the other's.
    expect(await countOrgs(USER_A)).toBe(1)
    expect(await countOrgs(USER_B)).toBe(1)
  })
})

describe('3b — GET /api/cases/latest (cross-session pre-fill)', () => {
  it('returns 204 when the user has no prior case', async () => {
    const token = await tokenFor(USER_LATEST)
    const res = await app.inject({ method: 'GET', url: '/api/cases/latest', headers: bearer(token) })
    expect(res.statusCode).toBe(204)
  })

  it('returns the most recent case answers, and never another user\'s', async () => {
    const token = await tokenFor(USER_LATEST)
    await post(token, '457b', answers({ ein: '11-1111111', companyName: 'First Co' }))
    const second = await post(token, 'simpleira', answers({ ein: '22-2222222', companyName: 'Second Co' }))
    expect(second.statusCode).toBe(201)

    const res = await app.inject({ method: 'GET', url: '/api/cases/latest', headers: bearer(token) })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ planType: string; answers: FormValues }>()
    expect(body.planType).toBe('simpleira') // the newer submission
    expect(body.answers.companyName).toBe('Second Co')

    // A different user with no history still gets 204 — no cross-tenant bleed.
    const other = await tokenFor('11111111-0000-0000-0000-0000000000ff')
    const otherRes = await app.inject({ method: 'GET', url: '/api/cases/latest', headers: bearer(other) })
    expect(otherRes.statusCode).toBe(204)

    // Unauthenticated -> 401.
    const noAuth = await app.inject({ method: 'GET', url: '/api/cases/latest' })
    expect(noAuth.statusCode).toBe(401)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import type { FormValues } from '@fbsi/shared'
import type { Config } from '../src/config'
import { createDatabase, type Database } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { withStaffScope, withUserScope } from '../src/db/scope'
import { cases } from '../src/db/schema/kernel'
import { buildApp } from '../src/app'

// Internal staff dashboard: a staff/admin JWT reads ANY case cross-owner (role-gated +
// the *_staff RLS policies); a verified non-staff caller is 403; owner isolation for the
// client-facing /api/cases routes is unchanged.

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
  devUserRole: 'admin',
}

const USER_A = '33333333-3333-3333-3333-333333333331'
const USER_B = '33333333-3333-3333-3333-333333333332'
const STAFF = '33333333-3333-3333-3333-3333333333ff'

/** Mint a Supabase-shaped HS256 token; `role` lands in the app_metadata custom claim. */
async function tokenFor(sub: string, role?: string): Promise<string> {
  const claims: Record<string, unknown> = { email: `${sub.slice(0, 4)}@example.com` }
  if (role) claims.app_metadata = { role }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET))
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

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
    planName: 'Acme Widgets 457(b) Plan',
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
let caseA: string
let caseB: string

beforeAll(async () => {
  database = createDatabase(config)
  await runMigrations(database)
  app = buildApp(config, database)
  await app.ready()

  const tokenA = await tokenFor(USER_A)
  const tokenB = await tokenFor(USER_B)
  const a = await app.inject({ method: 'POST', url: '/api/cases', headers: bearer(tokenA), payload: { planType: '457b', answers: answers({ companyName: 'Alpha Industries', ein: '11-1111111' }) } })
  const b = await app.inject({ method: 'POST', url: '/api/cases', headers: bearer(tokenB), payload: { planType: 'simpleira', answers: answers({ companyName: 'Beta Corp', ein: '22-2222222' }) } })
  caseA = a.json<{ id: string }>().id
  caseB = b.json<{ id: string }>().id
})

afterAll(async () => {
  await app.close()
  await database.close()
})

describe('staff gating', () => {
  it('rejects an unauthenticated caller (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a verified non-staff caller (403, not 404)', async () => {
    const token = await tokenFor(USER_A) // no role
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases', headers: bearer(token) })
    expect(res.statusCode).toBe(403)
    expect(res.json<{ error: string }>().error).toBe('forbidden')
  })

  it('admins are staff too', async () => {
    const token = await tokenFor(STAFF, 'admin')
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases', headers: bearer(token) })
    expect(res.statusCode).toBe(200)
  })
})

describe('staff list + search (cross-owner)', () => {
  it('lists cases from BOTH owners', async () => {
    const token = await tokenFor(STAFF, 'staff')
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases', headers: bearer(token) })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ rows: Array<{ orgName: string; ownerId: string }>; total: number }>()
    expect(body.total).toBeGreaterThanOrEqual(2)
    const owners = new Set(body.rows.map((r) => r.ownerId))
    expect(owners.has(USER_A)).toBe(true)
    expect(owners.has(USER_B)).toBe(true)
  })

  it('searches by company name', async () => {
    const token = await tokenFor(STAFF, 'staff')
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases?q=Alpha', headers: bearer(token) })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ rows: Array<{ orgName: string }>; total: number }>()
    expect(body.total).toBe(1)
    expect(body.rows[0].orgName).toBe('Alpha Industries')
  })

  it('filters by planType', async () => {
    const token = await tokenFor(STAFF, 'staff')
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases?planType=simpleira', headers: bearer(token) })
    const body = res.json<{ rows: Array<{ planType: string }>; total: number }>()
    expect(body.rows.every((r) => r.planType === 'simpleira')).toBe(true)
    expect(body.total).toBeGreaterThanOrEqual(1)
  })
})

describe('staff detail + pdf (cross-owner)', () => {
  it('opens another owner\'s case detail with answers, parties, and pdf hash', async () => {
    const token = await tokenFor(STAFF, 'staff')
    const res = await app.inject({ method: 'GET', url: `/api/staff/cases/${caseB}`, headers: bearer(token) })
    expect(res.statusCode).toBe(200)
    const body = res.json<{
      answers: FormValues
      orgName: string
      pdfHash: string | null
      parties: Array<{ role: string; name: string | null }>
      documents: unknown[]
    }>()
    expect(body.orgName).toBe('Beta Corp')
    expect(body.answers.primaryContactName).toBe('John Smith')
    expect(body.pdfHash).toMatch(/^[0-9a-f]{64}$/)
    // The contact was promoted into a kernel party (going-forward projection).
    expect(body.parties.some((p) => p.role === 'primary_contact' && p.name === 'John Smith')).toBe(true)
    expect(body.documents.length).toBeGreaterThanOrEqual(1)
  })

  it('streams the PDF for any owner\'s case', async () => {
    const token = await tokenFor(STAFF, 'staff')
    const res = await app.inject({ method: 'GET', url: `/api/staff/cases/${caseA}/pdf`, headers: bearer(token) })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('404s an unknown case id', async () => {
    const token = await tokenFor(STAFF, 'staff')
    const res = await app.inject({ method: 'GET', url: '/api/staff/cases/00000000-0000-0000-0000-000000000000', headers: bearer(token) })
    expect(res.statusCode).toBe(404)
  })
})

describe('owner isolation is unchanged by the staff policies', () => {
  it('a non-owner still gets 404 on the client /api/cases/:id route', async () => {
    const tokenA = await tokenFor(USER_A)
    const res = await app.inject({ method: 'GET', url: `/api/cases/${caseB}`, headers: bearer(tokenA) })
    expect(res.statusCode).toBe(404)
  })

  it('withUserScope still hides other owners; withStaffScope sees all', async () => {
    const asOwner = await withUserScope(database.db, USER_A, (tx) => tx.select().from(cases))
    expect(asOwner.every((c) => c.ownerId === USER_A)).toBe(true)
    const asStaff = await withStaffScope(database.db, STAFF, (tx) => tx.select().from(cases))
    const owners = new Set(asStaff.map((c) => c.ownerId))
    expect(owners.has(USER_A)).toBe(true)
    expect(owners.has(USER_B)).toBe(true)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import { getPlan, validate, type FormValues } from '@fbsi/shared'
import type { Config } from '../src/config'
import { createDatabase, type Database } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { buildApp } from '../src/app'

const JWT_SECRET = 'test-jwt-secret-not-a-real-secret'

const config: Config = {
  port: 0,
  databaseUrl: undefined,
  pgliteDir: ':memory:', // fresh in-process Postgres per run
  storageDir: '.data/test-pdfs',
  webOrigin: '*',
  // No Supabase env -> LocalPdfStorage; tests stay infra-free.
  supabaseUrl: undefined,
  supabaseServiceRoleKey: undefined,
  supabaseBucket: undefined,
  pdfServeMode: 'stream',
  // A known HS256 secret so tests mint their own valid JWTs (real auth path).
  supabaseJwtSecret: JWT_SECRET,
  authBypass: false,
  devUserId: '00000000-0000-4000-8000-000000000001',
  devUserRole: 'admin',
}

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

/** Mint a valid Supabase-shaped HS256 access token for `sub`. */
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

// Minimal valid answers for a 457(b): shared core + the 4 required contact fields.
// (457(b) sections = company + planId + existingPlan + contacts.)
const validAnswers: FormValues = {
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
}

let app: FastifyInstance
let database: Database
let tokenA: string
let tokenB: string

beforeAll(async () => {
  database = createDatabase(config)
  await runMigrations(database)
  app = buildApp(config, database)
  await app.ready()
  tokenA = await tokenFor(USER_A)
  tokenB = await tokenFor(USER_B)
})

afterAll(async () => {
  await app.close()
  await database.close()
})

describe('auth gate', () => {
  it('rejects an unauthenticated POST (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { planType: '457b', answers: validAnswers },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json<{ error: string }>().error).toBe('unauthorized')
  })

  it('rejects an unauthenticated GET (401)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/cases/${USER_A}` })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a forged/garbage token (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: bearer('not.a.real.jwt'),
      payload: { planType: '457b', answers: validAnswers },
    })
    expect(res.statusCode).toBe(401)
  })

  it('leaves /health public', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /api/cases', () => {
  it('the test fixture is actually valid per the shared validator', () => {
    expect(validate(getPlan('457b').sections, validAnswers)).toHaveLength(0)
  })

  it('persists a case, renders+stores a PDF, and round-trips it', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: bearer(tokenA),
      payload: { planType: '457b', answers: validAnswers },
    })
    expect(created.statusCode).toBe(201)
    const { id, pdfUrl } = created.json<{ id: string; pdfUrl: string }>()
    expect(id).toBeTruthy()
    expect(pdfUrl).toBe(`/api/cases/${id}/pdf`)

    // Survives a "refresh": reload purely from the API (as the owner).
    const fetched = await app.inject({ method: 'GET', url: `/api/cases/${id}`, headers: bearer(tokenA) })
    expect(fetched.statusCode).toBe(200)
    const body = fetched.json<{ planType: string; answers: FormValues; pdfHash: string }>()
    expect(body.planType).toBe('457b')
    expect(body.answers.companyName).toBe('Acme Widgets LLC')
    // The canonical PDF's SHA-256 is recorded (audit-log prep).
    expect(body.pdfHash).toMatch(/^[0-9a-f]{64}$/)

    // Server-made PDF served from storage.
    const pdf = await app.inject({ method: 'GET', url: pdfUrl, headers: bearer(tokenA) })
    expect(pdf.statusCode).toBe(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')
    expect(pdf.rawPayload.length).toBeGreaterThan(1000)
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('rejects answers that fail the shared validator (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: bearer(tokenA),
      payload: { planType: '457b', answers: { companyName: 'Only this' } },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json<{ error: string; errors: unknown[] }>()
    expect(body.error).toBe('validation_failed')
    expect(body.errors.length).toBeGreaterThan(0)
  })

  it('rejects a malformed envelope (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: bearer(tokenA),
      payload: { planType: 'not-a-plan', answers: {} },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: string }>().error).toBe('invalid_request')
  })
})

describe('tenant isolation', () => {
  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cases/00000000-0000-0000-0000-000000000000',
      headers: bearer(tokenA),
    })
    expect(res.statusCode).toBe(404)
  })

  it("hides another user's case (404, not 403 — don't leak existence)", async () => {
    // User A creates a case.
    const created = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: bearer(tokenA),
      payload: { planType: '457b', answers: validAnswers },
    })
    expect(created.statusCode).toBe(201)
    const { id } = created.json<{ id: string }>()

    // User B cannot read it, nor its PDF.
    const asB = await app.inject({ method: 'GET', url: `/api/cases/${id}`, headers: bearer(tokenB) })
    expect(asB.statusCode).toBe(404)
    const pdfAsB = await app.inject({ method: 'GET', url: `/api/cases/${id}/pdf`, headers: bearer(tokenB) })
    expect(pdfAsB.statusCode).toBe(404)

    // User A still can.
    const asA = await app.inject({ method: 'GET', url: `/api/cases/${id}`, headers: bearer(tokenA) })
    expect(asA.statusCode).toBe(200)
  })
})

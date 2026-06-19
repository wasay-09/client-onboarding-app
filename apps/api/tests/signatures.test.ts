import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import { getPlan, validate, type FormValues } from '@fbsi/shared'
import type { Config } from '../src/config'
import { createDatabase, type Database } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { buildApp } from '../src/app'
import { withUserScope } from '../src/db/scope'
import { document, signatureEvent } from '../src/db/schema/kernel'

// Phase 4 signature finalization: a signed agreement must become a tamper-evident server
// record tied to an authenticated user, plus an APPEND-ONLY audit log for ESIGN/UETA.

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
  // ON so the audit log captures the real client IP from X-Forwarded-For (nginx deploy).
  trustProxy: true,
}

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'
const SIGNER_IP = '203.0.113.7'
const SIGNER_UA = 'Mozilla/5.0 (SignatureTest)'

async function tokenFor(sub: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET))
}

// A real signature PNG data URL (the same sample the draft-PDF script uses), embedded in
// the rendered SA exactly as the client's SignaturePad output would be.
const SIG_PNG = `data:image/png;base64,${readFileSync(
  fileURLToPath(new URL('../../../scripts/sample_signature.png', import.meta.url)),
).toString('base64')}`

// ── Valid fixtures (mirrors scripts/smoke.tsx so validate() passes on the server) ──
const base: FormValues = {
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
  planName: 'Acme Widgets 401(k) Plan',
  planTrustee: 'Jane Doe',
  planEffectiveDate: '2026-01-01',
  planYearEnd: '12/31',
  planNumber: '001',
  investmentProduct: 'Mutual Funds',
  anotherQualifiedPlan: 'No',
}
const design: FormValues = {
  trustees: 'Individuals',
  eligibilityRequirements: '1 year',
  ageRequirements: '21',
  planEntryDates: 'Quarterly',
  recognizePriorEmployerService: 'No',
  vestingSchedule: '3 year cliff',
  yearsForVesting: 'All Years',
  normalRetirementAge: '65',
  modifyDeferralFrequency: 'Monthly',
  oneTimeDeferralOnBonus: 'No',
  allowRoth: 'Yes',
  commenceDeferralsAfterEligible: 'Monthly',
  autoEnrollment: 'No',
  employerMatch: 'Yes',
  matchingFormula: '50% on the first 6%',
  matchingFrequency: 'Per Payroll Period',
  matchingHours: 'None (typical)',
  matchingForfeitureThen: 'Used to Reduce future contributions (typical)',
  profitSharingOffered: 'No',
  loans: 'Yes',
  loanLimitations: 'Minimum loan of $1,000.00 (typical)',
  refinanceLoans: 'No',
  transfersFromOtherPlan: 'No',
  hardshipDistributions: 'From Employee Deferrals Only (typical)',
  inServiceDistributions: 'No',
  distributionFeesPaidByParticipants: 'Yes',
  forceOutThreshold: 'Less than $1,000 (paid to participant)',
  safeHarbor: 'No',
  adpAcpTestingMethod: 'Prior Year',
}
const operational: FormValues = {
  newOrExistingPlan: 'New',
  primaryContactName: 'John Smith',
  primaryContactEmail: 'john@acme.com',
  primaryContactPhone: '555-222-3333',
  primaryIsAuthorizedSigner: 'Yes',
  separateDivisions: 'No',
  payrollFrequency: 'Bi-Weekly',
  payrollWhenPaid: 'Friday',
  advisorFirmName: 'Acme Advisors LLC',
  advisorFeeArrangement: 'Option 2 — Fee-Based (advisor invoices)',
  defaultFundType: 'Single fund or Model Portfolios',
  fundLineup: JSON.stringify([
    { ticker: 'VFIAX', fundName: 'Vanguard 500 Index', cusip: '922908710', etf: 'No', notes: '' },
  ]),
}
// 401(k) with a completed SLA signature AND a data certification.
const signed401k: FormValues = {
  ...base,
  ...design,
  ...operational,
  esignConsent: 'Yes',
  esignConsentAt: '2026-06-20T10:00:00.000Z',
  slaSignerAuthorized: 'Yes',
  slaSignerName: 'Jane Doe',
  slaSignerTitle: 'Trustee',
  slaSignatureImage: SIG_PNG,
  slaAcknowledged: 'Yes',
  slaSignedAt: '2026-06-20T10:01:00.000Z',
  dataCertified: 'Yes',
  dataCertifiedBy: 'Jane Doe',
  dataCertifiedAt: '2026-06-20T10:02:00.000Z',
}

// Minimal valid 457(b): shared core + the 4 contact fields, certified but no SLA.
const certified457b: FormValues = {
  ...base,
  planName: 'Acme Widgets 457(b) Plan',
  primaryContactName: 'John Smith',
  primaryContactEmail: 'john@acme.com',
  primaryContactPhone: '555-222-3333',
  primaryIsAuthorizedSigner: 'Yes',
  esignConsent: 'Yes',
  esignConsentAt: '2026-06-20T10:00:00.000Z',
  dataCertified: 'Yes',
  dataCertifiedBy: 'John Smith',
  dataCertifiedAt: '2026-06-20T10:02:00.000Z',
}

let app: FastifyInstance
let database: Database
let tokenA: string
let tokenB: string

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

async function submit(planType: string, answers: FormValues, token: string) {
  return app.inject({
    method: 'POST',
    url: '/api/cases',
    headers: { ...bearer(token), 'x-forwarded-for': SIGNER_IP, 'user-agent': SIGNER_UA },
    payload: { planType, answers },
  })
}

beforeAll(async () => {
  database = createDatabase(config)
  await runMigrations(database)
  app = buildApp(config, database)
  await app.ready()
  tokenA = await tokenFor(USER_A, 'jane@acme.com')
  tokenB = await tokenFor(USER_B, 'someone@else.com')
})

afterAll(async () => {
  await app.close()
  await database.close()
})

describe('fixtures are valid per the shared validator', () => {
  it('401k + 457b fixtures pass validate()', () => {
    expect(validate(getPlan('401k').sections, signed401k)).toHaveLength(0)
    expect(validate(getPlan('457b').sections, certified457b)).toHaveLength(0)
  })
})

describe('SLA signature finalization (401k)', () => {
  let caseId: string
  let pdfHash: string

  it('records the case and reports it signed, bound to the user + PDF hash', async () => {
    const created = await submit('401k', signed401k, tokenA)
    expect(created.statusCode).toBe(201)
    caseId = created.json<{ id: string }>().id

    const fetched = await app.inject({ method: 'GET', url: `/api/cases/${caseId}`, headers: bearer(tokenA) })
    expect(fetched.statusCode).toBe(200)
    const body = fetched.json<{
      pdfHash: string
      signature: { signed: boolean; events: Array<{ eventType: string; documentSha256: string; consented: boolean; method: string }> }
    }>()
    pdfHash = body.pdfHash
    expect(pdfHash).toMatch(/^[0-9a-f]{64}$/)
    expect(body.signature.signed).toBe(true)

    const sla = body.signature.events.find((e) => e.eventType === 'sla_signature')
    const cert = body.signature.events.find((e) => e.eventType === 'data_certification')
    expect(sla).toBeDefined()
    expect(cert).toBeDefined()
    // Tamper-evident binding: the audit event froze the exact signed PDF's hash.
    expect(sla?.documentSha256).toBe(pdfHash)
    expect(sla?.consented).toBe(true)
    expect(sla?.method).toBe('esign_signature_pad')
    expect(cert?.method).toBe('attestation_checkbox')
  })

  it('stamps the document signed_at and writes append-only audit rows with IP/UA/user', async () => {
    // document.signed_at is set for the SLA signature (unscoped read — verifies the write).
    const docs = await database.db.select().from(document).where(eq(document.caseId, caseId))
    const onboarding = docs.find((d) => d.type === 'onboarding_package')
    expect(onboarding?.signedAt).toBeInstanceOf(Date)

    // The audit rows: tied to the authenticated user, with the request's IP + user-agent.
    const events = await withUserScope(database.db, USER_A, (tx) =>
      tx.select().from(signatureEvent).where(eq(signatureEvent.caseId, caseId)),
    )
    expect(events).toHaveLength(2)
    for (const e of events) {
      expect(e.signerUserId).toBe(USER_A)
      expect(e.signerEmail).toBe('jane@acme.com')
      expect(e.documentSha256).toBe(pdfHash)
      expect(e.ip).toBe(SIGNER_IP) // captured via trustProxy from X-Forwarded-For
      expect(e.userAgent).toBe(SIGNER_UA)
    }
  })

  it('refuses to UPDATE or DELETE an audit row (append-only at the DB grant)', async () => {
    const [{ id }] = await withUserScope(database.db, USER_A, (tx) =>
      tx.select({ id: signatureEvent.id }).from(signatureEvent).where(eq(signatureEvent.caseId, caseId)),
    )
    await expect(
      withUserScope(database.db, USER_A, (tx) =>
        tx.update(signatureEvent).set({ ip: '0.0.0.0' }).where(eq(signatureEvent.id, id)),
      ),
    ).rejects.toThrow()
    await expect(
      withUserScope(database.db, USER_A, (tx) =>
        tx.delete(signatureEvent).where(eq(signatureEvent.id, id)),
      ),
    ).rejects.toThrow()
  })
})

describe('data certification only (457b — no SLA)', () => {
  it('records a certification event but leaves the document unsigned', async () => {
    const created = await submit('457b', certified457b, tokenA)
    expect(created.statusCode).toBe(201)
    const caseId = created.json<{ id: string }>().id

    const body = (
      await app.inject({ method: 'GET', url: `/api/cases/${caseId}`, headers: bearer(tokenA) })
    ).json<{ signature: { signed: boolean; events: Array<{ eventType: string }> } }>()
    expect(body.signature.signed).toBe(false) // certification is an attestation, not a signature
    expect(body.signature.events.map((e) => e.eventType)).toEqual(['data_certification'])

    const docs = await database.db.select().from(document).where(eq(document.caseId, caseId))
    expect(docs.find((d) => d.type === 'onboarding_package')?.signedAt).toBeNull()
  })
})

describe('delegate route is not a finalized signature (401k, slaSignerAuthorized=No)', () => {
  it('writes no audit events and leaves the document unsigned', async () => {
    const delegated: FormValues = {
      ...base,
      ...design,
      ...operational,
      esignConsent: 'Yes',
      slaSignerAuthorized: 'No',
      slaDelegateName: 'Carol Trustee',
      slaDelegateEmail: 'carol@acme.com',
      slaAcknowledged: 'Yes',
    }
    const created = await submit('401k', delegated, tokenA)
    expect(created.statusCode).toBe(201)
    const caseId = created.json<{ id: string }>().id

    const body = (
      await app.inject({ method: 'GET', url: `/api/cases/${caseId}`, headers: bearer(tokenA) })
    ).json<{ signature: { signed: boolean; events: unknown[] } }>()
    expect(body.signature.signed).toBe(false)
    expect(body.signature.events).toHaveLength(0)

    const docs = await database.db.select().from(document).where(eq(document.caseId, caseId))
    expect(docs.find((d) => d.type === 'onboarding_package')?.signedAt).toBeNull()
  })
})

describe('tenant isolation', () => {
  it("hides another owner's signed case + audit events", async () => {
    // A submits a certified case; B must not see the case (404) — so its events are
    // unreachable through the API too.
    const created = await submit('457b', certified457b, tokenA)
    const caseId = created.json<{ id: string }>().id
    const asB = await app.inject({ method: 'GET', url: `/api/cases/${caseId}`, headers: bearer(tokenB) })
    expect(asB.statusCode).toBe(404)

    // And at the DB wall: B has its own (empty) org scope, so RLS yields zero events.
    const rows = await withUserScope(database.db, USER_B, (tx) => tx.select().from(signatureEvent))
    expect(rows).toHaveLength(0)
  })
})

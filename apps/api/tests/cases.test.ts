import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { getPlan, validate, type FormValues } from '@fbsi/shared'
import type { Config } from '../src/config'
import { createDatabase, type Database } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { buildApp } from '../src/app'

const config: Config = {
  port: 0,
  databaseUrl: undefined,
  pgliteDir: ':memory:', // fresh in-process Postgres per run
  storageDir: '.data/test-pdfs',
  webOrigin: '*',
}

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

describe('POST /api/cases', () => {
  it('the test fixture is actually valid per the shared validator', () => {
    expect(validate(getPlan('457b').sections, validAnswers)).toHaveLength(0)
  })

  it('persists a case, renders+stores a PDF, and round-trips it', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { planType: '457b', answers: validAnswers },
    })
    expect(created.statusCode).toBe(201)
    const { id, pdfUrl } = created.json<{ id: string; pdfUrl: string }>()
    expect(id).toBeTruthy()
    expect(pdfUrl).toBe(`/api/cases/${id}/pdf`)

    // Survives a "refresh": reload purely from the API.
    const fetched = await app.inject({ method: 'GET', url: `/api/cases/${id}` })
    expect(fetched.statusCode).toBe(200)
    const body = fetched.json<{ planType: string; answers: FormValues }>()
    expect(body.planType).toBe('457b')
    expect(body.answers.companyName).toBe('Acme Widgets LLC')

    // Server-made PDF served from storage.
    const pdf = await app.inject({ method: 'GET', url: pdfUrl })
    expect(pdf.statusCode).toBe(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')
    expect(pdf.rawPayload.length).toBeGreaterThan(1000)
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('rejects answers that fail the shared validator (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cases',
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
      payload: { planType: 'not-a-plan', answers: {} },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: string }>().error).toBe('invalid_request')
  })
})

describe('GET /api/cases/:id', () => {
  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cases/00000000-0000-0000-0000-000000000000' })
    expect(res.statusCode).toBe(404)
  })
})

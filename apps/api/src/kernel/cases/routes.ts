import type { FastifyInstance } from 'fastify'
import { CaseService, ValidationError, createCaseSchema } from './service'

/** Signed-URL lifetime when PDF_SERVE_MODE=signed-url. */
const SIGNED_URL_TTL_SECONDS = 300

export function registerCaseRoutes(
  app: FastifyInstance,
  service: CaseService,
  pdfServeMode: 'stream' | 'signed-url' = 'stream',
): void {
  app.post('/api/cases', async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const parsed = createCaseSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues })
    }
    try {
      // Capture the signing act's request metadata for the ESIGN/UETA audit log. request.ip
      // reflects the real client only when Fastify trustProxy is on (set behind nginx); see
      // config.trustProxy + docs/DEPLOY.md. The signer's account email comes from the JWT.
      const sign = {
        ip: request.ip || null,
        userAgent: request.headers['user-agent'] ?? null,
        signerEmail: request.user?.email ?? null,
      }
      const result = await service.create(parsed.data, userId, sign)
      return reply.code(201).send(result)
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: 'validation_failed', errors: err.errors })
      }
      throw err
    }
  })

  // Most recent case for the caller, to pre-fill a new questionnaire across
  // sessions. Registered before /:id; Fastify's router prefers the static segment,
  // so 'latest' is never captured as an :id. 204 when the user has no prior cases.
  app.get('/api/cases/latest', async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const c = await service.getLatest(userId)
    if (!c) return reply.code(204).send()
    return reply.send({
      id: c.id,
      planType: c.planType,
      answers: c.answers,
      status: c.status,
      pdfUrl: `/api/cases/${c.id}/pdf`,
      createdAt: c.createdAt,
    })
  })

  app.get('/api/cases/:id', async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const { id } = request.params as { id: string }
    // A case the user doesn't own is reported as 404 (don't leak its existence).
    const c = await service.get(id, userId)
    if (!c) return reply.code(404).send({ error: 'not_found' })
    // pdf_path/pdf_hash were promoted to the `document` table; the hash now comes from it.
    const pdfHash = await service.getOnboardingHash(id, userId)
    // The finalized-signature record for this case (the tamper-evident, user-bound proof).
    const signature = await service.getSignatureSummary(id, userId)
    return reply.send({
      id: c.id,
      planType: c.planType,
      answers: c.answers,
      status: c.status,
      pdfUrl: `/api/cases/${c.id}/pdf`,
      pdfHash,
      signature,
      createdAt: c.createdAt,
    })
  })

  app.get('/api/cases/:id/pdf', async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const { id } = request.params as { id: string }

    // signed-url mode: hand the browser a short-lived URL straight to storage
    // (saves API egress). Falls through to streaming if storage can't sign.
    if (pdfServeMode === 'signed-url') {
      const url = await service.getPdfSignedUrl(id, SIGNED_URL_TTL_SECONDS, userId)
      if (url) return reply.redirect(url)
    }

    // stream mode (default): proxy the bytes through the API so the PDF is served
    // from our own origin.
    const bytes = await service.getPdf(id, userId)
    if (!bytes) return reply.code(404).send({ error: 'not_found' })
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="onboarding-${id}.pdf"`)
      .send(Buffer.from(bytes))
  })
}

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PlanType } from '@fbsi/shared'
import { requireStaff } from '../../auth/guards'
import { ONBOARDING_PACKAGE } from '../documents'
import type { StaffService } from './service'

const SIGNED_URL_TTL_SECONDS = 300

const PLAN_TYPES = ['401k', '403b', '457b', 'simpleira', 'solo401k'] as const satisfies readonly PlanType[]

// q/status are free text; planType is constrained; paging is coerced + capped.
const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  planType: z.enum(PLAN_TYPES).optional(),
  status: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Internal staff dashboard — read-only, cross-owner. Every route is gated by
 * `requireStaff` (403 for a verified non-staff caller; the namespace itself is
 * privileged, so there's no per-resource existence to leak via 404).
 */
export function registerStaffRoutes(
  app: FastifyInstance,
  service: StaffService,
  pdfServeMode: 'stream' | 'signed-url' = 'stream',
): void {
  app.get('/api/staff/cases', { preHandler: requireStaff }, async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues })
    }
    const { rows, total } = await service.listCases(userId, parsed.data)
    return reply.send({ rows, total })
  })

  app.get('/api/staff/cases/:id', { preHandler: requireStaff }, async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const { id } = request.params as { id: string }
    const detail = await service.getCase(userId, id)
    if (!detail) return reply.code(404).send({ error: 'not_found' })

    const onboarding = detail.documents.find((d) => d.type === ONBOARDING_PACKAGE)
    return reply.send({
      id: detail.id,
      planType: detail.planType,
      status: detail.status,
      createdAt: detail.createdAt,
      answers: detail.answers,
      orgName: detail.orgName,
      ein: detail.ein,
      planName: detail.planName,
      pdfUrl: `/api/staff/cases/${detail.id}/pdf`,
      pdfHash: onboarding?.sha256 ?? null,
      parties: detail.parties,
      documents: detail.documents,
      signatureEvents: detail.signatureEvents,
    })
  })

  app.get('/api/staff/cases/:id/pdf', { preHandler: requireStaff }, async (request, reply) => {
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ error: 'unauthorized' })

    const { id } = request.params as { id: string }

    if (pdfServeMode === 'signed-url') {
      const url = await service.getPdfSignedUrl(userId, id, SIGNED_URL_TTL_SECONDS)
      if (url) return reply.redirect(url)
    }

    const bytes = await service.getPdf(userId, id)
    if (!bytes) return reply.code(404).send({ error: 'not_found' })
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="onboarding-${id}.pdf"`)
      .send(Buffer.from(bytes))
  })
}

import type { FastifyInstance } from 'fastify'
import { CaseService, ValidationError, createCaseSchema } from './service'

export function registerCaseRoutes(app: FastifyInstance, service: CaseService): void {
  app.post('/api/cases', async (request, reply) => {
    const parsed = createCaseSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues })
    }
    try {
      const result = await service.create(parsed.data)
      return reply.code(201).send(result)
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: 'validation_failed', errors: err.errors })
      }
      throw err
    }
  })

  app.get('/api/cases/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const c = await service.get(id)
    if (!c) return reply.code(404).send({ error: 'not_found' })
    return reply.send({
      id: c.id,
      planType: c.planType,
      answers: c.answers,
      status: c.status,
      pdfUrl: `/api/cases/${c.id}/pdf`,
      createdAt: c.createdAt,
    })
  })

  app.get('/api/cases/:id/pdf', async (request, reply) => {
    const { id } = request.params as { id: string }
    const bytes = await service.getPdf(id)
    if (!bytes) return reply.code(404).send({ error: 'not_found' })
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="onboarding-${id}.pdf"`)
      .send(Buffer.from(bytes))
  })
}

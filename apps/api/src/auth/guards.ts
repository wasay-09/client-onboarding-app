import type { FastifyReply, FastifyRequest } from 'fastify'
import { isStaff } from './verify'

/**
 * preHandler that restricts a route to internal staff/admin. The global onRequest
 * auth hook (registerAuth) has already verified the JWT and set request.user — so a
 * missing user means the request was let through un-gated (AUTH_BYPASS) or is the
 * dev path; we still 401 defensively. A verified non-staff caller gets 403.
 *
 * Note the deliberate 403 (not 404): the whole /api/staff namespace is privileged,
 * so there is no per-resource existence to leak — unlike the owner routes, which
 * return 404 for someone else's case.
 */
export async function requireStaff(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user?.id) return reply.code(401).send({ error: 'unauthorized' })
  if (!isStaff(request.user)) return reply.code(403).send({ error: 'forbidden' })
}

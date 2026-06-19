import type { FastifyInstance } from 'fastify'
import type { Config } from '../config'
import { createAuthVerifier, type AuthVerifier } from './verify'
import './types' // load the FastifyRequest.user augmentation

/** Endpoints reachable without a token. Everything else requires a verified JWT. */
function isPublic(method: string, url: string): boolean {
  if (method === 'OPTIONS') return true // CORS preflight — handled by @fastify/cors
  return url.split('?')[0] === '/health'
}

/**
 * Gate every request behind a verified Supabase JWT, attaching `request.user`.
 * Register AFTER cors + /health and BEFORE the protected routes.
 *
 * AUTH_BYPASS (local dev only) skips verification and acts as config.devUserId;
 * loadConfig() already refuses to start bypass against a real DATABASE_URL.
 */
export function registerAuth(app: FastifyInstance, config: Config): void {
  if (config.authBypass) {
    app.addHook('onRequest', async (request) => {
      request.user = { id: config.devUserId, role: config.devUserRole }
    })
    return
  }

  const verify: AuthVerifier = createAuthVerifier(config)

  app.addHook('onRequest', async (request, reply) => {
    if (isPublic(request.method, request.url)) return

    const header = request.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined
    if (!token) return reply.code(401).send({ error: 'unauthorized' })

    try {
      request.user = await verify(token)
    } catch {
      return reply.code(401).send({ error: 'unauthorized' })
    }
  })
}

import 'fastify'
import type { AuthUser } from './verify'

// The auth hook attaches the verified caller here; route handlers read request.user.
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

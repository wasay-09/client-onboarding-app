import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose'
import type { Config } from '../config'

/** The authenticated caller, derived from a verified Supabase JWT. */
export interface AuthUser {
  id: string
  email?: string
}

/** Thrown when a token is missing/expired/forged. Never leak the reason to clients. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export type AuthVerifier = (token: string) => Promise<AuthUser>

// Supabase issues access tokens with aud="authenticated" for signed-in users.
const EXPECTED_AUDIENCE = 'authenticated'

/**
 * Build a JWT verifier from config, locking in the key source ONCE:
 *  - SUPABASE_JWT_SECRET set  -> verify HS256 locally with the shared secret.
 *  - else SUPABASE_URL set    -> verify asymmetric tokens via the project's JWKS
 *                                (jose caches the fetched keys).
 * We verify the Supabase token ourselves (invariant 4) and deliberately avoid
 * Supabase's auth.uid()/request.jwt.claims so the API stays portable.
 */
export function createAuthVerifier(config: Config): AuthVerifier {
  if (config.supabaseJwtSecret) {
    const secret = new TextEncoder().encode(config.supabaseJwtSecret)
    return async (token) => {
      let payload: JWTPayload
      try {
        ;({ payload } = await jwtVerify(token, secret, {
          audience: EXPECTED_AUDIENCE,
          algorithms: ['HS256'],
        }))
      } catch (err) {
        throw new AuthError(`invalid token: ${(err as Error).message}`)
      }
      return toUser(payload)
    }
  }

  if (config.supabaseUrl) {
    const jwks = createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', config.supabaseUrl))
    const issuer = new URL('/auth/v1', config.supabaseUrl).toString()
    return async (token) => {
      let payload: JWTPayload
      try {
        // Pin asymmetric algorithms (Supabase signs with ES256/RS256). jose already
        // refuses HS* against a JWKS, but an explicit allowlist matches the HS256
        // branch's rigor and closes any algorithm-confusion door.
        ;({ payload } = await jwtVerify(token, jwks, {
          audience: EXPECTED_AUDIENCE,
          issuer,
          algorithms: ['RS256', 'ES256'],
        }))
      } catch (err) {
        throw new AuthError(`invalid token: ${(err as Error).message}`)
      }
      return toUser(payload)
    }
  }

  throw new Error(
    'Auth misconfigured: set SUPABASE_JWT_SECRET (HS256) or SUPABASE_URL (JWKS), ' +
      'or enable AUTH_BYPASS for local dev.',
  )
}

function toUser(payload: JWTPayload): AuthUser {
  if (!payload.sub) throw new AuthError('token has no subject')
  const email = typeof payload.email === 'string' ? payload.email : undefined
  return { id: payload.sub, email }
}

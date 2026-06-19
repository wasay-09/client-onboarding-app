import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type { Config } from './config'
import type { Database } from './db/client'
import { createStorage } from './storage'
import { registerAuth } from './auth/plugin'
import { CaseService, CaseStore, registerCaseRoutes } from './kernel/cases'

/** Build the server, wiring kernel slices to the DB + storage. Tests inject a pglite db. */
export function buildApp(config: Config, database: Database): FastifyInstance {
  const app = Fastify({ logger: false })

  app.register(cors, { origin: config.webOrigin === '*' ? true : config.webOrigin })

  app.get('/health', async () => ({ ok: true }))

  // Identity gate: verifies the Supabase JWT and sets request.user. Must come
  // before the protected routes below so /api/* requires authentication.
  registerAuth(app, config)

  const store = new CaseStore(database.db)
  const storage = createStorage(config)
  const service = new CaseService(store, storage)
  registerCaseRoutes(app, service, config.pdfServeMode)

  return app
}

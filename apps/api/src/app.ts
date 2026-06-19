import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type { Config } from './config'
import type { Database } from './db/client'
import { createStorage } from './storage'
import { registerAuth } from './auth/plugin'
import { CaseService, CaseStore, registerCaseRoutes } from './kernel/cases'
import { DocumentStore } from './kernel/documents'
import { SignatureStore } from './kernel/signatures'
import { StaffService, StaffStore, registerStaffRoutes } from './kernel/staff'

/** Build the server, wiring kernel slices to the DB + storage. Tests inject a pglite db. */
export function buildApp(config: Config, database: Database): FastifyInstance {
  // trustProxy: trust exactly N reverse-proxy hops so request.ip (recorded in the ESIGN
  // audit log) is the real client. A HOP COUNT, never "trust all" — trusting all would let
  // a client forge request.ip via X-Forwarded-For. 0 → false (off; use the socket IP).
  const app = Fastify({ logger: false, trustProxy: config.trustProxy || false })

  app.register(cors, { origin: config.webOrigin === '*' ? true : config.webOrigin })

  app.get('/health', async () => ({ ok: true }))

  // Identity gate: verifies the Supabase JWT and sets request.user. Must come
  // before the protected routes below so /api/* requires authentication.
  registerAuth(app, config)

  const store = new CaseStore(database.db)
  const documents = new DocumentStore(database.db)
  const signatures = new SignatureStore(database.db)
  const storage = createStorage(config)
  const service = new CaseService(store, documents, signatures, storage)
  registerCaseRoutes(app, service, config.pdfServeMode)

  // Internal staff dashboard: cross-owner read of any case (role-gated in the routes).
  const staffService = new StaffService(new StaffStore(database.db), storage)
  registerStaffRoutes(app, staffService, config.pdfServeMode)

  return app
}

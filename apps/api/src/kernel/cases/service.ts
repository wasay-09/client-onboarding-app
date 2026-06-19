import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getPlan, validate, type FieldError, type FormValues, type PlanType } from '@fbsi/shared'
import type { Case, SignatureEvent } from '../../db/schema/kernel'
import type { PdfStorage } from '../../storage'
import { renderOnboardingPackage } from '../../pdf'
import { DocumentStore, ONBOARDING_PACKAGE } from '../documents'
import { SignatureStore, deriveSignatureEvents, SLA_SIGNATURE } from '../signatures'
import type { CaseStore } from './store'

/** Where the signing act happened — captured from the request so the audit log is
 *  ESIGN/UETA-valid. IP needs Fastify trustProxy when behind nginx (see config). */
export interface SignContext {
  ip: string | null
  userAgent: string | null
  /** The signer's account email from the verified JWT (undefined under AUTH_BYPASS). */
  signerEmail: string | null
}

/** Owner-facing view of a case's finalized signatures (no IP/user-agent — that audit
 *  metadata is for staff). `signed` is true once an SLA signature is on record. */
export interface SignatureSummary {
  signed: boolean
  events: Array<{
    eventType: string
    signerName: string | null
    signerTitle: string | null
    method: string
    consented: boolean
    documentSha256: string
    createdAt: Date
  }>
}

// Runtime list for the Zod envelope; `satisfies` guards against a typo'd plan type.
const PLAN_TYPES = ['401k', '403b', '457b', 'simpleira', 'solo401k'] as const satisfies readonly PlanType[]

export const createCaseSchema = z.object({
  planType: z.enum(PLAN_TYPES),
  answers: z.record(z.string(), z.string()),
})
export type CreateCaseRequest = z.infer<typeof createCaseSchema>

export class ValidationError extends Error {
  readonly errors: FieldError[]

  constructor(errors: FieldError[]) {
    super('validation failed')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/** The only surface other modules may call. Re-validates on the server. */
export class CaseService {
  private readonly store: CaseStore
  private readonly documents: DocumentStore
  private readonly signatures: SignatureStore
  private readonly storage: PdfStorage

  constructor(store: CaseStore, documents: DocumentStore, signatures: SignatureStore, storage: PdfStorage) {
    this.store = store
    this.documents = documents
    this.signatures = signatures
    this.storage = storage
  }

  async create(req: CreateCaseRequest, userId: string, sign: SignContext): Promise<{ id: string; pdfUrl: string }> {
    const planType: PlanType = req.planType
    const answers: FormValues = req.answers

    // Invariant 3: re-run the shared validator on the server — never trust the client.
    const errors = validate(getPlan(planType).sections, answers)
    if (errors.length > 0) throw new ValidationError(errors)

    const created = await this.store.create({ planType, answers }, userId)

    // Canonical PDF is server-made from the same answers the client used, so it embeds the
    // captured signature image — i.e. this hash IS the hash of the exact signed PDF.
    const bytes = await renderOnboardingPackage(planType, answers)
    const pdfHash = createHash('sha256').update(bytes).digest('hex')
    const key = await this.storage.put(`cases/${created.id}.pdf`, bytes)

    // Server-side signature finalization: re-derive which finalized signatures/certifications
    // the submission carries (never trusting the client to declare "signed"), then write the
    // document AND the append-only audit events atomically. An SLA signature also stamps the
    // document's signed_at; a certification leaves it null (it attests data, it isn't an
    // executed agreement).
    const events = deriveSignatureEvents(planType, answers)
    const signed = events.some((e) => e.eventType === SLA_SIGNATURE)
    await this.documents.create(
      {
        caseId: created.id,
        organizationId: created.organizationId,
        type: ONBOARDING_PACKAGE,
        storageKey: key,
        sha256: pdfHash,
        signedAt: signed ? new Date() : null,
      },
      events,
      { signerUserId: userId, signerEmail: sign.signerEmail, ip: sign.ip, userAgent: sign.userAgent },
      userId,
    )

    return { id: created.id, pdfUrl: `/api/cases/${created.id}/pdf` }
  }

  get(id: string, userId: string): Promise<Case | null> {
    return this.store.get(id, userId)
  }

  /** The SHA-256 of a case's canonical PDF, from its `document` row (or null). The
   *  GET /cases/:id response keeps exposing this for document-integrity checks. */
  async getOnboardingHash(id: string, userId: string): Promise<string | null> {
    const doc = await this.documents.findByCase(id, ONBOARDING_PACKAGE, userId)
    return doc?.sha256 ?? null
  }

  /** The owner's view of a case's finalized signatures (signed status + the events,
   *  minus the IP/user-agent audit metadata reserved for staff). RLS-scoped. */
  async getSignatureSummary(id: string, userId: string): Promise<SignatureSummary> {
    const events = await this.signatures.listByCase(id, userId)
    return {
      signed: events.some((e: SignatureEvent) => e.eventType === SLA_SIGNATURE),
      events: events.map((e: SignatureEvent) => ({
        eventType: e.eventType,
        signerName: e.signerName,
        signerTitle: e.signerTitle,
        method: e.method,
        consented: e.consented,
        documentSha256: e.documentSha256,
        createdAt: e.createdAt,
      })),
    }
  }

  /** The caller's most recent case (any plan type) — used to pre-fill a new
   *  questionnaire across sessions ("ask once"). Null if they have none. */
  getLatest(userId: string): Promise<Case | null> {
    return this.store.getLatest(userId)
  }

  async getPdf(id: string, userId: string): Promise<Uint8Array | null> {
    const doc = await this.documents.findByCase(id, ONBOARDING_PACKAGE, userId)
    if (!doc) return null
    return this.storage.get(doc.storageKey)
  }

  /** A short-lived signed URL to the stored PDF, when the storage backend supports
   *  it (Supabase). Returns null for backends that can't (local) — caller streams. */
  async getPdfSignedUrl(id: string, expiresInSeconds: number, userId: string): Promise<string | null> {
    const doc = await this.documents.findByCase(id, ONBOARDING_PACKAGE, userId)
    if (!doc || !this.storage.signedUrl) return null
    return this.storage.signedUrl(doc.storageKey, expiresInSeconds)
  }
}

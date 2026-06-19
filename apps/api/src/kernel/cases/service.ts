import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getPlan, validate, type FieldError, type FormValues, type PlanType } from '@fbsi/shared'
import type { Case } from '../../db/schema/kernel'
import type { PdfStorage } from '../../storage'
import { renderOnboardingPackage } from '../../pdf'
import { DocumentStore, ONBOARDING_PACKAGE } from '../documents'
import type { CaseStore } from './store'

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
  private readonly storage: PdfStorage

  constructor(store: CaseStore, documents: DocumentStore, storage: PdfStorage) {
    this.store = store
    this.documents = documents
    this.storage = storage
  }

  async create(req: CreateCaseRequest, userId: string): Promise<{ id: string; pdfUrl: string }> {
    const planType: PlanType = req.planType
    const answers: FormValues = req.answers

    // Invariant 3: re-run the shared validator on the server — never trust the client.
    const errors = validate(getPlan(planType).sections, answers)
    if (errors.length > 0) throw new ValidationError(errors)

    const created = await this.store.create({ planType, answers }, userId)

    // Canonical PDF is server-made, then stored as a `document` kernel row. Its SHA-256
    // is recorded for document integrity (audit log + signature workflow prep).
    const bytes = await renderOnboardingPackage(planType, answers)
    const pdfHash = createHash('sha256').update(bytes).digest('hex')
    const key = await this.storage.put(`cases/${created.id}.pdf`, bytes)
    await this.documents.create(
      { caseId: created.id, organizationId: created.organizationId, type: ONBOARDING_PACKAGE, storageKey: key, sha256: pdfHash },
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

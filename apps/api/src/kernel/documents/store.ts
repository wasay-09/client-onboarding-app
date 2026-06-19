import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { DB } from '../../db/client'
import type { Tx } from '../../db/scope'
import { withUserScope } from '../../db/scope'
import { document, type Document } from '../../db/schema/kernel'
import { insertSignatureEvent, type SignatureEventDraft } from '../signatures'

export interface CreateDocumentInput {
  caseId: string
  organizationId: string
  type: string
  storageKey: string
  sha256: string
  /** Execution time when the document carries a finalized signature; null otherwise. */
  signedAt?: Date | null
}

/** Server-side context for the signature events written alongside a document. The
 *  per-event fields come from the answers (SignatureEventDraft); these are added by the
 *  server at write time so the client can never assert them. */
export interface SignatureContext {
  signerUserId: string
  signerEmail: string | null
  ip: string | null
  userAgent: string | null
}

/** DB access for the `document` kernel table — the canonical PDF and any documents a
 *  case later accrues (service agreement, signed copies). Owner-scoped via withUserScope,
 *  so RLS limits each op to the caller's organizations. Staff read via the staff slice. */
export class DocumentStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /**
   * Insert a document for a case the caller owns AND, in the SAME transaction, append any
   * finalized signature/certification events to the append-only audit log — so a signed
   * document and its tamper-evident record are written atomically (all or nothing).
   * `organizationId` comes from the just-created case so the by-org WITH CHECK passes.
   * Pass `events: []` for an unsigned submission (just the document, no audit rows).
   */
  async create(
    input: CreateDocumentInput,
    events: SignatureEventDraft[],
    ctx: SignatureContext,
    userId: string,
  ): Promise<Document> {
    return withUserScope(this.db, userId, async (tx) => {
      const doc = await insertDocument(tx, input)
      for (const e of events) {
        await insertSignatureEvent(tx, {
          documentId: doc.id,
          caseId: input.caseId,
          organizationId: input.organizationId,
          eventType: e.eventType,
          signerUserId: ctx.signerUserId,
          signerName: e.signerName,
          signerTitle: e.signerTitle,
          signerEmail: ctx.signerEmail,
          method: e.method,
          consented: e.consented,
          consentAt: e.consentAt,
          documentSha256: input.sha256, // freeze the exact signed PDF's hash on the event
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        })
      }
      return doc
    })
  }

  /** The most recent document of a type for a case, or null. Scoped by RLS. */
  async findByCase(caseId: string, type: string, userId: string): Promise<Document | null> {
    return withUserScope(this.db, userId, async (tx) => findLatest(tx, caseId, type))
  }
}

/** Insert a document on an existing tx (e.g. inside another scope). */
export function insertDocument(tx: Tx, input: CreateDocumentInput): Promise<Document> {
  return tx
    .insert(document)
    .values({ id: randomUUID(), ...input })
    .returning()
    .then((rows) => rows[0])
}

/** Latest document of a type for a case on an existing tx (used by the staff slice). */
export async function findLatest(tx: Tx, caseId: string, type: string): Promise<Document | null> {
  const [row] = await tx
    .select()
    .from(document)
    .where(and(eq(document.caseId, caseId), eq(document.type, type)))
    .orderBy(desc(document.createdAt))
    .limit(1)
  return row ?? null
}

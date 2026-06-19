import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import type { DB } from '../../db/client'
import type { Tx } from '../../db/scope'
import { withUserScope } from '../../db/scope'
import { signatureEvent, type SignatureEvent } from '../../db/schema/kernel'

/** A row for the append-only signature_event log. `signerUserId` is the authenticated
 *  caller (identity binding); `documentSha256` is a frozen copy of the signed PDF's hash. */
export interface RecordSignatureInput {
  documentId: string
  caseId: string
  organizationId: string
  eventType: string
  signerUserId: string
  signerName: string | null
  signerTitle: string | null
  signerEmail: string | null
  method: string
  consented: boolean
  consentAt: string | null
  documentSha256: string
  ip: string | null
  userAgent: string | null
}

/**
 * Append a signature/consent audit event on an EXISTING tx — composed with the document
 * insert (DocumentStore.create) so the signed document and its audit record are written
 * atomically, in the caller's org scope. Append-only is enforced by the DB grant
 * (SELECT + INSERT only, migration 0008); there is deliberately no update/delete path.
 */
export function insertSignatureEvent(tx: Tx, input: RecordSignatureInput): Promise<SignatureEvent> {
  return tx
    .insert(signatureEvent)
    .values({ id: randomUUID(), ...input })
    .returning()
    .then((rows) => rows[0])
}

/** All signature/consent events for a case, newest first, on an existing tx. Used by the
 *  owner read (withUserScope) and the staff read (withStaffScope). */
export function findEventsByCase(tx: Tx, caseId: string): Promise<SignatureEvent[]> {
  return tx
    .select()
    .from(signatureEvent)
    .where(eq(signatureEvent.caseId, caseId))
    .orderBy(desc(signatureEvent.createdAt))
}

/** Owner-scoped reads of the audit log. Writes happen inside DocumentStore.create (one tx
 *  with the document); this slice owns the read surface + the append-only insert helper. */
export class SignatureStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /** The case's signature/consent events, scoped to the caller by RLS. */
  listByCase(caseId: string, userId: string): Promise<SignatureEvent[]> {
    return withUserScope(this.db, userId, async (tx) => findEventsByCase(tx, caseId))
  }
}

import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { DB } from '../../db/client'
import type { Tx } from '../../db/scope'
import { withUserScope } from '../../db/scope'
import { document, type Document } from '../../db/schema/kernel'

export interface CreateDocumentInput {
  caseId: string
  organizationId: string
  type: string
  storageKey: string
  sha256: string
}

/** DB access for the `document` kernel table — the canonical PDF and any documents a
 *  case later accrues (service agreement, signed copies). Owner-scoped via withUserScope,
 *  so RLS limits each op to the caller's organizations. Staff read via the staff slice. */
export class DocumentStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /** Insert a document for a case the caller owns. `organizationId` comes from the
   *  just-created case so the by-org WITH CHECK passes. */
  async create(input: CreateDocumentInput, userId: string): Promise<Document> {
    return withUserScope(this.db, userId, async (tx) => insertDocument(tx, input))
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

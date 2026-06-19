import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { PlanType } from '@fbsi/shared'
import type { DB } from '../../db/client'
import { withStaffScope } from '../../db/scope'
import { cases, document, organization, party, plan, type Document } from '../../db/schema/kernel'
import { findLatest } from '../documents'

export interface StaffCaseFilter {
  q?: string
  planType?: PlanType
  status?: string
  limit: number
  offset: number
}

// Columns surfaced in the list — summary only, no answers JSONB, no storage keys.
const listColumns = {
  id: cases.id,
  planType: cases.planType,
  status: cases.status,
  createdAt: cases.createdAt,
  ownerId: cases.ownerId,
  orgName: organization.name,
  ein: organization.ein,
  planName: plan.name,
}

/** Cross-owner reads for the internal staff dashboard. Every method runs inside
 *  `withStaffScope`, so the permissive `*_staff` SELECT policies open up reads across
 *  owners while RLS still bars writes. The API's requireStaff gate is the primary wall. */
export class StaffStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /** A page of cases (newest first) plus the total matching the filter. */
  async list(userId: string, f: StaffCaseFilter) {
    return withStaffScope(this.db, userId, async (tx) => {
      const conds = []
      if (f.q) {
        const like = `%${f.q}%`
        conds.push(or(ilike(organization.name, like), ilike(organization.ein, like), ilike(plan.name, like)))
      }
      if (f.planType) conds.push(eq(cases.planType, f.planType))
      if (f.status) conds.push(eq(cases.status, f.status))
      const where = conds.length ? and(...conds) : undefined

      const rows = await tx
        .select(listColumns)
        .from(cases)
        .innerJoin(organization, eq(organization.id, cases.organizationId))
        .innerJoin(plan, eq(plan.id, cases.planId))
        .where(where)
        .orderBy(desc(cases.createdAt), cases.id) // stable tiebreaker for offset paging
        .limit(f.limit)
        .offset(f.offset)

      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(cases)
        .innerJoin(organization, eq(organization.id, cases.organizationId))
        .innerJoin(plan, eq(plan.id, cases.planId))
        .where(where)

      return { rows, total }
    })
  }

  /** Full case detail (answers + org + plan + canonical parties + documents) or null. */
  async get(userId: string, id: string) {
    return withStaffScope(this.db, userId, async (tx) => {
      const [row] = await tx
        .select({
          id: cases.id,
          planType: cases.planType,
          status: cases.status,
          createdAt: cases.createdAt,
          answers: cases.answers,
          organizationId: cases.organizationId,
          orgName: organization.name,
          ein: organization.ein,
          planName: plan.name,
        })
        .from(cases)
        .innerJoin(organization, eq(organization.id, cases.organizationId))
        .innerJoin(plan, eq(plan.id, cases.planId))
        .where(eq(cases.id, id))
        .limit(1)
      if (!row) return null

      const parties = await tx
        .select({
          id: party.id,
          role: party.role,
          name: party.name,
          email: party.email,
          phone: party.phone,
          title: party.title,
          isAuthorizedSigner: party.isAuthorizedSigner,
        })
        .from(party)
        .where(eq(party.organizationId, row.organizationId))
        .orderBy(party.role, party.createdAt)

      const documents = await tx
        .select({
          id: document.id,
          type: document.type,
          sha256: document.sha256,
          signedAt: document.signedAt,
          createdAt: document.createdAt,
        })
        .from(document)
        .where(eq(document.caseId, id))
        .orderBy(desc(document.createdAt))

      return { ...row, parties, documents }
    })
  }

  /** The latest document of a type for a case (for the PDF route). Includes the storage
   *  key — kept server-side, never returned to the browser. */
  async findDocument(userId: string, caseId: string, type: string): Promise<Document | null> {
    return withStaffScope(this.db, userId, async (tx) => findLatest(tx, caseId, type))
  }
}

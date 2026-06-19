import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { FormValues, PlanType } from '@fbsi/shared'
import type { DB } from '../../db/client'
import { withUserScope } from '../../db/scope'
import { cases, organization, plan, type Case } from '../../db/schema/kernel'

export interface CreateCaseInput {
  planType: PlanType
  answers: FormValues
}

/** DB access for the case flow. Owns the kernel rows created per submission.
 *  Every method runs inside `withUserScope` so RLS is enforced by `userId`. */
export class CaseStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /** Create organization + plan + case atomically, all owned by `userId`. */
  async create(input: CreateCaseInput, userId: string): Promise<Case> {
    const orgId = randomUUID()
    const planId = randomUUID()
    const caseId = randomUUID()
    const { answers, planType } = input

    return withUserScope(this.db, userId, async (tx) => {
      await tx.insert(organization).values({
        id: orgId,
        name: answers.companyName?.trim() || 'Unknown',
        ein: answers.ein || null,
        ownerId: userId,
      })
      await tx.insert(plan).values({
        id: planId,
        organizationId: orgId,
        planType,
        name: answers.planName || null,
      })
      const [row] = await tx
        .insert(cases)
        .values({ id: caseId, organizationId: orgId, planId, planType, answers, ownerId: userId })
        .returning()
      return row
    })
  }

  async setPdf(
    id: string,
    pdf: { pdfPath: string; pdfHash: string },
    userId: string,
  ): Promise<void> {
    await withUserScope(this.db, userId, async (tx) => {
      await tx
        .update(cases)
        .set({ pdfPath: pdf.pdfPath, pdfHash: pdf.pdfHash, updatedAt: new Date() })
        .where(eq(cases.id, id))
    })
  }

  /** Fetch a case — null if it doesn't exist OR isn't in the user's organization.
   *  Scoped in app logic (the org-ownership join) AND by RLS (the scope wrapper). */
  async get(id: string, userId: string): Promise<Case | null> {
    return withUserScope(this.db, userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(cases)
        .innerJoin(organization, eq(organization.id, cases.organizationId))
        .where(and(eq(cases.id, id), eq(organization.ownerId, userId)))
        .limit(1)
      return row?.cases ?? null
    })
  }
}

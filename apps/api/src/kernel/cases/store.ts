import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FormValues, PlanType } from '@fbsi/shared'
import type { DB } from '../../db/client'
import { cases, organization, plan, type Case } from '../../db/schema/kernel'

export interface CreateCaseInput {
  planType: PlanType
  answers: FormValues
}

/** DB access for the case flow. Owns the kernel rows created per submission. */
export class CaseStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /** Create organization + plan + case atomically. */
  async create(input: CreateCaseInput): Promise<Case> {
    const orgId = randomUUID()
    const planId = randomUUID()
    const caseId = randomUUID()
    const { answers, planType } = input

    return this.db.transaction(async (tx) => {
      await tx.insert(organization).values({
        id: orgId,
        name: answers.companyName?.trim() || 'Unknown',
        ein: answers.ein || null,
      })
      await tx.insert(plan).values({
        id: planId,
        organizationId: orgId,
        planType,
        name: answers.planName || null,
      })
      const [row] = await tx
        .insert(cases)
        .values({ id: caseId, organizationId: orgId, planId, planType, answers })
        .returning()
      return row
    })
  }

  async setPdfPath(id: string, pdfPath: string): Promise<void> {
    await this.db.update(cases).set({ pdfPath, updatedAt: new Date() }).where(eq(cases.id, id))
  }

  async get(id: string): Promise<Case | null> {
    const [row] = await this.db.select().from(cases).where(eq(cases.id, id)).limit(1)
    return row ?? null
  }
}

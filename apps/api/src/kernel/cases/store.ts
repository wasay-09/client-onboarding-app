import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { FormValues, PlanType } from '@fbsi/shared'
import type { DB } from '../../db/client'
import { withUserScope } from '../../db/scope'
import { cases, organization, plan, type Case } from '../../db/schema/kernel'
import { projectParties } from '../parties'

export interface CreateCaseInput {
  planType: PlanType
  answers: FormValues
}

/** The organization's natural key: EIN reduced to digits only, so '12-3456789'
 *  and '123456789' resolve to the same employer. Empty -> null (no key). The raw,
 *  formatted EIN is preserved in `answers.ein` (JSONB) for the PDF. */
export function normalizeEin(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits || null
}

/** DB access for the case flow. Owns the kernel rows created per submission.
 *  Every method runs inside `withUserScope` so RLS is enforced by `userId`. */
export class CaseStore {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  /**
   * Persist a submission, atomically, all owned by `userId`. "Ask once" across
   * sessions: an existing organization (matched by its EIN natural key) and an
   * existing plan of this type are REUSED rather than duplicated; only the case is
   * always new (each submission is its own row → "most recent answers"). Reuse
   * lookups run inside `withUserScope`, so RLS already limits them to the caller's
   * own rows. The UNIQUE(owner_id, ein) index is the backstop behind the find-first.
   */
  async create(input: CreateCaseInput, userId: string): Promise<Case> {
    const { answers, planType } = input
    const ein = normalizeEin(answers.ein)

    return withUserScope(this.db, userId, async (tx) => {
      // Reuse the org by its EIN natural key, else create it.
      const existingOrg = ein
        ? await tx
            .select()
            .from(organization)
            .where(and(eq(organization.ownerId, userId), eq(organization.ein, ein)))
            .limit(1)
        : []
      const org =
        existingOrg[0] ??
        (
          await tx
            .insert(organization)
            .values({
              id: randomUUID(),
              name: answers.companyName?.trim() || 'Unknown',
              ein,
              ownerId: userId,
            })
            .returning()
        )[0]

      // Reuse this org's plan of the same type, else create it.
      const existingPlan = await tx
        .select()
        .from(plan)
        .where(and(eq(plan.organizationId, org.id), eq(plan.planType, planType)))
        .limit(1)
      const planRow =
        existingPlan[0] ??
        (
          await tx
            .insert(plan)
            .values({ id: randomUUID(), organizationId: org.id, planType, name: answers.planName || null })
            .returning()
        )[0]

      const [row] = await tx
        .insert(cases)
        .values({ id: randomUUID(), organizationId: org.id, planId: planRow.id, planType, answers, ownerId: userId })
        .returning()

      // Promote contacts into canonical kernel parties, in the SAME tx (atomic with the
      // case). Raw contacts stay in `answers` for the PDF; this is the normalized copy
      // the payroll + advisor modules consume.
      await projectParties(tx, org.id, row.id, answers)
      return row
    })
  }

  /** The user's most recent case (any plan type), for cross-session pre-fill — or
   *  null if they have none. Scoped by org ownership AND by RLS. */
  async getLatest(userId: string): Promise<Case | null> {
    return withUserScope(this.db, userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(cases)
        .innerJoin(organization, eq(organization.id, cases.organizationId))
        .where(eq(organization.ownerId, userId))
        .orderBy(desc(cases.createdAt))
        .limit(1)
      return row?.cases ?? null
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

import { randomUUID } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { parseTable, type FormValues, type TableRow } from '@fbsi/shared'
import type { Tx } from '../../db/scope'
import { party } from '../../db/schema/kernel'

/** A canonical person to project into the `party` kernel table. */
interface PartyDraft {
  role: string
  name: string | null
  email: string | null
  phone: string | null
  title: string | null
  isAuthorizedSigner: boolean | null
}

const trimmed = (s: string | undefined): string | null => {
  const t = s?.trim()
  return t ? t : null
}
const signer = (s: string | undefined): boolean | null => (s === 'Yes' ? true : s === 'No' ? false : null)

/**
 * Derive canonical parties from a submission's answers. The RAW contact fields stay in
 * `answers` JSONB (the PDF reads them); this is the normalized projection the payroll +
 * advisor modules consume. Singular contacts come from well-known keys; the repeating-row
 * tables (additional*) explode into one draft each via the shared `parseTable`. Drafts
 * with neither a name nor an email are dropped.
 */
export function buildParties(answers: FormValues): PartyDraft[] {
  const drafts: PartyDraft[] = []
  const push = (d: PartyDraft) => {
    if (d.name || d.email) drafts.push(d)
  }
  const rowVal = (r: TableRow, k: string) => trimmed(r[k])

  push({
    role: 'primary_contact',
    name: trimmed(answers.primaryContactName),
    email: trimmed(answers.primaryContactEmail),
    phone: trimmed(answers.primaryContactPhone),
    title: null,
    isAuthorizedSigner: signer(answers.primaryIsAuthorizedSigner),
  })
  push({
    role: 'advisor',
    name: trimmed(answers.brokerName),
    email: trimmed(answers.brokerEmail),
    phone: trimmed(answers.brokerPhone),
    title: trimmed(answers.advisorFirmName),
    isAuthorizedSigner: null,
  })
  push({
    role: 'payroll',
    name: trimmed(answers.payrollContactInternal),
    email: trimmed(answers.payrollContactEmail),
    phone: null,
    title: trimmed(answers.payrollProvider),
    isAuthorizedSigner: null,
  })
  push({
    role: 'ach',
    name: trimmed(answers.achContactName),
    email: trimmed(answers.achContactEmail),
    phone: null,
    title: null,
    isAuthorizedSigner: null,
  })
  push({ role: 'trustee', name: trimmed(answers.planTrustee), email: null, phone: null, title: null, isAuthorizedSigner: null })

  for (const r of parseTable(answers.additionalContacts)) {
    push({ role: 'contact', name: rowVal(r, 'name'), email: rowVal(r, 'email'), phone: rowVal(r, 'phone'), title: rowVal(r, 'roles'), isAuthorizedSigner: null })
  }
  for (const r of parseTable(answers.additionalTrustees)) {
    push({ role: 'trustee', name: rowVal(r, 'name'), email: rowVal(r, 'email'), phone: rowVal(r, 'phone'), title: null, isAuthorizedSigner: null })
  }
  for (const r of parseTable(answers.additionalAdvisors)) {
    push({ role: 'advisor', name: rowVal(r, 'name'), email: rowVal(r, 'email'), phone: rowVal(r, 'phone'), title: rowVal(r, 'access'), isAuthorizedSigner: null })
  }
  return drafts
}

/** Collapse drafts that resolve to the same canonical person (role + email, or role +
 *  name when no email), matching the DB's partial unique index. Later wins. */
function dedupe(drafts: PartyDraft[]): PartyDraft[] {
  const byKey = new Map<string, PartyDraft>()
  for (const d of drafts) {
    const key = `${d.role}|${d.email ? `e:${d.email.toLowerCase()}` : `n:${(d.name ?? '').toLowerCase()}`}`
    byKey.set(key, d)
  }
  return [...byKey.values()]
}

/**
 * Project a submission's contacts into the `party` kernel table inside the SAME tx as
 * the case insert (atomic, owner-scoped — the by-org WITH CHECK passes because the org
 * is the caller's). Idempotent: re-submitting an org reuses each canonical person rather
 * than duplicating it (read-then-write — the partial functional unique index isn't a
 * usable ON CONFLICT target). Defensive (parseTable swallows bad JSON), so a malformed
 * contact never rolls back the case.
 */
export async function projectParties(tx: Tx, organizationId: string, sourceCaseId: string, answers: FormValues): Promise<void> {
  for (const d of dedupe(buildParties(answers))) {
    const keyConds = d.email
      ? [sql`lower(${party.email}) = ${d.email.toLowerCase()}`]
      : [isNull(party.email), sql`lower(${party.name}) = ${(d.name ?? '').toLowerCase()}`]
    const [existing] = await tx
      .select({ id: party.id })
      .from(party)
      .where(and(eq(party.organizationId, organizationId), eq(party.role, d.role), ...keyConds))
      .limit(1)

    if (existing) {
      await tx
        .update(party)
        .set({ name: d.name, email: d.email, phone: d.phone, title: d.title, isAuthorizedSigner: d.isAuthorizedSigner })
        .where(eq(party.id, existing.id))
    } else {
      await tx.insert(party).values({
        id: randomUUID(),
        organizationId,
        sourceCaseId,
        role: d.role,
        name: d.name,
        email: d.email,
        phone: d.phone,
        title: d.title,
        isAuthorizedSigner: d.isAuthorizedSigner,
      })
    }
  }
}

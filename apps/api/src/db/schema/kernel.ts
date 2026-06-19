import { pgTable, uuid, text, jsonb, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { FormValues, PlanType } from '@fbsi/shared'

// SHARED KERNEL — the small, governed core that every module references.
// Module-specific tables (census, funds, ...) are intentionally NOT here; they
// arrive with their modules (promote-on-evidence). FKs point toward the kernel.
//
// `id` values are generated in the app (crypto.randomUUID) so we don't depend on
// a DB-side gen_random_uuid() being available across drivers (pglite vs Postgres).

export const organization = pgTable(
  'organization',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    ein: text('ein'), // normalized to digits-only — the org's natural key (Phase 3)
    ownerId: uuid('owner_id'), // Phase 4 (Supabase Auth); nullable until then
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Phase 3 "ask once": EIN is the employer's natural key, so reuse-on-resubmit
  // never makes a duplicate org. Scoped PER OWNER (not global) so it can't leak
  // another tenant's existence and stays aligned with RLS. Partial (ein not null)
  // so null EINs and pre-auth (null owner_id) rows never collide.
  (t) => [uniqueIndex('organization_owner_ein_unique').on(t.ownerId, t.ein).where(sql`ein is not null`)],
)

export const plan = pgTable('plan', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organization.id),
  planType: text('plan_type').$type<PlanType>().notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Table name is 'cases' (not 'case') — 'case' is a SQL reserved word.
export const cases = pgTable('cases', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organization.id),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plan.id),
  planType: text('plan_type').$type<PlanType>().notNull(),
  status: text('status').notNull().default('submitted'),
  answers: jsonb('answers').$type<FormValues>().notNull(), // Tier 2 — no migration to add fields
  // The PDF (and any later documents) are promoted to the `document` kernel table —
  // pdf_path/pdf_hash were dropped in migration 0007. See kernel/documents/.
  ownerId: uuid('owner_id'), // Phase 4; nullable until then
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Promote-on-evidence (invariant 7): the canonical PDF — and the documents a case
// later accrues (service agreement, signed copies) — are first-class kernel rows, not
// a single pdf_path string on `cases`. `signed_at` is prep for the signature workflow.
// FKs point only toward the kernel; `organization_id` is denormalized onto the row so
// the RLS policy scopes BY org exactly like `cases`, without a join.
export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    type: text('type').notNull(), // e.g. 'onboarding_package'
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256'),
    signedAt: timestamp('signed_at', { withTimezone: true }), // null until signed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('document_case_type_idx').on(t.caseId, t.type)],
)

// Promote-on-evidence (invariant 7): contacts move out of `answers` JSONB into canonical
// kernel parties because the payroll + advisor modules need them structured (the "second
// module needs it" trigger). The RAW contacts STAY in `answers` for the PDF — `party` is
// the normalized copy, mirroring organization.ein vs answers.ein. Deduped per org.
export const party = pgTable(
  'party',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    sourceCaseId: uuid('source_case_id').references(() => cases.id), // provenance; nullable
    role: text('role').notNull(), // 'primary_contact' | 'contact' | 'trustee' | 'advisor' | 'payroll' | 'ach'
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    title: text('title'), // free text: role labels / advisor firm / payroll provider / access
    isAuthorizedSigner: boolean('is_authorized_signer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // HAND-OWNED INDEX: the migration writes this as a PARTIAL FUNCTIONAL unique index
  // — lower("email") WHERE email IS NOT NULL AND email <> '' — to dedupe the canonical
  // person per (org, role, email) case-insensitively. Drizzle can't model lower()/partial,
  // so the generated snapshot records the plain-column form; review (don't auto-apply) any
  // future drizzle-kit diff that tries to "correct" it. See drizzle/0005_party_table.sql.
  (t) => [uniqueIndex('party_org_role_email_unique').on(t.organizationId, t.role, t.email)],
)

export type Organization = typeof organization.$inferSelect
export type Plan = typeof plan.$inferSelect
export type Case = typeof cases.$inferSelect
export type NewCase = typeof cases.$inferInsert
export type Document = typeof document.$inferSelect
export type NewDocument = typeof document.$inferInsert
export type Party = typeof party.$inferSelect
export type NewParty = typeof party.$inferInsert

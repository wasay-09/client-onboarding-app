import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import type { FormValues, PlanType } from '@fbsi/shared'

// SHARED KERNEL — the small, governed core that every module references.
// Module-specific tables (census, funds, ...) are intentionally NOT here; they
// arrive with their modules (promote-on-evidence). FKs point toward the kernel.
//
// `id` values are generated in the app (crypto.randomUUID) so we don't depend on
// a DB-side gen_random_uuid() being available across drivers (pglite vs Postgres).

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  ein: text('ein'),
  ownerId: uuid('owner_id'), // Phase 4 (Supabase Auth); nullable until then
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

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
  pdfPath: text('pdf_path'),
  pdfHash: text('pdf_hash'), // SHA-256 of the canonical PDF (Phase 4 audit-log prep)
  ownerId: uuid('owner_id'), // Phase 4; nullable until then
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Organization = typeof organization.$inferSelect
export type Plan = typeof plan.$inferSelect
export type Case = typeof cases.$inferSelect
export type NewCase = typeof cases.$inferInsert

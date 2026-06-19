-- Promote contacts out of answers JSONB into canonical kernel `party` rows (the payroll
-- + advisor modules need structured contacts — the "second module needs it" trigger,
-- invariant 7). Raw contacts STAY in answers for the PDF (mirrors organization.ein vs
-- answers.ein). Populated GOING FORWARD by the app projection in CaseStore.create — no
-- historical backfill. Self-contained: grants/RLS/policies inline.
--
-- The unique index is PARTIAL + FUNCTIONAL (lower(email) where email present) so the
-- canonical person is deduped per (org, role, email) case-insensitively while null/empty
-- emails never collide. Drizzle can't model lower()/partial, so it's hand-written here;
-- the snapshot records the plain-column form (see the kernel.ts comment).
--
-- REVERSE (run by hand to roll back):
--   DROP POLICY IF EXISTS party_staff ON "party";
--   DROP POLICY IF EXISTS party_by_org ON "party";
--   DROP TABLE IF EXISTS "party";

CREATE TABLE "party" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_case_id" uuid,
	"role" text NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"title" text,
	"is_authorized_signer" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_source_case_id_cases_id_fk" FOREIGN KEY ("source_case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "party_org_role_email_unique" ON "party" USING btree ("organization_id","role",lower("email")) WHERE "email" IS NOT NULL AND "email" <> '';--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "party" TO app_authenticated;--> statement-breakpoint
ALTER TABLE "party" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owners see/insert their own org's parties (mirrors cases_by_org).
CREATE POLICY party_by_org ON "party" USING (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid)) WITH CHECK (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid));--> statement-breakpoint
-- Staff get cross-owner READ only (defense-in-depth behind the API role gate).
CREATE POLICY party_staff ON "party" FOR SELECT USING (current_setting('app.is_staff', true) = 'on');

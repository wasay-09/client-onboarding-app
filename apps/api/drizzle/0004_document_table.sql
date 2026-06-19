-- Promote the canonical PDF off cases.pdf_path/pdf_hash into a first-class `document`
-- kernel table (invariant 7). EXPAND/CONTRACT step 1: create + backfill; the DROP of
-- cases.pdf_path/pdf_hash is migration 0007 (after the code switches to DocumentStore).
-- Self-contained for `document`: grants, RLS, by-org policy AND staff SELECT policy live
-- here. One SQL command per breakpoint line (the driver rejects multiple per chunk — see 0002).
--
-- REVERSE (forward-only files; run by hand to roll back):
--   DROP POLICY IF EXISTS document_staff ON "document";
--   DROP POLICY IF EXISTS document_by_org ON "document";
--   DROP TABLE IF EXISTS "document";   -- (run 0007's reverse first to repopulate pdf_*)

CREATE TABLE "document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" text NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_case_type_idx" ON "document" USING btree ("case_id","type");--> statement-breakpoint
-- Backfill one document per existing case that already has a stored PDF. Runs as the
-- migration role (RLS bypassed), so it sees every row. The id is a driver-agnostic
-- md5-as-uuid (the app generates ids in JS precisely to avoid depending on a DB-side
-- gen_random_uuid()); no-op on a fresh DB where no case has a pdf_path yet.
INSERT INTO "document" ("id","case_id","organization_id","type","storage_key","sha256","created_at")
	SELECT md5(random()::text || clock_timestamp()::text || "id"::text)::uuid, "id", "organization_id", 'onboarding_package', "pdf_path", "pdf_hash", "created_at"
	FROM "cases" WHERE "pdf_path" IS NOT NULL;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "document" TO app_authenticated;--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owners see/insert their own org's documents (mirrors cases_by_org).
CREATE POLICY document_by_org ON "document" USING (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid)) WITH CHECK (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid));--> statement-breakpoint
-- Staff get cross-owner READ only (defense-in-depth behind the API role gate). NULL when
-- unset → non-staff sessions are unaffected; permissive policies OR together.
CREATE POLICY document_staff ON "document" FOR SELECT USING (current_setting('app.is_staff', true) = 'on');

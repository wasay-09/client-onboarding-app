-- APPEND-ONLY signature/consent audit log (Phase 4) — the legally meaningful record for
-- ESIGN/UETA. One row per finalized SLA signature or data certification, written in the
-- SAME tx as its `document` (atomic). Append-only is enforced at the DB wall: we grant
-- ONLY SELECT + INSERT to app_authenticated (deliberately NO UPDATE/DELETE), so a row can
-- never be altered or removed after the fact. `document_sha256` is a frozen copy of the
-- exact signed PDF's hash → tamper-evident even if the `document` row were changed.
-- Self-contained (table + grants + RLS + by-org + staff SELECT policies). One SQL command
-- per breakpoint line (the driver rejects multiple per chunk — see 0002).
--
-- REVERSE (forward-only files; run by hand to roll back):
--   DROP POLICY IF EXISTS signature_event_staff ON "signature_event";
--   DROP POLICY IF EXISTS signature_event_by_org ON "signature_event";
--   DROP TABLE IF EXISTS "signature_event";

CREATE TABLE "signature_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"signer_user_id" uuid NOT NULL,
	"signer_name" text,
	"signer_title" text,
	"signer_email" text,
	"method" text NOT NULL,
	"consented" boolean NOT NULL,
	"consent_at" text,
	"document_sha256" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signature_event" ADD CONSTRAINT "signature_event_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_event" ADD CONSTRAINT "signature_event_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_event" ADD CONSTRAINT "signature_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signature_event_case_idx" ON "signature_event" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "signature_event_document_idx" ON "signature_event" USING btree ("document_id");--> statement-breakpoint
-- APPEND-ONLY grant: SELECT + INSERT only. No UPDATE/DELETE → the audit trail is immutable
-- at the DB wall, not merely by convention in the app.
GRANT SELECT, INSERT ON "signature_event" TO app_authenticated;--> statement-breakpoint
ALTER TABLE "signature_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owners see/insert their own org's events (mirrors document_by_org / cases_by_org). WITH
-- CHECK gates the INSERT to the caller's org; USING gates SELECT to it.
CREATE POLICY signature_event_by_org ON "signature_event" USING (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid)) WITH CHECK (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid));--> statement-breakpoint
-- Staff get cross-owner READ only (defense-in-depth behind the API role gate). NULL when
-- unset → non-staff sessions are unaffected; permissive policies OR together.
CREATE POLICY signature_event_staff ON "signature_event" FOR SELECT USING (current_setting('app.is_staff', true) = 'on');
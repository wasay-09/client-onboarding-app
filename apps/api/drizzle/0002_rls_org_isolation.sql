-- Tenant isolation via Row-Level Security (Phase 4 auth), as defense-in-depth.
--
-- The API connects as a privileged role (postgres / pglite superuser) that BYPASSES
-- RLS. So we add a restricted role the API drops to per request (SET LOCAL ROLE) and
-- policies keyed on a tx-local GUC (app.current_user_id) the API stamps. See
-- src/db/scope.ts (withUserScope). Business logic still scopes in the API; this is
-- the second wall. Portable across Supabase + pglite (no auth.uid()/auth schema).
--
-- NOTE: exactly one SQL command per breakpoint line below — the driver runs each
-- chunk as a single prepared statement and rejects multiple commands per chunk.

-- A non-bypass role for scoped queries. CURRENT_USER (the role running migrations,
-- == the API's login role) is granted membership so it can SET ROLE to it.
CREATE ROLE app_authenticated NOLOGIN;--> statement-breakpoint
GRANT app_authenticated TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "organization" TO app_authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "plan" TO app_authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "cases" TO app_authenticated;--> statement-breakpoint

ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- A user owns the organizations they created. (When user<->org membership lands,
-- swap the owner_id check below for a membership lookup — nothing else changes.)
CREATE POLICY org_owner ON "organization" USING (owner_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint

-- plan + cases are scoped BY organization_id: visible iff their org is one the user owns.
CREATE POLICY plan_by_org ON "plan" USING (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid)) WITH CHECK (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid));--> statement-breakpoint

CREATE POLICY cases_by_org ON "cases" USING (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid)) WITH CHECK (organization_id IN (SELECT id FROM "organization" WHERE owner_id = current_setting('app.current_user_id', true)::uuid));

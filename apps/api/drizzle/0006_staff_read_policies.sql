-- Staff read surface (internal FBSI dashboard). Additive, permissive FOR SELECT policies
-- on the existing kernel tables so a staff session — one that set the tx-local
-- `app.is_staff` GUC via withStaffScope (src/db/scope.ts) — can read ACROSS owners.
--
-- This is defense-in-depth, not the primary gate: the API's requireStaff preHandler is
-- the real authorization wall (403 for non-staff). RLS is the second wall.
--
-- Safe + additive: Postgres ORs permissive policies, so the existing *_by_org policies are
-- untouched. A non-staff session never sets app.is_staff, so current_setting(...,true) is
-- NULL → NULL = 'on' is NULL → these policies contribute nothing → owner isolation holds.
-- FOR SELECT only → staff stay read-only at the DB wall. app_authenticated already has
-- SELECT on these tables (granted in 0002), so no new grants. Documents/parties carry
-- their own *_staff policies (0004/0005).
--
-- REVERSE (run by hand to roll back):
--   DROP POLICY IF EXISTS org_staff ON "organization";
--   DROP POLICY IF EXISTS plan_staff ON "plan";
--   DROP POLICY IF EXISTS cases_staff ON "cases";

CREATE POLICY org_staff ON "organization" FOR SELECT USING (current_setting('app.is_staff', true) = 'on');--> statement-breakpoint
CREATE POLICY plan_staff ON "plan" FOR SELECT USING (current_setting('app.is_staff', true) = 'on');--> statement-breakpoint
CREATE POLICY cases_staff ON "cases" FOR SELECT USING (current_setting('app.is_staff', true) = 'on');

-- Phase 3 "ask once": EIN becomes the organization's natural key (per owner).
-- First normalize any existing EINs to digits-only so old rows match the new key
-- and don't slip past reuse on resubmit. (No-op on a fresh DB.)
UPDATE "organization" SET "ein" = regexp_replace("ein", '\D', '', 'g') WHERE "ein" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_owner_ein_unique" ON "organization" USING btree ("owner_id","ein") WHERE ein is not null;

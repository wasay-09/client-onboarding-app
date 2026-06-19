-- CONTRACT step (expand/contract): pdf_path/pdf_hash are now sourced from the `document`
-- table (backfilled in 0004; written by DocumentStore). Single-instance atomic boot-time
-- migration — old code is gone before this runs against served traffic, so dropping in-PR
-- is safe; the data survives in `document`.
--
-- REVERSE (run by hand to roll back — repopulates from document, run BEFORE 0004's reverse):
--   ALTER TABLE "cases" ADD COLUMN "pdf_path" text;
--   ALTER TABLE "cases" ADD COLUMN "pdf_hash" text;
--   UPDATE "cases" c SET pdf_path = d.storage_key, pdf_hash = d.sha256
--     FROM (SELECT DISTINCT ON (case_id) case_id, storage_key, sha256 FROM "document"
--           WHERE type = 'onboarding_package' ORDER BY case_id, created_at DESC) d
--     WHERE d.case_id = c.id;

ALTER TABLE "cases" DROP COLUMN "pdf_path";--> statement-breakpoint
ALTER TABLE "cases" DROP COLUMN "pdf_hash";

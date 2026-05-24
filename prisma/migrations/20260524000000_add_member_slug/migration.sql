-- Add `slug` column to crew_member, populated from full_name, with unique
-- constraint (company_id, slug). Nullable initially to allow backfilling
-- existing rows — a follow-up migration can tighten to NOT NULL once we're
-- sure every row has one. See lib/slug.ts.

ALTER TABLE "crew_member" ADD COLUMN "slug" TEXT;

UPDATE "crew_member"
SET "slug" = regexp_replace(
  lower(regexp_replace("full_name", '\s+', '-', 'g')),
  '[^a-z0-9-]', '', 'g'
)
WHERE "slug" IS NULL;

ALTER TABLE "crew_member"
  ADD CONSTRAINT "crew_member_company_id_slug_key"
  UNIQUE ("company_id", "slug");

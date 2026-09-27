-- Brand descriptions and logo persistence.
--
-- The brands admin page already collects a description and a logo URL, but the
-- API accepted only nameAr/nameEn, so both values were silently discarded on
-- every save. `description` had no column at all, which is why the page had to
-- read it through a cast. This migration makes the stored data match what the
-- form promises.

-- Additive and nullable: existing brands keep working with no backfill.
ALTER TABLE "Brand" ADD COLUMN "description" TEXT;

-- T07 variant display families
ALTER TABLE "Product" ADD COLUMN "groupSlug" TEXT;
CREATE INDEX "Product_groupSlug_idx" ON "Product"("groupSlug");

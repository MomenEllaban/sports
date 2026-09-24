-- E01: multi-line stocktake sessions and immutable variance lines.
CREATE TYPE "StocktakeStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');
CREATE TYPE "StocktakeLineStatus" AS ENUM ('PENDING', 'COUNTED', 'APPLIED');
CREATE TYPE "StocktakeReason" AS ENUM ('CYCLE_COUNT', 'DAMAGE', 'EXPIRY', 'RECEIVING_ERROR', 'SALE_ERROR', 'THEFT', 'OTHER');

CREATE TABLE "StocktakeSession" (
  "id" TEXT NOT NULL,
  "stocktakeNumber" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "StocktakeStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StocktakeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StocktakeLine" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "skuSnapshot" TEXT NOT NULL,
  "nameArSnapshot" TEXT NOT NULL,
  "nameEnSnapshot" TEXT NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "expectedQuantity" INTEGER NOT NULL,
  "countedQuantity" INTEGER,
  "varianceQuantity" INTEGER,
  "previousQuantity" INTEGER,
  "newQuantity" INTEGER,
  "status" "StocktakeLineStatus" NOT NULL DEFAULT 'PENDING',
  "reasonCode" "StocktakeReason",
  "notes" TEXT,
  "countedById" TEXT,
  "countedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StocktakeLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StocktakeLine_expected_nonnegative" CHECK ("expectedQuantity" >= 0),
  CONSTRAINT "StocktakeLine_counted_nonnegative" CHECK ("countedQuantity" IS NULL OR "countedQuantity" >= 0),
  CONSTRAINT "StocktakeLine_unit_cost_nonnegative" CHECK ("unitCost" >= 0)
);

CREATE UNIQUE INDEX "StocktakeSession_stocktakeNumber_key" ON "StocktakeSession"("stocktakeNumber");
CREATE INDEX "StocktakeSession_branchId_status_createdAt_idx" ON "StocktakeSession"("branchId", "status", "createdAt");
CREATE INDEX "StocktakeSession_createdById_createdAt_idx" ON "StocktakeSession"("createdById", "createdAt");
CREATE UNIQUE INDEX "StocktakeLine_sessionId_productId_key" ON "StocktakeLine"("sessionId", "productId");
CREATE INDEX "StocktakeLine_sessionId_status_idx" ON "StocktakeLine"("sessionId", "status");
CREATE INDEX "StocktakeLine_productId_idx" ON "StocktakeLine"("productId");
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

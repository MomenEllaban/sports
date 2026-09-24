-- D03: per-branch reorder policy and durable shortage requests.
ALTER TABLE "BranchInventory"
  ADD COLUMN "reorderPoint" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "reorderQuantity" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE "ReorderRequest" (
  "id" TEXT NOT NULL,
  "branchInventoryId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierId" TEXT,
  "requestedById" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "neededAt" TIMESTAMP(3),
  "note" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2),
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReorderRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReorderRequest_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "ReorderRequest_branchInventoryId_status_requestedAt_idx"
  ON "ReorderRequest"("branchInventoryId", "status", "requestedAt");
CREATE INDEX "ReorderRequest_supplierId_status_idx" ON "ReorderRequest"("supplierId", "status");
CREATE INDEX "ReorderRequest_requestedById_requestedAt_idx" ON "ReorderRequest"("requestedById", "requestedAt");
ALTER TABLE "ReorderRequest"
  ADD CONSTRAINT "ReorderRequest_branchInventoryId_fkey"
  FOREIGN KEY ("branchInventoryId") REFERENCES "BranchInventory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Transfer lifecycle: real request -> approve -> ship -> receive workflow, and
-- a movement ledger that can express every business event the ERP performs.

-- 1. Widen the movement ledger enum. Legacy values are kept so historical rows
--    stay valid; the new precise types let a branch's net movement be
--    reconstructed without inferring direction from a document number.
ALTER TYPE "InventoryLogType" ADD VALUE 'SALE_RETURN';
ALTER TYPE "InventoryLogType" ADD VALUE 'PURCHASE';
ALTER TYPE "InventoryLogType" ADD VALUE 'PURCHASE_RETURN';
ALTER TYPE "InventoryLogType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "InventoryLogType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "InventoryLogType" ADD VALUE 'CYCLE_COUNT';
ALTER TYPE "InventoryLogType" ADD VALUE 'OPENING';

-- 2. Rebuild TransferStatus. The old enum collapsed "approved" and "received"
--    into COMPLETED, so goods in transit were invisible to stock and physical
--    loss between branches was unrecordable.
ALTER TYPE "TransferStatus" RENAME TO "TransferStatus_old";
CREATE TYPE "TransferStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'COMPLETED'
);
-- Existing COMPLETED rows mean stock already moved on both legs; keep them.
ALTER TABLE "StockTransfer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StockTransfer"
  ALTER COLUMN "status" TYPE "TransferStatus"
  USING CASE WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED' ELSE 'PENDING'::"TransferStatus" END;
ALTER TABLE "StockTransfer" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 3. Transfer lifecycle timestamps and a cancellation reason for the audit trail.
ALTER TABLE "StockTransfer" ADD COLUMN "approvedAt" timestamp(3);
ALTER TABLE "StockTransfer" ADD COLUMN "shippedAt" timestamp(3);
ALTER TABLE "StockTransfer" ADD COLUMN "receivedAt" timestamp(3);
ALTER TABLE "StockTransfer" ADD COLUMN "cancelledAt" timestamp(3);
ALTER TABLE "StockTransfer" ADD COLUMN "cancelReason" text;
ALTER TABLE "StockTransferItem" ADD COLUMN "quantityShipped" integer NOT NULL DEFAULT 0;
ALTER TABLE "StockTransferItem" ADD COLUMN "quantityReceived" integer NOT NULL DEFAULT 0;
ALTER TABLE "StockTransferItem" ADD COLUMN "shippedAt" timestamp(3);
ALTER TABLE "StockTransferItem" ADD COLUMN "receivedAt" timestamp(3);

-- A transfer that already completed moved stock in full on both legs; backfill
-- the counters and timestamps so historical documents reconcile against the ledger.
UPDATE "StockTransfer"
  SET "approvedAt" = "updatedAt", "shippedAt" = "updatedAt", "receivedAt" = "updatedAt"
  WHERE "status" = 'COMPLETED';
UPDATE "StockTransferItem" ti
  SET "quantityShipped" = ti."quantity",
      "quantityReceived" = ti."quantity",
      "shippedAt" = COALESCE(st."updatedAt", st."createdAt"),
      "receivedAt" = COALESCE(st."updatedAt", st."createdAt")
  FROM "StockTransfer" st
  WHERE st."id" = ti."transferId" AND st."status" = 'COMPLETED';
DROP TYPE "TransferStatus_old";

-- 4. The ledger is queried per branch/product over time, and the transfer list
--    is filtered by status; without these the admin pages degrade to full scans.
CREATE INDEX "InventoryLog_type_createdAt_idx" ON "InventoryLog"("type", "createdAt");
CREATE INDEX "StockTransfer_status_createdAt_idx" ON "StockTransfer"("status", "createdAt");
CREATE INDEX "StockTransfer_fromBranchId_createdAt_idx" ON "StockTransfer"("fromBranchId", "createdAt");
CREATE INDEX "StockTransfer_toBranchId_createdAt_idx" ON "StockTransfer"("toBranchId", "createdAt");
CREATE INDEX "StockTransfer_requestedById_createdAt_idx" ON "StockTransfer"("requestedById", "createdAt");
CREATE INDEX "StockTransferItem_productId_idx" ON "StockTransferItem"("productId");
CREATE INDEX "StockTransferItem_transferId_quantityReceived_idx" ON "StockTransferItem"("transferId", "quantityReceived");

-- 5. One line per product per transfer. Duplicate lines previously applied the
--    same decrement/increment pair twice, silently corrupting both balances.
CREATE UNIQUE INDEX "StockTransferItem_transferId_productId_key" ON "StockTransferItem"("transferId", "productId");

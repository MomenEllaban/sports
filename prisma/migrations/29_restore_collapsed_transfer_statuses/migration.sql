-- Repair the transfer statuses that migration 28 collapsed.
--
-- Migration 28 widened TransferStatus but mapped every pre-existing non-COMPLETED
-- row to PENDING, because the old enum had no way to tell "awaiting approval"
-- from "rejected" or "cancelled". That silently rewrote history: an already
-- approved request became actionable again and two closed requests became an
-- open approval queue. This migration restores the lost states.
--
-- 1. Evidence-based restore. The old schema recorded the approver on approved
--    rows, and that column was never cleared, so a row that is still PENDING
--    while carrying an approver and no shipment can only have been APPROVED.
--    approvedAt is backfilled from createdAt because the original approval
--    timestamp predates the lifecycle columns.
UPDATE "StockTransfer" st
SET "status" = 'APPROVED',
    "approvedAt" = st."createdAt"
WHERE st."status" = 'PENDING'
  AND st."approvedById" IS NOT NULL
  AND st."approvedAt" IS NULL
  AND st."shippedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "StockTransferItem" ti
    WHERE ti."transferId" = st."id" AND (ti."quantityShipped" > 0 OR ti."quantityReceived" > 0)
  );

-- 2. Terminal states of the demo dataset. The demo seeder assigns statuses
--    deterministically (prisma/seed/transactions.ts), and a rejected or
--    cancelled row left no column-level evidence, so they are restored from
--    the seeder definition. The guard keeps this a no-op on any database where
--    the seeder ran after migration 28 and the statuses are already correct.
UPDATE "StockTransfer"
SET "status" = 'REJECTED',
    "approvedById" = "requestedById",
    "approvedAt" = "createdAt"
WHERE "transferNumber" = 'TRF-D-0005'
  AND "status" = 'PENDING'
  AND "approvedById" IS NULL
  AND "shippedAt" IS NULL;

UPDATE "StockTransfer"
SET "status" = 'CANCELLED',
    "cancelledAt" = "createdAt",
    "cancelReason" = 'Cancelled before the transfer lifecycle existed (restored by migration 29)'
WHERE "transferNumber" = 'TRF-D-0006'
  AND "status" = 'PENDING'
  AND "cancelledAt" IS NULL;

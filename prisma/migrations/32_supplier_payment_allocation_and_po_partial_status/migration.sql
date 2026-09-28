-- Supplier payables that can actually be attributed, and a purchase order
-- status for the partially delivered case.
--
-- 1. PARTIALLY_RECEIVED on PurchaseOrderStatus. Goods receiving wrote
--    SUBMITTED back for a partial receipt, so a half-delivered order was
--    indistinguishable from one the supplier had not shipped at all, and the
--    "partially received" queue in the GRN page could never match a row.
--    Additive: no existing row changes meaning.
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'PARTIALLY_RECEIVED';

-- 2. Attribute supplier payments to the order they settle. The ledger only
--    stored a supplierId, so the invoice page applied every payment ever made
--    to a supplier to each of that supplier's orders independently. Two orders
--    for 1000 and 2000 with a single 2000 payment both reported fully paid,
--    overstating cash paid by 1000. Nullable so an advance or a credit note can
--    still be recorded, but the payable balance is only exact when it is set.
ALTER TABLE "SupplierPayment" ADD COLUMN "purchaseOrderId" TEXT;

CREATE INDEX "SupplierPayment_purchaseOrderId_idx" ON "SupplierPayment"("purchaseOrderId");

ALTER TABLE "SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

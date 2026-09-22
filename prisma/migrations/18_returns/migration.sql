-- T-RMA unified returns domain
CREATE TABLE "ReturnRequest" (
  "id" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "orderId" TEXT,
  "saleId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'RETURN',
  "channel" TEXT NOT NULL DEFAULT 'ADMIN',
  "branchId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "customerId" TEXT,
  "customerPhone" TEXT,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "receivedById" TEXT,
  "refundedById" TEXT,
  "source" TEXT NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "exchangeSaleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_saleId_idx" ON "ReturnRequest"("saleId");
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ReturnItem" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "saleItemId" TEXT,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reasonCode" TEXT NOT NULL DEFAULT 'OTHER',
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "disposition" TEXT NOT NULL DEFAULT 'RESTOCK',
  "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
  "notes" TEXT,
  "images" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'ORIGINAL_GATEWAY',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "gatewayRef" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "shiftId" TEXT,
  "proofImage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD COLUMN "returnStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Sale" ADD COLUMN "returnStatus" TEXT NOT NULL DEFAULT 'NONE';

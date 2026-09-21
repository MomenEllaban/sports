-- T10 refund outbox
CREATE TABLE "RefundRequest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "gatewayRef" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefundRequest_orderId_key" ON "RefundRequest"("orderId");
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

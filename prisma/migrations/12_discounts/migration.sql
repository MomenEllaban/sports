-- T16 unified discount pipeline: coupon ledger + attribution columns
CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PERCENT',
  "value" DECIMAL(12,2) NOT NULL,
  "capAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
  "minTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE TABLE "CouponUse" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "orderId" TEXT,
  "saleId" TEXT,
  "customerId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponUse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CouponUse_couponId_idx" ON "CouponUse"("couponId");
ALTER TABLE "CouponUse" ADD CONSTRAINT "CouponUse_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "loyaltyRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "loyaltyDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "Order" ADD COLUMN "couponDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "Sale" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Sale" ADD COLUMN "loyaltyRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "loyaltyDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "Sale" ADD COLUMN "couponDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0.0;

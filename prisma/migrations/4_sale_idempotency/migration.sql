-- AlterTable (T07 offline-sync idempotency)
ALTER TABLE "Sale" ADD COLUMN "clientSaleId" TEXT;
CREATE UNIQUE INDEX "Sale_clientSaleId_key" ON "Sale"("clientSaleId");

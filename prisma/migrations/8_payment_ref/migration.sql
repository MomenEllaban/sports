-- AlterTable: 3.1 gateway payment reference for webhook matching
ALTER TABLE "Order" ADD COLUMN "paymentRef" TEXT;

-- AlterTable: 3.3 courier-remitted COD amount
ALTER TABLE "Order" ADD COLUMN "codRemitted" DECIMAL(12,2) NOT NULL DEFAULT 0.0;

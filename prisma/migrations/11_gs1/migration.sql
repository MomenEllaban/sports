-- ETA-spike: GS1 code per product for production e-invoicing
ALTER TABLE "Product" ADD COLUMN "gs1Code" TEXT;

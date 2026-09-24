-- B03: immutable invoice presentation snapshot and audited reprints.
ALTER TABLE "TaxInvoice"
  ADD COLUMN "snapshot" JSONB,
  ADD COLUMN "snapshotSource" TEXT NOT NULL DEFAULT 'LEGACY_RECONSTRUCTED',
  ADD COLUMN "reprintCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReprintedAt" TIMESTAMP(3);

CREATE TABLE "InvoiceReprint" (
  "id" TEXT NOT NULL,
  "taxInvoiceId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "copyNumber" INTEGER NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'ar',
  "reason" TEXT,
  "printedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceReprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceReprint_requestId_key" ON "InvoiceReprint"("requestId");
CREATE INDEX "InvoiceReprint_taxInvoiceId_createdAt_idx" ON "InvoiceReprint"("taxInvoiceId", "createdAt");
ALTER TABLE "InvoiceReprint"
  ADD CONSTRAINT "InvoiceReprint_taxInvoiceId_fkey"
  FOREIGN KEY ("taxInvoiceId") REFERENCES "TaxInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

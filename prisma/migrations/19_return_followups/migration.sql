-- T-RMA follow-ups: idempotency + ETA marker
-- NOTE: no enum change (ALTER TYPE ... ADD VALUE can't run in migrate tx).
-- Partial state is derived: returnStatus FULL+REFUNDED vs PARTIAL (see DECISIONS).
ALTER TABLE "ReturnRequest" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "ReturnRequest_clientRequestId_key" ON "ReturnRequest"("clientRequestId");
ALTER TABLE "ReturnRequest" ADD COLUMN "etaStatus" TEXT NOT NULL DEFAULT 'NONE';

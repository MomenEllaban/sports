-- T05 cashier shifts + sale attribution
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TABLE "Shift" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "cashierId" TEXT NOT NULL,
  "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "openingFloat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "actualCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "difference" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "openNote" TEXT,
  "closeNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Shift_cashierId_status_idx" ON "Shift"("cashierId", "status");
CREATE INDEX "Shift_branchId_status_idx" ON "Shift"("branchId", "status");
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD COLUMN "shiftId" TEXT;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable (T06 manager discount authorization)
ALTER TABLE "User" ADD COLUMN "managerPinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "pinLockedUntil" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "approvedById" TEXT;

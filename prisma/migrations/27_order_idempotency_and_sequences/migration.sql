-- Order creation idempotency + a database-backed document-number counter.
--
-- Two separate problems are fixed here.
--
-- 1. `Order.idempotencyKey` lets a retried storefront checkout replay the
--    stored order instead of creating a second one (and charging twice).
--    Nullable so every existing row stays valid, and Postgres treats NULLs as
--    distinct in a unique index, so "no key" is not a collision.
--
-- 2. The `Sequence` table backs the document numbers printed on orders, POS
--    sales, return tickets, stock transfers and expenses. They used to be
--    `Math.random()` inside a 9,000-value window against a `@unique` column.
--    One row per prefix and year, incremented with an atomic upsert.
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("key")
);

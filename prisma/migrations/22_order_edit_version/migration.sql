-- B02: optimistic concurrency token for editable orders.
ALTER TABLE "Order" ADD COLUMN "editVersion" INTEGER NOT NULL DEFAULT 0;

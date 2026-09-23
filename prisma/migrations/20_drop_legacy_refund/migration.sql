-- T-RMA cleanup: drop the superseded T10 outbox (rows converted by backfillLegacy).
DROP TABLE IF EXISTS "RefundRequest";

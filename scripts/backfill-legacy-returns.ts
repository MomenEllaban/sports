/**
 * One-shot LEGACY backfill runner (T-RMA §6): converts pre-RMA RETURNED
 * orders (and T10 refund rows) WITHOUT moving stock. Safe to re-run.
 * Usage: npx tsx --env-file=.env scripts/backfill-legacy-returns.ts
 */
import { backfillLegacy } from '../src/lib/returns/service.js';

async function main() {
  const res = await backfillLegacy();
  console.log(`backfillLegacy done — created=${res.created} converted=${res.converted}`);
  const { PrismaClient } = await import('@prisma/client');
  await new PrismaClient().$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('backfill failed:', e);
  process.exit(1);
});

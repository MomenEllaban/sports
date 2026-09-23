/**
 * pnpm refunds:process (T-RMA) — retry all PENDING/FAILED RMA refunds.
 * Run every 10 minutes (Vercel Cron or systemd timer).
 */
import { PrismaClient } from '@prisma/client';
import { executeRefund } from '../src/lib/returns/service.js';

async function main() {
  const db = new PrismaClient();
  try {
    const pending = await db.refund.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      select: { id: true },
      take: 50,
    });
    let ok = 0;
    for (const r of pending) {
      try {
        const res = await executeRefund(r.id);
        if (res.ok) ok++;
      } catch {
        /* recorded as FAILED inside executeRefund; continue */
      }
    }
    console.log(`refunds:process done — ${ok}/${pending.length} succeeded.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('refunds:process failed:', e);
  process.exit(1);
});

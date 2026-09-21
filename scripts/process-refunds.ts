/**
 * pnpm refunds:process (T10) — retry all PENDING/FAILED refund requests.
 * Run every 10 minutes (Vercel Cron or systemd timer) + after each request.
 */
import { PrismaClient } from '@prisma/client';
import { processRefund } from '../src/lib/refunds/service.js';

async function main() {
  const db = new PrismaClient();
  try {
    const pending = await db.refundRequest.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      select: { id: true },
      take: 50,
    });
    let ok = 0;
    for (const r of pending) {
      try {
        const res = await processRefund(r.id);
        if (res.ok) ok++;
      } catch {
        /* recorded as FAILED inside processRefund; continue */
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

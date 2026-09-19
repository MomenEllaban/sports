import { prisma } from '../src/lib/db.js';

async function main() {
  // Remove orphan SALE logs from the earlier test (no referenceId, qty -2, today)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orphans = await prisma.inventoryLog.findMany({
    where: { type: 'SALE', changeQuantity: -2, referenceId: null, createdAt: { gte: dayAgo } },
  });
  console.log(`orphan test logs: ${orphans.length}`);
  if (orphans.length > 0 && orphans.length <= 5) {
    await prisma.inventoryLog.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
    console.log('orphans deleted');
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 200)); process.exit(1); });

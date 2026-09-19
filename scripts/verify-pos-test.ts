import fs from 'node:fs';
import { prisma } from '../src/lib/db.js';

const [saleNo, pid] = fs.readFileSync('C:/Users/Alex-Store/AppData/Local/Temp/opencode/pos-sale-no.txt', 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

async function main() {
let passed = 0, failed = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n} ${d}`); } };

const sale = await prisma.sale.findFirst({ where: { saleNumber: saleNo }, include: { items: true, taxInvoice: true } });
check('sale persisted with items', !!sale && sale.items.length === 1 && sale.items[0].quantity === 2, saleNo);
check('sale has ETA tax invoice', !!sale?.taxInvoice, '');
check('sale payment PAID/CASH', sale?.paymentStatus === 'PAID' && sale?.paymentMethod === 'CASH', `${sale?.paymentStatus}/${sale?.paymentMethod}`);

const logs = await prisma.inventoryLog.findMany({ where: { referenceId: saleNo }, orderBy: { createdAt: 'desc' } });
check('inventory SALE log written', logs.length >= 1 && logs[0].type === 'SALE' && logs[0].changeQuantity === -2, `logs=${logs.length}`);

// visibility where cashiers/managers look: dashboard + accounting + reports queries
const salesCount = await prisma.sale.count();
const rev = await prisma.sale.aggregate({ _sum: { totalAmount: true } });
check('sale visible in aggregates', salesCount >= 1 && Number(rev._sum.totalAmount) >= Number(sale?.totalAmount), `count=${salesCount}`);

// cleanup: restore stock, delete logs + invoice + items + sale
if (sale) {
  const inv = await prisma.branchInventory.findUnique({ where: { branchId_productId: { branchId: sale.branchId, productId: pid } } });
  if (inv) await prisma.branchInventory.update({ where: { branchId_productId: { branchId: sale.branchId, productId: pid } }, data: { stockQuantity: inv.stockQuantity + 2 } });
  await prisma.inventoryLog.deleteMany({ where: { referenceId: saleNo } });
  await prisma.taxInvoice.deleteMany({ where: { saleId: sale.id } });
  await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
  await prisma.sale.delete({ where: { id: sale.id } });
  const restored = await prisma.branchInventory.findUnique({ where: { branchId_productId: { branchId: sale.branchId, productId: pid } } });
  check('test cleanup + stock restored', restored?.stockQuantity === (inv?.stockQuantity ?? 0) + 2, `stock=${restored?.stockQuantity}`);
}
await prisma.$disconnect();
console.log(`\n==== POS DB RESULT: ${passed} passed, ${failed} failed ====`);
process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('verify crashed:', String(e).slice(0, 300)); process.exit(1); });

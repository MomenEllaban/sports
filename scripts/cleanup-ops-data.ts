import { PrismaClient } from '@prisma/client';

/**
 * Remove fabricated demo/seed operational data so the dashboard reflects only
 * real business data (live staff use it daily). System + catalog data is KEPT:
 * branches, users, categories, brands, products, branch inventory, settings.
 *
 * Removed (in FK-safe order): tax invoices, inventory logs, sales, orders,
 * purchase orders, transfers, payroll, audit logs, expenses, addresses,
 * customers, employees, suppliers, notifications.
 *
 * Safe to re-run (idempotent).
 */
const db = new PrismaClient();

async function main() {
  const totals: Record<string, number> = {};

  const del = async (name: string, p: Promise<{ count: number }>) => {
    totals[name] = (await p).count;
  };

  await del('taxInvoices', db.taxInvoice.deleteMany());
  await del('inventoryLogs', db.inventoryLog.deleteMany({ where: { id: { startsWith: 'invlog-' } } }));
  await del('saleItems', db.saleItem.deleteMany({ where: { id: { startsWith: 'saleitem-D-' } } }));
  await del('sales', db.sale.deleteMany({ where: { saleNumber: { startsWith: 'SALE-D-' } } }));

  // Manual live POS smoke-test sales created by the dev (real-format numbers).
  const testSaleNumbers = ['POS-2026-33742', 'POS-2026-39455'];
  const testSales = await db.sale.findMany({ where: { saleNumber: { in: testSaleNumbers } }, select: { id: true } });
  const testSaleIds = testSales.map((s) => s.id);
  if (testSaleIds.length > 0) {
    await del('testSaleItems', db.saleItem.deleteMany({ where: { saleId: { in: testSaleIds } } }));
    await del('testTaxInvoices', db.taxInvoice.deleteMany({ where: { saleId: { in: testSaleIds } } }));
    await del('testSales', db.sale.deleteMany({ where: { id: { in: testSaleIds } } }));
  }
  await del('orderItems', db.orderItem.deleteMany({ where: { id: { startsWith: 'orderitem-D-' } } }));
  await del('orders', db.order.deleteMany({ where: { orderNumber: { startsWith: 'ORD-D-' } } }));
  await del('poItems', db.purchaseOrderItem.deleteMany({ where: { id: { startsWith: 'poitem-D-' } } }));
  await del('purchaseOrders', db.purchaseOrder.deleteMany({ where: { poNumber: { startsWith: 'PO-D-' } } }));
  await del('transferItems', db.stockTransferItem.deleteMany({ where: { id: { startsWith: 'trfitem-D-' } } }));
  await del('transfers', db.stockTransfer.deleteMany({ where: { transferNumber: { startsWith: 'TRF-D-' } } }));
  await del('payrollItems', db.payrollItem.deleteMany({ where: { id: { startsWith: 'payroll-' } } }));
  await del('payrollRuns', db.payrollRun.deleteMany({ where: { id: { startsWith: 'payroll-' } } }));
  await del('auditLogs', db.auditLog.deleteMany({ where: { id: { startsWith: 'audit-D-' } } }));
  await del('expenses', db.expense.deleteMany({ where: { expenseNumber: { startsWith: 'EXP-D-' } } }));
  await del('addresses', db.address.deleteMany());
  await del('customers', db.customer.deleteMany({ where: { phone: { startsWith: '0100000' } } }));
  await del('employees', db.employee.deleteMany({ where: { id: { startsWith: 'emp-' } } }));
  await del('suppliers', db.supplier.deleteMany({ where: { taxNumber: { startsWith: 'FAKE-' } } }));
  await del('notifications', db.notification.deleteMany());

  console.log('==== CLEANUP ====');
  for (const [k, v] of Object.entries(totals)) console.log(`  ${k}: removed ${v}`);

  const [branches, users, categories, brands, products, inv, settings, customers, sales, orders] =
    await Promise.all([
      db.branch.count(),
      db.user.count(),
      db.category.count(),
      db.brand.count(),
      db.product.count(),
      db.branchInventory.count(),
      db.setting.count(),
      db.customer.count(),
      db.sale.count(),
      db.order.count(),
    ]);
  console.log('\nremaining:');
  console.log(`  branches=${branches} users=${users} categories=${categories} brands=${brands}`);
  console.log(`  products=${products} inventoryRows=${inv} settings=${settings}`);
  console.log(`  customers=${customers} sales=${sales} orders=${orders}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('cleanup failed:', e);
  await db.$disconnect();
  process.exit(1);
});
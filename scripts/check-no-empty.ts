/**
 * pnpm check:no-empty (F0 §1.5) — every admin + storefront route must render
 * real seeded data. Runs against the seeded DB via Prisma (no browser):
 * asserts row counts for the tables backing each screen.
 */
import { prisma as db } from '../src/lib/db';

const failures: string[] = [];
async function need(label: string, n: number) {
  if (n <= 0) failures.push(`${label}: 0 rows`);
  else console.log(`  ok ${label}: ${n}`);
}

async function main() {
  try {
    await need('branches (/admin/branches, /branches)', await db.branch.count());
    await need('products (/admin/products, /catalog)', await db.product.count());
    await need('categories', await db.category.count());
    await need('brands', await db.brand.count());
    await need('branchInventory (/admin/inventory)', await db.branchInventory.count());
    await need('customers (/admin/customers)', await db.customer.count());
    await need('orders (/admin/orders, tracking)', await db.order.count());
    await need('sales (POS unified table)', await db.sale.count());
    await need('shifts (/admin/shifts)', await db.shift.count());
    await need('coupons (/admin/coupons)', await db.coupon.count());
    await need('supplierPayments (/admin/purchasing)', await db.supplierPayment.count());
    await need('reviews (/admin/reviews)', await db.review.count({ where: { approved: true } }));
    await need('suppliers (/admin/purchasing)', await db.supplier.count());
    await need('purchaseOrders', await db.purchaseOrder.count());
    await need('transfers (/admin/inventory)', await db.stockTransfer.count());
    await need('employees (/admin/employees)', await db.employee.count());
    await need('payrollRuns (/admin/payroll)', await db.payrollRun.count());
    await need('expenses (/admin/accounting)', await db.expense.count());
    await need('notifications (/admin/notifications)', await db.notification.count());
    await need('taxInvoices (/admin/accounting)', await db.taxInvoice.count());
    await need('settings (/admin/settings)', await db.setting.count());
    await need('users (/admin/users)', await db.user.count());
  } catch (e) {
    console.error('check:no-empty could not reach DB:', (e as Error).message);
    process.exit(2);
  } finally {
    await db.$disconnect();
  }

  if (failures.length) {
    console.error(`check:no-empty FAILED:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('check:no-empty OK.');
}

main();

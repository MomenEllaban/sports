import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getTestDatabaseUrl } from './test-db.js';

let client: PrismaClient | null = null;

export function testPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ datasources: { db: { url: getTestDatabaseUrl() } } });
  }
  return client;
}

const TABLES = [
  'TaxInvoice', 'Notification', 'Expense', 'PurchaseOrderItem', 'PurchaseOrder', 'Supplier',
  'InventoryLog', 'SaleItem', 'Sale', 'Shift', 'CouponUse', 'Coupon', 'RefundRequest', 'Review', 'OrderItem', 'Order', 'Address', 'Customer',
  'PayrollItem', 'PayrollRun', 'Employee', 'User', 'StockTransferItem', 'StockTransfer',
  'BranchInventory', 'Product', 'Category', 'Brand', 'Branch',
].map((t) => `"${t}"`);

/** Truncate every app table in the TEST schema. Refuses unsafe URLs first. */
export async function resetTestDb(): Promise<void> {
  const db = testPrisma();
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${n++}`;

export async function makeBranch(name = 'Test Branch') {
  const db = testPrisma();
  return db.branch.create({
    data: {
      name, nameEn: `${name} EN`, address: 'addr', addressEn: 'addr en',
      phone: '030000000', city: 'Alexandria', workingHours: '10-10', isActive: true,
    },
  });
}

export async function makeUser(role: 'SUPER_ADMIN' | 'FINANCE' | 'BRANCH_MANAGER' | 'CASHIER' | 'STAFF' = 'STAFF', branchIds: string[] = []) {
  const db = testPrisma();
  return db.user.create({
    data: {
      name: uid('user'), email: `${uid('u')}@sports-champions.local`,
      passwordHash: await bcrypt.hash('Test@123456', 4),
      role: role as never, branchIds, isActive: true,
    },
  });
}

export async function makeProduct(categoryId: string, price = 100) {
  const db = testPrisma();
  return db.product.create({
    data: {
      sku: uid('SKU'), nameAr: 'صنف اختبار', nameEn: 'Test product',
      price, costPrice: 60, categoryId, isActive: true, images: [],
    },
  });
}

export async function makeCategory() {
  return testPrisma().category.create({
    data: { slug: uid('cat'), nameAr: 'تصنيف', nameEn: 'Category' },
  });
}

export async function stock(branchId: string, productId: string, qty: number) {
  const db = testPrisma();
  return db.branchInventory.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { branchId, productId, stockQuantity: qty, lowStockThreshold: 5 },
    update: { stockQuantity: qty },
  });
}

export async function makeCustomer(phone?: string) {
  return testPrisma().customer.create({
    data: { phone: phone || `0100000${String(1000 + (n++))}`, name: 'Test', loyaltyPoints: 0 },
  });
}

export function sessionFor(user: { id: string; name: string; email: string; role: string; branchIds: string[]; branchId?: string | null }) {
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, branchIds: user.branchIds, branchId: user.branchId ?? null } };
}

/** Open a T05 shift for tests (cashier + branch must exist). */
export async function openTestShift(branchId: string, cashierId: string, openingFloat = 500) {
  return testPrisma().shift.create({
    data: { branchId, cashierId, status: 'OPEN', openingFloat, expectedCash: openingFloat },
  });
}

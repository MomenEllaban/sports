import { PrismaClient } from '@prisma/client';
import { assertDevelopment } from '../../src/lib/env-guard.js';
import { seedBranches } from './branches.js';
import { seedUsers } from './users.js';
import { seedCategories, seedBrands } from './catalog-base.js';
import { seedCatalog } from './catalog.js';
import { seedStock } from './stock.js';
import { seedSuppliers, seedCustomers, seedEmployees, seedExpenses } from './people.js';
import { seedSettings } from './settings.js';
import { seedTransactions } from './transactions.js';
import { MANAGER_PINS } from './users.js';

const prisma = new PrismaClient();
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Test@123456';

export async function seedMinimal() {
  const counts: Record<string, number> = {};
  counts.branches = await seedBranches(prisma);
  const users = await seedUsers(prisma, SEED_PASSWORD);
  counts.users = users.length;
  counts.settings = await seedSettings(prisma);
  counts.categories = await seedCategories(prisma);
  return { counts, users };
}

export async function seedDemo() {
  const { counts, users } = await seedMinimal();
  counts.brands = await seedBrands(prisma);
  const cat = await seedCatalog(prisma);
  counts.models = cat.models;
  counts.skus = cat.skus;
  counts.inventoryRows = await seedStock(prisma);
  counts.suppliers = await seedSuppliers(prisma);
  counts.customers = await seedCustomers(prisma);
  counts.employees = await seedEmployees(prisma);
  counts.expenses = await seedExpenses(prisma);
  Object.assign(counts, await seedTransactions(prisma));
  return { counts, users };
}

export async function wipeAppTables() {
  assertDevelopment('seed:reset wipe');
  const t = [
    'TaxInvoice', 'Notification', 'Expense', 'PurchaseOrderItem', 'PurchaseOrder', 'Supplier',
    'InventoryLog', 'SaleItem', 'Sale', 'Shift', 'OrderItem', 'Order', 'Address', 'Customer',
    'PayrollItem', 'PayrollRun', 'Employee', 'User', 'StockTransferItem', 'StockTransfer',
    'BranchInventory', 'Product', 'Category', 'Brand', 'Branch', 'Setting',
  ].map((x) => `"${x}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE ${t.join(', ')} RESTART IDENTITY CASCADE`);
}

export function printSummary(counts: Record<string, number>, users: Array<{ email: string; role: string }>) {
  console.log('\n==== SEED SUMMARY ====');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log('\n==== DEV CREDENTIALS (development only) ====');
  console.log(`  password for ALL seed users: ${process.env.SEED_DEFAULT_PASSWORD ? '(from SEED_DEFAULT_PASSWORD)' : SEED_PASSWORD}`);
  for (const u of users) console.log(`  ${u.role}: ${u.email}`);
  console.log(`  manager discount PINs: ${MANAGER_PINS.primary} (ibrahimeyah) / ${MANAGER_PINS.secondary} (smouha) — bcrypt-hashed in DB`);
}

async function main() {
  const mode = process.argv[2] || 'demo';
  if (mode === 'reset') {
    await wipeAppTables();
    console.log('wiped app tables (development only)');
  }
  if (mode === 'transactions') {
    const counts = await seedTransactions(prisma);
    console.log('\n==== TRANSACTIONS SEED ====');
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
    await prisma.$disconnect();
    return;
  }
  const { counts, users } = mode === 'minimal' ? await seedMinimal() : await seedDemo();
  printSummary(counts, users.map((u) => ({ email: u.email, role: u.role })));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('seed failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});

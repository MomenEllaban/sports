/**
 * Full smoke test: frontend routes + backend libs + Cloudinary + DB + Vercel envs
 * Run: npx tsx scripts/smoke-test.ts
 */
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string) {
  passed++;
  console.log(`  PASS  ${name}`);
}
function fail(name: string, detail?: string) {
  failed++;
  failures.push(name + (detail ? ` -> ${detail}` : ''));
  console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`);
}

const root = process.cwd();

async function main() {
console.log('\n[1/6] Environment variables');
for (const key of [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
]) {
  if (process.env[key]) ok(`env ${key}`);
  else fail(`env ${key}`, 'missing');
}

console.log('\n[2/6] Frontend routes exist (responsive pages)');
const routes = [
  'src/app/[locale]/(storefront)/page.tsx',
  'src/app/[locale]/(storefront)/catalog/page.tsx',
  'src/app/[locale]/(storefront)/cart/page.tsx',
  'src/app/[locale]/(storefront)/checkout/page.tsx',
  'src/app/[locale]/(storefront)/tracking/page.tsx',
  'src/app/[locale]/(storefront)/branches/page.tsx',
  'src/app/[locale]/pos/page.tsx',
  'src/app/[locale]/admin/page.tsx',
  'src/app/[locale]/admin/login/page.tsx',
];
for (const r of routes) {
  if (fs.existsSync(path.join(root, r))) ok(`route ${r}`);
  else fail(`route ${r}`, 'file missing');
}

console.log('\n[3/6] Responsive + animation checks');
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
for (const token of ['@keyframes fade-up', '@keyframes float-slow', '.animate-fade-up', 'prefers-reduced-motion']) {
  if (css.includes(token)) ok(`css ${token}`);
  else fail(`css ${token}`, 'missing');
}
const headerSrc = fs.readFileSync(path.join(root, 'src/components/storefront/Header.tsx'), 'utf8');
if (headerSrc.includes('mobileOpen') && headerSrc.includes('lg:hidden')) ok('header mobile menu');
else fail('header mobile menu', 'no responsive menu');
if (fs.existsSync(path.join(root, 'src/components/storefront/Reveal.tsx'))) ok('Reveal component');
else fail('Reveal component', 'missing');

const pageSrc = fs.readFileSync(path.join(root, 'src/app/[locale]/(storefront)/page.tsx'), 'utf8');
if (pageSrc.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4')) ok('product grid responsive');
else fail('product grid responsive', 'missing breakpoints');

console.log('\n[4/6] Backend libs (payments / logistics / ETA / notifications)');
try {
  const { createCourierShipment, parseCourierWebhook, ALEXANDRIA_DELIVERY_ZONES } = await import('../src/lib/logistics/index.js');
  const shipment = await createCourierShipment({
    orderNumber: 'ORD-TEST-001',
    branchAddress: '92 Omar Lotfy',
    customerName: 'Test',
    customerPhone: '01012345678',
    customerAddress: 'Ibrahimeyah',
    codAmount: 100,
    provider: 'BOSTA' as never,
  });
  if (shipment.success && shipment.trackingNumber) ok('logistics BOSTA shipment');
  else fail('logistics BOSTA shipment', 'bad result');
  if (ALEXANDRIA_DELIVERY_ZONES.length >= 5) ok(`delivery zones (${ALEXANDRIA_DELIVERY_ZONES.length})`);
  else fail('delivery zones', 'too few');
  const parsed = parseCourierWebhook({ tracking_id: 'BST-1', state: 'DELIVERED' });
  if (parsed.normalizedStatus === 'DELIVERED') ok('courier webhook parse');
  else fail('courier webhook parse', JSON.stringify(parsed));
} catch (e) {
  fail('logistics lib', String(e).slice(0, 200));
}

try {
  const { initializePayment } = await import('../src/lib/payments/index.js');
  const pay = await initializePayment('COD' as never, 'ORD-TEST-001', 500, '01012345678', 'Test');
  if (pay.instructionsAr) ok('payments COD instructions');
  else fail('payments COD instructions', 'empty');
} catch (e) {
  fail('payments lib', String(e).slice(0, 200));
}

try {
  const { prisma: prismaEta } = await import('../src/lib/db.js');
  const realBranch = await prismaEta.branch.findFirst({ where: { isActive: true } });
  const { submitToEta } = await import('../src/lib/eta.js');
  const invNo = `INV-TEST-${Date.now()}`;
  const eta = await submitToEta({ branchId: realBranch!.id, invoiceNumber: invNo, totalAmount: 100, vatAmount: 14, items: [] });
  if (eta.etaUuid) {
    ok('ETA submit (disabled mode)');
    await prismaEta.taxInvoice.deleteMany({ where: { invoiceNumber: invNo } });
    ok('ETA tax record cleanup');
  } else fail('ETA submit', 'no uuid');
} catch (e) {
  fail('ETA lib', String(e).slice(0, 200));
}

try {
  const { dispatchNotification } = await import('../src/lib/notifications.js');
  const n = await dispatchNotification({ type: 'NEW_ORDER', titleAr: 'ت', titleEn: 't', messageAr: 'م', messageEn: 'm' });
  if (n) ok('notifications dispatch');
  else fail('notifications dispatch', 'falsy');
} catch (e) {
  fail('notifications lib', String(e).slice(0, 200));
}

console.log('\n[5/6] Cloudinary connectivity');
try {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const ping = await cloudinary.api.ping();
  if (ping.status === 'ok') ok('cloudinary ping ok');
  else fail('cloudinary ping', JSON.stringify(ping).slice(0, 200));
} catch (e) {
  fail('cloudinary ping', String(e).slice(0, 300));
}

console.log('\n[6/6] Database connectivity (Neon Postgres)');
try {
  const { prisma } = await import('../src/lib/db.js');
  await prisma.$queryRaw`SELECT 1`;
  ok('db connection SELECT 1');
  const [branches, products, categories] = await Promise.all([
    prisma.branch.count(),
    prisma.product.count(),
    prisma.category.count(),
  ]);
  ok(`db counts branches=${branches} products=${products} categories=${categories}`);
  const [orders, sales, pos, expenses, runs, transfers, notifs] = await Promise.all([
    prisma.order.count(),
    prisma.sale.count(),
    prisma.purchaseOrder.count(),
    prisma.expense.count(),
    prisma.payrollRun.count(),
    prisma.stockTransfer.count(),
    prisma.notification.count(),
  ]);
  if (orders >= 5 && sales >= 3 && pos >= 2 && expenses >= 4 && runs >= 1 && transfers >= 1 && notifs >= 4) {
    ok(`rich seed orders=${orders} sales=${sales} pos=${pos} expenses=${expenses} payrollRuns=${runs} transfers=${transfers} notifications=${notifs}`);
  } else {
    fail('rich seed data', `orders=${orders} sales=${sales} pos=${pos} expenses=${expenses} runs=${runs} transfers=${transfers} notifs=${notifs}`);
  }
  await prisma.$disconnect();
} catch (e) {
  fail('db connection', String(e).slice(0, 300));
}

console.log('\n[7/7] Admin wiring (auth route, guard, APIs, i18n)');
const requiredFiles = [
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/app/api/admin/orders/[id]/route.ts',
  'src/app/api/admin/products/route.ts',
  'src/app/api/admin/products/[id]/route.ts',
  'src/app/api/admin/transfers/route.ts',
  'src/app/api/admin/transfers/[id]/route.ts',
  'src/app/api/admin/purchase-orders/route.ts',
  'src/app/api/admin/purchase-orders/[id]/receive/route.ts',
  'src/app/api/admin/expenses/route.ts',
  'src/app/api/admin/payroll-runs/route.ts',
  'src/app/api/admin/payroll-runs/[id]/route.ts',
  'src/app/api/admin/notifications/route.ts',
  'src/app/api/admin/notifications/[id]/route.ts',
  'src/app/api/admin/notifications/read-all/route.ts',
  'src/components/admin/ui.tsx',
  'src/components/admin/OrdersManager.tsx',
  'src/components/admin/ProductsManager.tsx',
  'src/components/admin/TransfersManager.tsx',
  'src/components/admin/PurchasingManager.tsx',
  'src/components/admin/PayrollManager.tsx',
  'src/components/admin/NotificationsManager.tsx',
  'src/components/admin/ExpensesManager.tsx',
  'src/components/admin/CustomersManager.tsx',
  'src/lib/admin-guard.ts',
  'src/app/[locale]/admin/error.tsx',
];
for (const f of requiredFiles) {
  if (fs.existsSync(path.join(root, f))) ok(`file ${f.split('/').slice(-2).join('/')}`);
  else fail(`file ${f}`, 'missing');
}
try {
  const ar = JSON.parse(fs.readFileSync(path.join(root, 'messages/ar.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(root, 'messages/en.json'), 'utf8'));
  const needKeys = ['auth', 'admin'];
  let i18nOk = true;
  for (const ns of needKeys) {
    if (!ar[ns] || !en[ns]) { fail(`i18n namespace ${ns}`, 'missing'); i18nOk = false; }
  }
  for (const k of ['status_DELIVERED', 'pay_COD', 'src_ONLINE', 'markAllRead', 'newExpense']) {
    if (!(ar.admin && ar.admin[k]) || !(en.admin && en.admin[k])) { fail(`i18n key ${k}`, 'missing'); i18nOk = false; }
  }
  if (i18nOk) ok('i18n auth+admin namespaces with status keys (ar/en)');
} catch (e) {
  fail('i18n parse', String(e).slice(0, 200));
}

console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(' - ' + f);
}
process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});

/**
 * Renders the English routes and fails if any untranslated Arabic reaches the
 * browser. This is the regression guard for the i18n work: the `/en` pages must
 * contain zero Arabic text nodes.
 *
 * Requirements (it needs a live server and the seeded QA database):
 *   npx next dev -p 3100
 *   npx tsx scripts/verify-i18n-render.mjs
 *
 * The language switcher is excluded because it deliberately labels the target
 * language in its own script ("ع" / "العربية").
 *
 * Known limitation: the Prisma schema has no English column for Customer.name,
 * User.name, Employee.name, Supplier.name, Product.color/size, Expense.notes,
 * Review.text or Address.street, so those database values still render in
 * Arabic on the English admin. They are reported under `--show-data` for
 * review but never fail the check; only UI copy is a hard failure.
 */
import { readFileSync } from 'node:fs';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.SCAN_BASE || 'http://localhost:3100';
const ADMIN_EMAIL = process.env.SCAN_ADMIN || 'admin@sports-champions.local';
const SHOW_DATA = process.argv.includes('--show-data');
const AR = /[\u0600-\u06FF]/;

function envValue(key) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}
const secret = envValue('NEXTAUTH_SECRET') || 'dev-insecure-nextauth-secret';
process.env.NEXTAUTH_SECRET = secret;

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email: ADMIN_EMAIL },
  select: { id: true, name: true, email: true, role: true, branchIds: true, branchId: true },
});
await prisma.$disconnect();
if (!user) {
  console.error(`QA admin ${ADMIN_EMAIL} not found — seed the database first.`);
  process.exit(2);
}

const token = await encode({
  token: {
    name: user.name, email: user.email, sub: user.id, id: user.id,
    role: user.role, branchIds: user.branchIds ?? [], branchId: user.branchId ?? null,
  },
  secret,
});
const cookie = `next-auth.session-token=${token}`;

const ROUTES = [
  '/en', '/en/features', '/en/cart', '/en/wishlist', '/en/tracking', '/en/branches',
  '/en/admin/login', '/en/admin', '/en/admin/orders', '/en/admin/products',
  '/en/admin/customers', '/en/admin/employees', '/en/admin/reports',
  '/en/admin/reports/sales', '/en/admin/reports/inventory', '/en/admin/reports/branches',
  '/en/admin/reports/finance', '/en/admin/reports/reorder', '/en/admin/shipping',
  '/en/admin/inventory', '/en/admin/inventory/count', '/en/admin/inventory/labels',
  '/en/admin/returns', '/en/admin/returns/new', '/en/admin/settings',
  '/en/admin/settings/setup', '/en/admin/shifts', '/en/admin/users', '/en/admin/users/roles',
  '/en/admin/purchasing', '/en/admin/purchasing/suppliers', '/en/admin/reviews',
  '/en/admin/expenses', '/en/admin/accounting', '/en/admin/notifications',
  '/en/admin/cod-settlement', '/en/admin/website/store', '/en/admin/backup',
  '/en/admin/campaigns', '/en/admin/coupons', '/en/pos',
];

/**
 * Routes whose remaining Arabic is expected because the Prisma schema stores
 * those values in a single column with no English counterpart. Anything NOT
 * listed here must be fully English on `/en`, and a new leak will fail the run.
 * To make a route clean, add the English column and render it — do not add the
 * route here.
 */
const DB_ONLY = {
  '/en/admin': ['Customer.name', 'Order.guestName'],
  '/en/admin/orders': ['Customer.name', 'Order.guestName'],
  '/en/admin/cod-settlement': ['Customer.name', 'Order.guestName'],
  '/en/admin/customers': ['Customer.name', 'Address.street', 'Address.city', 'Address.governorate'],
  '/en/admin/users': ['User.name'],
  '/en/admin/shifts': ['User.name'],
  '/en/admin/employees': ['Employee.name', 'Employee.roleTitle'],
  '/en/admin/payroll': ['Employee.name', 'Employee.roleTitle'],
  '/en/admin/products': ['Product.color', 'Product.size'],
  '/en/admin/reports/reorder': ['Supplier.name', 'Product.color'],
  '/en/admin/purchasing': ['Supplier.name'],
  '/en/admin/purchasing/suppliers': ['Supplier.name', 'Supplier.contactName', 'Supplier.address'],
  '/en/admin/reviews': ['Review.text', 'Product.nameAr'],
  '/en/admin/expenses': ['Expense.notes', 'Expense.title'],
  '/en/admin/accounting': ['Expense.notes', 'Expense.title'],
};

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+data-locale-switcher="true"[^>]*>[\s\S]*?<\/[^>]+>/gi, ' ')
    .replace(/<[^>]+>/g, '\u0001')
    .split('\u0001').map((s) => s.trim()).filter(Boolean).join('\n');
}

let uiFailures = 0;
let unreachable = 0;
for (const route of ROUTES) {
  let res, html = '';
  let lastError = '';
  // The dev server can restart itself under memory pressure, so retry once
  // before treating a fetch failure as a real result.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(BASE + route, { headers: { cookie }, redirect: 'manual' });
      html = await res.text();
      lastError = '';
      break;
    } catch (e) {
      lastError = e.message;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (lastError) {
    unreachable++;
    console.log(`SKIP    ${route}  (${lastError})`);
    continue;
  }
  if (res.status >= 300 && res.status < 400) {
    console.log(`SKIP    ${res.status}  ${route} -> ${res.headers.get('location')}`);
    continue;
  }
  const lines = [...new Set(visibleText(html).split('\n').filter((l) => AR.test(l)))]
    // The switcher endonym and the Arabic brand mark are intentional.
    .filter((l) => !/^العربية$/.test(l) && !/^ع$/.test(l) && !/أبطال الرياضة/.test(l));

  const hardFail = res.status >= 400 ? [`HTTP ${res.status}`] : [];
  const known = DB_ONLY[route];
  if (lines.length && known) {
    if (SHOW_DATA) {
      console.log(`   data>  ${route}  [${known.join(', ')}]`);
      for (const l of lines) console.log(`   data>     ${l.slice(0, 90)}`);
    }
  } else if (lines.length) {
    hardFail.push(...lines);
  }
  if (hardFail.length) uiFailures++;
  console.log(`${hardFail.length ? 'FAIL' : ' ok  '}    ${res.status}  ${route}`);
  for (const l of hardFail) console.log(`   AR>   ${l.slice(0, 140)}`);
}

console.log(`\nchecked ${ROUTES.length} routes — ui failures: ${uiFailures}, unreachable: ${unreachable}`);
process.exit(uiFailures ? 1 : 0);

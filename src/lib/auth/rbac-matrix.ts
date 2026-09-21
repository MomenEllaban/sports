import type { Role } from '@prisma/client';

/**
 * SINGLE SOURCE OF TRUTH for API authorization (T04).
 * Key: route path as it appears under src/app/api (without trailing /route).
 * Value: allowed HTTP methods with minimal roles, or 'public'.
 * The meta-test (tests/integration/rbac-matrix.test.ts) FAILS for any route.ts
 * that is neither listed here nor under an explicitly public prefix.
 */
export type MatrixEntry = { methods: Record<string, Role[] | 'public'> };

export const PUBLIC_PREFIXES = ['/api/auth/', '/api/orders/', '/api/account/', '/api/payments/', '/api/discounts/', '/api/reviews', '/api/products/'];

const SUPER: Role[] = ['SUPER_ADMIN'];
const BM: Role[] = ['SUPER_ADMIN', 'BRANCH_MANAGER'];
const FIN: Role[] = ['SUPER_ADMIN', 'FINANCE'];
const ALL: Role[] = ['SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF'];
const POS: Role[] = ['CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'];

export const RBAC_MATRIX: Record<string, MatrixEntry> = {
  '/api/admin/users': { methods: { GET: SUPER, POST: SUPER } },
  '/api/admin/users/[id]': { methods: { PATCH: SUPER, DELETE: SUPER } },
  '/api/admin/branches': { methods: { GET: SUPER, POST: SUPER } },
  '/api/admin/branches/[id]': { methods: { PATCH: SUPER, DELETE: SUPER } },
  '/api/admin/expenses': { methods: { POST: FIN } },
  '/api/admin/expenses/[id]': { methods: { PATCH: FIN, DELETE: FIN } },
  '/api/admin/payroll-runs': { methods: { POST: FIN } },
  '/api/admin/payroll-runs/[id]': { methods: { POST: FIN, PATCH: FIN } },
  '/api/admin/notifications': { methods: { GET: ALL } },
  '/api/admin/notifications/[id]': { methods: { PATCH: ALL, DELETE: ALL } },
  '/api/admin/notifications/read-all': { methods: { POST: ALL } },
  '/api/admin/upload': { methods: { POST: BM } },
  '/api/admin/orders': { methods: { POST: BM } },
  '/api/admin/orders/[id]': { methods: { PATCH: BM } },
  '/api/admin/orders/[id]/ship': { methods: { POST: BM } },
  '/api/admin/orders/[id]/refund': { methods: { POST: BM } },
  '/api/admin/refunds': { methods: { GET: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'] } },
  '/api/admin/reports/summary': { methods: { GET: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'] } },
  '/api/admin/refunds/[id]': { methods: { POST: BM } },
  '/api/admin/products': { methods: { POST: BM } },
  '/api/admin/products/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/categories': { methods: { GET: BM, POST: BM } },
  '/api/admin/categories/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/brands': { methods: { GET: BM, POST: BM } },
  '/api/admin/brands/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/suppliers': { methods: { GET: BM, POST: BM } },
  '/api/admin/suppliers/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/customers': { methods: { POST: BM } },
  '/api/admin/customers/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/employees': { methods: { GET: BM, POST: BM } },
  '/api/admin/employees/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/transfers': { methods: { POST: BM } },
  '/api/admin/transfers/[id]': { methods: { POST: BM } },
  '/api/admin/purchase-orders': { methods: { POST: BM } },
  '/api/admin/purchase-orders/[id]': { methods: { PATCH: BM } },
  '/api/admin/purchase-orders/[id]/return': { methods: { POST: BM } },
  '/api/admin/inventory/adjust': { methods: { POST: BM } },
  '/api/admin/tax-invoices/[id]/retry': { methods: { POST: FIN } },
  '/api/admin/inventory/adjust-info': { methods: { GET: BM } },
  '/api/admin/supplier-payments': { methods: { GET: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], POST: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'] } },
  '/api/admin/purchase-orders/[id]/receive': { methods: { POST: BM } },
  '/api/pos/products': { methods: { GET: POS } },
  '/api/pos/sale': { methods: { POST: POS } },
  '/api/pos/shifts': { methods: { GET: POS, POST: POS } },
  '/api/pos/shifts/[id]': { methods: { GET: POS, POST: POS } },
  '/api/pos/customer': { methods: { GET: POS, POST: POS } },
  '/api/admin/audit': { methods: { GET: SUPER } },
  '/api/admin/settings': { methods: { GET: SUPER, PUT: SUPER } },
  '/api/admin/settings/status': { methods: { GET: SUPER } },
  '/api/upload/receipt': { methods: { POST: 'public' } },
  '/api/health': { methods: { GET: 'public' } },
  '/api/webhooks/paymob': { methods: { POST: 'public' } },
  '/api/webhooks/fawry': { methods: { POST: 'public' } },
  '/api/webhooks/bosta': { methods: { POST: 'public' } },
  '/api/webhooks/mylerz': { methods: { POST: 'public' } },
  '/api/admin/coupons': { methods: { GET: BM, POST: BM } },
  '/api/admin/reviews': { methods: { GET: BM, PATCH: BM, DELETE: BM } },
  '/api/admin/coupons/[id]': { methods: { PATCH: BM, DELETE: BM } },
  '/api/admin/cod-settlement': { methods: { GET: FIN, POST: FIN } },
};

export function lookupMatrix(pathname: string): MatrixEntry | null {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return { methods: {} };
  }
  return RBAC_MATRIX[pathname] ?? null;
}

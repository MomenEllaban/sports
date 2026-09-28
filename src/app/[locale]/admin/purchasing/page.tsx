import React from 'react';
import { getLocale } from 'next-intl/server';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import PurchasingManager from '@/components/admin/PurchasingManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { branchWhere, scopedBranchIds } from '@/lib/auth/branch-scope';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

/** Only what the order card renders. `items.product` is the heaviest include. */
const orderSelect = {
  id: true,
  poNumber: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  supplier: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, nameEn: true } },
  items: {
    select: {
      id: true,
      quantityOrdered: true,
      quantityReceived: true,
      unitCost: true,
      product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, costPrice: true } },
    },
  },
} as const;

type OrderRow = Prisma.PurchaseOrderGetPayload<{ select: typeof orderSelect }>;

const loadOrders = (where: Prisma.PurchaseOrderWhereInput, page: number) =>
  prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: orderSelect,
  });

export default async function AdminPurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; supplierId?: string; q?: string }>;
}) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page || 1) || 1);
  const statusFilter = typeof sp.status === 'string' ? sp.status : '';
  const supplierFilter = typeof sp.supplierId === 'string' ? sp.supplierId : '';
  // Bounded free-text lookup. Only the PO number is searchable: it is the one
  // identifier users actually have in hand from a printed order or a phone call.
  const poQuery = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 40);

  // The previous `session as unknown as {...}` cast duplicated the branch-scope
  // rules and could drift from them. This is the one canonical helper.
  const allowedBranchIds = scopedBranchIds(session);
  // Built explicitly rather than spread from a shared helper, so the fragment is
  // typed as PurchaseOrderWhereInput and cannot carry a foreign model's
  // relations into this query.
  const orderWhere: Prisma.PurchaseOrderWhereInput = {
    ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
    ...(statusFilter ? { status: statusFilter as PurchaseOrderStatus } : {}),
    ...(supplierFilter ? { supplierId: supplierFilter } : {}),
    ...(poQuery ? { poNumber: { contains: poQuery } } : {}),
  };

  // The status chips are built from `total`, which is the count *after* the
  // status filter, so the "All" chip used to report the filtered total and every
  // other chip reported nothing. The tabs need the real per-status counts, and
  // an unfiltered total, so they are counted separately.
  const scopeOnly: Prisma.PurchaseOrderWhereInput = {
    ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
  };
  const scopeWithSearch: Prisma.PurchaseOrderWhereInput = {
    ...scopeOnly,
    ...(supplierFilter ? { supplierId: supplierFilter } : {}),
    ...(poQuery ? { poNumber: { contains: poQuery } } : {}),
  };

  const [suppliers, branches, total, orders, totalAll, statusGroups] = await Promise.all([
    // Suppliers and branches are small lookup tables, needed in full to populate
    // the create form's selects.
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    // Scoped: the branch select used to offer every active branch in the system,
    // so a branch manager could open a PO against a branch they cannot see.
    prisma.branch.findMany({
      where: { isActive: true, ...branchWhere(session) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nameEn: true },
    }),
    prisma.purchaseOrder.count({ where: orderWhere }),
    // Server-side pagination. The product catalogue is no longer loaded here at
    // all: the line picker typeaheads against /api/admin/purchasing/products.
    loadOrders(orderWhere, page),
    prisma.purchaseOrder.count({ where: scopeOnly }),
    // One grouped query instead of one count per status.
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: scopeWithSearch,
      _count: { _all: true },
    }),
  ]);

  const statusCounts = statusGroups.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = g._count._all;
    return acc;
  }, {});

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  // An out-of-range page (a stale bookmark, or a filter that just shrank the
  // list) is re-read at the last real page instead of rendering nothing, which
  // is how the other admin lists clamp. The re-read only happens when the
  // requested page is out of range, so the normal case stays a single round trip.
  const rows: OrderRow[] = safePage === page ? orders : await loadOrders(orderWhere, safePage);

  const mapRow = (po: OrderRow) => ({
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    createdAt: po.createdAt.toISOString(),
    totalAmount: num(po.totalAmount),
    supplier: po.supplier,
    branch: po.branch,
    items: po.items.map((i) => ({
      id: i.id,
      quantityOrdered: i.quantityOrdered,
      quantityReceived: i.quantityReceived,
      unitCost: num(i.unitCost),
      product: { ...i.product, costPrice: num(i.product.costPrice) },
    })),
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-slate-100">{isAr ? 'أوامر التوريد والمشتريات' : 'Purchase orders & procurement'}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{isAr ? 'إنشاء ومتابعة أوامر شراء البضائع والمستلزمات الرياضية' : 'Create and track purchase orders for goods and sports equipment'}</p>
      </div>
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
        <PurchasingManager
          suppliers={suppliers}
          branches={branches}
          purchaseOrders={rows.map(mapRow)}
          totalCount={total}
          totalAll={totalAll}
          statusCounts={statusCounts}
          page={safePage}
          totalPages={totalPages}
          statusFilter={statusFilter}
          selectedSupplierId={supplierFilter}
          poQuery={poQuery}
        />
      </div>
    </>
  );
}

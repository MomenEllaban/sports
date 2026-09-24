import React from 'react';
import OrdersManager from '@/components/admin/OrdersManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { branchResourceWhere, branchResourceWhereForSale, branchWhere } from '@/lib/auth/branch-scope';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const [orders, sales, products, branches] = await Promise.all([
    prisma.order.findMany({
      where: branchResourceWhere(session),
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true } } } },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        returns: { select: { id: true, returnNumber: true, status: true, refunds: { select: { id: true, status: true, amount: true } } } },
        taxInvoice: { select: { id: true } },
      },
    }),
    // POS cashier sales appear here too (source POS, completed/paid) — single source of truth stays the Sale table
    prisma.sale.findMany({
      where: branchResourceWhereForSale(session),
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true } } } },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        taxInvoice: { select: { id: true } },
      },
    }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true, price: true } }),
    prisma.branch.findMany({ where: { isActive: true, ...branchWhere(session) }, select: { id: true, name: true, nameEn: true } }),
  ]);

  const orderRows = orders.map((o) => ({
    kind: 'ORDER' as const,
    ...o,
    receiptImage: o.receiptImage ?? null,
    invoiceId: o.taxInvoice?.id ?? null,
    returns: o.returns.map((r) => ({ ...r, refunds: r.refunds.map((f) => ({ ...f, amount: num(f.amount) })) })),
    totalAmount: num(o.totalAmount),
    subtotal: num(o.subtotal),
    discountAmount: num(o.discountAmount),
    taxAmount: num(o.taxAmount),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((i) => ({ ...i, unitPrice: num(i.unitPrice), totalPrice: num(i.totalPrice) })),
  }));

  const posRows = sales.map((s) => ({
    kind: 'POS' as const,
    id: s.id,
    orderNumber: s.saleNumber,
    orderSource: 'POS',
    guestName: s.customer?.name || null,
    guestPhone: s.customer?.phone || '',
    deliveryAddress: s.branch?.name || '',
    shippingProvider: 'PICKUP',
    trackingNumber: s.saleNumber,
    paymentMethod: s.paymentMethod,
    totalAmount: num(s.totalAmount),
    subtotal: num(s.subtotal),
    discountAmount: num(s.discountAmount),
    taxAmount: num(s.taxAmount),
    orderStatus: s.paymentStatus === 'PAID' ? 'DELIVERED' : 'PENDING',
    paymentStatus: s.paymentStatus,
    invoiceId: s.taxInvoice?.id ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.createdAt.toISOString(),
    items: s.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: num(i.unitPrice),
      totalPrice: num(i.totalPrice),
      product: i.product,
    })),
    customer: s.customer,
    branch: s.branch,
  }));

  const rows = [...orderRows, ...posRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-slate-100">إدارة الطلبات والشحنات</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                جدول الطلبات الموحد (Online / POS / WhatsApp) ومتابعة شركات الشحن (بوسطة/مايلرز)
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden animate-fade-up">
            <OrdersManager
              orders={rows}
              products={products.map((p) => ({ ...p, price: num(p.price) }))}
              branches={branches}
            />
          </div>
        </>
  );
}

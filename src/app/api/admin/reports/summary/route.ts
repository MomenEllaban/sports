import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { getSetting } from '@/lib/settings';
import { captureError } from '@/lib/monitor';

/**
 * Reports summary (T12): profitability by product/branch/cashier, dead
 * stock, shipping performance. Filtered by date range + branch; paginated
 * client-side. All math matches check:invariants semantics.
 */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') ? new Date(String(searchParams.get('from'))) : new Date(Date.now() - 30 * 86_400_000);
    const toParam = searchParams.get('to');
    const to = toParam
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(toParam) ? `${toParam}T23:59:59.999Z` : toParam)
      : new Date();
    const branchId = searchParams.get('branch') || undefined;
    const deadDays = await getSetting<number>('reports.deadStockDays', 60).catch(() => 60);
    if (isNaN(+from) || isNaN(+to)) return NextResponse.json({ success: false, error: 'Invalid dates' }, { status: 400 });

    const branchFilter = branchId ? { branchId } : {};
    const [orderItems, saleItems, returnItems, deadCutoff] = await Promise.all([
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: from, lte: to }, paymentStatus: 'PAID', ...branchFilter } },
        include: { product: { select: { id: true, nameAr: true, nameEn: true, price: true, costPrice: true } }, order: { select: { branchId: true } } },
        take: 2000,
      }),
      prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: from, lte: to }, paymentStatus: 'PAID', ...branchFilter } },
        include: {
          product: { select: { id: true, nameAr: true, nameEn: true, price: true, costPrice: true } },
          sale: { select: { branchId: true, cashierId: true, discountAmount: true } },
        },
        take: 2000,
      }),
      prisma.returnItem.findMany({
        where: { return: { createdAt: { gte: from, lte: to }, status: 'COMPLETED', ...branchFilter } },
        include: {
          product: { select: { id: true, nameAr: true, nameEn: true } },
          return: { select: { branchId: true, status: true, channel: true } },
        },
        take: 2000,
      }),
      new Date(Date.now() - deadDays * 86_400_000),
    ]);

    // Returns (T-RMA §7): refund denominator subtracted from revenue/profit.
    const returnsTotal = returnItems.reduce((s, i) => s + num(i.refundAmount), 0);
    const activeReturns = returnItems.filter((i) => ['REQUESTED', 'RECEIVED', 'REFUND_PENDING'].includes(i.return.status));
    const byReason = new Map<string, { count: number; amount: number }>();
    const byReturnProduct = new Map<string, { nameAr: string; qty: number; refund: number }>();
    for (const it of returnItems) {
      const r = byReason.get(it.reasonCode) || { count: 0, amount: 0 };
      r.count += 1;
      r.amount += num(it.refundAmount);
      byReason.set(it.reasonCode, r);
      const p = byReturnProduct.get(it.productId) || { nameAr: it.product.nameAr, qty: 0, refund: 0 };
      p.qty += it.quantity;
      p.refund += num(it.refundAmount);
      byReturnProduct.set(it.productId, p);
    }

    // Product profitability (net of returns).
    const byProduct = new Map<string, { nameAr: string; qty: number; revenue: number; cost: number; refund: number }>();
    for (const it of [...orderItems, ...saleItems]) {
      const cur = byProduct.get(it.productId) || { nameAr: it.product.nameAr, qty: 0, revenue: 0, cost: 0, refund: 0 };
      cur.qty += it.quantity;
      cur.revenue += num(it.totalPrice);
      cur.cost += num(it.product.costPrice) * it.quantity;
      byProduct.set(it.productId, cur);
    }
    for (const [id, p] of byReturnProduct) {
      const entry = byProduct.get(id);
      if (entry) entry.refund += p.refund;
      else byProduct.set(id, { nameAr: p.nameAr, qty: p.qty, revenue: 0, cost: 0, refund: p.refund });
    }
    const productProfit = [...byProduct.entries()]
      .map(([id, v]) => ({ id, ...v, profit: Math.round((v.revenue - v.cost - v.refund) * 100) / 100 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 50);

    // Branch profitability (net of returns).
    const byBranch = new Map<string, { revenue: number; orders: number; sales: number }>();
    for (const it of orderItems) {
      const cur = byBranch.get(it.order.branchId) || { revenue: 0, orders: 0, sales: 0 };
      cur.revenue += num(it.totalPrice);
      cur.orders += 1;
      byBranch.set(it.order.branchId, cur);
    }
    for (const it of saleItems) {
      const cur = byBranch.get(it.sale.branchId) || { revenue: 0, orders: 0, sales: 0 };
      cur.revenue += num(it.totalPrice);
      cur.sales += 1;
      byBranch.set(it.sale.branchId, cur);
    }
    for (const it of returnItems) {
      const cur = byBranch.get(it.return.branchId) || { revenue: 0, orders: 0, sales: 0 };
      cur.revenue -= num(it.refundAmount);
      byBranch.set(it.return.branchId, cur);
    }
    const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
    const branchProfit = branches.map((b) => ({ id: b.id, name: b.name, ...(byBranch.get(b.id) || { revenue: 0, orders: 0, sales: 0 }) }));

    // Cashier performance.
    const byCashier = new Map<string, { revenue: number; sales: number; discount: number }>();
    const countedSales = new Set<string>();
    for (const it of saleItems) {
      const cur = byCashier.get(it.sale.cashierId) || { revenue: 0, sales: 0, discount: 0 };
      cur.revenue += num(it.totalPrice);
      if (!countedSales.has(it.saleId)) {
        countedSales.add(it.saleId);
        cur.sales += 1;
        cur.discount += num(it.sale.discountAmount);
      }
      byCashier.set(it.sale.cashierId, cur);
    }
    const cashiers = await prisma.user.findMany({ where: { id: { in: [...byCashier.keys()] } }, select: { id: true, name: true } });
    const cashierPerf = cashiers.map((c) => ({ id: c.id, name: c.name, ...byCashier.get(c.id)! }))
      .sort((a, b) => b.revenue - a.revenue);

    // Dead stock: stocked but unsold in the window.
    const soldIds = new Set([...orderItems, ...saleItems].map((i) => i.productId));
    const inventories = await prisma.branchInventory.findMany({
      where: { stockQuantity: { gt: 0 }, ...(branchId ? { branchId } : {}) },
      include: { product: { select: { id: true, nameAr: true, price: true, costPrice: true } }, branch: { select: { name: true } } },
      take: 500,
    });
    const deadStock = inventories
      .filter((inv) => !soldIds.has(inv.productId))
      .map((inv) => ({
        productId: inv.productId,
        nameAr: inv.product.nameAr,
        branch: inv.branch.name,
        qty: inv.stockQuantity,
        value: Math.round(num(inv.product.costPrice) * inv.stockQuantity * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    // Shipping performance in range.
    const shipments = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, ...branchFilter },
      select: { shippingProvider: true, orderStatus: true, paymentMethod: true, totalAmount: true },
    });
    const shipByProvider = new Map<string, { total: number; delivered: number; returned: number; cod: number }>();
    for (const s of shipments) {
      const cur = shipByProvider.get(s.shippingProvider) || { total: 0, delivered: 0, returned: 0, cod: 0 };
      cur.total += 1;
      if (s.orderStatus === 'DELIVERED') cur.delivered += 1;
      if (s.orderStatus === 'RETURNED') cur.returned += 1;
      if (s.paymentMethod === 'COD') cur.cod += num(s.totalAmount);
      shipByProvider.set(s.shippingProvider, cur);
    }

    return NextResponse.json({
      success: true,
      from: from.toISOString(),
      to: to.toISOString(),
      productProfit,
      branchProfit,
      cashierPerf,
      deadStock,
      deadDays,
      deadCutoff: deadCutoff.toISOString(),
      shipping: [...shipByProvider.entries()].map(([provider, v]) => ({ provider, ...v })),
      returns: {
        totalRefund: Math.round(returnsTotal * 100) / 100,
        count: returnItems.length,
        activeRequests: activeReturns.length,
        byReason: [...byReason.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.amount - a.amount),
        byProduct: [...byReturnProduct.entries()]
          .map(([id, v]) => ({ id, ...v, refund: Math.round(v.refund * 100) / 100 }))
          .sort((a, b) => b.refund - a.refund)
          .slice(0, 20),
      },
    });
  } catch (e) {
    captureError('admin/reports/summary', e);
    return NextResponse.json({ success: false, error: 'تعذر بناء التقرير' }, { status: 500 });
  }
}

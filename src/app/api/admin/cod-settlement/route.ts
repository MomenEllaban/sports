import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { num } from '@/lib/pricing';

/**
 * COD courier settlement (3.3).
 * GET: all COD orders with collected vs remitted amounts + reconciled flag.
 * POST { orderId, remittedAmount }: finance records the courier remittance
 * sheet amount; the order is flagged reconciled only on exact match.
 */
export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const orders = await prisma.order.findMany({
      where: { paymentMethod: 'COD' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        customer: { select: { name: true, phone: true } },
      },
    });

    return NextResponse.json({
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        branchId: o.branchId,
        branchName: o.branch.name,
        customerName: o.customer?.name || o.guestName,
        guestPhone: o.guestPhone,
        trackingNumber: o.trackingNumber,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        collectedAmount: num(o.totalAmount),
        remittedAmount: num(o.codRemitted),
        codReconciled: o.codReconciled,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error('COD settlement list error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load COD orders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const body = await req.json();
    const { orderId, remittedAmount } = body as { orderId?: string; remittedAmount?: unknown };
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }
    const remitted = Number(remittedAmount);
    if (!Number.isFinite(remitted) || remitted < 0) {
      return NextResponse.json({ success: false, error: 'remittedAmount must be a non-negative number' }, { status: 400 });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentMethod !== 'COD') {
      return NextResponse.json({ success: false, error: 'COD order not found' }, { status: 404 });
    }
    const reconciled = Math.abs(num(order.totalAmount) - remitted) < 0.01;
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { codRemitted: remitted, codReconciled: reconciled },
    });
    return NextResponse.json({
      success: true,
      orderId,
      remittedAmount: remitted,
      codReconciled: updated.codReconciled,
      discrepancy: num(order.totalAmount) - remitted,
    });
  } catch (e) {
    console.error('COD settlement save error:', e);
    return NextResponse.json({ success: false, error: 'Failed to save remittance' }, { status: 500 });
  }
}

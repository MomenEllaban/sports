import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
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
    captureError('api/admin/cod-settlement', e);
    return apiError('INTERNAL_ERROR', 'Failed to load COD orders', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const body = await req.json();
    const { orderId, remittedAmount } = body as { orderId?: string; remittedAmount?: unknown };
    if (!orderId) {
      return apiError('VALIDATION_ERROR', 'orderId is required', 400);
    }
    const remitted = Number(remittedAmount);
    if (!Number.isFinite(remitted) || remitted < 0) {
      return apiError('VALIDATION_ERROR', 'remittedAmount must be a non-negative number', 400);
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentMethod !== 'COD') {
      return apiError('NOT_FOUND', 'COD order not found', 404);
    }
    const reconciled = Math.abs(num(order.totalAmount) - remitted) < 0.01;
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { codRemitted: remitted, codReconciled: reconciled },
    });

    // This is the record of physical cash handed over by the courier. A short
    // remittance is a cash discrepancy, so both the amounts and the mismatch
    // belong in the trail even when the entry reconciles.
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: reconciled ? 'cod.reconciled' : 'cod.discrepancy',
      entity: 'Order',
      entityId: orderId,
      branchId: order.branchId,
      metadata: {
        orderNumber: order.orderNumber,
        expected: num(order.totalAmount),
        remitted,
        discrepancy: num(order.totalAmount) - remitted,
        previousRemitted: num(order.codRemitted),
        previousReconciled: order.codReconciled,
      },
    });

    return NextResponse.json({
      success: true,
      orderId,
      remittedAmount: remitted,
      codReconciled: updated.codReconciled,
      discrepancy: num(order.totalAmount) - remitted,
    });
  } catch (e) {
    captureError('api/admin/cod-settlement', e);
    return apiError('INTERNAL_ERROR', 'Failed to save remittance', 500);
  }
}

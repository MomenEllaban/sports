import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { branchResourceWhere } from '@/lib/auth/branch-scope';
import { captureError } from '@/lib/monitor';

/** Admin order lookup for RMA creation: full lines + availability. */
export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const orderNumber = (new URL(req.url).searchParams.get('orderNumber') || '').trim();
    if (!orderNumber) return apiError('VALIDATION_ERROR', 'orderNumber is required', 400);
    const order = await prisma.order.findFirst({
      // Scoped so a branch manager cannot pull another branch's order lines
      // (and the customer details behind them) by guessing an order number.
      where: {
        AND: [
          { orderNumber: { equals: orderNumber, mode: 'insensitive' } },
          branchResourceWhere(session),
        ],
      },
      include: { items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true } } } } },
    });
    if (!order) return apiError('NOT_FOUND', 'Order not found', 404);
    return NextResponse.json({
      success: true,
      doc: {
        id: order.id,
        number: order.orderNumber,
        branchId: order.branchId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: num(order.totalAmount),
        items: order.items.map((i) => ({
          refId: i.id,
          productId: i.productId,
          nameAr: i.product.nameAr,
          nameEn: i.product.nameEn,
          sku: i.product.sku,
          quantity: i.quantity,
          unitPrice: num(i.unitPrice),
        })),
      },
    });
  } catch (e) {
    captureError('admin/returns/lookup', e);
    return apiError('INTERNAL_ERROR', 'Failed to load the order', 500);
  }
}

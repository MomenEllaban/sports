import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { transitionOrder, OrderTransitionError } from '@/lib/orders/status';

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { orderStatus, paymentStatus } = body;

    let order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Order status goes through the state machine (T08). Direct RETURNED is
    // closed: all returns flow through the single Return Service (T-RMA).
    if (orderStatus) {
      if (!ORDER_STATUSES.includes(orderStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid order status' }, { status: 400 });
      }
      if (orderStatus === 'RETURNED') {
        return NextResponse.json(
          { success: false, error: 'استخدم مسار المرتجعات (/admin/returns) بدلاً من قلب الحالة مباشرة' },
          { status: 400 }
        );
      }
      try {
        const actorId = (session?.user as { id?: string } | undefined)?.id;
        await transitionOrder(id, orderStatus as OrderStatus, actorId);
      } catch (e) {
        const err = e as OrderTransitionError & { status?: number };
        return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
      }
      order = await prisma.order.findUniqueOrThrow({ where: { id } });
    }
    if (paymentStatus) {
      if (!PAYMENT_STATUSES.includes(paymentStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid payment status' }, { status: 400 });
      }
      order = await prisma.order.update({ where: { id }, data: { paymentStatus } });
    }
    if (!orderStatus && !paymentStatus) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('Admin order update error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}

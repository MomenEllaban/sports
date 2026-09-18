import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';
import { OrderStatus, PaymentStatus } from '@prisma/client';

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { orderStatus, paymentStatus } = body;

    const data: { orderStatus?: OrderStatus; paymentStatus?: PaymentStatus } = {};
    if (orderStatus) {
      if (!ORDER_STATUSES.includes(orderStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid order status' }, { status: 400 });
      }
      data.orderStatus = orderStatus;
    }
    if (paymentStatus) {
      if (!PAYMENT_STATUSES.includes(paymentStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid payment status' }, { status: 400 });
      }
      data.paymentStatus = paymentStatus;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const order = await prisma.order.update({ where: { id }, data });
    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('Admin order update error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}

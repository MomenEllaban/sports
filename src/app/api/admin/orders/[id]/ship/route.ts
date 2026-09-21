import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { createCourierShipment } from '@/lib/logistics';
import { captureError } from '@/lib/monitor';

/**
 * Retry shipment booking (T03): for MANUAL orders (courier wasn't booked),
 * attempt the real courier call now and persist the tracking number.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (order.shippingProvider !== 'BOSTA' && order.shippingProvider !== 'MYLERZ') {
      return NextResponse.json({ success: false, error: 'الشحن اليدوي/الاستلام لا يحتاج حجز' }, { status: 400 });
    }
    if (order.trackingNumber && !order.trackingNumber.startsWith('MANUAL-')) {
      return NextResponse.json({ success: false, error: 'الشحنة محجوزة بالفعل' }, { status: 409 });
    }
    const result = await createCourierShipment({
      orderNumber: order.orderNumber,
      branchAddress: '',
      customerName: order.guestName || 'Customer',
      customerPhone: order.guestPhone,
      customerAddress: order.deliveryAddress,
      codAmount: order.paymentMethod === 'COD' ? num(order.totalAmount) : 0,
      provider: order.shippingProvider,
    });
    if (result.manual) {
      return NextResponse.json({ success: false, error: 'شركة الشحن غير مفعلة — أدخل مفتاحها في الإعدادات أولاً' }, { status: 422 });
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { trackingNumber: result.trackingNumber },
    });
    return NextResponse.json({ success: true, trackingNumber: updated.trackingNumber, labelUrl: result.labelUrl });
  } catch (e) {
    captureError('admin/orders/[id]/ship', e);
    return NextResponse.json({ success: false, error: 'تعذر حجز الشحنة' }, { status: 500 });
  }
}

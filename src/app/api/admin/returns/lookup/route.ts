import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { captureError } from '@/lib/monitor';

/** Admin order lookup for RMA creation (T-RMA): full lines + availability. */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const orderNumber = (new URL(req.url).searchParams.get('orderNumber') || '').trim();
    if (!orderNumber) return NextResponse.json({ success: false, error: 'orderNumber required' }, { status: 400 });
    const order = await prisma.order.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } },
      include: { items: { include: { product: { select: { id: true, nameAr: true } } } } },
    });
    if (!order) return NextResponse.json({ success: false, error: 'الطلب غير موجود' }, { status: 404 });
    return NextResponse.json({
      success: true,
      doc: {
        id: order.id,
        number: order.orderNumber,
        items: order.items.map((i) => ({
          refId: i.id, productId: i.productId, nameAr: i.product.nameAr,
          quantity: i.quantity, unitPrice: num(i.unitPrice),
        })),
      },
    });
  } catch (e) {
    captureError('admin/returns/lookup', e);
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}

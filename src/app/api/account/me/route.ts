import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { isPortalEnabled } from '@/lib/settings';
import { readPortalSession } from '@/lib/account/session';

/** Customer portal profile: loyalty, orders, addresses (4.3). */
export async function GET() {
  try {
    if (!(await isPortalEnabled().catch(() => true))) {
      return NextResponse.json({ success: false, error: 'portal disabled' }, { status: 403 });
    }
    const session = await readPortalSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'not logged in' }, { status: 401 });
    }
    const customer = await prisma.customer.findUnique({
      where: { id: session.customerId },
      include: {
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: { include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } } } },
      },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'account not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        loyaltyPoints: customer.loyaltyPoints,
        addresses: customer.addresses,
        orders: customer.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          totalAmount: num(o.totalAmount),
          trackingNumber: o.trackingNumber,
          createdAt: o.createdAt.toISOString(),
          items: o.items.map((i) => ({
            quantity: i.quantity,
            unitPrice: num(i.unitPrice),
            totalPrice: num(i.totalPrice),
            product: i.product,
          })),
        })),
      },
    });
  } catch (e) {
    console.error('Portal me error:', e);
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ success: false, message: 'مطلوب إدخال رقم الطلب أو رقم الموبايل.' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { equals: query, mode: 'insensitive' } },
        { guestPhone: { contains: query } },
        { trackingNumber: { equals: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ success: false, message: 'لم يتم العثور على أي طلب مطابق.' });
  }

  return NextResponse.json({
    success: true,
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      shippingProvider: order.shippingProvider,
      trackingNumber: order.trackingNumber,
      totalAmount: order.totalAmount,
      guestName: order.guestName,
      guestPhone: order.guestPhone,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        name: i.product.nameAr,
        quantity: i.quantity,
        price: i.unitPrice,
      })),
    },
  });
}

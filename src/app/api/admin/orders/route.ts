import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const body = await req.json();
    const {
      guestName,
      guestPhone,
      deliveryAddress,
      paymentMethod = 'COD',
      orderSource = 'WHATSAPP',
      branchId,
      notes,
      items,
    } = body;

    if (!guestPhone || !deliveryAddress || !branchId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'الموبايل، العنوان، الفرع، والمنتجات مطلوبة' },
        { status: 400 }
      );
    }

    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const unitPrice = item.unitPrice || product.price;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      orderItemsData.push({
        productId: product.id,
        unitPrice,
        quantity: item.quantity,
        totalPrice,
      });
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const taxAmount = Math.round(subtotal * 0.14 * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderSource: orderSource as 'WHATSAPP' | 'ONLINE' | 'POS',
        guestName: guestName || null,
        guestPhone: String(guestPhone).trim(),
        deliveryAddress: String(deliveryAddress).trim(),
        branchId,
        paymentMethod: paymentMethod as 'COD' | 'PAYMOB' | 'FAWRY' | 'INSTAPAY' | 'VODAFONE_CASH' | 'KASHIER' | 'CASH' | 'CARD',
        subtotal,
        taxAmount,
        totalAmount,
        notes: notes || null,
        items: { create: orderItemsData },
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('Admin order create error:', e);
    return NextResponse.json({ success: false, error: 'فشل في إنشاء الطلب' }, { status: 500 });
  }
}

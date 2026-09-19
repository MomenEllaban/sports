import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { computeTotals, num } from '@/lib/pricing';

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
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

    const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
    if (!branch) {
      return NextResponse.json({ success: false, error: 'الفرع غير صالح' }, { status: 400 });
    }

    const orderItemsData: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number }> = [];

    for (const item of items) {
      // T06/T09: server recomputes from DB; client prices ignored. Strict integer qty.
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الطلب' }, { status: 400 });
      }
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        return NextResponse.json({ success: false, error: 'صنف غير موجود أو موقوف' }, { status: 400 });
      }
      const price = num(product.price);
      const totalPrice = price * item.quantity;
      orderItemsData.push({
        productId: product.id,
        unitPrice: price,
        quantity: item.quantity,
        totalPrice,
      });
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    // T09: central pricing (exclusive VAT).
    const totals = computeTotals({ lines: orderItemsData });
    const subtotal = totals.subtotal;
    const taxAmount = totals.vat;
    const totalAmount = totals.total;

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

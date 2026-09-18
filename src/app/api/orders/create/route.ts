import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCourierShipment } from '@/lib/logistics';
import { submitToEta } from '@/lib/eta';
import { initializePayment } from '@/lib/payments';
import { dispatchNotification } from '@/lib/notifications';
import { OrderSource, PaymentMethod, ShippingProvider, OrderStatus, PaymentStatus } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, name, address, fulfillmentType, zoneId, deliveryFee, paymentMethod, items } = body;

    if (!phone || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'رقم الموبايل والمنتجات مطلوبة.' }, { status: 400 });
    }

    // 1. Fetch Flagship Branch (Al Ibrahimeyah)
    const flagshipBranch = await prisma.branch.findFirst({
      where: { isActive: true },
    });

    if (!flagshipBranch) {
      return NextResponse.json({ success: false, error: 'الفرع غير متوفر حالياً.' }, { status: 500 });
    }

    // 2. Find or create Customer
    let customer = await prisma.customer.findUnique({
      where: { phone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone,
          name: name || 'عميل كريم',
        },
      });
    }

    // 3. Calculate order totals & verify stock
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const dbProduct = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventories: { where: { branchId: flagshipBranch.id } } },
      });

      if (!dbProduct) continue;

      const itemTotal = dbProduct.price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: dbProduct.id,
        unitPrice: dbProduct.price,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });

      // Deduct stock in Flagship Branch
      const currentStock = dbProduct.inventories[0]?.stockQuantity || 0;
      const newStock = Math.max(0, currentStock - item.quantity);

      await prisma.branchInventory.updateMany({
        where: { branchId: flagshipBranch.id, productId: dbProduct.id },
        data: { stockQuantity: newStock },
      });

      // Log inventory change
      await prisma.inventoryLog.create({
        data: {
          branchId: flagshipBranch.id,
          productId: dbProduct.id,
          type: 'SALE',
          changeQuantity: -item.quantity,
          previousQuantity: currentStock,
          newQuantity: newStock,
        },
      });
    }

    const vatAmount = Math.round(subtotal * 0.14 * 100) / 100;
    const totalAmount = subtotal + vatAmount + Number(deliveryFee || 0);

    const orderNumber = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Create Shipment
    const provider = fulfillmentType === 'PICKUP' ? ShippingProvider.PICKUP : ShippingProvider.BOSTA;
    const courierResult = await createCourierShipment({
      orderNumber,
      branchAddress: flagshipBranch.address,
      customerName: name || 'عميل كريم',
      customerPhone: phone,
      customerAddress: address,
      codAmount: paymentMethod === 'COD' ? totalAmount : 0,
      provider,
    });

    // 5. Initialize Payment Instructions
    const payResult = await initializePayment(paymentMethod as PaymentMethod, orderNumber, totalAmount, phone, name);

    // 6. Create Order in Database
    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderSource: OrderSource.ONLINE,
        customerId: customer.id,
        guestPhone: phone,
        guestName: name,
        deliveryAddress: address,
        branchId: flagshipBranch.id,
        deliveryZone: zoneId || 'Alexandria Central',
        deliveryFee: Number(deliveryFee || 0),
        shippingProvider: provider,
        trackingNumber: courierResult.trackingNumber,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentStatus: paymentMethod === 'COD' ? PaymentStatus.PENDING : PaymentStatus.PENDING,
        orderStatus: OrderStatus.CONFIRMED,
        subtotal,
        taxAmount: vatAmount,
        totalAmount,
        items: {
          create: orderItemsData,
        },
      },
    });

    // 7. Submit ETA Receipt record
    const etaRes = await submitToEta({
      branchId: flagshipBranch.id,
      orderId: order.id,
      invoiceNumber: orderNumber,
      totalAmount,
      vatAmount,
      items: orderItemsData.map((i) => ({
        name: 'منتج رياضي',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        vatAmount: Math.round(i.totalPrice * 0.14 * 100) / 100,
      })),
    });

    // 8. Dispatch Notifications
    await dispatchNotification({
      type: 'NEW_ORDER',
      titleAr: `طلب إلكتروني جديد: ${orderNumber}`,
      titleEn: `New Online Order: ${orderNumber}`,
      messageAr: `تم استلام طلب جديد بمبلغ ${totalAmount} ج.م من العميل ${name || phone}.`,
      messageEn: `New order received for ${totalAmount} EGP.`,
      sendWhatsAppPhone: phone,
    });

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      trackingNumber: courierResult.trackingNumber,
      instructionsAr: payResult.instructionsAr,
      etaUuid: etaRes.etaUuid,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ success: false, error: 'فشل في حفظ الطلب.' }, { status: 500 });
  }
}

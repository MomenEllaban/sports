import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCourierShipment } from '@/lib/logistics';
import { buildEtaReceipt } from '@/lib/eta';
import { initializePayment } from '@/lib/payments';
import { dispatchNotification } from '@/lib/notifications';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { OrderSource, PaymentMethod, ShippingProvider, OrderStatus, PaymentStatus } from '@prisma/client';

const genOrderNumber = () => `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

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

    // 3. Validate items + compute totals from DB prices (T06 semantics). No writes yet.
    let subtotal = 0;
    const orderItemsData: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number }> = [];
    const shortages: Array<{ productId: string; sku: string; available: number; requested: number }> = [];

    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الطلب' }, { status: 400 });
      }
      const dbProduct = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventories: { where: { branchId: flagshipBranch.id } } },
      });

      if (!dbProduct || !dbProduct.isActive) {
        return NextResponse.json({ success: false, error: 'صنف غير موجود أو موقوف' }, { status: 400 });
      }

      const available = dbProduct.inventories[0]?.stockQuantity || 0;
      if (available < item.quantity) {
        shortages.push({ productId: dbProduct.id, sku: dbProduct.sku, available, requested: item.quantity });
        continue;
      }

      const itemTotal = dbProduct.price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: dbProduct.id,
        unitPrice: dbProduct.price,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });
    }

    // T07: online checkout REJECTS insufficient stock with item + available payload.
    if (shortages.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'المخزون لا يكفي لبعض الأصناف',
          items: shortages,
        },
        { status: 400 }
      );
    }

    const vatAmount = Math.round(subtotal * 0.14 * 100) / 100;
    const totalAmount = subtotal + vatAmount + Number(deliveryFee || 0);

    const receipt = await buildEtaReceipt({
      branchId: flagshipBranch.id,
      invoiceNumber: 'pending',
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

    // 4-6. ONE transaction: stock + logs + order + invoice; numbers retried (T07).
    const provider = fulfillmentType === 'PICKUP' ? ShippingProvider.PICKUP : ShippingProvider.BOSTA;
    let order: { id: string; orderNumber: string };
    let trackingNumber = '';
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = genOrderNumber();
      try {
        const courierResult = await createCourierShipment({
          orderNumber,
          branchAddress: flagshipBranch.address,
          customerName: name || 'عميل كريم',
          customerPhone: phone,
          customerAddress: address,
          codAmount: paymentMethod === 'COD' ? totalAmount : 0,
          provider,
        });
        order = await prisma.$transaction(async (tx) => {
          for (const line of orderItemsData) {
            await decrementStock(tx, {
              branchId: flagshipBranch.id,
              productId: line.productId,
              quantity: line.quantity,
              type: 'SALE',
              referenceId: orderNumber,
            });
          }
          const created = await tx.order.create({
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
              paymentStatus: PaymentStatus.PENDING,
              orderStatus: OrderStatus.CONFIRMED,
              subtotal,
              taxAmount: vatAmount,
              totalAmount,
              items: { create: orderItemsData },
            },
          });
          await tx.taxInvoice.create({
            data: {
              invoiceNumber: orderNumber,
              etaUuid: receipt.etaUuid,
              orderId: created.id,
              branchId: flagshipBranch.id,
              totalAmount,
              vatAmount,
              qrCodeData: receipt.qrCodeDataUrl,
              status: receipt.status,
              etaResponseText: receipt.message,
            },
          });
          return { id: created.id, orderNumber };
        });
        trackingNumber = courierResult.trackingNumber;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if ((e as { code?: string }).code === 'P2002') continue;
        if (e instanceof InsufficientStockError) {
          return NextResponse.json(
            {
              success: false,
              error: 'المخزون لا يكفي',
              items: [{ productId: e.productId, available: e.available }],
            },
            { status: 400 }
          );
        }
        throw e;
      }
    }
    if (lastErr || !order!) {
      throw lastErr || new Error('Order failed');
    }

    // 7. Payment instructions (external, after commit — never fails the order).
    const payResult = await initializePayment(paymentMethod as PaymentMethod, order.orderNumber, totalAmount, phone, name).catch(() => null);

    // 8. Notifications after commit (never roll back the order).
    dispatchNotification({
      type: 'NEW_ORDER',
      titleAr: `طلب إلكتروني جديد: ${order.orderNumber}`,
      titleEn: `New Online Order: ${order.orderNumber}`,
      messageAr: `تم استلام طلب جديد بمبلغ ${totalAmount} ج.م من العميل ${name || phone}.`,
      messageEn: `New order received for ${totalAmount} EGP.`,
      sendWhatsAppPhone: phone,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      trackingNumber,
      instructionsAr: payResult?.instructionsAr,
      etaUuid: receipt.etaUuid,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ success: false, error: 'فشل في حفظ الطلب.' }, { status: 500 });
  }
}

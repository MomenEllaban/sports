import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCourierShipment } from '@/lib/logistics';
import { buildEtaReceipt } from '@/lib/eta';
import { initializePayment, availablePaymentMethods, PaymentUnavailableError } from '@/lib/payments';
import { dispatchNotification } from '@/lib/notifications';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { computeTotals, num } from '@/lib/pricing';
import { getVatRate } from '@/lib/settings';
import { OrderSource, PaymentMethod, ShippingProvider, OrderStatus, PaymentStatus } from '@prisma/client';

const genOrderNumber = () => `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, name, address, fulfillmentType, zoneId, deliveryFee, paymentMethod, items } = body;

    if (!phone || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'رقم الموبايل والمنتجات مطلوبة.' }, { status: 400 });
    }

    // T01: reject payment methods that are not actually available (hidden in UI).
    try {
      const available = await availablePaymentMethods();
      if (!available.includes(paymentMethod as PaymentMethod)) {
        return NextResponse.json({ success: false, error: 'طريقة الدفع غير متاحة حالياً' }, { status: 400 });
      }
    } catch {
      /* availability check is best-effort; creation validates again below */
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
    const requested: Array<{ productId: string; quantity: number }> = [];
    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الطلب' }, { status: 400 });
      }
      if (typeof item.productId !== 'string' || !item.productId) {
        return NextResponse.json({ success: false, error: 'صنف غير صالح في الطلب' }, { status: 400 });
      }
      requested.push({ productId: item.productId, quantity: item.quantity });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(requested.map((r) => r.productId))] } },
      include: { inventories: { where: { branchId: flagshipBranch.id } } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const orderItemsData: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number }> = [];
    const shortages: Array<{ productId: string; sku: string; available: number; requested: number }> = [];

    for (const item of requested) {
      const dbProduct = byId.get(item.productId);
      if (!dbProduct || !dbProduct.isActive) {
        return NextResponse.json({ success: false, error: 'صنف غير موجود أو موقوف' }, { status: 400 });
      }

      const available = dbProduct.inventories[0]?.stockQuantity || 0;
      if (available < item.quantity) {
        shortages.push({ productId: dbProduct.id, sku: dbProduct.sku, available, requested: item.quantity });
        continue;
      }

      const price = num(dbProduct.price);
      const itemTotal = price * item.quantity;

      orderItemsData.push({
        productId: dbProduct.id,
        unitPrice: price,
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

    // T09: totals via the central pricing module (same exclusive-VAT semantics).
    const vatRate = await getVatRate();
    const totals = computeTotals({
      lines: orderItemsData,
      deliveryFee: Number(deliveryFee || 0),
      vatRate,
    });
    const vatAmount = totals.vat;
    const totalAmount = totals.total;

    // 4-6. ONE transaction: stock + logs + order + invoice; numbers retried (T07).
    const provider = fulfillmentType === 'PICKUP' ? ShippingProvider.PICKUP : ShippingProvider.BOSTA;
    let order: { id: string; orderNumber: string };
    let receipt: Awaited<ReturnType<typeof buildEtaReceipt>> | null = null;
    let trackingNumber = '';
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = genOrderNumber();
      try {
        const currentReceipt = await buildEtaReceipt({
          branchId: flagshipBranch.id,
          invoiceNumber: orderNumber,
          totalAmount,
          vatAmount,
          items: orderItemsData.map((i) => ({
            name: 'منتج رياضي',
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
            vatAmount: Math.round(i.totalPrice * vatRate * 100) / 100,
          })),
        });
        receipt = currentReceipt;
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
              subtotal: totals.subtotal,
              taxAmount: vatAmount,
              totalAmount,
              receiptImage:
                typeof (body as { receiptImage?: unknown }).receiptImage === 'string'
                  ? String((body as { receiptImage: string }).receiptImage).slice(0, 500)
                  : null,
              items: { create: orderItemsData },
            },
          });
          await tx.taxInvoice.create({
            data: {
              invoiceNumber: orderNumber,
              etaUuid: currentReceipt.etaUuid,
              orderId: created.id,
              branchId: flagshipBranch.id,
              totalAmount,
              vatAmount,
              qrCodeData: currentReceipt.qrCodeDataUrl,
              status: currentReceipt.status,
              etaResponseText: currentReceipt.message,
            },
          });
          return { id: created.id, orderNumber };
        }, { maxWait: 10000, timeout: 20000 });
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
    let payResult: Awaited<ReturnType<typeof initializePayment>> | null = null;
    try {
      payResult = await initializePayment(paymentMethod as PaymentMethod, order.orderNumber, totalAmount, phone, name);
    } catch (e) {
      if (e instanceof PaymentUnavailableError) {
        return NextResponse.json({ success: false, error: e.message }, { status: e.status });
      }
      payResult = null;
    }
    // 3.1: persist gateway reference for webhook matching (never fails the order).
    if (payResult?.transactionRef) {
      await prisma.order
        .update({ where: { id: order.id }, data: { paymentRef: payResult.transactionRef } })
        .catch(() => null);
    }

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
      redirectUrl: payResult?.redirectUrl,
      instructionsAr: payResult?.instructionsAr,
      etaUuid: receipt?.etaUuid,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ success: false, error: 'فشل في حفظ الطلب.' }, { status: 500 });
  }
}

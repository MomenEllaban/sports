import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCourierShipment, ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';
import { buildEtaReceipt } from '@/lib/eta';
import { initializePayment, availablePaymentMethods, PaymentUnavailableError } from '@/lib/payments';
import { dispatchNotification } from '@/lib/notifications';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { computeStackedTotals, num, linesSubtotal } from '@/lib/pricing';
import { getVatRate, getRedeemRule } from '@/lib/settings';
import { quoteCoupon, consumeCoupon, redeemPoints, CouponError } from '@/lib/discounts/coupons';
import { OrderSource, PaymentMethod, ShippingProvider, OrderStatus, PaymentStatus } from '@prisma/client';
import { makeInvoiceSnapshot } from '@/lib/invoices/snapshot';

const genOrderNumber = () => `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, name, address, fulfillmentType, zoneId, paymentMethod, items } = body;

    if (!phone || !items || items.length === 0) {
      return apiError('VALIDATION_ERROR', 'رقم الموبايل والمنتجات مطلوبة.', 400);
    }
    if (fulfillmentType !== 'DELIVERY' && fulfillmentType !== 'PICKUP') {
      return apiError('VALIDATION_ERROR', 'طريقة الاستلام غير صالحة.', 400);
    }
    const requestedZoneId = typeof zoneId === 'string' && zoneId.trim() ? zoneId.trim() : 'ALX-CENTRAL';
    const deliveryZone = fulfillmentType === 'DELIVERY'
      ? ALEXANDRIA_DELIVERY_ZONES.find((zone) => zone.id === requestedZoneId)
      : undefined;
    if (fulfillmentType === 'DELIVERY' && !deliveryZone) {
      return apiError('VALIDATION_ERROR', 'منطقة التوصيل غير صالحة.', 400);
    }
    // Never trust a client-supplied delivery fee; calculate it from the server zone table.
    const serverDeliveryFee = fulfillmentType === 'PICKUP' ? 0 : deliveryZone!.fee;

    // T01: reject payment methods that are not actually available (hidden in UI).
    try {
      const available = await availablePaymentMethods();
      if (!available.includes(paymentMethod as PaymentMethod)) {
        return apiError('VALIDATION_ERROR', 'طريقة الدفع غير متاحة حالياً', 400);
      }
    } catch {
      /* availability check is best-effort; creation validates again below */
    }

    // 1. Fetch Flagship Branch (Al Ibrahimeyah)
    const flagshipBranch = await prisma.branch.findFirst({
      where: { isActive: true },
    });

    if (!flagshipBranch) {
      return apiError('INTERNAL_ERROR', 'الفرع غير متوفر حالياً.', 500);
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

    // T09: saved portal address (must belong to this customer) → snapshot text.
    let addressId: string | null = null;
    let finalAddress = address;
    const rawAddressId = typeof body.addressId === 'string' ? body.addressId.trim() : '';
    if (fulfillmentType !== 'PICKUP' && rawAddressId) {
      const saved = await prisma.address.findFirst({ where: { id: rawAddressId, customerId: customer.id } });
      if (!saved) {
        return apiError('VALIDATION_ERROR', 'العنوان المحفوظ غير صالح', 400);
      }
      addressId = saved.id;
      finalAddress = [saved.street, saved.building, saved.city, saved.governorate].filter(Boolean).join('، ');
    }
    if (fulfillmentType !== 'PICKUP' && !finalAddress.trim()) {
      return apiError('VALIDATION_ERROR', 'عنوان التوصيل مطلوب', 400);
    }

    // 3. Validate items + compute totals from DB prices (T06 semantics). No writes yet.
    const requested: Array<{ productId: string; quantity: number }> = [];
    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return apiError('VALIDATION_ERROR', 'كمية غير صالحة في الطلب', 400);
      }
      if (typeof item.productId !== 'string' || !item.productId) {
        return apiError('VALIDATION_ERROR', 'صنف غير صالح في الطلب', 400);
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
        return apiError('VALIDATION_ERROR', 'صنف غير موجود أو موقوف', 400);
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

    // T16: unified discount pipeline (coupon → loyalty → cap).
    // Coupon/PIN never stack by default (allowCouponPin=false); loyalty stacks.
    const vatRate = await getVatRate();
    const redeemRule = await getRedeemRule();
    const subtotal0 = linesSubtotal(orderItemsData);
    let couponQuote: Awaited<ReturnType<typeof quoteCoupon>> | null = null;
    const rawCoupon = typeof body.couponCode === 'string' ? body.couponCode.trim() : '';
    if (rawCoupon) {
      try {
        couponQuote = await quoteCoupon(rawCoupon, subtotal0);
      } catch (e) {
        const err = e as CouponError & { status?: number };
        return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
      }
    }
    const wantPoints = Math.max(0, Math.floor(Number(body.loyaltyPoints) || 0));
    // T-RMA: negative loyalty (after returns) blocks new redemptions until covered.
    if (wantPoints > 0 && (customer.loyaltyPoints || 0) < 0) {
      return apiError('VALIDATION_ERROR', 'رصيد النقاط سالب — لا يمكن الاستبدال حتى تعويضه', 400);
    }
    const totals = computeStackedTotals({
      lines: orderItemsData,
      deliveryFee: serverDeliveryFee,
      vatRate,
      stack: {
        coupon: couponQuote ? { kind: couponQuote.kind, value: couponQuote.value, cap: couponQuote.cap } : null,
        loyalty: wantPoints > 0 ? { points: wantPoints, rate: redeemRule.rate, maxPct: redeemRule.maxPct } : null,
        maxTotalPct: redeemRule.maxTotalPct,
        allowCouponLoyalty: redeemRule.allowCouponLoyalty,
        allowCouponPin: redeemRule.allowCouponPin,
      },
    });
    // Loyalty needs a real balance check now (atomic re-check inside the tx).
    if (totals.pointsUsed > (customer.loyaltyPoints || 0)) {
      return apiError('VALIDATION_ERROR', 'رصيد النقاط لا يكفي', 400);
    }
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
          items: orderItemsData.map((i) => {
            const p = byId.get(i.productId);
            return {
              name: p ? p.nameAr : 'منتج رياضي',
              code: p?.gs1Code || p?.sku,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              vatAmount: Math.round(i.totalPrice * vatRate * 100) / 100,
            };
          }),
        });
        receipt = currentReceipt;
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
              deliveryAddress: fulfillmentType === 'PICKUP' ? 'استلام من فرع الإبراهيمية (92 شارع عمر لطفى)' : finalAddress,
              addressId,
              branchId: flagshipBranch.id,
              deliveryZone: deliveryZone?.id || 'PICKUP',
              deliveryFee: serverDeliveryFee,
              shippingProvider: provider,
              trackingNumber: null,
              paymentMethod: paymentMethod as PaymentMethod,
              paymentStatus: PaymentStatus.PENDING,
              orderStatus: OrderStatus.CONFIRMED,
              subtotal: totals.subtotal,
              discountAmount: totals.totalDiscount,
              taxAmount: vatAmount,
              totalAmount,
              couponCode: couponQuote?.code || null,
              couponDiscount: totals.couponDiscount,
              loyaltyRedeemed: totals.pointsUsed,
              loyaltyDiscount: totals.loyaltyDiscount,
              receiptImage:
                typeof (body as { receiptImage?: unknown }).receiptImage === 'string'
                  ? String((body as { receiptImage: string }).receiptImage).slice(0, 500)
                  : null,
              items: { create: orderItemsData },
            },
          });
          // T16: consume coupon + redeem points atomically with the order.
          if (couponQuote) {
            try {
              await consumeCoupon(tx, couponQuote.id, { orderId: created.id, customerId: customer.id, amount: totals.couponDiscount });
            } catch (e) {
              const err = e as CouponError & { status?: number };
              throw Object.assign(new Error(err.message), { status: err.status || 400 });
            }
          }
          if (totals.pointsUsed > 0) {
            try {
              await redeemPoints(tx, customer.id, totals.pointsUsed);
            } catch (e) {
              const err = e as CouponError & { status?: number };
              throw Object.assign(new Error(err.message), { status: err.status || 400 });
            }
          }
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
              snapshotSource: 'ISSUED',
              snapshot: makeInvoiceSnapshot({
                invoiceNumber: orderNumber,
                source: 'ORDER',
                sourceId: created.id,
                createdAt: new Date(),
                branch: { id: flagshipBranch.id, name: flagshipBranch.name, nameEn: flagshipBranch.nameEn },
                customer: { name: name || customer.name, phone },
                paymentMethod: String(paymentMethod),
                subtotal: totals.subtotal,
                discount: totals.totalDiscount,
                vat: totals.vat,
                deliveryFee: serverDeliveryFee,
                total: totals.total,
                etaUuid: currentReceipt.etaUuid,
                qrCodeData: currentReceipt.qrCodeDataUrl,
                lines: orderItemsData.map((line) => {
                  const product = byId.get(line.productId);
                  return {
                    productId: line.productId,
                    nameAr: product?.nameAr || 'منتج رياضي',
                    nameEn: product?.nameEn || 'Sports product',
                    sku: product?.sku || line.productId,
                    barcode: product?.barcode || null,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    totalPrice: line.totalPrice,
                  };
                }),
              }),
            },
          });
          return { id: created.id, orderNumber };
        }, { maxWait: 10000, timeout: 20000 });
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
        // T16: coupon/points races surface with an HTTP status.
        const st = (e as { status?: number }).status;
        if (typeof st === 'number' && st >= 400 && st < 500) {
          return apiError('REQUEST_FAILED', String((e as Error).message), st);
        }
        throw e;
      }
    }
    if (lastErr || !order!) {
      throw lastErr || new Error('Order failed');
    }

    // Create the courier shipment only after the local order commits. A failed
    // shipment must not leave an orphan shipment without a local order.
    let courierResult: Awaited<ReturnType<typeof createCourierShipment>>;
    try {
      courierResult = await createCourierShipment({
        orderNumber: order.orderNumber,
        branchAddress: flagshipBranch.address,
        customerName: name || 'عميل كريم',
        customerPhone: phone,
        customerAddress: finalAddress,
        codAmount: paymentMethod === 'COD' ? totalAmount : 0,
        provider,
      });
    } catch {
      courierResult = {
        success: true,
        trackingNumber: `MANUAL-${order.orderNumber}`,
        provider,
        estimatedDelivery: 'يحتاج إنشاء الشحنة يدوياً',
        manual: true,
      };
    }
    trackingNumber = courierResult.trackingNumber;
    await prisma.order.update({ where: { id: order.id }, data: { trackingNumber } }).catch(() => null);

    // 7. Payment instructions (external, after commit — never fails the order).
    let payResult: Awaited<ReturnType<typeof initializePayment>> | null = null;
    let paymentInitializationError: string | null = null;
    try {
      payResult = await initializePayment(paymentMethod as PaymentMethod, order.orderNumber, totalAmount, phone, name);
    } catch (e) {
      if (e instanceof PaymentUnavailableError) {
        paymentInitializationError = e.message;
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
      paymentPending: paymentMethod !== 'COD' && !payResult,
      paymentInitializationError,
      etaUuid: receipt?.etaUuid,
    });
  } catch (error) {
    captureError('api/orders/create', error);
    return apiError('INTERNAL_ERROR', 'فشل في حفظ الطلب.', 500);
  }
}

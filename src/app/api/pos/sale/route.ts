import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildEtaReceipt } from '@/lib/eta';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { requireRole, POS_ROLES } from '@/lib/auth/guards';
import { resolvePosContext, PosContextError } from '@/lib/pos/context';
import { authorizeDiscount, DiscountAuthError } from '@/lib/pos/discount';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { computeStackedTotals, linesSubtotal, loyaltyEarned as loyaltyRule, num } from '@/lib/pricing';
import { getLoyaltyRule, getVatRate, getRedeemRule } from '@/lib/settings';
import { quoteCoupon, consumeCoupon, redeemPoints, CouponError } from '@/lib/discounts/coupons';
import { dispatchNotification } from '@/lib/notifications';

const genSaleNumber = () => `POS-2026-${Math.floor(10000 + Math.random() * 90000)}`;

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;

    const body = await req.json();
    const { paymentMethod, items, customerId, branchId } = body;

    let ctx;
    try {
      ctx = await resolvePosContext(session!, branchId ?? null);
    } catch (e) {
      const err = e as PosContextError;
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'الفاتورة فارغة: أضف صنفاً واحداً على الأقل' }, { status: 400 });
    }
    if (!['CASH', 'CARD', 'INSTAPAY'].includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: 'طريقة الدفع غير صالحة' }, { status: 400 });
    }

    const clientSaleId =
      typeof body.clientSaleId === 'string' && body.clientSaleId.trim() ? body.clientSaleId.trim() : null;

    // Idempotency: same clientSaleId twice -> return the ORIGINAL result, no double decrement.
    if (clientSaleId) {
      const existing = await prisma.sale.findUnique({
        where: { clientSaleId },
        include: { taxInvoice: true },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          idempotentReplay: true,
          saleId: existing.id,
          saleNumber: existing.saleNumber,
          totalAmount: existing.totalAmount,
          subtotal: existing.subtotal,
          vatAmount: existing.taxAmount,
          discountAmount: existing.discountAmount,
          loyaltyEarned: 0,
          qrCodeDataUrl: existing.taxInvoice?.qrCodeData || '',
        });
      }
    }

    // Validate items shape (integer qty). Prices ALWAYS recomputed from DB (T06).
    const lines: Array<{ productId: string; quantity: number }> = [];
    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الفاتورة' }, { status: 400 });
      }
      if (typeof item.productId !== 'string' || !item.productId) {
        return NextResponse.json({ success: false, error: 'صنف غير صالح في الفاتورة' }, { status: 400 });
      }
      lines.push({ productId: item.productId, quantity: item.quantity });
    }

    // Load products + pre-check stock for clear errors (the transaction re-checks atomically).
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(lines.map((l) => l.productId))] } },
      include: { inventories: { where: { branchId: ctx.branch.id } } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const priced: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number }> = [];
    for (const line of lines) {
      const dbProduct = byId.get(line.productId);
      if (!dbProduct || !dbProduct.isActive) {
        return NextResponse.json({ success: false, error: 'صنف غير موجود أو موقوف' }, { status: 400 });
      }
      const available = dbProduct.inventories[0]?.stockQuantity || 0;
      if (available < line.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `المخزون لا يكفي: ${dbProduct.nameAr} (المتاح ${available})`,
            items: [{ productId: dbProduct.id, sku: dbProduct.sku, available, requested: line.quantity }],
          },
          { status: 400 }
        );
      }
      const price = num(dbProduct.price);
      const totalPrice = price * line.quantity;
      subtotal += totalPrice;
      priced.push({ productId: dbProduct.id, unitPrice: price, quantity: line.quantity, totalPrice });
    }

    // Strict discount validation + manager authorization (T06), before any write.
    const rawDiscount = (body as { discountAmount?: unknown }).discountAmount ?? 0;
    if (typeof rawDiscount !== 'number' || !Number.isFinite(rawDiscount) || rawDiscount < 0 || rawDiscount > subtotal) {
      return NextResponse.json({ success: false, error: 'مبلغ الخصم غير صالح' }, { status: 400 });
    }
    const discount = Math.round(rawDiscount * 100) / 100;
    let approvedById: string | null = null;
    try {
      const decision = await authorizeDiscount(
        ctx.cashierId,
        ctx.role,
        discount,
        typeof body.managerPin === 'string' ? body.managerPin : null
      );
      approvedById = decision.approvedById;
    } catch (e) {
      const err = e as DiscountAuthError;
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }

    // T09: totals via the central pricing module (same exclusive-VAT semantics).
    const vatRate = await getVatRate();

    let resolvedCustomerId: string | null = null;
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer) resolvedCustomerId = customerId;
    } else if (body.customerPhone) {
      const customer = await prisma.customer.findUnique({ where: { phone: String(body.customerPhone) } });
      if (customer) resolvedCustomerId = customer.id;
    }

    // T16: unified pipeline — coupon → loyalty → authorized PIN, capped.
    const redeemRule = await getRedeemRule();
    const posSubtotal = linesSubtotal(priced);
    let couponQuote: Awaited<ReturnType<typeof quoteCoupon>> | null = null;
    const rawCoupon = typeof body.couponCode === 'string' ? body.couponCode.trim() : '';
    if (rawCoupon) {
      try {
        couponQuote = await quoteCoupon(rawCoupon, posSubtotal);
      } catch (e) {
        const err = e as CouponError & { status?: number };
        return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
      }
    }
    const wantPoints = resolvedCustomerId ? Math.max(0, Math.floor(Number(body.loyaltyPoints) || 0)) : 0;
    if (wantPoints > 0 && resolvedCustomerId) {
      const bal = (await prisma.customer.findUnique({ where: { id: resolvedCustomerId }, select: { loyaltyPoints: true } }))?.loyaltyPoints || 0;
      // T-RMA: negative loyalty (after returns) blocks new redemptions until covered.
      if (bal < 0) {
        return NextResponse.json({ success: false, error: 'رصيد النقاط سالب — لا يمكن الاستبدال حتى تعويضه' }, { status: 400 });
      }
      if (wantPoints > bal) {
        return NextResponse.json({ success: false, error: 'رصيد النقاط لا يكفي' }, { status: 400 });
      }
    }
    const totals = computeStackedTotals({
      lines: priced,
      vatRate,
      stack: {
        coupon: couponQuote ? { kind: couponQuote.kind, value: couponQuote.value, cap: couponQuote.cap } : null,
        loyalty: wantPoints > 0 ? { points: wantPoints, rate: redeemRule.rate, maxPct: redeemRule.maxPct } : null,
        pin: discount,
        maxTotalPct: redeemRule.maxTotalPct,
        allowCouponLoyalty: redeemRule.allowCouponLoyalty,
        allowCouponPin: redeemRule.allowCouponPin,
      },
    });
    const vatAmount = totals.vat;
    const totalAmount = totals.total;

    // T05: attribute to the shift open at SALE time. Offline queue posts
    // carry the captured shiftId; it must belong to this cashier+branch
    // (open or already closed). Otherwise use the current open shift.
    let saleShiftId = ctx.shift.id;
    if (typeof body.shiftId === 'string' && body.shiftId) {
      const claimed = await prisma.shift.findFirst({
        where: { id: body.shiftId, cashierId: ctx.cashierId, branchId: ctx.branch.id },
        select: { id: true },
      });
      if (claimed) saleShiftId = claimed.id;
    }

    // ONE transaction: stock + logs + sale + invoice (T07). Number collisions retried.
    let sale: { id: string; saleNumber: string } | null = null;
    let receipt: Awaited<ReturnType<typeof buildEtaReceipt>> | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const saleNumber = genSaleNumber();
      try {
        const currentReceipt = await buildEtaReceipt({
          branchId: ctx.branch.id,
          invoiceNumber: saleNumber,
          totalAmount,
          vatAmount,
          items: priced.map((i) => {
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
        sale = await prisma.$transaction(async (tx) => {
          for (const line of priced) {
            await decrementStock(tx, {
              branchId: ctx.branch.id,
              productId: line.productId,
              quantity: line.quantity,
              type: 'SALE',
              referenceId: saleNumber,
              createdById: ctx.cashierId,
            });
          }
          const created = await tx.sale.create({
            data: {
              saleNumber,
              branchId: ctx.branch.id,
              cashierId: ctx.cashierId,
              customerId: resolvedCustomerId,
              shiftId: saleShiftId,
              subtotal,
              discountAmount: totals.totalDiscount,
              couponCode: couponQuote?.code || null,
              couponDiscount: totals.couponDiscount,
              loyaltyRedeemed: totals.pointsUsed,
              loyaltyDiscount: totals.loyaltyDiscount,
              taxAmount: vatAmount,
              totalAmount,
              paymentMethod: paymentMethod as PaymentMethod,
              paymentStatus: PaymentStatus.PAID,
              approvedById,
              clientSaleId,
              items: {
                create: priced.map((l) => ({
                  productId: l.productId,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  totalPrice: l.totalPrice,
                })),
              },
            },
          });
          // T16: consume coupon + redeem points atomically with the sale.
          if (couponQuote) {
            await consumeCoupon(tx, couponQuote.id, { saleId: created.id, customerId: resolvedCustomerId, amount: totals.couponDiscount });
          }
          if (totals.pointsUsed > 0 && resolvedCustomerId) {
            await redeemPoints(tx, resolvedCustomerId, totals.pointsUsed);
          }
          await tx.taxInvoice.create({
            data: {
              invoiceNumber: saleNumber,
              etaUuid: currentReceipt.etaUuid,
              saleId: created.id,
              branchId: ctx.branch.id,
              totalAmount,
              vatAmount,
              qrCodeData: currentReceipt.qrCodeDataUrl,
              status: currentReceipt.status,
              etaResponseText: currentReceipt.message,
            },
          });
          return { id: created.id, saleNumber };
        }, { maxWait: 10000, timeout: 20000 });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if ((e as { code?: string }).code === 'P2002') continue; // number/clientSaleId race: retry
        if (e instanceof InsufficientStockError) {
          return NextResponse.json(
            {
              success: false,
              error: `المخزون لا يكفي (المتاح ${e.available})`,
              items: [{ productId: e.productId, available: e.available }],
            },
            { status: 400 }
          );
        }
        // T16: coupon/points races surface with an HTTP status.
        const st = (e as { status?: number }).status;
        if (typeof st === 'number' && st >= 400 && st < 500) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: st });
        }
        throw e;
      }
    }
    if (lastErr || !sale) {
      throw lastErr || new Error('Sale failed');
    }

    // AFTER commit only: loyalty + notifications never roll back or fail the sale.
    let loyaltyEarned = 0;
    if (resolvedCustomerId) {
      const rule = await getLoyaltyRule();
      loyaltyEarned = loyaltyRule(totalAmount, rule.earnPerEgp);
      if (loyaltyEarned > 0) {
        await prisma.customer.update({
          where: { id: resolvedCustomerId },
          data: { loyaltyPoints: { increment: loyaltyEarned } },
        }).catch(() => null);
      }
    }
    dispatchNotification({
      type: 'NEW_ORDER',
      titleAr: `بيع كاشير جديد: ${sale.saleNumber}`,
      titleEn: `New POS sale: ${sale.saleNumber}`,
      messageAr: `فاتورة ${sale.saleNumber} بمبلغ ${totalAmount} ج.م (${paymentMethod}).`,
      messageEn: `POS sale ${sale.saleNumber} for ${totalAmount} EGP.`,
      branchId: ctx.branch.id,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      totalAmount,
      subtotal,
      vatAmount,
      discountAmount: totals.totalDiscount,
      couponDiscount: totals.couponDiscount,
      loyaltyDiscount: totals.loyaltyDiscount,
      loyaltyRedeemed: totals.pointsUsed,
      loyaltyEarned,
      qrCodeDataUrl: receipt?.qrCodeDataUrl || '',
    });
  } catch (error) {
    console.error('POS Sale API error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تنفيذ عملية البيع' }, { status: 500 });
  }
}

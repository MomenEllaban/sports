import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole, POS_ROLES } from '@/lib/auth/guards';
import { resolvePosContext, PosContextError } from '@/lib/pos/context';
import { authorizeDiscount, DiscountAuthError } from '@/lib/pos/discount';
import {
  requestReturn, approveReturn, receiveReturn, executeRefund, linkExchangeSale, ReturnError,
} from '@/lib/returns/service';
import { getReturnsPolicy } from '@/lib/returns/policy';
import { computeTotals } from '@/lib/pricing';
import { buildEtaReceipt } from '@/lib/eta';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { captureError } from '@/lib/monitor';
import { makeInvoiceSnapshot } from '@/lib/invoices/snapshot';

const genSaleNumber = () => `POS-2026-${Math.floor(10000 + Math.random() * 90000)}`;

/**
 * In-store return/exchange wizard (T-RMA §5.1): one call walks
 * REQUESTED→APPROVED→RECEIVED→REFUND_PENDING through the single service.
 * Offline sales are REJECTED here (money + limits need the server).
 * Body: { saleNumber?, customerPhone?, items[{productId,quantity,reasonCode}], refundMethod?,
 *         managerPin?, exchange?: { items[{productId,quantity}], paymentMethod, tendered? },
 *         clientRequestId? }
 */
export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;
    const body = await req.json();
    const actorId = (session?.user as { id?: string })?.id;
    const actorRole = session?.user?.role as string;

    const policy = await getReturnsPolicy();
    if (!policy.enabled) return apiError('FORBIDDEN', 'المرتجعات معطلة حالياً', 403);

    // Locate the original sale: receipt number, or customer's latest sales.
    let sale = null;
    if (typeof body.saleNumber === 'string' && body.saleNumber.trim()) {
      const needle = body.saleNumber.trim();
      sale = await prisma.sale.findFirst({
        where: { OR: [{ saleNumber: needle }, { id: needle }] },
        include: { items: { include: { product: true } } },
      });
      if (!sale) return apiError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
    } else if (typeof body.customerPhone === 'string' && body.customerPhone.trim()) {
      const customer = await prisma.customer.findUnique({
        where: { phone: body.customerPhone.trim() },
        include: { sales: { orderBy: { createdAt: 'desc' }, take: 5, include: { items: { include: { product: true } } } } },
      });
      if (!customer || customer.sales.length === 0) {
        return apiError('NOT_FOUND', 'لا فواتير لهذا الرقم', 404);
      }
      if (!body.saleId) {
        // Lookup step: return candidates for the wizard.
        return NextResponse.json({
          success: true,
          lookup: true,
          sales: customer.sales.map((s) => ({
            id: s.id, saleNumber: s.saleNumber, branchId: s.branchId,
            totalAmount: num(s.totalAmount), createdAt: s.createdAt,
            items: s.items.map((i) => ({
              saleItemId: i.id, productId: i.productId, nameAr: i.product.nameAr,
              sku: i.product.sku, images: i.product.images, quantity: i.quantity,
              unitPrice: num(i.unitPrice), size: i.product.size, color: i.product.color,
            })),
          })),
        });
      }
      sale = customer.sales.find((s) => s.id === body.saleId) || null;
      if (!sale) return apiError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
    } else {
      return apiError('VALIDATION_ERROR', 'رقم الفاتورة أو هاتف العميل مطلوب', 400);
    }

    // POS context (branch + shift gate for cash payouts).
    let ctx;
    try {
      ctx = await resolvePosContext(session!, sale.branchId);
    } catch (e) {
      const err = e as PosContextError;
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400, undefined, { needsShift: err.status === 422 });
    }
    if (ctx.branch.id !== sale.branchId) {
      return apiError('FORBIDDEN', 'الفاتورة لفرع آخر', 403);
    }

    const items = (Array.isArray(body.items) ? body.items : []).map((it: Record<string, unknown>) => ({
      refId: typeof it.saleItemId === 'string' ? it.saleItemId : undefined,
      productId: String(it.productId || ''),
      quantity: Math.floor(Number(it.quantity)),
      reasonCode: String(it.reasonCode || 'OTHER'),
    }));
    if (items.length === 0) return apiError('VALIDATION_ERROR', 'اختر صنفاً واحداً على الأقل', 400);

    // Quote first for the PIN decision (server recomputes authoritatively later).
    try {
      // 1) REQUEST (idempotent).
      const { request, replay } = await requestReturn({
        saleId: sale.id,
        type: body.exchange ? 'EXCHANGE' : 'RETURN',
        channel: 'POS',
        branchId: sale.branchId,
        items,
        customerPhone: body.customerPhone,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        clientRequestId: typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined,
        actorId,
        actorRole,
      });
      if (replay) {
        return NextResponse.json({ success: true, replay: true, returnNumber: request.returnNumber, status: request.status });
      }
      // 2) Approval is immediate in-store (the PIN gate below is the control).
      try {
        await approveReturn(request.id, actorId);
      } catch (e) {
        const err = e as ReturnError & { status?: number };
        return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
      }

      // PIN gate: cash above threshold or value above auto-approve cap.
      const estRefund = await estimateRefund(request.id);
      const pinNeeded =
        (body.refundMethod === 'CASH' || (!body.refundMethod && sale.paymentMethod === 'CASH')) && estRefund > policy.cashRefundManagerThreshold
        || estRefund > policy.autoApproveMaxValue;
      if (pinNeeded) {
        try {
          const decision = await authorizeDiscount(actorId!, actorRole, estRefund, typeof body.managerPin === 'string' ? body.managerPin : null, policy.cashRefundManagerThreshold);
          void decision;
        } catch (e) {
          const err = e as DiscountAuthError;
          return apiError('REQUEST_FAILED', String(err.message), err.status || 400, undefined, { needsPin: true, estimatedRefund: estRefund });
        }
      }

      // 3) RECEIVE with smart disposition defaults.
      const fresh = await prisma.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
      const receiveLines = fresh.items.map((ri) => ({
        returnItemId: ri.id,
        condition: ri.condition,
        disposition: ri.disposition,
      }));
      const received = await receiveReturn(request.id, actorId, receiveLines, {
        refundMethod: normalizeMethod(body.refundMethod, sale.paymentMethod, policy.allowedRefundMethods),
      });

      // 4) EXCHANGE: linked new sale in the same wizard (price difference).
      let exchange = null;
      if (body.exchange && Array.isArray(body.exchange.items) && body.exchange.items.length > 0) {
        exchange = await createExchangeSale(ctx, sale, body.exchange, actorId);
        await linkExchangeSale(request.id, exchange.saleId, actorId);
      }

      // 5) Execute payout now (cash rides the open shift; gateways async).
      let payout: { ok: boolean; gatewayRef?: string | null; error?: string; manual?: boolean } = { ok: false };
      if (received.refund) {
        const r = await executeRefund(received.refund.id);
        payout = { ok: r.ok, gatewayRef: (r as { gatewayRef?: string }).gatewayRef || null, error: (r as { error?: string }).error, manual: (r as { manual?: boolean }).manual };
      }
      const done = await prisma.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { refunds: true } });
      return NextResponse.json({
        success: true,
        returnNumber: done.returnNumber,
        status: done.status,
        refundTotal: received.quote.total,
        refund: done.refunds[0] || null,
        payout,
        exchange,
      });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('pos/returns', e);
    return apiError('INTERNAL_ERROR', 'تعذر تنفيذ المرتجع', 500);
  }
}

function normalizeMethod(wanted: unknown, fallbackPm: string, allowed: string[]): string {
  const w = typeof wanted === 'string' ? wanted.toUpperCase() : '';
  if (w && allowed.includes(w)) return w;
  // Default: cash stays cash (drawer), everything else via original gateway.
  if (fallbackPm === 'CASH' && allowed.includes('CASH')) return 'CASH';
  return 'ORIGINAL_GATEWAY';
}

async function estimateRefund(returnId: string): Promise<number> {
  const r = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: {
      items: true,
      order: { include: { items: true } },
      sale: { include: { items: true } },
    },
  });
  if (!r) return 0;
  // Rough pre-receive estimate: net of returned lines + VAT (exact quote at receive).
  const { getVatRate } = await import('@/lib/settings');
  const vatRate = await getVatRate().catch(() => 0.14);
  let total = 0;
  for (const ri of r.items) {
    const src = r.order
      ? r.order.items.find((i) => i.id === ri.orderItemId)
      : r.sale!.items.find((i) => i.id === ri.saleItemId);
    if (!src) continue;
    total += (num(src.unitPrice) * ri.quantity) * (1 + vatRate);
  }
  return Math.round(total * 100) / 100;
}

async function createExchangeSale(
  ctx: { branch: { id: string }; cashierId: string; shift: { id: string } },
  origSale: { id: string; customerId: string | null },
  exchange: { items: Array<{ productId: string; quantity: number }>; paymentMethod?: string; tendered?: number },
  actorId: string | undefined
) {
  const { getVatRate } = await import('@/lib/settings');
  const vatRate = await getVatRate().catch(() => 0.14);
  for (const item of exchange.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ReturnError(400, 'كمية صنف الاستبدال غير صالحة');
    }
  }
  const products = await prisma.product.findMany({ where: { id: { in: exchange.items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const priced = exchange.items.map((l) => {
    const p = byId.get(l.productId);
    if (!p || !p.isActive) throw new ReturnError(400, 'صنف الاستبدال غير متاح');
    const price = num(p.price);
    return { productId: p.id, unitPrice: price, quantity: l.quantity, totalPrice: price * l.quantity };
  });
  const totals = computeTotals({ lines: priced, vatRate });
  const method = exchange.paymentMethod === 'CARD' ? 'CARD' : 'CASH';
  for (let attempt = 0; attempt < 3; attempt++) {
    const saleNumber = genSaleNumber();
    try {
      const receipt = await buildEtaReceipt({
        branchId: ctx.branch.id, invoiceNumber: saleNumber,
        totalAmount: totals.total, vatAmount: totals.vat,
        items: priced.map((i) => ({ name: 'استبدال', quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, vatAmount: 0 })),
      });
      const created = await prisma.$transaction(async (tx) => {
        for (const l of priced) {
          await decrementStock(tx, {
            branchId: ctx.branch.id, productId: l.productId, quantity: l.quantity,
            type: 'SALE', referenceId: `${saleNumber}-EX`, createdById: actorId,
          });
        }
        const s = await tx.sale.create({
          data: {
            saleNumber, branchId: ctx.branch.id, cashierId: ctx.cashierId,
            customerId: origSale.customerId, shiftId: ctx.shift.id,
            subtotal: totals.subtotal, taxAmount: totals.vat, totalAmount: totals.total,
            paymentMethod: method as never, paymentStatus: method === 'CASH' ? 'PAID' : 'PENDING',
            items: { create: priced.map((l) => ({ productId: l.productId, unitPrice: l.unitPrice, quantity: l.quantity, totalPrice: l.totalPrice })) },
          },
        });
        await tx.taxInvoice.create({
          data: {
            invoiceNumber: saleNumber, etaUuid: receipt.etaUuid, saleId: s.id,
            branchId: ctx.branch.id, totalAmount: totals.total, vatAmount: totals.vat,
            qrCodeData: receipt.qrCodeDataUrl, status: receipt.status, etaResponseText: receipt.message,
            snapshotSource: 'ISSUED',
            snapshot: makeInvoiceSnapshot({
              invoiceNumber: saleNumber,
              source: 'SALE',
              sourceId: s.id,
              createdAt: new Date(),
              branch: { id: ctx.branch.id, name: 'فرع POS' },
              cashier: { id: ctx.cashierId },
              paymentMethod: method,
              subtotal: totals.subtotal,
              discount: 0,
              vat: totals.vat,
              deliveryFee: 0,
              total: totals.total,
              etaUuid: receipt.etaUuid,
              qrCodeData: receipt.qrCodeDataUrl,
              lines: priced.map((line) => {
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
        return s;
      });
      return { saleId: created.id, saleNumber, totalAmount: totals.total };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') continue;
      if (e instanceof InsufficientStockError) throw new ReturnError(400, 'مخزون صنف الاستبدال لا يكفي');
      throw e;
    }
  }
  throw new ReturnError(500, 'تعذر إنشاء فاتورة الاستبدال');
}

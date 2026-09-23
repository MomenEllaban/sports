import { prisma } from '@/lib/db';
import { num, money } from '@/lib/pricing';
import { incrementStock } from '@/lib/inventory/service';
import { quoteReturn, OUR_FAULT, type ReasonCode } from './calc';
import { getReturnsPolicy } from './policy';
import { getVatRate, getLoyaltyRule } from '../settings';
import { submitEtaCreditNote } from '../eta';
import { getPaymobConfig } from '../payments/paymob-config';
import { paymobAuthToken } from '../payments/paymob';
import { getFawryConfig } from '../payments/fawry-config';
import { dispatchNotification, sendWhatsAppTemplate } from '../notifications';
import { writeAudit } from '../audit';
import type { Prisma } from '@prisma/client';

export class ReturnError extends Error {
  status = 400;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;
export type FetchFn = typeof fetch;

const genReturnNumber = () => `RTN-2026-${Math.floor(1000 + Math.random() * 9000)}`;

export interface ReturnLineInput {
  refId?: string; // orderItemId or saleItemId
  productId: string;
  quantity: number;
  reasonCode: string;
  images?: string[];
  notes?: string;
}

export interface RequestReturnInput {
  orderId?: string;
  saleId?: string;
  channel: string;
  branchId?: string;
  items: ReturnLineInput[];
  customerPhone?: string;
  notes?: string;
  clientRequestId?: string;
  actorId?: string;
  actorRole?: string;
}

// ── helpers ──────────────────────────────────────────────

async function sourceLines(orderId?: string, saleId?: string) {
  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { id: true, categoryId: true } } } } },
    });
    if (!order) throw new ReturnError(404, 'الطلب غير موجود');
    return {
      kind: 'order' as const,
      doc: order,
      branchId: order.branchId,
      customerId: order.customerId,
      phone: order.guestPhone,
      createdAt: order.createdAt,
      status: order.orderStatus,
      subtotal: num(order.subtotal),
      discount: num(order.discountAmount),
      deliveryFee: num(order.deliveryFee),
      total: num(order.totalAmount),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      lines: order.items.map((i) => ({
        refId: i.id, productId: i.productId, unitPrice: num(i.unitPrice), quantity: i.quantity,
        categoryId: i.product.categoryId,
      })),
    };
  }
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: { include: { product: { select: { id: true, categoryId: true } } } } },
  });
  if (!sale) throw new ReturnError(404, 'الفاتورة غير موجودة');
  return {
    kind: 'sale' as const,
    doc: sale,
    branchId: sale.branchId,
    customerId: sale.customerId,
    phone: null as string | null,
    createdAt: sale.createdAt,
    status: 'DELIVERED',
    subtotal: num(sale.subtotal),
    discount: num(sale.discountAmount),
    deliveryFee: 0,
    total: num(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    lines: sale.items.map((i) => ({
      refId: i.id, productId: i.productId, unitPrice: num(i.unitPrice), quantity: i.quantity,
      categoryId: i.product.categoryId,
    })),
  };
}

async function alreadyReturned(src: { kind: string; doc: { id: string } }): Promise<Map<string, number>> {
  const items = await prisma.returnItem.findMany({
    where: src.kind === 'order'
      ? { return: { orderId: src.doc.id, status: { notIn: ['REJECTED', 'CANCELLED'] } } }
      : { return: { saleId: src.doc.id, status: { notIn: ['REJECTED', 'CANCELLED'] } } },
    select: { orderItemId: true, saleItemId: true, productId: true, quantity: true },
  });
  const m = new Map<string, number>();
  for (const it of items) {
    const key = (it.orderItemId || it.saleItemId || `p:${it.productId}`) as string;
    m.set(key, (m.get(key) || 0) + it.quantity);
  }
  return m;
}

async function notifyCustomer(phone: string | null, messageAr: string, templateParams: string[]) {
  await dispatchNotification({
    type: 'NEW_ORDER',
    titleAr: 'تحديث طلب المرتجع',
    titleEn: 'Return update',
    messageAr,
    messageEn: messageAr,
    sendWhatsAppPhone: phone || undefined,
  }).catch(() => null);
  if (phone) {
    const { getWhatsAppConfig } = await import('../settings');
    const cfg = await getWhatsAppConfig().catch(() => null);
    if (cfg?.mode === 'cloud') {
      await sendWhatsAppTemplate(phone, undefined, 'ar', templateParams).catch(() => null);
    }
  }
}

async function audit(actorId: string | undefined, action: string, entityId: string, metadata?: Record<string, unknown>) {
  await writeAudit({ actorId, action, entity: 'ReturnRequest', entityId, metadata }).catch(() => null);
}

// ── REQUEST ──────────────────────────────────────────────

/**
 * Step 1: validate eligibility + create REQUESTED case (idempotent).
 * No stock or money moves here.
 */
export async function requestReturn(input: RequestReturnInput) {
  const policy = await getReturnsPolicy();
  if (!policy.enabled) throw new ReturnError(403, 'المرتجعات معطلة حالياً');
  if (!input.orderId && !input.saleId) throw new ReturnError(400, 'الطلب أو الفاتورة مطلوب');
  if (!input.items || input.items.length === 0) throw new ReturnError(400, 'اختر صنفاً واحداً على الأقل');

  // Idempotency: same clientRequestId returns the original case.
  if (input.clientRequestId) {
    const dup = await prisma.returnRequest.findUnique({
      where: { clientRequestId: input.clientRequestId },
      include: { items: true },
    });
    if (dup) return { request: dup, replay: true as boolean };
  }

  const src = await sourceLines(input.orderId, input.saleId);
  if (src.kind === 'order' && !['DELIVERED', 'SHIPPED'].includes(src.status)) {
    throw new ReturnError(400, 'المرتجع متاح بعد التسليم فقط');
  }
  // Window check from delivery/sale date.
  const ageDays = (Date.now() - src.createdAt.getTime()) / 86_400_000;
  if (ageDays > policy.windowDays) throw new ReturnError(400, `انتهت مدة الاسترجاع (${policy.windowDays} يوم)`);
  // Non-returnable categories.
  const blockedCats = new Set(policy.nonReturnableCategories);
  // Reasons + per-line guards.
  const allowedReasons = new Set(policy.reasons);
  const returned = await alreadyReturned(src);
  for (const it of input.items) {
    if (!allowedReasons.has(it.reasonCode)) throw new ReturnError(400, `سبب غير معتمد: ${it.reasonCode}`);
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new ReturnError(400, 'كمية غير صالحة');
    const line = src.lines.find((l) => (it.refId ? l.refId === it.refId : l.productId === it.productId));
    if (!line) throw new ReturnError(400, 'صنف غير موجود في الفاتورة الأصلية');
    if (blockedCats.has(line.categoryId)) throw new ReturnError(400, 'هذا الصنف غير قابل للاسترجاع');
    const key = it.refId || `p:${line.productId}`;
    const open = returned.get(key) || 0;
    if (open + it.quantity > line.quantity) {
      throw new ReturnError(400, `الكمية تتجاوز المباع (المتاح للإرجاع ${line.quantity - open})`);
    }
    if (policy.requirePhotoForReasons.includes(it.reasonCode) && (!it.images || it.images.length === 0)) {
      throw new ReturnError(400, `السبب ${it.reasonCode} يتطلب صورة إثبات`);
    }
  }
  // Phone ownership for online/channel requests.
  if ((input.channel === 'ONLINE' || input.channel === 'WHATSAPP') && input.customerPhone && src.phone && input.customerPhone !== src.phone) {
    throw new ReturnError(401, 'رقم الهاتف غير مطابق لصاحب الطلب');
  }
  // Monthly frequency warning (non-blocking).
  let frequencyWarning: string | null = null;
  if (src.customerId && policy.maxReturnsPerCustomerPerMonth > 0) {
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const n = await prisma.returnRequest.count({
      where: { customerId: src.customerId, createdAt: { gte: monthAgo }, status: { notIn: ['REJECTED', 'CANCELLED'] } },
    });
    if (n >= policy.maxReturnsPerCustomerPerMonth) {
      frequencyWarning = `تنبيه: العميل تجاوز حد المرتجعات الشهري (${policy.maxReturnsPerCustomerPerMonth})`;
    }
  }

  const receiveBranchId = input.branchId || (policy.receiveBranchDefault === 'SALE_BRANCH' || !policy.receiveBranchDefault ? src.branchId : policy.receiveBranchDefault);
  const receiveBranch = await prisma.branch.findFirst({ where: { id: receiveBranchId, isActive: true } });
  if (!receiveBranch) throw new ReturnError(400, 'فرع الاستلام غير صالح');

  for (let attempt = 0; attempt < 3; attempt++) {
    const returnNumber = genReturnNumber();
    try {
      // Serialize per document: lock the order/sale row so concurrent
      // requests re-read committed returns (over-return guard holds).
      const created = await prisma.$transaction(async (tx: Tx) => {
        if (input.orderId) {
          await tx.$queryRaw`SELECT 1 FROM "Order" WHERE id = ${input.orderId} FOR UPDATE`;
        } else {
          await tx.$queryRaw`SELECT 1 FROM "Sale" WHERE id = ${input.saleId} FOR UPDATE`;
        }
        const live = await alreadyReturned(src);
        for (const it of input.items) {
          const line = src.lines.find((l) => (it.refId ? l.refId === it.refId : l.productId === it.productId))!;
          const key = it.refId || `p:${line.productId}`;
          if ((live.get(key) || 0) + it.quantity > line.quantity) {
            throw new ReturnError(400, `الكمية تتجاوز المباع (المتاح للإرجاع ${line.quantity - (live.get(key) || 0)})`);
          }
        }
        return tx.returnRequest.create({
          data: {
            returnNumber,
            orderId: input.orderId,
            saleId: input.saleId,
            type: 'RETURN',
            channel: input.channel,
            branchId: receiveBranch.id,
            status: 'REQUESTED',
            customerId: src.customerId,
            customerPhone: input.customerPhone || src.phone,
            requestedById: input.actorId,
            source: 'NEW',
            notes: input.notes?.slice(0, 500) || null,
            clientRequestId: input.clientRequestId || null,
            items: {
              create: input.items.map((it) => {
                const line = src.lines.find((l) => (it.refId ? l.refId === it.refId : l.productId === it.productId))!;
                return {
                  orderItemId: src.kind === 'order' ? line.refId : null,
                  saleItemId: src.kind === 'sale' ? line.refId : null,
                  productId: line.productId,
                  quantity: it.quantity,
                  reasonCode: it.reasonCode,
                  condition: it.reasonCode === 'DEFECTIVE' ? 'DEFECTIVE' : 'GOOD',
                  disposition: it.reasonCode === 'DEFECTIVE' ? 'DAMAGED' : 'RESTOCK',
                  notes: it.notes?.slice(0, 500) || null,
                  images: it.images || [],
                };
              }),
            },
          },
          include: { items: true },
        });
      });
      await audit(input.actorId, 'return.request', created.id, { returnNumber, channel: input.channel });
      await notifyCustomer(created.customerPhone, `تم استلام طلب المرتجع ${returnNumber} وجارٍ المراجعة.`, [returnNumber]);
      return { request: created, replay: false as boolean, frequencyWarning };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        if (input.clientRequestId) {
          const dup = await prisma.returnRequest.findUnique({ where: { clientRequestId: input.clientRequestId }, include: { items: true } });
          if (dup) return { request: dup, replay: true as boolean };
        }
        continue; // number collision: retry
      }
      throw e;
    }
  }
  throw new ReturnError(500, 'تعذر إنشاء طلب المرتجع');
}

// ── APPROVE / REJECT / CANCEL ────────────────────────────

export async function approveReturn(id: string, actorId: string | undefined) {
  const updated = await prisma.returnRequest.updateMany({
    where: { id, status: 'REQUESTED' },
    data: { status: 'APPROVED', approvedById: actorId },
  });
  if (updated.count !== 1) throw new ReturnError(409, 'الطلب ليس بانتظار الاعتماد');
  const r = await prisma.returnRequest.findUniqueOrThrow({ where: { id } });
  await audit(actorId, 'return.approve', id, {});
  await notifyCustomer(r.customerPhone, `تم اعتماد المرتجع ${r.returnNumber}. الخطوة التالية: تسليم الأصناف لفرع الاستلام.`, [r.returnNumber]);
  return r;
}

export async function rejectReturn(id: string, actorId: string | undefined, reason?: string) {
  const updated = await prisma.returnRequest.updateMany({
    where: { id, status: 'REQUESTED' },
    data: { status: 'REJECTED', notes: reason?.slice(0, 500) || undefined },
  });
  if (updated.count !== 1) throw new ReturnError(409, 'لا يمكن الرفض في هذه الحالة');
  const r = await prisma.returnRequest.findUniqueOrThrow({ where: { id } });
  await audit(actorId, 'return.reject', id, { reason });
  await notifyCustomer(r.customerPhone, `تم رفض طلب المرتجع ${r.returnNumber}: ${reason || ''}`, [r.returnNumber]);
  return r;
}

export async function cancelReturn(id: string, actorId: string | undefined) {
  const updated = await prisma.returnRequest.updateMany({
    where: { id, status: { in: ['REQUESTED', 'APPROVED'] } },
    data: { status: 'CANCELLED' },
  });
  if (updated.count !== 1) throw new ReturnError(409, 'لا يمكن الإلغاء بعد الاستلام');
  await audit(actorId, 'return.cancel', id, {});
  return prisma.returnRequest.findUniqueOrThrow({ where: { id } });
}

// ── RECEIVE (the single stock path) ──────────────────────

export interface ReceiveLineInput {
  returnItemId: string;
  condition: string; // GOOD | DAMAGED | DEFECTIVE
  disposition: string; // RESTOCK | DAMAGED | INSPECT
}

/**
 * THE single path for any return restock. APPROVED → RECEIVED (+REFUND_PENDING
 * when money is due): per-line disposition moves, quote finalized, returnStatus
 * recomputed, Refund outbox recorded — all in ONE transaction.
 */
export async function receiveReturn(
  id: string,
  actorId: string | undefined,
  lines: ReceiveLineInput[],
  opts?: { refundMethod?: string; exchangeSaleId?: string }
) {
  const policy = await getReturnsPolicy();
  const vatRate = await getVatRate();
  const full = await prisma.returnRequest.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, order: { include: { items: true } }, sale: { include: { items: true } } },
  });
  if (!full) throw new ReturnError(404, 'طلب المرتجع غير موجود');
  if (full.status !== 'APPROVED') throw new ReturnError(409, 'الاستلام بعد الاعتماد فقط');
  if (!lines || lines.length !== full.items.length) throw new ReturnError(400, 'افحص كل الأصناف أولاً');

  const src = full.orderId
    ? { kind: 'order' as const, id: full.orderId, discount: num(full.order!.discountAmount), deliveryFee: num(full.order!.deliveryFee), total: num(full.order!.totalAmount), paymentMethod: full.order!.paymentMethod, lines: full.order!.items.map((i) => ({ refId: i.id, productId: i.productId, unitPrice: num(i.unitPrice), quantity: i.quantity })) }
    : { kind: 'sale' as const, id: full.saleId!, discount: num(full.sale!.discountAmount), deliveryFee: 0, total: num(full.sale!.totalAmount), paymentMethod: full.sale!.paymentMethod, lines: full.sale!.items.map((i) => ({ refId: i.id, productId: i.productId, unitPrice: num(i.unitPrice), quantity: i.quantity })) };

  const decided = full.items.map((ri) => {
    const d = lines.find((l) => l.returnItemId === ri.id);
    if (!d) throw new ReturnError(400, `صنف بلا فحص: ${ri.id}`);
    if (!['GOOD', 'DAMAGED', 'DEFECTIVE'].includes(d.condition)) throw new ReturnError(400, 'حالة صنف غير صالحة');
    if (!['RESTOCK', 'DAMAGED', 'INSPECT'].includes(d.disposition)) throw new ReturnError(400, 'مصير صنف غير صالح');
    return { ri, ...d };
  });

  // Quote on actually-received lines.
  const returnedQtyByLine = new Map(decided.map((d) => [d.ri.id, d.ri.quantity]));
  void returnedQtyByLine;
  const quoteLines = decided.map((d) => {
    const srcLine = src.lines.find((l) => l.refId === (src.kind === 'order' ? d.ri.orderItemId : d.ri.saleItemId) || l.productId === d.ri.productId)!;
    return { productId: d.ri.productId, unitPrice: srcLine.unitPrice, quantity: srcLine.quantity, returnedQty: d.ri.quantity };
  });
  // Full-return test: every sold qty covered by (prior completed + this)?
  const prior = await alreadyReturned({ kind: src.kind, doc: { id: src.id } });
  const fullReturn = src.lines.every((l) => {
    const key = l.refId;
    const now = decided.filter((d) => (src.kind === 'order' ? d.ri.orderItemId : d.ri.saleItemId) === key).reduce((s, d) => s + d.ri.quantity, 0);
    return (prior.get(key) || 0) + now >= l.quantity;
  });
  const ourFault = decided.some((d) => OUR_FAULT.includes(d.ri.reasonCode as never));
  const changedMind = decided.some((d) => d.ri.reasonCode === 'CHANGED_MIND');
  // Already-refunded cap across prior DONE refunds of this doc.
  const priorRefunds = await prisma.refund.findMany({
    where: { status: 'DONE', return: src.kind === 'order' ? { orderId: src.id } : { saleId: src.id } },
    select: { amount: true },
  });
  const alreadyRefunded = priorRefunds.reduce((s, r) => s + num(r.amount), 0);
  const quote = quoteReturn({
    lines: quoteLines,
    orderDiscount: src.discount,
    vatRate,
    deliveryFee: src.deliveryFee,
    deliveryPaid: src.kind === 'order' && src.deliveryFee > 0,
    deliveryPolicy: policy.refundDeliveryFee,
    fullReturn,
    ourFault,
    restockingFeePct: policy.restockingFeePct,
    changedMind,
    alreadyRefunded,
    paidTotal: src.total,
  });

  const refundMethod = opts?.refundMethod || 'ORIGINAL_GATEWAY';
  if (!policy.allowedRefundMethods.includes(refundMethod)) throw new ReturnError(400, 'طريقة الاسترداد غير مسموحة');

  const result = await prisma.$transaction(async (tx: Tx) => {
    const claimed = await tx.returnRequest.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'RECEIVED', receivedById: actorId } });
    if (claimed.count !== 1) throw new ReturnError(409, 'تغيّرت الحالة concurrently');
    // Per-line disposition moves through the ONLY inventory path.
    for (let i = 0; i < decided.length; i++) {
      const d = decided[i];
      const q = quote.lines[i];
      await tx.returnItem.update({
        where: { id: d.ri.id },
        data: { condition: d.condition, disposition: d.disposition, refundAmount: q.refund },
      });
      if (d.disposition === 'RESTOCK') {
        await incrementStock(tx, {
          branchId: full.branchId,
          productId: d.ri.productId,
          quantity: d.ri.quantity,
          type: 'RETURN',
          referenceId: full.returnNumber,
          notes: `RMA ${d.condition}`,
          createdById: actorId,
        });
      } else {
        // DAMAGED/INSPECT: visible log with zero sellable change (chain stays consistent).
        const inv = await tx.branchInventory.findUnique({ where: { branchId_productId: { branchId: full.branchId, productId: d.ri.productId } } });
        const prev = inv?.stockQuantity || 0;
        await tx.inventoryLog.create({
          data: {
            branchId: full.branchId,
            productId: d.ri.productId,
            type: 'RETURN',
            changeQuantity: 0,
            previousQuantity: prev,
            newQuantity: prev,
            referenceId: full.returnNumber,
            notes: `RMA ${d.disposition} (${d.condition}) — غير قابل للبيع`,
            createdById: actorId,
          },
        });
      }
    }
    // Derived returnStatus + terminal order state only on FULL.
    const newStatus = fullReturn ? 'FULL' : 'PARTIAL';
    if (src.kind === 'order') {
      await tx.order.update({ where: { id: src.id }, data: { returnStatus: newStatus } });
      if (fullReturn) {
        await tx.order.updateMany({ where: { id: src.id, orderStatus: { in: ['DELIVERED', 'SHIPPED'] } }, data: { orderStatus: 'RETURNED' } });
      }
    } else {
      await tx.sale.update({ where: { id: src.id }, data: { returnStatus: newStatus } });
    }
    // Outbox: payout recorded here, executed after commit.
    let refund = null;
    if (quote.total > 0) {
      refund = await tx.refund.create({
        data: {
          returnId: id,
          amount: quote.total,
          method: refundMethod,
          status: 'PENDING',
          idempotencyKey: `rma-${full.returnNumber}`,
        },
      });
    }
    await tx.returnRequest.update({
      where: { id },
      data: { status: quote.total > 0 ? 'REFUND_PENDING' : 'COMPLETED', exchangeSaleId: opts?.exchangeSaleId || null },
    });
    return { refund, quote, fullReturn };
  }, { maxWait: 15000, timeout: 30000 });

  await audit(actorId, 'return.receive', id, { fullReturn: result.fullReturn, total: result.quote.total });
  await notifyCustomer(full.customerPhone, `تم استلام مرتجعك ${full.returnNumber} — جارٍ إصدار الاسترداد (${result.quote.total} ج.م).`, [full.returnNumber]);
  return result;
}

// ── PAYOUT execution (after commit, retried) ─────────────

const MANUAL_PAYOUT: string[] = ['INSTAPAY', 'VODAFONE', 'BANK_TRANSFER'];

export async function executeRefund(refundId: string, f: FetchFn = fetch) {
  const claimed = await prisma.refund.updateMany({
    where: { id: refundId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new ReturnError(409, 'الاسترداد قيد المعالجة بالفعل');
  const rf = await prisma.refund.findUniqueOrThrow({
    where: { id: refundId },
    include: { return: { include: { order: true, sale: true, items: true } }, shift: true },
  });
  const ret = rf.return;
  const doc = ret.order || ret.sale;
  if (!doc) throw new ReturnError(404, 'المستند الأصلي غير موجود');
  const amount = num(rf.amount);
  const isOrder = !!ret.order;

  try {
    let gatewayRef: string | null = null;
    if (rf.method === 'CASH') {
      // Cash from drawer: must ride an OPEN shift; expectedCash derives it.
      const shift = rf.shiftId
        ? await prisma.shift.findUnique({ where: { id: rf.shiftId } })
        : await prisma.shift.findFirst({ where: { cashierId: ret.receivedById || ret.approvedById || '', status: 'OPEN' } });
      if (!shift || shift.status !== 'OPEN') {
        await prisma.refund.update({ where: { id: refundId }, data: { status: 'MANUAL_REQUIRED', lastError: 'لا توجد وردية مفتوحة للصرف النقدي' } });
        return { ok: false as const, manual: true as const, error: 'لا توجد وردية مفتوحة للصرف النقدي' };
      }
      if (rf.shiftId !== shift.id) await prisma.refund.update({ where: { id: refundId }, data: { shiftId: shift.id } });
      gatewayRef = `CASH-${shift.id.slice(-6)}`;
    } else if (rf.method === 'ORIGINAL_GATEWAY') {
      const pm = isOrder ? ret.order!.paymentMethod : ret.sale!.paymentMethod;
      if (pm === 'PAYMOB') {
        const cfg = await getPaymobConfig();
        if (!cfg.ready) throw new Error('Paymob غير مفعل');
        const txnId = ((isOrder ? ret.order!.paymentRef : null) || '').replace(/^PAYMOB-/, '').trim();
        if (!txnId) throw new Error('لا مرجع بوابة صالح');
        const token = await paymobAuthToken(cfg, f);
        const res = await f('https://accept.paymob.com/api/acceptance/void_refund/refund', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_token: token, transaction_id: txnId, amount_cents: String(Math.round(amount * 100)) }),
        });
        if (!res.ok) throw new Error(`Paymob refund failed (HTTP ${res.status})`);
        gatewayRef = `PAYMOB-RFND-${txnId}`;
      } else if (pm === 'FAWRY') {
        const cfg = await getFawryConfig();
        if (!cfg.ready) throw new Error('Fawry غير مفعل');
        const res = await f('https://www.atfawry.com/ECommerceWeb/Fawry/payments/refund', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantCode: cfg.merchantCode, merchantRefNum: isOrder ? ret.order!.orderNumber : ret.sale!.saleNumber, refundAmount: amount.toFixed(2) }),
        });
        if (!res.ok) throw new Error(`Fawry refund failed (HTTP ${res.status})`);
        gatewayRef = `FAWRY-RFND-${ret.returnNumber}`;
      } else {
        // COD/CASH/transfer originals settle by hand.
        await prisma.refund.update({ where: { id: refundId }, data: { status: 'MANUAL_REQUIRED', lastError: `تسوية يدوية مطلوبة (${pm})` } });
        return { ok: false as const, manual: true as const, error: `تسوية يدوية مطلوبة (${pm})` };
      }
    } else if (MANUAL_PAYOUT.includes(rf.method)) {
      await prisma.refund.update({ where: { id: refundId }, data: { status: 'MANUAL_REQUIRED', lastError: `بانتظار التحويل اليدوي (${rf.method})` } });
      return { ok: false as const, manual: true as const, error: 'بانتظار التحويل اليدوي' };
    } else {
      throw new Error(`طريقة غير معروفة: ${rf.method}`);
    }

    await applyRefundSideEffects(refundId, ret.id, isOrder, doc.id, amount, gatewayRef);
    return { ok: true as const, gatewayRef };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'refund failed';
    await prisma.refund.update({ where: { id: refundId }, data: { status: 'FAILED', lastError: msg } });
    return { ok: false as const, error: msg };
  }
}

/** Post-payout side effects (each idempotent-guarded by the DONE transition). */
async function applyRefundSideEffects(
  refundId: string, returnId: string, isOrder: boolean, docId: string, amount: number, gatewayRef: string | null,
  from: string[] = ['PROCESSING']
) {
  const policy = await getReturnsPolicy();
  const ret = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { return: { include: { items: true, order: true, sale: true } } } });
  const r = ret.return;
  await prisma.$transaction(async (tx: Tx) => {
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: { in: from } }, data: { status: 'DONE', gatewayRef } });
    if (claimed.count !== 1) throw new ReturnError(409, 'already finalized');
    // Payment state: REFUNDED only on FULL return.
    const full = await isFullReturn(r);
    if (isOrder) {
      await tx.order.update({ where: { id: docId }, data: { paymentStatus: full ? 'REFUNDED' : (await tx.order.findUniqueOrThrow({ where: { id: docId } })).paymentStatus } });
    }
    await tx.returnRequest.update({ where: { id: returnId }, data: { status: 'COMPLETED' } });

    // Loyalty: revoke earned on refunded net, restore redeemed proportionally.
    const earnRule = await getLoyaltyRule();
    const itemsNet = r.items.reduce((s, i) => s + num(i.refundAmount), 0);
    const revoke = Math.floor(itemsNet / Math.max(1, earnRule.earnPerEgp));
    const customerId = r.customerId;
    if (customerId && revoke > 0) {
      const cust = await tx.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
      if (cust) {
        const next = cust.loyaltyPoints - revoke;
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: policy.allowNegativeOnReturn ? next : Math.max(0, next) },
        });
      }
    }
    // Coupon restore on FULL return when enabled.
    if (full && policy.restoreOnFullReturn && isOrder) {
      const order = await tx.order.findUnique({ where: { id: docId }, select: { couponCode: true } });
      if (order?.couponCode) {
        await tx.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { decrement: 1 } } });
      }
    }
  });

  // ETA credit note (best-effort; PENDING_ETA marker when offline).
  try {
    const vatRate = await getVatRate();
    const items = r.items.map((i) => ({
      name: 'مرتجع',
      code: undefined as string | undefined,
      quantity: i.quantity,
      unitPrice: 0,
      totalPrice: num(i.refundAmount),
      vatAmount: money((num(i.refundAmount) * vatRate) / (1 + vatRate)),
    }));
    const res = await submitEtaCreditNote({
      branchId: r.branchId,
      invoiceNumber: r.returnNumber,
      totalAmount: amount,
      vatAmount: items.reduce((s, i) => s + i.vatAmount, 0),
      items,
    });
    await prisma.returnRequest.update({ where: { id: returnId }, data: { etaStatus: res.ok ? 'SENT' : 'PENDING_ETA' } });
  } catch {
    await prisma.returnRequest.update({ where: { id: returnId }, data: { etaStatus: 'PENDING_ETA' } }).catch(() => null);
  }

  const msg = `تم الاسترداد ${amount} ج.م للمرتجع ${r.returnNumber} (${gatewayRef || ''}).`;
  await notifyCustomer(r.customerPhone, msg, [r.returnNumber]);
  await audit(undefined, 'refund.done', returnId, { amount, gatewayRef });
}

async function isFullReturn(r: { orderId: string | null; saleId: string | null }): Promise<boolean> {
  if (r.orderId) {
    const o = await prisma.order.findUnique({ where: { id: r.orderId }, select: { returnStatus: true } });
    return o?.returnStatus === 'FULL';
  }
  const s = await prisma.sale.findUnique({ where: { id: r.saleId! }, select: { returnStatus: true } });
  return s?.returnStatus === 'FULL';
}

/** Manual settlement (proof image + ref) closes a MANUAL_REQUIRED/FAILED refund. */
export async function recordManualRefund(refundId: string, actorId: string | undefined, gatewayRef: string, proofImage?: string) {
  const rf = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { return: true } });
  if (!['MANUAL_REQUIRED', 'FAILED'].includes(rf.status)) throw new ReturnError(409, 'لا يحتاج تسوية يدوية');
  if (!gatewayRef.trim()) throw new ReturnError(400, 'المرجع مطلوب');
  const ret = rf.return;
  const isOrder = !!ret.orderId;
  const docId = (ret.orderId || ret.saleId)!;
  await applyRefundSideEffects(refundId, ret.id, isOrder, docId, num(rf.amount), `MANUAL:${gatewayRef.trim()}`, ['MANUAL_REQUIRED', 'FAILED', 'PROCESSING']);
  await prisma.refund.update({ where: { id: refundId }, data: { proofImage: proofImage?.slice(0, 500) || null } });
  await audit(actorId, 'refund.manual', ret.id, { gatewayRef });
  return prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
}

// ── EXCHANGE ─────────────────────────────────────────────

/**
 * Exchange = this return + a linked new sale. Price difference settled by
 * method (customer pays extra via POS, or a Refund covers the change).
 */
export async function linkExchangeSale(returnId: string, saleId: string, actorId: string | undefined) {
  const updated = await prisma.returnRequest.updateMany({
    where: { id: returnId, type: 'EXCHANGE', status: { in: ['RECEIVED', 'REFUND_PENDING', 'COMPLETED'] } },
    data: { exchangeSaleId: saleId },
  });
  if (updated.count !== 1) throw new ReturnError(409, 'الربط للاستبدال المعتمد فقط');
  await audit(actorId, 'return.exchange-link', returnId, { saleId });
}

// ── LEGACY backfill + old-outbox conversion ──────────────

/** Convert pre-RMA RETURNED orders (and T10 refund rows) without moving stock. */
export async function backfillLegacy() {
  const db = prisma;
  const old = await db.order.findMany({
    where: { orderStatus: 'RETURNED' },
    include: { items: true },
  });
  let created = 0;
  for (const o of old) {
    const exists = await db.returnRequest.findFirst({ where: { orderId: o.id } });
    if (exists) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.returnRequest.create({
          data: {
            returnNumber: genReturnNumber(),
            orderId: o.id,
            type: 'RETURN',
            channel: 'ADMIN',
            branchId: o.branchId,
            status: 'COMPLETED',
            customerId: o.customerId,
            customerPhone: o.guestPhone,
            source: 'LEGACY',
            notes: 'تحويل تلقائي من حالة RETURNED القديمة (بلا حركة مخزون)',
            items: {
              create: o.items.map((i) => ({
                orderItemId: i.id,
                productId: i.productId,
                quantity: i.quantity,
                reasonCode: 'OTHER',
                condition: 'GOOD',
                disposition: 'RESTOCK',
                refundAmount: 0,
              })),
            },
          },
        });
        created++;
        break;
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
    await db.order.update({ where: { id: o.id }, data: { returnStatus: 'FULL' } }).catch(() => null);
  }
  // T10 conversion already ran on prod before the old table dropped (see DECISIONS).
  return { created, converted: 0 };
}

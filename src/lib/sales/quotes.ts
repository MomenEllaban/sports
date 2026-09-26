import type { Prisma, QuotationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { nextDocumentNumber } from '@/lib/documents';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';
import { computeTotals, money, num } from '@/lib/pricing';
import type { Tx } from '@/lib/inventory/service';
import { createInvoiceInTx } from '@/lib/sales/invoices';

/**
 * Quotations: the priced offer side of a B2B sale. A quotation never touches
 * stock and never creates a receivable on its own — it becomes money only when
 * an accepted quotation is CONVERTED into a customer invoice.
 *
 * The state machine is intentionally boring and total: every action declares
 * the statuses it may be applied from, so a stale browser tab cannot skip a
 * step or move a document backwards.
 */

export class QuoteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** action -> statuses the action may be applied from. */
const QUOTE_TRANSITIONS: Record<string, QuotationStatus[]> = {
  send: ['DRAFT'],
  accept: ['SENT'],
  reject: ['SENT'],
  expire: ['SENT'],
  convert: ['ACCEPTED'],
};

/** Actions a UI may offer for a quotation in the given state. */
export function allowedQuoteActions(status: QuotationStatus): string[] {
  return Object.entries(QUOTE_TRANSITIONS)
    .filter(([, from]) => from.includes(status))
    .map(([action]) => action);
}

/**
 * A quotation past its validity date is expired whether or not anyone has run
 * the expire action yet. Deriving the state on read keeps the document honest
 * without a scheduler, and `assertQuoteTransition` uses the same function so a
 * stale tab cannot accept an expired offer.
 */
export function effectiveQuoteStatus(
  status: QuotationStatus,
  validUntil: Date,
  now: Date = new Date(),
): QuotationStatus {
  if (status === 'SENT' && validUntil.getTime() < now.getTime()) return 'EXPIRED';
  return status;
}

export function assertQuoteTransition(status: QuotationStatus, action: string): void {
  const from = QUOTE_TRANSITIONS[action];
  if (!from) {
    throw new QuoteError('VALIDATION_ERROR', `Unsupported quotation action "${action}"`, 400);
  }
  if (!from.includes(status)) {
    throw new QuoteError('QUOTE_NOT_PROCESSABLE', `A quotation in status ${status} cannot be ${action}ed`, 409, {
      status,
      allowedActions: allowedQuoteActions(status),
    });
  }
}

export interface QuoteLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteInput {
  customerId: string;
  customerName?: string;
  branchId: string;
  discount?: number;
  validUntil: Date;
  notes?: string;
  items: QuoteLineInput[];
}

export interface NormalizedLine {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Validates and prices the lines. Pure, so the arithmetic is unit-testable
 * without a database: a line is `quantity * unitPrice`, the document total is
 * the shared pricing pipeline (subtotal, clamped discount, VAT).
 */
export function normalizeQuoteLines(items: QuoteLineInput[]): NormalizedLine[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new QuoteError('VALIDATION_ERROR', 'Add at least one line to the quotation');
  }
  if (items.length > 100) {
    throw new QuoteError('VALIDATION_ERROR', 'A quotation cannot exceed 100 lines', 400);
  }
  return items.map((raw, i) => {
    const description = String(raw.description ?? '').trim();
    const quantity = Number(raw.quantity);
    const unitPrice = Number(raw.unitPrice);
    if (!description) {
      throw new QuoteError('VALIDATION_ERROR', `Line ${i + 1} needs a description`);
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new QuoteError('VALIDATION_ERROR', `Line ${i + 1} quantity must be a positive whole number`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new QuoteError('VALIDATION_ERROR', `Line ${i + 1} price cannot be negative`);
    }
    return {
      productId: raw.productId ? String(raw.productId) : null,
      description: description.slice(0, 300),
      quantity,
      unitPrice: money(unitPrice),
      lineTotal: money(unitPrice * quantity),
    };
  });
}

function quoteTotals(lines: NormalizedLine[], discount?: number) {
  return computeTotals({
    lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    discount: num(discount),
  });
}

function actorId(session: AppSession | null): string {
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new QuoteError('UNAUTHORIZED', 'A signed-in user is required', 401);
  return id;
}

export async function createQuotation(
  session: AppSession | null,
  input: QuoteInput,
): Promise<Prisma.QuotationGetPayload<{ include: { items: true } }>> {
  const branchId = String(input.branchId ?? '');
  if (!branchId || !canAccessBranch(session, branchId)) {
    throw new QuoteError('FORBIDDEN', 'This branch is outside your assignment', 403);
  }
  const customerId = String(input.customerId ?? '');
  if (!customerId) throw new QuoteError('VALIDATION_ERROR', 'A customer is required');

  const lines = normalizeQuoteLines(input.items);
  const totals = quoteTotals(lines, input.discount);

  const validUntil = input.validUntil instanceof Date ? input.validUntil : new Date(input.validUntil);
  if (Number.isNaN(validUntil.getTime())) {
    throw new QuoteError('VALIDATION_ERROR', 'A valid-until date is required');
  }
  if (validUntil.getTime() <= Date.now()) {
    throw new QuoteError('VALIDATION_ERROR', 'The validity date must be in the future');
  }

  const userId = actorId(session);
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true },
  });
  if (!customer) throw new QuoteError('VALIDATION_ERROR', 'Unknown customer', 400, { customerId });

  const productIds = [...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id))];
  if (productIds.length) {
    const found = await prisma.product.count({ where: { id: { in: productIds } } });
    if (found !== productIds.length) {
      throw new QuoteError('VALIDATION_ERROR', 'One or more products no longer exist', 400, {
        productIds: productIds.filter((id) => !id),
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const quotationNumber = await nextDocumentNumber(tx, 'QT');
    const created = await tx.quotation.create({
      data: {
        quotationNumber,
        customerId,
        customerName: input.customerName?.trim() || customer.name || customer.phone,
        branchId,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        discount: totals.discount,
        vat: totals.vat,
        total: totals.total,
        validUntil,
        notes: input.notes ? String(input.notes).slice(0, 1000) : null,
        createdById: userId,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: { items: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'quotation.created',
        entity: 'Quotation',
        entityId: created.id,
        branchId,
        metadata: JSON.stringify({
          quotationNumber,
          customerId,
          lineCount: lines.length,
          total: totals.total,
        }),
      },
    });
    return created;
  });
}

/** A draft may be re-priced; anything already sent to a customer is frozen. */
export async function updateQuotation(
  session: AppSession | null,
  id: string,
  input: Partial<QuoteInput>,
): Promise<Prisma.QuotationGetPayload<{ include: { items: true } }>> {
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) throw new QuoteError('NOT_FOUND', 'Quotation not found', 404);
  if (!canAccessBranch(session, existing.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This quotation is outside your assignment', 403);
  }
  if (existing.status !== 'DRAFT') {
    throw new QuoteError('CONFLICT', 'Only a draft quotation can be edited', 409, { status: existing.status });
  }

  const lines = input.items ? normalizeQuoteLines(input.items) : null;
  const discount = input.discount !== undefined ? num(input.discount) : num(existing.discount);
  const totals = lines
    ? quoteTotals(lines, discount)
    : { subtotal: num(existing.subtotal), discount, vat: num(existing.vat), total: num(existing.total), net: 0, deliveryFee: 0 };

  let validUntil = existing.validUntil;
  if (input.validUntil) {
    const next = input.validUntil instanceof Date ? input.validUntil : new Date(input.validUntil);
    if (Number.isNaN(next.getTime())) throw new QuoteError('VALIDATION_ERROR', 'Invalid validity date');
    if (next.getTime() <= Date.now()) {
      throw new QuoteError('VALIDATION_ERROR', 'The validity date must be in the future');
    }
    validUntil = next;
  }

  const userId = actorId(session);
  return prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotationItem.createMany({
        data: lines.map((l) => ({
          quotationId: id,
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      });
    }
    const updated = await tx.quotation.update({
      where: { id },
      data: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        vat: totals.vat,
        total: totals.total,
        validUntil,
        notes: input.notes !== undefined ? (input.notes ? String(input.notes).slice(0, 1000) : null) : undefined,
      },
      include: { items: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'quotation.updated',
        entity: 'Quotation',
        entityId: id,
        branchId: existing.branchId,
        metadata: JSON.stringify({
          quotationNumber: existing.quotationNumber,
          total: { from: num(existing.total), to: totals.total },
          relined: !!lines,
        }),
      },
    });
    return updated;
  });
}

export async function deleteQuotation(session: AppSession | null, id: string): Promise<void> {
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) throw new QuoteError('NOT_FOUND', 'Quotation not found', 404);
  if (!canAccessBranch(session, existing.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This quotation is outside your assignment', 403);
  }
  if (existing.status !== 'DRAFT') {
    throw new QuoteError('CONFLICT', 'Only a draft quotation can be deleted', 409, { status: existing.status });
  }
  const userId = actorId(session);
  await prisma.$transaction(async (tx) => {
    await tx.quotation.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'quotation.deleted',
        entity: 'Quotation',
        entityId: id,
        branchId: existing.branchId,
        metadata: JSON.stringify({ quotationNumber: existing.quotationNumber, total: num(existing.total) }),
      },
    });
  });
}

/**
 * Applies one lifecycle action. The status claim is a compare-and-swap on the
 * statuses the action accepts, so two approvers pressing the same button cannot
 * both move the document.
 */
export async function applyQuoteAction(
  session: AppSession | null,
  id: string,
  action: string,
  payload: { reason?: string } = {},
): Promise<{ status: QuotationStatus; invoiceId?: string }> {
  const quote = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!quote) throw new QuoteError('NOT_FOUND', 'Quotation not found', 404);
  if (!canAccessBranch(session, quote.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This quotation is outside your assignment', 403);
  }
  if (action === 'reject' && !payload.reason?.trim()) {
    throw new QuoteError('VALIDATION_ERROR', 'A reason is required to reject a quotation');
  }
  if (action === 'convert') {
    assertQuoteTransition(effectiveQuoteStatus(quote.status, quote.validUntil), action);
  } else {
    assertQuoteTransition(quote.status, action);
  }

  const userId = actorId(session);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const claim = await tx.quotation.updateMany({
      where: { id, status: { in: QUOTE_TRANSITIONS[action] } },
      data: {
        status: nextQuoteStatus(action),
        sentAt: action === 'send' ? now : undefined,
        decidedAt: action === 'accept' || action === 'reject' ? now : undefined,
        cancelReason:
          action === 'reject' || action === 'expire'
            ? (payload.reason?.trim().slice(0, 500) ?? null)
            : undefined,
      },
    });
    if (claim.count !== 1) {
      throw new QuoteError('QUOTE_NOT_PROCESSABLE', 'Quotation already processed', 409);
    }

    let invoiceId: string | undefined;
    if (action === 'convert') {
      invoiceId = await createInvoiceFromQuotation(tx, {
        quotationId: quote.id,
        customerId: quote.customerId,
        branchId: quote.branchId,
        discount: num(quote.discount),
        items: quote.items.map((i) => ({
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: num(i.unitPrice),
        })),
        createdById: userId,
      });
      await tx.quotation.update({ where: { id }, data: { convertedInvoiceId: invoiceId } });
    }

    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: `quotation.${action}`,
        entity: 'Quotation',
        entityId: id,
        branchId: quote.branchId,
        metadata: JSON.stringify({
          quotationNumber: quote.quotationNumber,
          from: quote.status,
          to: nextQuoteStatus(action),
          total: num(quote.total),
          ...(payload.reason ? { reason: payload.reason } : {}),
          ...(invoiceId ? { invoiceId } : {}),
        }),
      },
    });

    return { status: nextQuoteStatus(action), invoiceId };
  });
}

function nextQuoteStatus(action: string): QuotationStatus {
  switch (action) {
    case 'send':
      return 'SENT';
    case 'accept':
      return 'ACCEPTED';
    case 'reject':
      return 'REJECTED';
    case 'expire':
      return 'EXPIRED';
    case 'convert':
      return 'CONVERTED';
    default:
      throw new QuoteError('VALIDATION_ERROR', `Unsupported quotation action "${action}"`, 400);
  }
}

/**
 * An accepted quotation becomes a DRAFT invoice: the price the customer agreed
 * to, still reviewable and still unsigned by the business. Nothing is
 * receivable until someone issues it.
 */
async function createInvoiceFromQuotation(
  tx: Tx,
  input: {
    quotationId: string;
    customerId: string;
    branchId: string;
    discount: number;
    items: QuoteLineInput[];
    createdById: string;
  },
): Promise<string> {
  return createInvoiceInTx(tx, {
    customerId: input.customerId,
    branchId: input.branchId,
    discount: input.discount,
    items: input.items,
    createdById: input.createdById,
    notes: 'Converted from quotation',
  });
}

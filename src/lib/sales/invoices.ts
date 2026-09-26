import type { CustomerInvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { nextDocumentNumber } from '@/lib/documents';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';
import { computeTotals, money, num } from '@/lib/pricing';
import type { Tx } from '@/lib/inventory/service';
import { normalizeQuoteLines, QuoteError, type QuoteLineInput } from '@/lib/sales/quotes';

/**
 * Customer invoices: the receivable side of a B2B sale.
 *
 * Two rules hold the money together:
 *  1. An invoice only becomes a receivable when it is ISSUED. A draft is a
 *     document, not a debt.
 *  2. The settled amount is `paidAmount`, and it is only ever changed by the
 *     allocation service in `src/lib/finance/customer-payments.ts`. Editing an
 *     invoice total is impossible precisely so a debt cannot be quietly
 *     rewritten to match what was paid.
 */

export { QuoteError as InvoiceError };

const INVOICE_TRANSITIONS: Record<string, CustomerInvoiceStatus[]> = {
  issue: ['DRAFT'],
  void: ['ISSUED', 'PARTIALLY_PAID'],
};

export function allowedInvoiceActions(status: CustomerInvoiceStatus, hasPayments: boolean): string[] {
  if (status === 'DRAFT') return ['issue'];
  if (status === 'ISSUED' || status === 'PARTIALLY_PAID') return hasPayments ? [] : ['void'];
  return [];
}

export function assertInvoiceTransition(
  status: CustomerInvoiceStatus,
  action: string,
  hasPayments: boolean,
): void {
  const from = INVOICE_TRANSITIONS[action];
  if (!from) {
    throw new QuoteError('VALIDATION_ERROR', `Unsupported invoice action "${action}"`, 400);
  }
  if (!from.includes(status)) {
    throw new QuoteError(
      'INVOICE_NOT_PROCESSABLE',
      `An invoice in status ${status} cannot be ${action}d`,
      409,
      { status, allowedActions: allowedInvoiceActions(status, hasPayments) },
    );
  }
  if (action === 'void' && hasPayments) {
    throw new QuoteError(
      'CONFLICT',
      'Reverse the recorded payments before voiding this invoice',
      409,
      { reason: 'has_payments' },
    );
  }
}

export interface InvoiceLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceInput {
  customerId: string;
  branchId: string;
  discount?: number;
  dueDate?: Date;
  notes?: string;
  items: InvoiceLineInput[];
}

export type InvoiceWithLines = Prisma.CustomerInvoiceGetPayload<{ include: { lines: true } }>;

function invoiceTotals(lines: ReturnType<typeof normalizeQuoteLines>, discount?: number) {
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

const DEFAULT_DUE_DAYS = 14;

/**
 * Creates the invoice and its lines inside the caller's transaction, allocating
 * the document number from the same counter as every other number in the
 * system. Exported so the quotation conversion can build an invoice in its own
 * transaction without a second commit.
 */
export async function createInvoiceInTx(
  tx: Tx,
  input: InvoiceInput & { createdById: string },
): Promise<string> {
  const lines = normalizeQuoteLines(input.items as QuoteLineInput[]);
  const totals = invoiceTotals(lines, input.discount);
  if (totals.total <= 0) {
    throw new QuoteError('VALIDATION_ERROR', 'An invoice must have a positive total');
  }

  const invoiceNumber = await nextDocumentNumber(tx, 'INV');
  const invoice = await tx.customerInvoice.create({
    data: {
      invoiceNumber,
      customerId: input.customerId,
      branchId: input.branchId,
      status: 'DRAFT',
      subtotal: totals.subtotal,
      discount: totals.discount,
      vat: totals.vat,
      total: totals.total,
      dueDate: input.dueDate ?? new Date(Date.now() + DEFAULT_DUE_DAYS * 864e5),
      notes: input.notes ? String(input.notes).slice(0, 1000) : null,
      createdById: input.createdById,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      },
    },
    select: { id: true },
  });
  return invoice.id;
}

export async function createInvoice(
  session: AppSession | null,
  input: InvoiceInput,
): Promise<InvoiceWithLines> {
  const branchId = String(input.branchId ?? '');
  if (!branchId || !canAccessBranch(session, branchId)) {
    throw new QuoteError('FORBIDDEN', 'This branch is outside your assignment', 403);
  }
  const customerId = String(input.customerId ?? '');
  if (!customerId) throw new QuoteError('VALIDATION_ERROR', 'A customer is required');

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) throw new QuoteError('VALIDATION_ERROR', 'Unknown customer', 400, { customerId });

  const lines = normalizeQuoteLines(input.items as QuoteLineInput[]);
  const totals = invoiceTotals(lines, input.discount);
  if (totals.total <= 0) {
    throw new QuoteError('VALIDATION_ERROR', 'An invoice must have a positive total');
  }

  const userId = actorId(session);
  const dueDate = input.dueDate
    ? input.dueDate instanceof Date
      ? input.dueDate
      : new Date(input.dueDate)
    : new Date(Date.now() + DEFAULT_DUE_DAYS * 864e5);
  if (Number.isNaN(dueDate.getTime())) {
    throw new QuoteError('VALIDATION_ERROR', 'Invalid due date');
  }

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, 'INV');
    const created = await tx.customerInvoice.create({
      data: {
        invoiceNumber,
        customerId,
        branchId,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        discount: totals.discount,
        vat: totals.vat,
        total: totals.total,
        dueDate,
        notes: input.notes ? String(input.notes).slice(0, 1000) : null,
        createdById: userId,
        lines: {
          create: lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'invoice.created',
        entity: 'CustomerInvoice',
        entityId: created.id,
        branchId,
        metadata: JSON.stringify({ invoiceNumber, customerId, lineCount: lines.length, total: totals.total }),
      },
    });
    return created;
  });
}

/** Only a draft can be re-priced, and re-pricing a draft that already carries
 * a quotation link would silently change the agreed quote. */
export async function updateInvoice(
  session: AppSession | null,
  id: string,
  input: Partial<InvoiceInput>,
): Promise<InvoiceWithLines> {
  const existing = await prisma.customerInvoice.findUnique({ where: { id } });
  if (!existing) throw new QuoteError('NOT_FOUND', 'Invoice not found', 404);
  if (!canAccessBranch(session, existing.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This invoice is outside your assignment', 403);
  }
  if (existing.status !== 'DRAFT') {
    throw new QuoteError('CONFLICT', 'Only a draft invoice can be edited', 409, { status: existing.status });
  }

  const lines = input.items ? normalizeQuoteLines(input.items as QuoteLineInput[]) : null;
  const discount = input.discount !== undefined ? num(input.discount) : num(existing.discount);
  const totals = lines
    ? invoiceTotals(lines, discount)
    : {
        subtotal: num(existing.subtotal),
        discount,
        vat: num(existing.vat),
        total: num(existing.total),
        net: 0,
        deliveryFee: 0,
      };
  if (totals.total <= 0) {
    throw new QuoteError('VALIDATION_ERROR', 'An invoice must have a positive total');
  }

  const userId = actorId(session);
  return prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.customerInvoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.customerInvoiceLine.createMany({
        data: lines.map((l) => ({
          invoiceId: id,
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      });
    }
    const updated = await tx.customerInvoice.update({
      where: { id },
      data: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        vat: totals.vat,
        total: totals.total,
        dueDate: input.dueDate
          ? input.dueDate instanceof Date
            ? input.dueDate
            : new Date(input.dueDate)
          : undefined,
        notes: input.notes !== undefined ? (input.notes ? String(input.notes).slice(0, 1000) : null) : undefined,
      },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'invoice.updated',
        entity: 'CustomerInvoice',
        entityId: id,
        branchId: existing.branchId,
        metadata: JSON.stringify({
          invoiceNumber: existing.invoiceNumber,
          total: { from: num(existing.total), to: totals.total },
          relined: !!lines,
        }),
      },
    });
    return updated;
  });
}

export async function deleteInvoice(session: AppSession | null, id: string): Promise<void> {
  const existing = await prisma.customerInvoice.findUnique({
    where: { id },
    include: { _count: { select: { allocations: true } } },
  });
  if (!existing) throw new QuoteError('NOT_FOUND', 'Invoice not found', 404);
  if (!canAccessBranch(session, existing.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This invoice is outside your assignment', 403);
  }
  if (existing.status !== 'DRAFT') {
    throw new QuoteError('CONFLICT', 'Only a draft invoice can be deleted; void it instead', 409, {
      status: existing.status,
    });
  }
  if (existing._count.allocations > 0) {
    throw new QuoteError('CONFLICT', 'This invoice already has payments recorded against it', 409);
  }
  const userId = actorId(session);
  await prisma.$transaction(async (tx) => {
    await tx.customerInvoice.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'invoice.deleted',
        entity: 'CustomerInvoice',
        entityId: id,
        branchId: existing.branchId,
        metadata: JSON.stringify({ invoiceNumber: existing.invoiceNumber, total: num(existing.total) }),
      },
    });
  });
}

export async function applyInvoiceAction(
  session: AppSession | null,
  id: string,
  action: string,
  payload: { reason?: string; dueDate?: Date } = {},
): Promise<{ status: CustomerInvoiceStatus }> {
  const invoice = await prisma.customerInvoice.findUnique({
    where: { id },
    include: { _count: { select: { allocations: true } } },
  });
  if (!invoice) throw new QuoteError('NOT_FOUND', 'Invoice not found', 404);
  if (!canAccessBranch(session, invoice.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This invoice is outside your assignment', 403);
  }
  if (action === 'void' && !payload.reason?.trim()) {
    throw new QuoteError('VALIDATION_ERROR', 'A reason is required to void an invoice');
  }
  assertInvoiceTransition(invoice.status, action, invoice._count.allocations > 0);

  const userId = actorId(session);
  const now = new Date();
  const dueDate = payload.dueDate ?? invoice.dueDate ?? new Date(now.getTime() + DEFAULT_DUE_DAYS * 864e5);

  return prisma.$transaction(async (tx) => {
    const to: CustomerInvoiceStatus = action === 'issue' ? 'ISSUED' : 'VOID';
    const claim = await tx.customerInvoice.updateMany({
      where: { id, status: { in: INVOICE_TRANSITIONS[action] } },
      data: {
        status: to,
        issuedAt: action === 'issue' ? now : undefined,
        dueDate: action === 'issue' ? dueDate : undefined,
        voidReason: action === 'void' ? payload.reason?.trim().slice(0, 500) : undefined,
      },
    });
    if (claim.count !== 1) {
      throw new QuoteError('INVOICE_NOT_PROCESSABLE', 'Invoice already processed', 409);
    }
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: `invoice.${action}`,
        entity: 'CustomerInvoice',
        entityId: id,
        branchId: invoice.branchId,
        metadata: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          from: invoice.status,
          to,
          total: num(invoice.total),
          dueDate: action === 'issue' ? dueDate.toISOString() : undefined,
          ...(payload.reason ? { reason: payload.reason } : {}),
        }),
      },
    });
    return { status: to };
  });
}

/** Money still owed on one invoice. Pure so the ledger, the list and the tests
 * all agree on the definition of "outstanding". */
export function outstandingOf(invoice: { total: unknown; paidAmount: unknown }): number {
  return money(Math.max(0, num(invoice.total) - num(invoice.paidAmount)));
}

export function settlementStatus(invoice: {
  status: CustomerInvoiceStatus;
  total: unknown;
  paidAmount: unknown;
}): CustomerInvoiceStatus {
  if (invoice.status === 'DRAFT' || invoice.status === 'VOID') return invoice.status;
  return outstandingOf(invoice) <= 0 ? 'PAID' : 'PARTIALLY_PAID';
}

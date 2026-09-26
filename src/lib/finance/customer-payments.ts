import type { CustomerInvoiceStatus, Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { nextDocumentNumber } from '@/lib/documents';
import { canAccessBranch, scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';
import { money, num } from '@/lib/pricing';
import { settlementStatus, outstandingOf } from '@/lib/sales/invoices';
import { QuoteError } from '@/lib/sales/quotes';
import type { Tx } from '@/lib/inventory/service';
import { resolveBranchScope } from '@/lib/hr/attendance';

/**
 * Customer payments and their allocation to invoices.
 *
 * A payment is a fact about money received ("the customer paid 5,000"). Which
 * invoices that money settles is a bookkeeping decision. The two are therefore
 * separate: a payment may arrive with no allocations at all (a credit on
 * account), and the same payment can be allocated to several invoices.
 *
 * Every rule below is enforced inside one transaction, and the invoice row is
 * re-claimed with a conditional update, so two clerks allocating money at the
 * same moment cannot both push an invoice past fully paid.
 */

export interface AllocationInput {
  invoiceId: string;
  amount: number;
}

export interface RecordPaymentInput {
  customerId: string;
  branchId: string;
  amount: number;
  method?: string;
  reference?: string;
  paidAt?: Date;
  notes?: string;
  allocations?: AllocationInput[];
}

function actorId(session: AppSession | null): string {
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new QuoteError('UNAUTHORIZED', 'A signed-in user is required', 401);
  return id;
}

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;

/**
 * Rejects duplicate invoice lines and lines that do not sum to at most the
 * payment total. Pure so the "how much of this payment is unallocated" question
 * is answered identically in the API, the UI hint and the tests.
 */
export function normalizeAllocations(
  allocations: AllocationInput[] | undefined,
  paymentAmount: number,
): { invoiceId: string; amount: number }[] {
  if (!allocations || allocations.length === 0) return [];
  const seen = new Set<string>();
  let sum = 0;
  const out = allocations.map((raw, i) => {
    const invoiceId = String(raw?.invoiceId ?? '');
    const amount = money(Number(raw?.amount));
    if (!invoiceId) {
      throw new QuoteError('VALIDATION_ERROR', `Allocation ${i + 1} needs an invoice`);
    }
    if (seen.has(invoiceId)) {
      throw new QuoteError('VALIDATION_ERROR', 'An invoice cannot be allocated twice on one payment', 400, {
        invoiceId,
      });
    }
    seen.add(invoiceId);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new QuoteError('VALIDATION_ERROR', `Allocation ${i + 1} amount must be positive`, 400, {
        invoiceId,
      });
    }
    sum = money(sum + amount);
    return { invoiceId, amount };
  });
  if (sum > money(paymentAmount)) {
    throw new QuoteError(
      'VALIDATION_ERROR',
      'Allocations cannot exceed the payment amount',
      400,
      { paymentAmount: money(paymentAmount), allocated: sum },
    );
  }
  return out;
}

/** Credit left on the account when a payment is not fully allocated. */
export function unallocatedCredit(amount: number, allocatedAmount: number): number {
  return money(Math.max(0, num(amount) - num(allocatedAmount)));
}

export async function recordCustomerPayment(
  session: AppSession | null,
  input: RecordPaymentInput,
): Promise<Prisma.CustomerPaymentGetPayload<{ include: { allocations: true } }>> {
  const branchId = String(input.branchId ?? '');
  if (!branchId || !canAccessBranch(session, branchId)) {
    throw new QuoteError('FORBIDDEN', 'This branch is outside your assignment', 403);
  }
  const customerId = String(input.customerId ?? '');
  if (!customerId) throw new QuoteError('VALIDATION_ERROR', 'A customer is required');

  const amount = money(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new QuoteError('VALIDATION_ERROR', 'The payment amount must be positive');
  }
  if (amount > 99_999_999) {
    throw new QuoteError('VALIDATION_ERROR', 'The payment amount is implausibly large');
  }

  const method = (input.method ?? 'CASH').toUpperCase();
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    throw new QuoteError('VALIDATION_ERROR', 'Unknown payment method', 400, {
      allowed: PAYMENT_METHODS,
    });
  }
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw new QuoteError('VALIDATION_ERROR', 'Invalid payment date');
  }

  const allocations = normalizeAllocations(input.allocations, amount);
  const userId = actorId(session);

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new QuoteError('VALIDATION_ERROR', 'Unknown customer', 400, { customerId });

  return prisma.$transaction(async (tx) => {
    const receiptNumber = await nextDocumentNumber(tx, 'RCP');

    // Load every target invoice once, then check them all before writing
    // anything, so a bad allocation never leaves a half-recorded payment.
    if (allocations.length) {
      const invoices = await tx.customerInvoice.findMany({
        where: { id: { in: allocations.map((a) => a.invoiceId) } },
        include: { _count: { select: { allocations: true } } },
      });
      const byId = new Map(invoices.map((i) => [i.id, i]));
      for (const allocation of allocations) {
        const invoice = byId.get(allocation.invoiceId);
        if (!invoice) {
          throw new QuoteError('VALIDATION_ERROR', 'Unknown invoice', 400, { invoiceId: allocation.invoiceId });
        }
        if (invoice.customerId !== customerId) {
          throw new QuoteError(
            'VALIDATION_ERROR',
            'An invoice can only be settled by the customer it belongs to',
            400,
            { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
          );
        }
        if (invoice.status !== 'ISSUED' && invoice.status !== 'PARTIALLY_PAID') {
          throw new QuoteError(
            'CONFLICT',
            `Invoice ${invoice.invoiceNumber} is ${invoice.status.toLowerCase().replace('_', ' ')} and cannot be paid`,
            409,
            { invoiceId: invoice.id, status: invoice.status },
          );
        }
        const outstanding = outstandingOf(invoice);
        if (allocation.amount > outstanding) {
          throw new QuoteError(
            'VALIDATION_ERROR',
            `Allocating ${allocation.amount} exceeds the ${outstanding} outstanding on ${invoice.invoiceNumber}`,
            400,
            { invoiceId: invoice.id, outstanding, attempted: allocation.amount },
          );
        }
      }
    }

    const allocatedAmount = money(allocations.reduce((sum, a) => sum + a.amount, 0));
    const payment = await tx.customerPayment.create({
      data: {
        receiptNumber,
        customerId,
        branchId,
        amount,
        allocatedAmount,
        method,
        reference: input.reference ? String(input.reference).slice(0, 120) : null,
        paidAt,
        notes: input.notes ? String(input.notes).slice(0, 1000) : null,
        createdById: userId,
        allocations: allocations.length
          ? { create: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) }
          : undefined,
      },
      include: { allocations: true },
    });

    for (const allocation of allocations) {
      const current = await settledView(tx, allocation.invoiceId);
      // Optimistic claim: the WHERE clause pins the exact paidAmount we
      // validated against, so a concurrent allocation makes this match nothing
      // instead of double-spending the invoice.
      const claim = await tx.customerInvoice.updateMany({
        where: {
          id: allocation.invoiceId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
          paidAmount: current.paidAmount,
        },
        data: {
          paidAmount: money(num(current.paidAmount) + allocation.amount),
          status: settlementStatus({
            status: 'ISSUED' as const,
            total: current.total,
            paidAmount: money(num(current.paidAmount) + allocation.amount),
          }),
        },
      });
      if (claim.count !== 1) {
        throw new QuoteError(
          'ALLOCATION_CONFLICT',
          'This invoice changed while the payment was being saved; reload and try again',
          409,
          { invoiceId: allocation.invoiceId },
        );
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'customer_payment.recorded',
        entity: 'CustomerPayment',
        entityId: payment.id,
        branchId,
        metadata: JSON.stringify({
          receiptNumber,
          customerId,
          amount,
          allocatedAmount,
          credit: unallocatedCredit(amount, allocatedAmount),
          method,
          allocations,
        }),
      },
    });

    return payment;
  });
}

/** The invoice as the allocation service needs to see it after an increment. */
async function settledView(
  tx: Tx,
  invoiceId: string,
): Promise<{ status: CustomerInvoiceStatus; total: Decimal; paidAmount: Decimal }> {
  const invoice = await tx.customerInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true, total: true, paidAmount: true },
  });
  return invoice;
}

/** Only an untouched payment can be deleted; otherwise it must be reversed. */
export async function deleteCustomerPayment(session: AppSession | null, id: string): Promise<void> {
  const payment = await prisma.customerPayment.findUnique({
    where: { id },
    include: { _count: { select: { allocations: true } } },
  });
  if (!payment) throw new QuoteError('NOT_FOUND', 'Payment not found', 404);
  if (!canAccessBranch(session, payment.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This payment is outside your assignment', 403);
  }
  if (payment._count.allocations > 0) {
    throw new QuoteError(
      'CONFLICT',
      'This payment is allocated to invoices; reverse the allocations instead',
      409,
      { reason: 'has_allocations' },
    );
  }
  const userId = actorId(session);
  await prisma.$transaction(async (tx) => {
    await tx.customerPayment.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'customer_payment.deleted',
        entity: 'CustomerPayment',
        entityId: id,
        branchId: payment.branchId,
        metadata: JSON.stringify({
          receiptNumber: payment.receiptNumber,
          amount: num(payment.amount),
          customerId: payment.customerId,
        }),
      },
    });
  });
}

/**
 * Reverses every allocation of a payment, returning the invoices to whatever
 * they owe after the reversal. The payment row is kept with
 * `allocatedAmount = 0` so the reversal is auditable rather than silent.
 */
export async function reverseCustomerPayment(
  session: AppSession | null,
  id: string,
  reason?: string,
): Promise<{ released: number }> {
  const payment = await prisma.customerPayment.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!payment) throw new QuoteError('NOT_FOUND', 'Payment not found', 404);
  if (!canAccessBranch(session, payment.branchId)) {
    throw new QuoteError('FORBIDDEN', 'This payment is outside your assignment', 403);
  }
  if (payment.allocations.length === 0) {
    throw new QuoteError('CONFLICT', 'This payment has no allocations to reverse', 409);
  }
  const userId = actorId(session);

  return prisma.$transaction(async (tx) => {
    let released = 0;
    for (const allocation of payment.allocations) {
      const invoice = await tx.customerInvoice.findUnique({
        where: { id: allocation.invoiceId },
        select: { id: true, status: true, total: true, paidAmount: true, invoiceNumber: true },
      });
      if (!invoice) continue;
      const amount = money(num(invoice.paidAmount) - num(allocation.amount));
      const nextPaid = money(Math.max(0, amount));
      released = money(released + num(allocation.amount));
      const nextStatus = invoice.status === 'VOID' ? 'VOID' : settlementStatus({
        status: 'ISSUED' as const,
        total: invoice.total,
        paidAmount: nextPaid,
      });
      await tx.customerInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: nextPaid, status: nextStatus },
      });
      await tx.paymentAllocation.delete({ where: { id: allocation.id } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'customer_payment.allocation_reversed',
          entity: 'CustomerInvoice',
          entityId: invoice.id,
          branchId: payment.branchId,
          metadata: JSON.stringify({
            receiptNumber: payment.receiptNumber,
            invoiceNumber: invoice.invoiceNumber,
            amount: num(allocation.amount),
            ...(reason ? { reason } : {}),
          }),
        },
      });
    }
    await tx.customerPayment.update({
      where: { id },
      data: { allocatedAmount: 0, notes: reason ? `${payment.notes ?? ''} | reversed: ${reason}`.slice(0, 1000) : payment.notes },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'customer_payment.reversed',
        entity: 'CustomerPayment',
        entityId: id,
        branchId: payment.branchId,
        metadata: JSON.stringify({ receiptNumber: payment.receiptNumber, released, ...(reason ? { reason } : {}) }),
      },
    });
    return { released };
  });
}

export interface ReceivablesRow {
  customerId: string;
  customerName: string | null;
  phone: string | null;
  invoiced: number;
  paid: number;
  outstanding: number;
  openInvoices: number;
  oldestDueDate: Date | null;
}

/**
 * Per-customer receivable summary, aggregated in SQL. Both halves are groupBy
 * aggregates (open invoices, allocated payments), so the cost does not grow
 * with the number of documents; only the customer list is joined in memory.
 */
export async function getReceivables(
  session: AppSession | null,
  opts: { q?: string; branchId?: string; limit?: number } = {},
): Promise<ReceivablesRow[]> {
  const branches = resolveBranchScope(scopedBranchIds(session), opts.branchId);
  if (branches && branches.length === 0) return [];

  const openInvoices = await prisma.customerInvoice.groupBy({
    by: ['customerId'],
    where: {
      status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
      ...(branches ? { branchId: { in: branches } } : {}),
    },
    _sum: { total: true, paidAmount: true },
    _count: { _all: true },
    _min: { dueDate: true },
  });

  const paidByCustomer = await prisma.customerPayment.groupBy({
    by: ['customerId'],
    where: { ...(branches ? { branchId: { in: branches } } : {}) },
    _sum: { allocatedAmount: true },
  });
  const paidMap = new Map(paidByCustomer.map((r) => [r.customerId, num(r._sum.allocatedAmount)]));

  const totals = new Map<string, { invoiced: number; outstanding: number; openInvoices: number; oldestDueDate: Date | null }>();
  for (const row of openInvoices) {
    const invoiced = num(row._sum.total);
    const outstanding = money(Math.max(0, invoiced - num(row._sum.paidAmount)));
    const previous = totals.get(row.customerId);
    const oldest = row._min.dueDate
      ? previous?.oldestDueDate
        ? new Date(Math.min(previous.oldestDueDate.getTime(), row._min.dueDate.getTime()))
        : row._min.dueDate
      : (previous?.oldestDueDate ?? null);
    totals.set(row.customerId, {
      invoiced: money((previous?.invoiced ?? 0) + invoiced),
      outstanding: money((previous?.outstanding ?? 0) + outstanding),
      openInvoices: (previous?.openInvoices ?? 0) + row._count._all,
      oldestDueDate: oldest,
    });
  }

  const customerIds = [...totals.keys()];
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true, phone: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const q = opts.q?.trim().toLowerCase();
  const rows: ReceivablesRow[] = [...totals.entries()]
    .map(([customerId, t]) => {
      const customer = customerMap.get(customerId);
      return {
        customerId,
        customerName: customer?.name ?? null,
        phone: customer?.phone ?? null,
        invoiced: t.invoiced,
        paid: paidMap.get(customerId) ?? 0,
        outstanding: t.outstanding,
        openInvoices: t.openInvoices,
        oldestDueDate: t.oldestDueDate,
      };
    })
    .filter((r) =>
      q
        ? (r.customerName ?? '').toLowerCase().includes(q) || (r.phone ?? '').toLowerCase().includes(q)
        : true,
    )
    .sort((a, b) => b.outstanding - a.outstanding);

  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

export function isOverdue(dueDate: Date | null, now: Date = new Date()): boolean {
  return !!dueDate && dueDate.getTime() < now.getTime();
}

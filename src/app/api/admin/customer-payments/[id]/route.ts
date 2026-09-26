import { NextResponse } from 'next/server';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { deleteCustomerPayment, reverseCustomerPayment, unallocatedCredit } from '@/lib/finance/customer-payments';
import { QuoteError } from '@/lib/sales/quotes';

/** Payment detail, including what it settled. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;

    const payment = await prisma.customerPayment.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true, nameEn: true } },
        allocations: {
          include: { invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } } },
        },
      },
    });
    if (!payment) return apiError('NOT_FOUND', 'Payment not found', 404);
    if (!canAccessBranch(session, payment.branchId)) {
      return apiError('FORBIDDEN', 'This payment is outside your assignment', 403);
    }

    const amount = num(payment.amount);
    const allocatedAmount = num(payment.allocatedAmount);
    return NextResponse.json({
      success: true,
      payment: {
        ...payment,
        amount,
        allocatedAmount,
        credit: unallocatedCredit(amount, allocatedAmount),
        paidAt: payment.paidAt.toISOString(),
        createdAt: payment.createdAt.toISOString(),
        canReverse: payment.allocations.length > 0,
        canDelete: payment.allocations.length === 0,
        allocations: payment.allocations.map((a) => ({
          id: a.id,
          invoiceId: a.invoiceId,
          amount: num(a.amount),
          invoice: { ...a.invoice, total: num(a.invoice.total) },
        })),
      },
    });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/customer-payments/[id] GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load payment', 500);
  }
}

/** One action: reverse. Releases the allocations and keeps the receipt. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { action?: unknown; reason?: unknown } | null;
    if (!body || typeof body.action !== 'string') {
      return apiError('VALIDATION_ERROR', 'An action is required', 400);
    }
    if (body.action !== 'reverse') {
      return apiError('VALIDATION_ERROR', `Unsupported payment action "${body.action}"`, 400);
    }

    const result = await reverseCustomerPayment(
      session,
      id,
      typeof body.reason === 'string' ? body.reason : undefined,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/customer-payments/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process payment', 500);
  }
}

/** Only an unallocated payment can be deleted outright. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    await deleteCustomerPayment(session, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/customer-payments/[id] DELETE', e);
    return apiError('INTERNAL_ERROR', 'Failed to delete payment', 500);
  }
}

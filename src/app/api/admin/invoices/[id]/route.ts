import { NextResponse } from 'next/server';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { num } from '@/lib/pricing';
import { allowedInvoiceActions, applyInvoiceAction, deleteInvoice, outstandingOf, updateInvoice } from '@/lib/sales/invoices';
import { QuoteError } from '@/lib/sales/quotes';
import { isOverdue } from '@/lib/finance/customer-payments';

/** Invoice detail with its lines and the payments applied to it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;

    const invoice = await prisma.customerInvoice.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } } } },
        branch: { select: { id: true, name: true, nameEn: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        allocations: {
          include: { payment: { select: { id: true, receiptNumber: true, paidAt: true, method: true } } },
          orderBy: { createdAt: 'desc' },
        },
        quotation: { select: { id: true, quotationNumber: true, status: true } },
      },
    });
    if (!invoice) return apiError('NOT_FOUND', 'Invoice not found', 404);
    if (!canAccessBranch(session, invoice.branchId)) {
      return apiError('FORBIDDEN', 'This invoice is outside your assignment', 403);
    }

    const hasPayments = invoice.allocations.length > 0;
    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        subtotal: num(invoice.subtotal),
        discount: num(invoice.discount),
        vat: num(invoice.vat),
        total: num(invoice.total),
        paidAmount: num(invoice.paidAmount),
        outstanding: outstandingOf(invoice),
        overdue: isOverdue(invoice.dueDate) && (invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID'),
        dueDate: invoice.dueDate?.toISOString() ?? null,
        issuedAt: invoice.issuedAt?.toISOString() ?? null,
        createdAt: invoice.createdAt.toISOString(),
        availableActions: allowedInvoiceActions(invoice.status, hasPayments),
        lines: invoice.lines.map((l) => ({
          ...l,
          unitPrice: num(l.unitPrice),
          lineTotal: num(l.lineTotal),
        })),
        allocations: invoice.allocations.map((a) => ({
          id: a.id,
          invoiceId: a.invoiceId,
          amount: num(a.amount),
          createdAt: a.createdAt.toISOString(),
          payment: {
            ...a.payment,
            paidAt: a.payment.paidAt.toISOString(),
          },
        })),
      },
    });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/invoices/[id] GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load invoice', 500);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const invoice = await updateInvoice(session, id, {
      discount: body.discount === undefined ? undefined : Number(body.discount),
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      items: Array.isArray(body.items) ? (body.items as never) : undefined,
    });
    return NextResponse.json({ success: true, invoice });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/invoices/[id] PATCH', e);
    return apiError('INTERNAL_ERROR', 'Failed to update invoice', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    await deleteInvoice(session, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/invoices/[id] DELETE', e);
    return apiError('INTERNAL_ERROR', 'Failed to delete invoice', 500);
  }
}

/** One action per call: issue | void. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      action?: unknown;
      reason?: unknown;
      dueDate?: unknown;
    } | null;
    if (!body || typeof body.action !== 'string') {
      return apiError('VALIDATION_ERROR', 'An action is required', 400);
    }

    const result = await applyInvoiceAction(session, id, body.action, {
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      dueDate: typeof body.dueDate === 'string' ? new Date(body.dueDate) : undefined,
    });
    return NextResponse.json({ success: true, status: result.status });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/invoices/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process invoice', 500);
  }
}

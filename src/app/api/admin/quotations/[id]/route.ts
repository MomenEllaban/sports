import { NextResponse } from 'next/server';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { num } from '@/lib/pricing';
import { applyQuoteAction, deleteQuotation, QuoteError, updateQuotation } from '@/lib/sales/quotes';

/** Quotation detail, including the priced lines and what can be done next. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } } } },
        branch: { select: { id: true, name: true, nameEn: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    });
    if (!quotation) return apiError('NOT_FOUND', 'Quotation not found', 404);
    if (!canAccessBranch(session, quotation.branchId)) {
      return apiError('FORBIDDEN', 'This quotation is outside your assignment', 403);
    }

    const { effectiveQuoteStatus, allowedQuoteActions } = await import('@/lib/sales/quotes');
    const status = effectiveQuoteStatus(quotation.status, quotation.validUntil);
    return NextResponse.json({
      success: true,
      quotation: {
        ...quotation,
        subtotal: num(quotation.subtotal),
        discount: num(quotation.discount),
        vat: num(quotation.vat),
        total: num(quotation.total),
        validUntil: quotation.validUntil.toISOString(),
        createdAt: quotation.createdAt.toISOString(),
        effectiveStatus: status,
        availableActions: allowedQuoteActions(status),
        items: quotation.items.map((i) => ({
          ...i,
          unitPrice: num(i.unitPrice),
          lineTotal: num(i.lineTotal),
        })),
      },
    });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/quotations/[id] GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load quotation', 500);
  }
}

/** Re-price or re-date a draft. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const quotation = await updateQuotation(session, id, {
      discount: body.discount === undefined ? undefined : Number(body.discount),
      validUntil: body.validUntil ? new Date(String(body.validUntil)) : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      items: Array.isArray(body.items) ? (body.items as never) : undefined,
    });
    return NextResponse.json({ success: true, quotation });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/quotations/[id] PATCH', e);
    return apiError('INTERNAL_ERROR', 'Failed to update quotation', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    await deleteQuotation(session, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/quotations/[id] DELETE', e);
    return apiError('INTERNAL_ERROR', 'Failed to delete quotation', 500);
  }
}

/**
 * One lifecycle action per call: send | accept | reject | expire | convert.
 * `convert` is the interesting one: it returns the draft invoice it created, so
 * the UI can link straight to it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { action?: unknown; reason?: unknown } | null;
    if (!body || typeof body.action !== 'string') {
      return apiError('VALIDATION_ERROR', 'An action is required', 400);
    }

    const result = await applyQuoteAction(session, id, body.action, {
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    const invoice = result.invoiceId
      ? await prisma.customerInvoice.findUnique({
          where: { id: result.invoiceId },
          select: { id: true, invoiceNumber: true, status: true, total: true },
        })
      : null;

    return NextResponse.json({
      success: true,
      status: result.status,
      invoice: invoice ? { ...invoice, total: num(invoice.total) } : null,
    });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/quotations/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process quotation', 500);
  }
}

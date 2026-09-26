import { NextResponse } from 'next/server';
import type { Prisma, QuotationStatus } from '@prisma/client';
import { QuotationStatus as QuotationStatusEnum } from '@prisma/client';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import {
  allowedQuoteActions,
  createQuotation,
  effectiveQuoteStatus,
  QuoteError,
} from '@/lib/sales/quotes';
import { resolveBranchScope } from '@/lib/hr/attendance';

const STATUSES = new Set<string>(Object.values(QuotationStatusEnum));

/** Paginated quotation list, scoped to the branches the caller can see. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
    const statusParam = (url.searchParams.get('status') ?? '').trim();
    if (statusParam && !STATUSES.has(statusParam)) {
      return apiError('VALIDATION_ERROR', `Unknown quotation status "${statusParam}"`, 400, undefined, {
        allowed: [...STATUSES],
      });
    }
    const branchParam = (url.searchParams.get('branchId') ?? '').trim();
    const scopeIds = resolveBranchScope(scopedBranchIds(session), branchParam || undefined);
    if (scopeIds && scopeIds.length === 0) {
      return NextResponse.json({ success: true, rows: [], total: 0, page, pageSize, pageCount: 1 });
    }

    // Search and branch scope are ANDed: a search term must never replace the
    // branch scope, or a scoped user could read other branches' quotations.
    const and: Prisma.QuotationWhereInput[] = [];
    if (scopeIds) and.push({ branchId: { in: scopeIds } });
    if (q) {
      and.push({
        OR: [
          { quotationNumber: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { customer: { phone: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.QuotationWhereInput = {
      ...(statusParam ? { status: statusParam as QuotationStatus } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          branch: { select: { id: true, name: true, nameEn: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        ...row,
        total: Number(row.total),
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        vat: Number(row.vat),
        validUntil: row.validUntil.toISOString(),
        // `status` stays the stored value; `effectiveStatus` is what a user is
        // allowed to act on, so an offer that lapsed reads as expired without
        // needing a scheduler to write it.
        effectiveStatus: effectiveQuoteStatus(row.status, row.validUntil),
        availableActions: allowedQuoteActions(effectiveQuoteStatus(row.status, row.validUntil)),
        lineCount: row._count.items,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    captureError('api/admin/quotations GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load quotations', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const quotation = await createQuotation(session, {
      customerId: String(body.customerId ?? ''),
      customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
      branchId: String(body.branchId ?? ''),
      discount: body.discount === undefined ? undefined : Number(body.discount),
      validUntil: new Date(String(body.validUntil ?? '')),
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      items: Array.isArray(body.items) ? (body.items as never) : [],
    });

    return NextResponse.json({ success: true, quotation }, { status: 201 });
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/quotations', e);
    return apiError('INTERNAL_ERROR', 'Failed to create quotation', 500);
  }
}

import { NextResponse } from 'next/server';
import type { CustomerInvoiceStatus, Prisma } from '@prisma/client';
import { CustomerInvoiceStatus as InvoiceStatusEnum } from '@prisma/client';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { num } from '@/lib/pricing';
import { outstandingOf } from '@/lib/sales/invoices';
import { resolveBranchScope } from '@/lib/hr/attendance';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { isOverdue } from '@/lib/finance/customer-payments';

const STATUSES = new Set<string>(Object.values(InvoiceStatusEnum));

/** Invoice list with the outstanding balance computed on the server. */
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
      return apiError('VALIDATION_ERROR', `Unknown invoice status "${statusParam}"`, 400, undefined, {
        allowed: [...STATUSES],
      });
    }
    const branchParam = (url.searchParams.get('branchId') ?? '').trim();
    const scopeIds = resolveBranchScope(scopedBranchIds(session), branchParam || undefined);
    if (scopeIds && scopeIds.length === 0) {
      return NextResponse.json({ success: true, rows: [], total: 0, page, pageSize, pageCount: 1, summary: null });
    }

    const and: Prisma.CustomerInvoiceWhereInput[] = [];
    if (scopeIds) and.push({ branchId: { in: scopeIds } });
    if (q) {
      and.push({
        OR: [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { customer: { phone: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.CustomerInvoiceWhereInput = {
      ...(statusParam ? { status: statusParam as CustomerInvoiceStatus } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    const [total, rows, summary] = await prisma.$transaction([
      prisma.customerInvoice.count({ where }),
      prisma.customerInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          branch: { select: { id: true, name: true, nameEn: true } },
          customer: { select: { id: true, name: true, phone: true } },
          _count: { select: { lines: true, allocations: true } },
        },
      }),
      prisma.customerInvoice.aggregate({
        where: {
          ...where,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
        },
        _sum: { total: true, paidAmount: true },
      }),
    ]);

    const openStatuses = new Set(['ISSUED', 'PARTIALLY_PAID']);
    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        ...row,
        subtotal: num(row.subtotal),
        discount: num(row.discount),
        vat: num(row.vat),
        total: num(row.total),
        paidAmount: num(row.paidAmount),
        outstanding: outstandingOf(row),
        overdue: openStatuses.has(row.status) && isOverdue(row.dueDate),
        lineCount: row._count.lines,
        hasPayments: row._count.allocations > 0,
        dueDate: row.dueDate?.toISOString() ?? null,
        issuedAt: row.issuedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      summary: {
        invoiced: num(summary._sum.total),
        paid: num(summary._sum.paidAmount),
        outstanding: Math.max(0, num(summary._sum.total) - num(summary._sum.paidAmount)),
      },
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    captureError('api/admin/invoices GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load invoices', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const { createInvoice } = await import('@/lib/sales/invoices');
    const invoice = await createInvoice(session, {
      customerId: String(body.customerId ?? ''),
      branchId: String(body.branchId ?? ''),
      discount: body.discount === undefined ? undefined : Number(body.discount),
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      items: Array.isArray(body.items) ? (body.items as never) : [],
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (e) {
    const { QuoteError } = await import('@/lib/sales/quotes');
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/invoices', e);
    return apiError('INTERNAL_ERROR', 'Failed to create invoice', 500);
  }
}

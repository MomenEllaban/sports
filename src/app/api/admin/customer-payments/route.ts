import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { num } from '@/lib/pricing';
import {
  recordCustomerPayment,
  unallocatedCredit,
} from '@/lib/finance/customer-payments';
import { resolveBranchScope } from '@/lib/hr/attendance';
import { QuoteError } from '@/lib/sales/quotes';

/** Customer payment receipts, newest first. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
    const customerParam = (url.searchParams.get('customerId') ?? '').trim();
    const branchParam = (url.searchParams.get('branchId') ?? '').trim();
    const scopeIds = resolveBranchScope(scopedBranchIds(session), branchParam || undefined);
    if (scopeIds && scopeIds.length === 0) {
      return NextResponse.json({ success: true, rows: [], total: 0, page, pageSize, pageCount: 1 });
    }

    const and: Prisma.CustomerPaymentWhereInput[] = [];
    if (scopeIds) and.push({ branchId: { in: scopeIds } });
    if (customerParam) and.push({ customerId: customerParam });
    if (q) {
      and.push({
        OR: [
          { receiptNumber: { contains: q, mode: 'insensitive' } },
          { reference: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { customer: { phone: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.CustomerPaymentWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await prisma.$transaction([
      prisma.customerPayment.count({ where }),
      prisma.customerPayment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true, nameEn: true } },
          allocations: { include: { invoice: { select: { id: true, invoiceNumber: true } } } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        ...row,
        amount: num(row.amount),
        allocatedAmount: num(row.allocatedAmount),
        credit: unallocatedCredit(num(row.amount), num(row.allocatedAmount)),
        paidAt: row.paidAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        allocations: row.allocations.map((a) => ({
          id: a.id,
          invoiceId: a.invoiceId,
          invoiceNumber: a.invoice.invoiceNumber,
          amount: num(a.amount),
        })),
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    captureError('api/admin/customer-payments GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load payments', 500);
  }
}

/**
 * Records money received. `allocations` is optional: a payment with no
 * allocations is held as customer credit, which is the common case when a
 * customer pays before the invoice exists.
 */
export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const payment = await recordCustomerPayment(session, {
      customerId: String(body.customerId ?? ''),
      branchId: String(body.branchId ?? ''),
      amount: Number(body.amount),
      method: typeof body.method === 'string' ? body.method : undefined,
      reference: typeof body.reference === 'string' ? body.reference : undefined,
      paidAt: typeof body.paidAt === 'string' ? new Date(body.paidAt) : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      allocations: Array.isArray(body.allocations)
        ? (body.allocations as Array<{ invoiceId?: unknown; amount?: unknown }>).map((a) => ({
            invoiceId: String(a?.invoiceId ?? ''),
            amount: Number(a?.amount),
          }))
        : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        payment: {
          ...payment,
          amount: num(payment.amount),
          allocatedAmount: num(payment.allocatedAmount),
          credit: unallocatedCredit(num(payment.amount), num(payment.allocatedAmount)),
          paidAt: payment.paidAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof QuoteError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/customer-payments', e);
    return apiError('INTERNAL_ERROR', 'Failed to record payment', 500);
  }
}

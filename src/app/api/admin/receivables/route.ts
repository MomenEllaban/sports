import { NextResponse } from 'next/server';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/guards';
import { getReceivables } from '@/lib/finance/customer-payments';
import { num } from '@/lib/pricing';
import { prisma } from '@/lib/db';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { isOverdue } from '@/lib/finance/customer-payments';
import { outstandingOf } from '@/lib/sales/invoices';

/**
 * Accounts-receivable view: who owes what, and which invoices are late.
 * Both halves are server-side aggregates, so the page does not download every
 * invoice in the business to add up a column.
 */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
    const branchId = (url.searchParams.get('branchId') ?? '').trim() || undefined;
    const customerParam = (url.searchParams.get('customerId') ?? '').trim();

    const rows = await getReceivables(session, { q, branchId });

    const summary = rows.reduce(
      (acc, r) => ({
        customers: acc.customers + 1,
        invoiced: acc.invoiced + r.invoiced,
        paid: acc.paid + r.paid,
        outstanding: acc.outstanding + r.outstanding,
      }),
      { customers: 0, invoiced: 0, paid: 0, outstanding: 0 },
    );

    // The selected customer's open invoices, for the drill-down panel.
    let openInvoices: Array<{
      id: string;
      invoiceNumber: string;
      total: number;
      paidAmount: number;
      outstanding: number;
      dueDate: string | null;
      overdue: boolean;
    }> = [];
    if (customerParam) {
      const invoices = await prisma.customerInvoice.findMany({
        where: { customerId: customerParam, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        orderBy: { dueDate: 'asc' },
        take: 100,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paidAmount: true,
          dueDate: true,
          branchId: true,
        },
      });
      openInvoices = invoices
        .filter((i) => canAccessBranch(session, i.branchId))
        .map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          total: num(i.total),
          paidAmount: num(i.paidAmount),
          outstanding: outstandingOf(i),
          dueDate: i.dueDate?.toISOString() ?? null,
          overdue: isOverdue(i.dueDate),
        }));
    }

    return NextResponse.json({
      success: true,
      rows: rows.map((r) => ({
        ...r,
        invoiced: num(r.invoiced),
        paid: num(r.paid),
        outstanding: num(r.outstanding),
        oldestDueDate: r.oldestDueDate?.toISOString() ?? null,
        overdue: isOverdue(r.oldestDueDate),
      })),
      summary,
      openInvoices,
    });
  } catch (e) {
    captureError('api/admin/receivables GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load receivables', 500);
  }
}

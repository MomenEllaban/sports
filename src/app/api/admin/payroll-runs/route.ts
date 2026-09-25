import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { money, num } from '@/lib/pricing';

// Create a payroll run for a month with items auto-built from active employees
export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const body = await req.json();
    const now = new Date();
    const periodMonth = Number(body.periodMonth) || now.getMonth() + 1;
    const periodYear = Number(body.periodYear) || now.getFullYear();

    if (periodMonth < 1 || periodMonth > 12 || periodYear < 2020) {
      return apiError('VALIDATION_ERROR', 'Invalid payroll period', 400);
    }

    const existing = await prisma.payrollRun.findFirst({ where: { periodMonth, periodYear } });
    if (existing) {
      return apiError('VALIDATION_ERROR', 'Payroll run already exists for this month', 400);
    }

    const employees = await prisma.employee.findMany({ where: { isActive: true } });
    if (employees.length === 0) {
      return apiError('VALIDATION_ERROR', 'No active employees', 400);
    }

    // 2.4: commission base = ACTUAL POS sales by this employee's linked user in the payroll month.
    // T-RMA: DONE refunds on those sales reduce the base (visible as returnsDeduction).
    const monthStart = new Date(periodYear, periodMonth - 1, 1);
    const monthEnd = new Date(periodYear, periodMonth, 1);
    const salesTotals = await prisma.sale.groupBy({
      by: ['cashierId'],
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
      _sum: { totalAmount: true },
    });
    const salesByCashier = new Map(salesTotals.map((s) => [s.cashierId, num(s._sum.totalAmount ?? 0)]));
    const refundRows = await prisma.refund.findMany({
      where: { status: 'DONE', updatedAt: { gte: monthStart, lt: monthEnd }, return: { saleId: { not: null } } },
      select: { amount: true, return: { select: { sale: { select: { cashierId: true } } } } },
    });
    const refundsByCashier = new Map<string, number>();
    for (const r of refundRows) {
      const cid = r.return.sale?.cashierId;
      if (!cid) continue;
      refundsByCashier.set(cid, (refundsByCashier.get(cid) || 0) + num(r.amount));
    }

    const salesByEmployee: Record<string, number> = {};
    const items = employees.map((e) => {
      const salary = num(e.salary);
      const gross = e.userId ? salesByCashier.get(e.userId) ?? 0 : 0;
      const clawback = e.userId ? refundsByCashier.get(e.userId) ?? 0 : 0;
      const salesTotal = Math.max(0, money(gross - clawback));
      salesByEmployee[e.id] = salesTotal;
      const commission = money(salesTotal * e.commissionRate);
      return {
        employeeId: e.id,
        baseSalary: salary,
        bonus: 0,
        deductions: 0,
        commissionAmount: commission,
        netSalary: money(salary + commission),
        status: 'DRAFT' as const,
      };
    });
    const totalAmount = items.reduce((s, i) => s + i.netSalary, 0);

    const run = await prisma.payrollRun.create({
      data: {
        periodMonth,
        periodYear,
        status: 'DRAFT',
        totalAmount,
        createdById: (session!.user as { id: string }).id,
        items: { create: items },
      },
      include: { items: { include: { employee: true } } },
    });

    return NextResponse.json({ success: true, payrollRun: run, salesByEmployee });
  } catch (e) {
    captureError('api/admin/payroll-runs', e);
    return apiError('INTERNAL_ERROR', 'Failed to create payroll run', 500);
  }
}

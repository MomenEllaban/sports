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
      return NextResponse.json({ success: false, error: 'Invalid payroll period' }, { status: 400 });
    }

    const existing = await prisma.payrollRun.findFirst({ where: { periodMonth, periodYear } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Payroll run already exists for this month' }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({ where: { isActive: true } });
    if (employees.length === 0) {
      return NextResponse.json({ success: false, error: 'No active employees' }, { status: 400 });
    }

    const items = employees.map((e) => {
      const salary = num(e.salary);
      const commission = money(salary * e.commissionRate);
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

    return NextResponse.json({ success: true, payrollRun: run });
  } catch (e) {
    console.error('Admin payroll create error:', e);
    return NextResponse.json({ success: false, error: 'Failed to create payroll run' }, { status: 500 });
  }
}

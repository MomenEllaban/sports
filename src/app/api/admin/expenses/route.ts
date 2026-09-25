import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { nextDocumentNumber } from '@/lib/documents';
import { ExpenseCategory } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const body = await req.json();
    const { branchId, category, description, amount } = body;

    if (!branchId || !description || !(Number(amount) > 0)) {
      return apiError('VALIDATION_ERROR', 'Branch, description and positive amount are required', 400);
    }
    if (category && !Object.values(ExpenseCategory).includes(category)) {
      return apiError('VALIDATION_ERROR', 'Invalid expense category', 400);
    }

    const actorId = (session!.user as { id: string }).id;
    const expenseNumber = await prisma.$transaction((tx) => nextDocumentNumber(tx, 'EXP'));
    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        branchId,
        category: category || 'OTHER',
        description: String(description).trim(),
        amount: Number(amount),
        createdById: actorId,
      },
    });

    void writeAudit({
      actorId,
      action: 'expense.recorded',
      entity: 'Expense',
      entityId: expense.id,
      branchId,
      metadata: { expenseNumber, amount: Number(amount), category: expense.category },
    });

    return NextResponse.json({ success: true, expense });
  } catch (e) {
    captureError('api/admin/expenses', e);
    return apiError('INTERNAL_ERROR', 'Failed to record expense', 500);
  }
}

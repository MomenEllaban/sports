import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards.js';
import { ExpenseCategory } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const body = await req.json();
    const { branchId, category, description, amount } = body;

    if (!branchId || !description || !(Number(amount) > 0)) {
      return NextResponse.json({ success: false, error: 'Branch, description and positive amount are required' }, { status: 400 });
    }
    if (category && !Object.values(ExpenseCategory).includes(category)) {
      return NextResponse.json({ success: false, error: 'Invalid expense category' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        expenseNumber: `EXP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        branchId,
        category: category || 'OTHER',
        description: String(description).trim(),
        amount: Number(amount),
        createdById: (session!.user as { id: string }).id,
      },
    });

    return NextResponse.json({ success: true, expense });
  } catch (e) {
    console.error('Admin expense create error:', e);
    return NextResponse.json({ success: false, error: 'Failed to record expense' }, { status: 500 });
  }
}

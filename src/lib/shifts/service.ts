import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import type { PaymentMethod } from '@prisma/client';

export class ShiftError extends Error {
  status = 400;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const CASH_METHODS: PaymentMethod[] = ['CASH'];

/** The single OPEN shift of a cashier (at most one). */
export async function getOpenShift(cashierId: string) {
  return prisma.shift.findFirst({ where: { cashierId, status: 'OPEN' }, include: { branch: true } });
}

/**
 * Expected cash in drawer = opening float + CASH sales since open
 * − DONE cash refunds paid from this shift (T-RMA).
 * Card/InstaPay never touch the drawer.
 */
export async function expectedCashFor(shiftId: string, openingFloat: number): Promise<number> {
  const sales = await prisma.sale.findMany({
    where: { shiftId, paymentMethod: { in: CASH_METHODS } },
    select: { totalAmount: true },
  });
  const refunds = await prisma.refund.findMany({
    where: { shiftId, status: 'DONE', method: 'CASH' },
    select: { amount: true },
  });
  const cash = sales.reduce((s, x) => s + num(x.totalAmount), 0);
  const paid = refunds.reduce((s, x) => s + num(x.amount), 0);
  return Math.round((openingFloat + cash - paid) * 100) / 100;
}

export async function openShift(args: { branchId: string; cashierId: string; openingFloat: number; openNote?: string }) {
  if (!Number.isFinite(args.openingFloat) || args.openingFloat < 0) {
    throw new ShiftError(400, 'رصيد الافتتاح غير صالح');
  }
  const existing = await getOpenShift(args.cashierId);
  if (existing) throw new ShiftError(409, 'لديك وردية مفتوحة بالفعل — أغلقها أولاً');
  const branch = await prisma.branch.findFirst({ where: { id: args.branchId, isActive: true } });
  if (!branch) throw new ShiftError(422, 'الفرع المحدد غير نشط');
  // Claim exactly-once: unique partial index would be ideal; re-check in tx.
  return prisma.$transaction(async (tx) => {
    const race = await tx.shift.findFirst({ where: { cashierId: args.cashierId, status: 'OPEN' } });
    if (race) throw new ShiftError(409, 'لديك وردية مفتوحة بالفعل — أغلقها أولاً');
    return tx.shift.create({
      data: {
        branchId: args.branchId,
        cashierId: args.cashierId,
        openingFloat: Math.round(args.openingFloat * 100) / 100,
        expectedCash: Math.round(args.openingFloat * 100) / 100,
        openNote: args.openNote?.slice(0, 500) || null,
      },
    });
  });
}

export async function closeShift(args: { shiftId: string; cashierId: string; actualCash: number; closeNote?: string; maxShortage: number }) {
  if (!Number.isFinite(args.actualCash) || args.actualCash < 0) {
    throw new ShiftError(400, 'المبلغ المعدود غير صالح');
  }
  const shift = await prisma.shift.findUnique({ where: { id: args.shiftId } });
  if (!shift || shift.cashierId !== args.cashierId) throw new ShiftError(404, 'الوردية غير موجودة');
  if (shift.status !== 'OPEN') throw new ShiftError(409, 'الوردية مغلقة بالفعل');
  const expected = await expectedCashFor(shift.id, num(shift.openingFloat));
  const actual = Math.round(args.actualCash * 100) / 100;
  const difference = Math.round((actual - expected) * 100) / 100;
  // Shortage beyond tolerance requires a written explanation.
  if (difference < 0 && Math.abs(difference) > args.maxShortage && !(args.closeNote || '').trim()) {
    throw new ShiftError(422, `العجز ${Math.abs(difference)} يتجاوز المسموح (${args.maxShortage}) — اكتب تفسيراً إجبارياً`);
  }
  // Exactly-once close: conditional update is the lock.
  const closed = await prisma.shift.updateMany({
    where: { id: shift.id, status: 'OPEN' },
    data: { status: 'CLOSED', closedAt: new Date(), expectedCash: expected, actualCash: actual, difference, closeNote: args.closeNote?.slice(0, 500) || null },
  });
  if (closed.count !== 1) throw new ShiftError(409, 'الوردية أُغلقت concurrently');
  return { expected, actual, difference };
}

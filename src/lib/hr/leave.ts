import type { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canAccessBranch, scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';
import { addDaysUtc, HRError, resolveBranchScope, startOfDayUtc } from '@/lib/hr/attendance';

/**
 * Leave requests. Friday/Saturday are the weekend in this deployment, so a
 * leave spanning them is billed in business days, not calendar days.
 *
 * Approving leave writes the matching `LEAVE` attendance rows, so the
 * attendance register and the leave register cannot disagree.
 */

export { HRError as LeaveError };

export const WEEKEND_DAYS = [5, 6]; // Friday, Saturday (UTC day index)

/** Inclusive business-day count between two dates. Pure. */
export function countBusinessDays(start: Date, end: Date): number {
  const from = startOfDayUtc(start).getTime();
  const to = startOfDayUtc(end).getTime();
  if (to < from) return 0;
  let days = 0;
  for (let t = from; t <= to; t += 864e5) {
    if (!WEEKEND_DAYS.includes(new Date(t).getUTCDay())) days += 1;
  }
  return days;
}

/** Every business day in an inclusive range, as UTC midnights. Pure. */
export function businessDaysInRange(start: Date, end: Date): Date[] {
  const from = startOfDayUtc(start).getTime();
  const to = startOfDayUtc(end).getTime();
  const days: Date[] = [];
  for (let t = from; t <= to; t += 864e5) {
    const day = new Date(t);
    if (!WEEKEND_DAYS.includes(day.getUTCDay())) days.push(day);
  }
  return days;
}

export interface LeaveInput {
  employeeId: string;
  type?: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason?: string;
}

function actorId(session: AppSession | null): string {
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new HRError('UNAUTHORIZED', 'A signed-in user is required', 401);
  return id;
}

async function loadEmployee(session: AppSession | null, employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, branchId: true, isActive: true },
  });
  if (!employee) throw new HRError('VALIDATION_ERROR', 'Unknown employee', 400, { employeeId });
  if (!employee.isActive) throw new HRError('CONFLICT', 'This employee is no longer active', 409);
  if (!canAccessBranch(session, employee.branchId)) {
    throw new HRError('FORBIDDEN', 'This employee is outside your assignment', 403);
  }
  return employee;
}

/** Two ranges overlap when each starts before the other ends. Pure. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

export async function requestLeave(
  session: AppSession | null,
  input: LeaveInput,
): Promise<LeaveRequestRow> {
  const employee = await loadEmployee(session, String(input.employeeId ?? ''));
  const startDate = startOfDayUtc(input.startDate);
  const endDate = startOfDayUtc(input.endDate);
  if (endDate.getTime() < startDate.getTime()) {
    throw new HRError('VALIDATION_ERROR', 'The end date cannot be before the start date');
  }
  if (startDate.getTime() < startOfDayUtc(new Date()).getTime() - 30 * 864e5) {
    throw new HRError('VALIDATION_ERROR', 'A leave request cannot start more than 30 days in the past');
  }
  const days = countBusinessDays(startDate, endDate);
  if (days === 0) {
    throw new HRError('VALIDATION_ERROR', 'The selected range contains no working days');
  }
  if (days > 60) {
    throw new HRError('VALIDATION_ERROR', 'A single leave request cannot exceed 60 working days');
  }

  const clash = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, startDate: true, endDate: true, status: true },
  });
  if (clash) {
    throw new HRError(
      'CONFLICT',
      'This employee already has a leave request covering some of those days',
      409,
      { leaveRequestId: clash.id, status: clash.status, startDate: clash.startDate, endDate: clash.endDate },
    );
  }

  const userId = actorId(session);
  return prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        employeeId: employee.id,
        branchId: employee.branchId,
        type: input.type ?? 'ANNUAL',
        startDate,
        endDate,
        days,
        reason: input.reason ? String(input.reason).slice(0, 1000) : null,
        status: 'PENDING',
      },
      include: { employee: { select: { id: true, name: true, roleTitle: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'leave.requested',
        entity: 'LeaveRequest',
        entityId: created.id,
        branchId: employee.branchId,
        metadata: JSON.stringify({ employeeId: employee.id, type: created.type, startDate, endDate, days }),
      },
    });
    return created;
  });
}

export type LeaveRequestRow = Prisma.LeaveRequestGetPayload<{
  include: { employee: { select: { id: true; name: true; roleTitle: true } } };
}>;

const DECISIONS: Record<string, LeaveStatus> = { approve: 'APPROVED', reject: 'REJECTED' };

/**
 * Approve or reject. Approving marks the working days as LEAVE in the
 * attendance register, but never overwrites a day that already carries a punch
 * pair — an existing punch is evidence the person worked, and a decision on a
 * leave request must not erase it.
 */
export async function decideLeave(
  session: AppSession | null,
  id: string,
  action: string,
  note?: string,
): Promise<LeaveRequestRow> {
  const to = DECISIONS[action];
  if (!to) throw new HRError('VALIDATION_ERROR', `Unsupported leave action "${action}"`, 400);
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) throw new HRError('NOT_FOUND', 'Leave request not found', 404);
  if (!canAccessBranch(session, leave.branchId)) {
    throw new HRError('FORBIDDEN', 'This leave request is outside your assignment', 403);
  }
  if (leave.status !== 'PENDING') {
    throw new HRError('CONFLICT', `This request was already ${leave.status.toLowerCase()}`, 409, {
      status: leave.status,
    });
  }
  if (to === 'REJECTED' && !note?.trim()) {
    throw new HRError('VALIDATION_ERROR', 'A reason is required to reject leave');
  }

  const userId = actorId(session);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const claim = await tx.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: to, decidedById: userId, decidedAt: now, decisionNote: note?.trim().slice(0, 500) ?? null },
    });
    if (claim.count !== 1) throw new HRError('CONFLICT', 'This request was already decided', 409);

    if (to === 'APPROVED') {
      const days = businessDaysInRange(leave.startDate, leave.endDate);
      for (const day of days) {
        const existing = await tx.attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId: leave.employeeId, date: day } },
          select: { id: true, checkIn: true, checkOut: true, status: true },
        });
        if (existing) continue;
        await tx.attendanceRecord.create({
          data: {
            employeeId: leave.employeeId,
            branchId: leave.branchId,
            date: day,
            status: 'LEAVE',
            notes: 'Approved leave',
            recordedById: userId,
          },
        });
      }
    }

    const updated = await tx.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: { employee: { select: { id: true, name: true, roleTitle: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: `leave.${action}d`,
        entity: 'LeaveRequest',
        entityId: id,
        branchId: leave.branchId,
        metadata: JSON.stringify({
          employeeId: leave.employeeId,
          from: 'PENDING',
          to,
          days: leave.days,
          ...(note ? { note } : {}),
        }),
      },
    });
    return updated;
  });
}

export async function cancelLeave(session: AppSession | null, id: string): Promise<LeaveRequestRow> {
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) throw new HRError('NOT_FOUND', 'Leave request not found', 404);
  if (!canAccessBranch(session, leave.branchId)) {
    throw new HRError('FORBIDDEN', 'This leave request is outside your assignment', 403);
  }
  if (leave.status !== 'PENDING' && leave.status !== 'APPROVED') {
    throw new HRError('CONFLICT', 'Only a pending or approved request can be cancelled', 409, {
      status: leave.status,
    });
  }
  const userId = actorId(session);

  return prisma.$transaction(async (tx) => {
    const claim = await tx.leaveRequest.updateMany({
      where: { id, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'CANCELLED', decidedById: userId, decidedAt: new Date() },
    });
    if (claim.count !== 1) throw new HRError('CONFLICT', 'This request was already processed', 409);

    // Free the days this request had marked as leave, but only the ones it
    // actually marked: a real punch must survive the cancellation.
    if (leave.status === 'APPROVED') {
      for (const day of businessDaysInRange(leave.startDate, leave.endDate)) {
        await tx.attendanceRecord.deleteMany({
          where: { employeeId: leave.employeeId, date: day, status: 'LEAVE', notes: 'Approved leave' },
        });
      }
    }

    const updated = await tx.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: { employee: { select: { id: true, name: true, roleTitle: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'leave.cancelled',
        entity: 'LeaveRequest',
        entityId: id,
        branchId: leave.branchId,
        metadata: JSON.stringify({ employeeId: leave.employeeId, from: leave.status, to: 'CANCELLED' }),
      },
    });
    return updated;
  });
}

export interface LeaveQuery {
  from?: Date | string;
  to?: Date | string;
  branchId?: string;
  employeeId?: string;
  status?: LeaveStatus;
  page?: number;
  pageSize?: number;
}

export async function listLeave(session: AppSession | null, query: LeaveQuery = {}) {
  const branches = resolveBranchScope(scopedBranchIds(session), query.branchId);

  const from = query.from ? startOfDayUtc(query.from) : startOfDayUtc(addDaysUtc(new Date(), -60));
  const toRaw = query.to ? startOfDayUtc(query.to) : startOfDayUtc(addDaysUtc(new Date(), 60));
  const to = toRaw.getTime() < from.getTime() ? from : toRaw;
  if (branches && branches.length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 0,
      pendingRequests: 0,
      pendingDays: 0,
      range: { start: from, end: to },
    };
  }

  const where = {
    startDate: { lte: to },
    endDate: { gte: from },
    ...(branches ? { branchId: { in: branches } } : {}),
    ...(query.employeeId ? { employeeId: String(query.employeeId) } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

  const [rows, total, pending] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: [{ startDate: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { employee: { select: { id: true, name: true, roleTitle: true, branchId: true } } },
    }),
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.aggregate({
      where: { ...where, status: 'PENDING' },
      _sum: { days: true },
      _count: { _all: true },
    }),
  ]);

  return {
    items: rows,
    total,
    page,
    pageSize,
    pendingRequests: pending._count._all,
    pendingDays: pending._sum.days ?? 0,
    range: { start: from, end: to },
  };
}

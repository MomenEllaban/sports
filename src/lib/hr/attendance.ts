import type { AttendanceStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canAccessBranch, scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

/**
 * Daily attendance. One row per employee per day, corrected in place.
 *
 * The branch always comes from the employee record, never from the request
 * body, so a manager cannot write attendance into another branch by sending a
 * different `branchId`.
 */

export class HRError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const SHIFT_START_HOUR = 9;
export const GRACE_MINUTES = 15;
export const HALF_DAY_MINUTES = 240;

export function startOfDayUtc(value: Date | string): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) throw new HRError('VALIDATION_ERROR', 'Invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDaysUtc(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 864e5);
}

/**
 * Derives the day status from the punch pair. Pure and clock-agnostic: a caller
 * passes the instants, so the same rules run in tests without freezing time.
 *
 *  - no punch in            -> ABSENT
 *  - later than grace       -> LATE
 *  - shorter than half day  -> HALF_DAY
 *  - otherwise              -> PRESENT
 */
export function classifyAttendance(
  checkIn: Date | null,
  checkOut: Date | null,
  opts: { shiftStartHour?: number; graceMinutes?: number; halfDayMinutes?: number } = {},
): { status: AttendanceStatus; workedMinutes: number } {
  if (!checkIn) return { status: 'ABSENT', workedMinutes: 0 };
  const shiftStartHour = opts.shiftStartHour ?? SHIFT_START_HOUR;
  const graceMinutes = opts.graceMinutes ?? GRACE_MINUTES;
  const halfDayMinutes = opts.halfDayMinutes ?? HALF_DAY_MINUTES;
  const workedMinutes = checkOut
    ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 6e4))
    : 0;

  const shiftStart = new Date(checkIn.getTime());
  shiftStart.setUTCHours(shiftStartHour, 0, 0, 0);
  const late = checkIn.getTime() > shiftStart.getTime() + graceMinutes * 6e4;

  if (workedMinutes > 0 && workedMinutes < halfDayMinutes) {
    return { status: 'HALF_DAY', workedMinutes };
  }
  return { status: late ? 'LATE' : 'PRESENT', workedMinutes };
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

export interface RecordAttendanceInput {
  employeeId: string;
  date: Date | string;
  checkIn?: Date | string | null;
  checkOut?: Date | string | null;
  status?: AttendanceStatus;
  notes?: string;
}

function parseInstant(value: Date | string | null | undefined, field: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new HRError('VALIDATION_ERROR', `Invalid ${field}`);
  return d;
}

/**
 * Creates or corrects one day for one employee. Returns the row plus what
 * changed, so the audit trail records the edit rather than just the click.
 */
export async function recordAttendance(
  session: AppSession | null,
  input: RecordAttendanceInput,
): Promise<{ record: Prisma.AttendanceRecordGetPayload<Record<string, never>>; created: boolean }> {
  const employee = await loadEmployee(session, String(input.employeeId ?? ''));
  const date = startOfDayUtc(input.date);
  const checkIn = parseInstant(input.checkIn, 'check-in time');
  const checkOut = parseInstant(input.checkOut, 'check-out time');
  if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
    throw new HRError('VALIDATION_ERROR', 'Check-out cannot be before check-in');
  }
  if (checkIn && startOfDayUtc(checkIn).getTime() !== date.getTime()) {
    throw new HRError('VALIDATION_ERROR', 'The check-in time falls on a different day');
  }
  if (checkOut && startOfDayUtc(checkOut).getTime() !== date.getTime()) {
    throw new HRError('VALIDATION_ERROR', 'The check-out time falls on a different day');
  }

  const derived = classifyAttendance(checkIn, checkOut);
  const status = input.status ?? derived.status;
  const userId = actorId(session);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
    });
    const data = {
      checkIn,
      checkOut,
      status,
      notes: input.notes ? String(input.notes).slice(0, 500) : null,
      recordedById: userId,
    };
    const record = existing
      ? await tx.attendanceRecord.update({ where: { id: existing.id }, data })
      : await tx.attendanceRecord.create({
          data: { ...data, employeeId: employee.id, branchId: employee.branchId, date },
        });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: existing ? 'attendance.corrected' : 'attendance.recorded',
        entity: 'AttendanceRecord',
        entityId: record.id,
        branchId: employee.branchId,
        metadata: JSON.stringify({
          employeeId: employee.id,
          date: date.toISOString(),
          from: existing ? { status: existing.status, checkIn: existing.checkIn, checkOut: existing.checkOut } : null,
          to: { status: record.status, checkIn, checkOut },
          autoClassified: !input.status,
        }),
      },
    });
    return { record, created: !existing };
  });
}

export interface AttendanceQuery {
  from?: Date | string;
  to?: Date | string;
  branchId?: string;
  employeeId?: string;
  status?: AttendanceStatus;
  page?: number;
  pageSize?: number;
}

export const ATTENDANCE_PAGE_SIZE = 50;

/** A date range, inclusive of the end day, that never inverts. Pure. */
export function resolveRange(from?: Date | string, to?: Date | string): { start: Date; end: Date } {
  const start = from ? startOfDayUtc(from) : startOfDayUtc(addDaysUtc(new Date(), -30));
  const rawEnd = to ? startOfDayUtc(to) : startOfDayUtc(new Date());
  const end = rawEnd.getTime() < start.getTime() ? start : rawEnd;
  return { start, end };
}

export async function listAttendance(
  session: AppSession | null,
  query: AttendanceQuery = {},
) {
  const accessible = scopedBranchIds(session);
  const branches = resolveBranchScope(accessible, query.branchId);
  const { start, end } = resolveRange(query.from, query.to);
  if (branches && branches.length === 0) {
    return { items: [], total: 0, page: 1, pageSize: 0, summary: emptySummary(), range: { start, end } };
  }

  const where = {    date: { gte: start, lt: addDaysUtc(end, 1) },
    ...(branches ? { branchId: { in: branches } } : {}),
    ...(query.employeeId ? { employeeId: String(query.employeeId) } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || ATTENDANCE_PAGE_SIZE));

  const [rows, total, grouped] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { employee: { select: { id: true, name: true, roleTitle: true, branchId: true } } },
    }),
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ]);

  const summary = emptySummary();
  for (const g of grouped) summary[g.status] = g._count._all;

  return { items: rows, total, page, pageSize, summary, range: { start, end } };
}

/**
 * `null` means "every accessible branch"; an array narrows the result. A
 * requested branch the caller cannot see yields an empty array, which the
 * callers turn into an empty page rather than an unscoped leak.
 */
export function resolveBranchScope(
  accessible: string[] | null,
  requested?: string,
): string[] | null {
  if (accessible === null) return requested ? [requested] : null;
  if (!requested) return accessible;
  return accessible.includes(requested) ? [requested] : [];
}

function emptySummary(): Record<AttendanceStatus, number> {
  return { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0 };
}

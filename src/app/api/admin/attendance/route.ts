import { NextResponse } from 'next/server';
import type { AttendanceStatus } from '@prisma/client';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/guards';
import { HRError, listAttendance, recordAttendance } from '@/lib/hr/attendance';

/** Attendance register for a date range, with per-status totals. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const result = await listAttendance(session, {
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
      employeeId: url.searchParams.get('employeeId') ?? undefined,
      status: (url.searchParams.get('status') as AttendanceStatus | null) ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1) || 1,
      pageSize: Number(url.searchParams.get('pageSize') ?? 50) || 50,
    });

    return NextResponse.json({
      success: true,
      ...result,
      items: result.items.map((row) => ({
        ...row,
        date: row.date.toISOString(),
        checkIn: row.checkIn?.toISOString() ?? null,
        checkOut: row.checkOut?.toISOString() ?? null,
      })),
      range: { start: result.range.start.toISOString(), end: result.range.end.toISOString() },
    });
  } catch (e) {
    if (e instanceof HRError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/attendance GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load attendance', 500);
  }
}

/** Create or correct one employee-day. The day is unique per employee, so a
 * repeated submission updates the existing row rather than stacking punches. */
export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const { record, created } = await recordAttendance(session, {
      employeeId: String(body.employeeId ?? ''),
      date: String(body.date ?? ''),
      checkIn: body.checkIn === null ? null : body.checkIn === undefined ? undefined : String(body.checkIn),
      checkOut: body.checkOut === null ? null : body.checkOut === undefined ? undefined : String(body.checkOut),
      status: body.status === undefined ? undefined : (String(body.status) as AttendanceStatus),
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        created,
        record: {
          ...record,
          date: record.date.toISOString(),
          checkIn: record.checkIn?.toISOString() ?? null,
          checkOut: record.checkOut?.toISOString() ?? null,
        },
      },
      { status: created ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof HRError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/attendance', e);
    return apiError('INTERNAL_ERROR', 'Failed to record attendance', 500);
  }
}

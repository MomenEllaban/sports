import { NextResponse } from 'next/server';
import type { LeaveStatus } from '@prisma/client';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/guards';
import { HRError } from '@/lib/hr/attendance';
import { listLeave, requestLeave } from '@/lib/hr/leave';

/** Leave register for a date window. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const result = await listLeave(session, {
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
      employeeId: url.searchParams.get('employeeId') ?? undefined,
      status: (url.searchParams.get('status') as LeaveStatus | null) ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1) || 1,
      pageSize: Number(url.searchParams.get('pageSize') ?? 50) || 50,
    });

    return NextResponse.json({
      success: true,
      ...result,
      items: result.items.map((row) => ({
        ...row,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      range: { start: result.range.start.toISOString(), end: result.range.end.toISOString() },
    });
  } catch (e) {
    if (e instanceof HRError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/leaves GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load leave requests', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const leave = await requestLeave(session, {
      employeeId: String(body.employeeId ?? ''),
      type: body.type === undefined ? undefined : (String(body.type) as never),
      startDate: String(body.startDate ?? ''),
      endDate: String(body.endDate ?? ''),
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        leaveRequest: {
          ...leave,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof HRError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/leaves', e);
    return apiError('INTERNAL_ERROR', 'Failed to create leave request', 500);
  }
}

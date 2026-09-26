import { NextResponse } from 'next/server';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { HRError } from '@/lib/hr/attendance';
import { cancelLeave, decideLeave } from '@/lib/hr/leave';
import { prisma } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true, roleTitle: true, branchId: true } } },
    });
    if (!leave) return apiError('NOT_FOUND', 'Leave request not found', 404);
    if (!canAccessBranch(session, leave.branchId)) {
      return apiError('FORBIDDEN', 'This leave request is outside your assignment', 403);
    }

    return NextResponse.json({
      success: true,
      leaveRequest: {
        ...leave,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        decidedAt: leave.decidedAt?.toISOString() ?? null,
        createdAt: leave.createdAt.toISOString(),
        availableActions:
          leave.status === 'PENDING' ? ['approve', 'reject', 'cancel'] : leave.status === 'APPROVED' ? ['cancel'] : [],
      },
    });
  } catch (e) {
    if (e instanceof HRError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/leaves/[id] GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load leave request', 500);
  }
}

/**
 * One decision per call: approve | reject | cancel. Approving writes the
 * matching LEAVE attendance days in the same transaction.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { action?: unknown; note?: unknown } | null;
    if (!body || typeof body.action !== 'string') {
      return apiError('VALIDATION_ERROR', 'An action is required', 400);
    }
    const note = typeof body.note === 'string' ? body.note : undefined;

    const leave =
      body.action === 'cancel'
        ? await cancelLeave(session, id)
        : await decideLeave(session, id, body.action, note);

    return NextResponse.json({
      success: true,
      status: leave.status,
      leaveRequest: {
        ...leave,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        decidedAt: leave.decidedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof HRError) return apiError(e.code, e.message, e.status, undefined, e.details);
    captureError('api/admin/leaves/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process leave request', 500);
  }
}

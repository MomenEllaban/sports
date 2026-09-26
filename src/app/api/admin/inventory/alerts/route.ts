import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { apiError } from '@/lib/api-response';
import { captureError } from '@/lib/monitor';
import { listTransferAlerts, parseListParams, InventoryScopeError } from '@/lib/inventory/queries';

/** Low-stock and out-of-stock rows, with the suggested reorder quantity. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const page = await listTransferAlerts(session, parseListParams(new URL(req.url)));
    return NextResponse.json({ success: true, ...page });
  } catch (e) {
    if (e instanceof InventoryScopeError) {
      return apiError('FORBIDDEN', e.message, 403);
    }
    captureError('api/admin/inventory/alerts', e);
    return apiError('INTERNAL_ERROR', 'Failed to load stock alerts', 500);
  }
}

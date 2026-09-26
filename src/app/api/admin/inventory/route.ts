import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { apiError } from '@/lib/api-response';
import { captureError } from '@/lib/monitor';
import { getInventoryOverview, InventoryScopeError } from '@/lib/inventory/queries';

/**
 * Inventory overview KPIs. `view` selects which aggregate set is returned so
 * the admin shell can hydrate its tabs from one endpoint.
 *   ?view=overview (default) | stock | movements | alerts
 * All values are aggregated in SQL; the client never computes them.
 */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') ?? 'overview';

    if (view === 'overview') {
      const overview = await getInventoryOverview(session, { branchId: searchParams.get('branchId') ?? undefined });
      return NextResponse.json({ success: true, view, ...overview });
    }

    return apiError('VALIDATION_ERROR', `Unknown inventory view "${view}"`, 400);
  } catch (e) {
    if (e instanceof InventoryScopeError) {
      return apiError('FORBIDDEN', e.message, 403);
    }
    captureError('api/admin/inventory', e);
    return apiError('INTERNAL_ERROR', 'Failed to load inventory', 500);
  }
}

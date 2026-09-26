import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { apiError } from '@/lib/api-response';
import { captureError } from '@/lib/monitor';
import { parseListParams, listStock, InventoryScopeError } from '@/lib/inventory/queries';

/** Branch-level stock rows: paginated, searchable, filterable, sortable. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const params = parseListParams(new URL(req.url));
    const page = await listStock(session, params);
    return NextResponse.json({ success: true, ...page });
  } catch (e) {
    if (e instanceof InventoryScopeError) {
      return apiError('FORBIDDEN', e.message, 403);
    }
    captureError('api/admin/inventory/stock', e);
    return apiError('INTERNAL_ERROR', 'Failed to load branch stock', 500);
  }
}

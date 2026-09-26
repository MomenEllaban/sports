import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { apiError } from '@/lib/api-response';
import { captureError } from '@/lib/monitor';
import { listMovements, parseListParams, InventoryScopeError } from '@/lib/inventory/queries';
import { InventoryLogType } from '@prisma/client';

const MOVEMENT_TYPES = new Set<string>(Object.values(InventoryLogType));

/**
 * The inventory movement ledger. Every stock change in the ERP lands here with
 * its previous/new balance, reference document, actor and reason, so a branch
 * balance can be reconciled line by line.
 */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const params = parseListParams(url);
    const type = url.searchParams.get('type') ?? undefined;
    if (type && !MOVEMENT_TYPES.has(type)) {
      return apiError('VALIDATION_ERROR', `Unknown movement type "${type}"`, 400, undefined, { allowed: [...MOVEMENT_TYPES] });
    }
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    for (const [name, value] of [['from', from], ['to', to]] as const) {
      if (value && Number.isNaN(Date.parse(value))) {
        return apiError('VALIDATION_ERROR', `"${name}" is not a valid date`, 400);
      }
    }

    const page = await listMovements(session, {
      ...params,
      type,
      from,
      to,
      productId: url.searchParams.get('productId') ?? undefined,
    });
    return NextResponse.json({ success: true, ...page, filters: { type: type ?? null, from: from ?? null, to: to ?? null } });
  } catch (e) {
    if (e instanceof InventoryScopeError) {
      return apiError('FORBIDDEN', e.message, 403);
    }
    captureError('api/admin/inventory/movements', e);
    return apiError('INTERNAL_ERROR', 'Failed to load inventory movements', 500);
  }
}

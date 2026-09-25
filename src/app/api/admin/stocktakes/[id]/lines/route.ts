import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { saveStocktakeLines, StocktakeError } from '@/lib/inventory/stocktake';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params; const body = await req.json() as { lines?: unknown };
    if (!Array.isArray(body.lines)) return apiError('VALIDATION_ERROR', 'lines مطلوبة', 400);
    const result = await saveStocktakeLines({ session, sessionId: id, lines: body.lines as Array<{ id: string; countedQuantity?: number | null; reasonCode?: string | null; notes?: string | null }> });
    return NextResponse.json({ success: true, stocktake: { ...result, createdAt: result.createdAt.toISOString(), startedAt: result.startedAt.toISOString(), updatedAt: result.updatedAt.toISOString() } });
  } catch (error) { if (error instanceof StocktakeError) return apiError('REQUEST_FAILED', String(error.message), error.status); captureError('api/admin/stocktakes/[id]/lines', error); return apiError('INTERNAL_ERROR', 'تعذر حفظ خطوط الجرد', 500); }
}

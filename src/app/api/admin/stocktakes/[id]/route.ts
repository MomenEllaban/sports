import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getStocktakeReport, StocktakeError } from '@/lib/inventory/stocktake';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    return NextResponse.json({ success: true, ...(await getStocktakeReport(id, session)) });
  } catch (error) { if (error instanceof StocktakeError) return apiError('REQUEST_FAILED', String(error.message), error.status); captureError('api/admin/stocktakes/[id]', error); return apiError('INTERNAL_ERROR', 'تعذر تحميل الجلسة', 500); }
}

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getStocktakeReport, StocktakeError } from '@/lib/inventory/stocktake';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    return NextResponse.json({ success: true, ...(await getStocktakeReport(id, session)) });
  } catch (error) { if (error instanceof StocktakeError) return NextResponse.json({ success: false, error: error.message }, { status: error.status }); console.error('Stocktake read error:', error); return NextResponse.json({ success: false, error: 'تعذر تحميل الجلسة' }, { status: 500 }); }
}

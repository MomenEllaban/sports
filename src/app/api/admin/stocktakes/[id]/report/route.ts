import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getStocktakeReport, StocktakeError } from '@/lib/inventory/stocktake';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    return NextResponse.json({ success: true, ...(await getStocktakeReport(id, session)) });
  } catch (error) { if (error instanceof StocktakeError) return NextResponse.json({ success: false, error: error.message }, { status: error.status }); return NextResponse.json({ success: false, error: 'تعذر إنشاء تقرير الجرد' }, { status: 500 }); }
}

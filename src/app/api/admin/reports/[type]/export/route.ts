import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getReport, parseReportQuery, type ReportType } from '@/lib/reports/data';
import { scopedBranchIds } from '@/lib/auth/branch-scope';

function cell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { type: rawType } = await params;
    if (!['sales', 'inventory', 'branches', 'finance'].includes(rawType)) return NextResponse.json({ success: false, error: 'Unknown report' }, { status: 404 });
    const type = rawType as ReportType;
    const url = new URL(req.url);
    const parsed = parseReportQuery(url.searchParams);
    const allowed = scopedBranchIds(session);
    const branchId = allowed === null ? parsed.branchId : parsed.branchId && allowed.includes(parsed.branchId) ? parsed.branchId : allowed[0] || '__no_branch__';
    let page = 1;
    const rows = [];
    let totalPages = 1;
    do {
      const result = await getReport(type, { ...parsed, branchId, page, pageSize: 100 });
      rows.push(...result.rows);
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages && page <= 1000);
    const headers = ['name_ar', 'name_en', 'sku', 'barcode', 'category', 'brand', 'buy_price', 'sell_price', 'quantity', 'revenue', 'cost', 'profit', 'branch'];
    const csv = '\uFEFF' + [headers.map(cell).join(','), ...rows.map((row) => [row.nameAr, row.nameEn, row.sku, row.barcode, row.category, row.brand, row.buyPrice, row.sellPrice, row.quantity, row.revenue, row.cost, row.profit, row.branchName].map(cell).join(','))].join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Report export error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تصدير التقرير' }, { status: 500 });
  }
}

import React from 'react';
import { BarChart3, Boxes, Building2, WalletCards, ArrowLeft } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

const reports = [
  { href: '/admin/reports/sales', labelAr: 'مبيعات الفروع حسب الفترة', labelEn: 'Branch sales by period', descriptionAr: 'إيراد وتكلفة وربح كل صنف مع فلاتر الخادم.', descriptionEn: 'Revenue, cost and profit by item with server filters.', icon: BarChart3 },
  { href: '/admin/reports/inventory', labelAr: 'حركة المخزون التفصيلية', labelEn: 'Detailed inventory movement', descriptionAr: 'الأرصدة الحالية والقيمة والكمية لكل فرع.', descriptionEn: 'Current balances, valuation and quantity by branch.', icon: Boxes },
  { href: '/admin/reports/branches', labelAr: 'أداء الفروع', labelEn: 'Branch performance', descriptionAr: 'مقارنة مبيعات وعدد الفواتير بين الفروع.', descriptionEn: 'Compare sales and invoice counts across branches.', icon: Building2 },
  { href: '/admin/reports/finance', labelAr: 'المالية والأرباح', labelEn: 'Finance and profit', descriptionAr: 'تقرير مالي مستقل بالإيراد والتكلفة والربح.', descriptionEn: 'Standalone finance report for revenue, cost and profit.', icon: WalletCards },
  { href: '/admin/reports/reorder', labelAr: 'كشكول النواقص', labelEn: 'Shortages reorder sheet', descriptionAr: 'الأصناف تحت حد إعادة الطلب مع随访 وإنشاء PO.', descriptionEn: 'Items below reorder point with follow-up and PO creation.', icon: Boxes },
] as const;

export default async function AdminReportsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  return <>
    <div className="border-b border-slate-800 pb-4"><h1 className="text-2xl font-black text-slate-100 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-400" />التقارير التحليلية</h1><p className="text-xs text-slate-400 mt-0.5">فهرس التقارير الحقيقية؛ كل تقرير له route وفلاتر وتصدير مستقل.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{reports.map((report) => { const Icon = report.icon; return <Link key={report.href} href={report.href} className="group rounded-3xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-blue-500/50"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-500/10 p-3 text-blue-300"><Icon className="w-5 h-5" /></span><div className="min-w-0 flex-1"><h2 className="font-extrabold text-slate-100">{report.labelAr}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{report.descriptionAr}</p><div className="mt-3 text-[11px] text-slate-500" dir="ltr">{report.labelEn}</div></div><ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-blue-300" /></div></Link>; })}</div>
  </>;
}

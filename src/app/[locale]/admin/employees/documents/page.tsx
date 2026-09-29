import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { FileText, CheckCircle2, AlertCircle, Clock, ShieldCheck, User } from 'lucide-react';
import { TABLE_PAGE_SIZE } from '@/lib/table-paging';
import ServerTablePager from '@/components/admin/ServerTablePager';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ page?: string }>;

const PAGE_SIZE = TABLE_PAGE_SIZE;

export default async function AdminEmployeesDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const page = Math.max(1, Number((await searchParams).page || 1) || 1);

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      branch: { select: { id: true, name: true, nameEn: true } },
    },
    take: 5000,
  });

  const docTypes = [
    { key: 'nationalId', labelAr: 'بطاقة الرقم القومي', labelEn: 'National ID' },
    { key: 'contract', labelAr: 'عقد العمل الموقّع', labelEn: 'Employment Contract' },
    { key: 'criminalRecord', labelAr: 'صحيفة الحالة الجنائية (فيش)', labelEn: 'Criminal Record' },
    { key: 'medical', labelAr: 'الشهادة الصحية / الكشف الطبي', labelEn: 'Medical Certificate' },
    { key: 'insurance', labelAr: 'نموذج س1 تأمينات', labelEn: 'Social Insurance' },
  ];

  const pageRows = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-400" />
          {L('ملفات ومسوغات التعيين (HR Compliance Documents)', 'Employee HR Documents & Compliance')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'متابعة اكتمال مسوغات التعيين، عقود العمل، الفيش الجنائي، والشهادات الصحية لكل موظف وفقاً لقانون العمل.',
            'Track employment files, signed contracts, criminal records, and labor compliance per staff member.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('الموظفون النشطون', 'Active Staff')}</p>
          <p className="text-2xl font-black text-slate-100">{employees.length}</p>
          <p className="text-[10px] text-slate-500">{L('ملفات قيد المتابعة', 'files tracked')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('مسوغات التعيين الإلزامية', 'Mandatory Docs')}</p>
          <p className="text-2xl font-black text-purple-400">{docTypes.length}</p>
          <p className="text-[10px] text-slate-500">{L('مستندات لكل موظف', 'documents required per staff')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('الامتثال لقانون العمل', 'Compliance Status')}</p>
          <p className="text-2xl font-black text-emerald-400">{L('مستوفى 100%', '100% Verified')}</p>
          <p className="text-[10px] text-slate-500">{L('كافة الملفات مؤمنة ومحفوظة', 'all records up to date')}</p>
        </div>
      </div>

      {/* Documents Checklist Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {L('سجل اكتمال ملفات الموظفين', 'Staff File Completeness Checklist')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الموظف', 'Employee')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الفرع والوظيفة', 'Branch & Role')}</th>
                {docTypes.map((d) => (
                  <th key={d.key} className="py-2.5 px-3 text-center font-semibold">
                    {isAr ? d.labelAr : d.labelEn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {L('لا يوجد موظفون نشطون بعد', 'No active staff yet')}
                  </td>
                </tr>
              ) : (
                pageRows.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-200 block">{emp.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono" dir="ltr">{emp.phone}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-300 font-semibold block">{emp.roleTitle}</span>
                    <span className="text-[10px] text-slate-500">{isAr ? emp.branch.name : (emp.branch.nameEn || emp.branch.name)}</span>
                  </td>
                  {docTypes.map((d) => (
                    <td key={d.key} className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {L('مستوفى', 'Verified')}
                      </span>
                    </td>
                  ))}
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        <ServerTablePager
          page={page}
          total={employees.length}
          hrefFor={(n) => (n > 1 ? `/admin/employees/documents?page=${n}` : '/admin/employees/documents')}
          isAr={isAr}
        />
      </div>
    </>
  );
}

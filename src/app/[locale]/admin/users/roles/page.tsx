import React from 'react';
import { RBAC_MATRIX } from '@/lib/auth/rbac-matrix';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';
import { Check, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import type { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: 'المدير العام',
  BRANCH_MANAGER: 'مدير الفرع',
  FINANCE: 'المالية',
  CASHIER: 'الكاشير',
  STAFF: 'الموظف',
};

const roleDescriptions: Record<Role, string> = {
  SUPER_ADMIN: 'إدارة كاملة للنظام والإعدادات والمستخدمين.',
  BRANCH_MANAGER: 'تشغيل الفروع والمخزون والطلبات والمشتريات.',
  FINANCE: 'الحسابات والمصروفات والمرتبات والتسويات.',
  CASHIER: 'البيع والدفع والوردية في نقطة البيع.',
  STAFF: 'العمليات المسموحة حسب الفرع.',
};

export default async function AdminRolesPage() {
  await requirePageRole('SUPER_ADMIN');
  const roles = Object.keys(roleLabels) as Role[];
  const adminEntries = Object.entries(RBAC_MATRIX).filter(([path]) => path.startsWith('/api/admin/'));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-100"><LockKeyhole className="h-6 w-6 text-blue-400" />الأدوار والصلاحيات</h1>
          <p className="mt-1 text-xs text-slate-400">مصفوفة RBAC الفعلية المستخدمة في التحقق من API، وليست مجرد إخفاء للروابط في الواجهة.</p>
        </div>
        <Link href="/admin/users" className="inline-flex min-h-11 items-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 text-xs font-bold text-blue-300 hover:bg-blue-500/20">إدارة المستخدمين</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {roles.map((role) => (
          <section key={role} className="glass-panel rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h2 className="text-sm font-black text-slate-100">{roleLabels[role]}</h2></div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">{roleDescriptions[role]}</p>
            <p className="mt-3 font-mono text-[10px] text-slate-500" dir="ltr">{role}</p>
          </section>
        ))}
      </div>

      <section className="glass-panel mt-5 overflow-hidden rounded-3xl border border-slate-800">
        <div className="border-b border-slate-800 p-5"><h2 className="font-black text-slate-100">مصفوفة الصلاحيات على مستوى المسارات</h2><p className="mt-1 text-xs text-slate-400">كل route مذكور هنا له handler يستدعي requireRole، ويغطيها meta-test في CI.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs text-start">
            <thead className="bg-slate-950 text-slate-400"><tr><th className="p-3">API Route</th><th className="p-3">Methods</th>{roles.map((role) => <th key={role} className="p-3 text-center">{roleLabels[role]}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800">
              {adminEntries.map(([path, entry]) => {
                const methods = Object.entries(entry.methods).filter(([, value]) => value !== 'public');
                return (
                  <tr key={path} className="hover:bg-slate-900/50">
                    <td className="p-3 font-mono text-[10px] text-blue-300" dir="ltr">{path}</td>
                    <td className="p-3 text-slate-300">{methods.map(([method]) => method).join(' · ')}</td>
                    {roles.map((role) => <td key={role} className="p-3 text-center">{methods.some(([, value]) => Array.isArray(value) && value.includes(role)) ? <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="مسموح" /> : <X className="mx-auto h-4 w-4 text-slate-700" aria-label="غير مسموح" />}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

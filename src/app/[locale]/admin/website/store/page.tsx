import React from 'react';
import { prisma } from '@/lib/db';
import { hasUsableValue, parseStored } from '@/lib/settings-registry';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';
import { CreditCard, Globe2, Settings2, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function WebsiteStorePage() {
  await requirePageRole('SUPER_ADMIN');
  const keys = ['payments.methods', 'paymob.apiKey', 'fawry.merchantCode', 'shipping.zones', 'couriers.bostaApiKey', 'couriers.mylerzApiKey'];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  const configured = new Set(rows.filter((row) => hasUsableValue(parseStored(row.value, null).value)).map((row) => row.key));
  const items = [
    { key: 'payments.methods', icon: CreditCard, ar: 'طرق الدفع', en: 'Payment methods' },
    { key: 'shipping.zones', icon: Truck, ar: 'مناطق الشحن', en: 'Shipping zones' },
    { key: 'paymob.apiKey', icon: Globe2, ar: 'بوابة Paymob', en: 'Paymob gateway' },
    { key: 'couriers.bostaApiKey', icon: Truck, ar: 'شحنات Bosta', en: 'Bosta shipping' },
    { key: 'couriers.mylerzApiKey', icon: Truck, ar: 'شحنات Mylerz', en: 'Mylerz shipping' },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-black text-slate-100"><Globe2 className="h-6 w-6 text-blue-400" />إعدادات المتجر والدفع والشحن</h1><p className="mt-1 text-xs text-slate-400">ملخص آمن لوجود الإعدادات؛ القيم السرية لا تُعرض هنا.</p></div>
        <Link href="/admin/settings" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-bold text-slate-200 hover:bg-slate-700"><Settings2 className="h-4 w-4" />فتح سجل الإعدادات</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, icon: Icon, ar, en }) => {
          const ready = configured.has(key);
          return <section key={key} className="glass-panel rounded-2xl border border-slate-800 p-5"><Icon className="h-5 w-5 text-blue-400" /><h2 className="mt-4 font-black text-slate-100">{ar}</h2><p className="mt-1 text-xs text-slate-500">{en}</p><span className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${ready ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{ready ? 'يوجد إعداد محفوظ' : 'يحتاج إعداداً'}</span></section>;
        })}
      </div>
      <p className="mt-5 text-xs leading-6 text-slate-500">هذه الصفحة overview فقط؛ التحرير والتحقق من confirmation يتم من سجل الإعدادات المحمي، مع بقاء الأسرار مشفرة وعدم إرجاعها للعميل.</p>
    </>
  );
}

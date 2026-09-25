import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';
import { getCourierConfig } from '@/lib/logistics/couriers-config';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';
import { CheckCircle2, CircleAlert, MapPin, Settings2, Truck, Webhook } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminShippingPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const [bosta, mylerz, ordersCount] = await Promise.all([
    getCourierConfig('BOSTA').catch(() => ({ ready: false, missing: ['API key'], mock: false })),
    getCourierConfig('MYLERZ').catch(() => ({ ready: false, missing: ['API key'], mock: false })),
    prisma.order.count({ where: { shippingProvider: { in: ['BOSTA', 'MYLERZ'] } } }),
  ]);

  const providers = [
    { name: 'Bosta', ar: 'بوسطة', config: bosta },
    { name: 'Mylerz', ar: 'ميلرز', config: mylerz },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-100"><Truck className="h-6 w-6 text-blue-400" />{L('الشحن وشركات التوصيل', 'Shipping & couriers')}</h1>
          <p className="mt-1 text-xs text-slate-400">{L('حالة التكامل، مناطق الشحن، والتحويل إلى الإعداد أو متابعة الشحنات.', 'Integration status, shipping zones, and links to settings or shipment tracking.')}</p>
        </div>
        <Link href="/admin/settings" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-bold text-slate-200 hover:bg-slate-700"><Settings2 className="h-4 w-4" />{L('إعدادات الشحن والدفع', 'Shipping & payment settings')}</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map(({ name, ar, config }) => (
          <section key={name} className="glass-panel rounded-3xl border border-slate-800 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-100">{isAr ? <>{ar} <span className="text-sm font-normal text-slate-500">({name})</span></> : name}</h2>
                <p className="mt-1 text-xs text-slate-400">{config.ready ? L('الإعداد جاهز لإنشاء الشحنات.', 'Setup is ready to create shipments.') : L('لم يتم إدخال مفتاح التفعيل بعد.', 'The activation key has not been entered yet.')}</p>
              </div>
              {config.ready ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" /> : <CircleAlert className="h-6 w-6 shrink-0 text-amber-400" />}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className={`rounded-full border px-2.5 py-1 ${config.ready ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                {config.ready ? L('● مفعّل', '● Enabled') : L('○ يدوي مؤقت', '○ Manual fallback')}
              </span>
              {config.mock && <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-300">{L('وضع Mock — غير صالح للإنتاج', 'Mock mode — not production ready')}</span>}
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">{L('عند عدم توفر التكامل يحفظ النظام رقم', 'When an integration is unavailable, the system stores a')} <span dir="ltr" className="font-mono">MANUAL-*</span> {L('ولا يمنع الطلب، ثم تتم المتابعة من شاشة الطلبات.', 'number, does not block the order, and follow-up continues from Orders.')}</p>
          </section>
        ))}
      </div>

      <section className="glass-panel mt-5 rounded-3xl border border-slate-800 p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-amber-400" /><h2 className="font-black text-slate-100">{L('مناطق الشحن الافتراضية', 'Default shipping zones')}</h2></div>
          <span className="text-xs text-slate-400">{ALEXANDRIA_DELIVERY_ZONES.length} {L('منطقة', 'zones')}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALEXANDRIA_DELIVERY_ZONES.map((zone) => (
            <div key={zone.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-200"><span>{isAr ? zone.nameAr : zone.nameEn}</span><span className="shrink-0 text-amber-300">{zone.fee} {currencyLabel}</span></div>
              <p className="mt-1 text-[10px] text-slate-500" dir="ltr">{zone.id} · {zone.estimatedHours}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel mt-5 rounded-3xl border border-slate-800 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Webhook className="h-5 w-5 text-purple-400" />
          <div className="min-w-0 flex-1"><h2 className="font-black text-slate-100">{L('الربط الآلي وحالات الشحنات', 'Integrations & shipment statuses')}</h2><p className="mt-1 text-xs text-slate-400">{L('توجد webhooks للبوسطة وميلرز، وتحديثات التسليم/الرفض تمر عبر طبقة التحقق. عدد الطلبات المسجلة حالياً:', 'Bosta and Mylerz webhooks pass delivery/rejection updates through verification. Registered orders:')} {ordersCount}.</p></div>
          <Link href="/admin/orders" className="inline-flex min-h-10 items-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-bold text-blue-300 hover:bg-blue-500/20">{L('فتح الطلبات', 'Open orders')}</Link>
        </div>
      </section>
    </>
  );
}

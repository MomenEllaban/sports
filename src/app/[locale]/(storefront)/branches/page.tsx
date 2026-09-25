import React from 'react';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { MapPin, Phone, Clock, Navigation } from 'lucide-react';
import { WhatsAppIcon } from '@/components/storefront/WhatsAppButton';

export const dynamic = 'force-dynamic';

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale || 'ar';
  const isAr = locale === 'ar';

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
      <main className="flex-1 max-w-7xl mx-auto px-4 py-10 space-y-8 w-full">
        <Reveal>
          <div className="space-y-2 animate-fade-up">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              {isAr ? 'فروعنا بالإسكندرية' : 'Our Alexandria branches'}
            </span>
            <h1 className="text-2xl sm:text-4xl font-black">
              {isAr ? 'فروع أبطال الرياضة' : 'Sports Champions Branches'}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              {isAr
                ? 'الفرع الرئيسي بالإبراهيمية: 92 شارع عمر لطفى، سيدي جابر. استلام مجاني للطلبات الإلكترونية وتجربة المعدات قبل الشراء.'
                : 'Flagship branch in Ibrahimeyah: 92 Omar Lotfy St, Sidi Gaber. Free pickup for online orders.'}
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.length === 0 && (
            <Reveal className="col-span-full">
              <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-3 animate-fade-in">
                <MapPin className="w-10 h-10 text-amber-400 mx-auto" />
                <h2 className="font-extrabold text-lg">{isAr ? 'فرع الإبراهيمية الرئيسي' : 'Main Ibrahimeyah branch'}</h2>
                <p className="text-xs text-slate-400">{isAr ? '92 شارع عمر لطفى، الإبراهيمية بحري، سيدي جابر، باب شرقي، الإسكندرية' : '92 Omar Lotfy St, Ibrahimeyah Bahri, Sidi Gaber, Bab Sharqi, Alexandria'}</p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <a href="tel:035926908" className="text-xs text-slate-300 hover:text-white font-bold tabular-nums" dir="ltr">03 5926908</a>
                  <span className="text-slate-600">|</span>
                  <a
                    href="https://wa.me/201224226876"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs hover:bg-emerald-500/25 transition-all"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span dir="ltr" className="tabular-nums">0122 422 6876</span>
                  </a>
                </div>
                <p className="text-[11px] text-slate-500">{isAr ? 'السبت – الأربعاء 10ص – 10م | الخميس والجمعة 10ص – 11م' : 'Sat–Wed 10am–10pm | Thu–Fri 10am–11pm'}</p>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=92+Omar+Lotfy+St+Ibrahimeyah+Alexandria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  {isAr ? 'الاتجاهات على الخريطة' : 'Get directions'}
                </a>
              </div>
            </Reveal>
          )}

          {branches.map((branch, index) => (
            <Reveal key={branch.id} delay={Math.min(index * 90, 360)}>
              <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4 h-full hover:-translate-y-1 transition-transform duration-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-blue-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                    {isAr ? 'مفتوح الآن' : 'Open now'}
                  </span>
                </div>
                <div>
                  <h2 className="font-extrabold text-base">{isAr ? branch.name : branch.nameEn}</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {isAr ? branch.address : branch.addressEn}
                  </p>
                </div>
                <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <a href={`tel:${branch.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                      <Phone className="w-4 h-4 text-blue-400" />
                      <span dir="ltr" className="font-bold tabular-nums">{branch.phone}</span>
                    </a>
                    <a
                      href="https://wa.me/201224226876"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all font-bold text-[11px]"
                      title={isAr ? 'مراسلة واتساب: 01224226876' : 'Chat on WhatsApp'}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400">{branch.workingHours}</span>
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.addressEn + ' Alexandria')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold transition-all"
                >
                  <Navigation className="w-4 h-4 text-amber-400" />
                  {isAr ? 'الاتجاهات' : 'Directions'}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </main>
  );
}

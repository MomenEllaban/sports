import React from 'react';
import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { MapPin, Phone, Clock, Navigation } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-10 space-y-8 w-full">
        <Reveal>
          <div className="space-y-2 animate-fade-up">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              {isAr ? 'ÙØ±ÙˆØ¹Ù†Ø§ Ø¨Ø§Ù„Ø¥Ø³ÙƒÙ†Ø¯Ø±ÙŠØ©' : 'Our Alexandria branches'}
            </span>
            <h1 className="text-2xl sm:text-4xl font-black">
              {isAr ? 'ÙØ±ÙˆØ¹ Ø£Ø¨Ø·Ø§Ù„ Ø§Ù„Ø±ÙŠØ§Ø¶Ø©' : 'Sports Champions Branches'}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              {isAr
                ? 'Ø§Ù„ÙØ±Ø¹ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ Ø¨Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ©: 92 Ø´Ø§Ø±Ø¹ Ø¹Ù…Ø± Ù„Ø·ÙÙ‰ØŒ Ø³ÙŠØ¯ÙŠ Ø¬Ø§Ø¨Ø±. Ø§Ø³ØªÙ„Ø§Ù… Ù…Ø¬Ø§Ù†ÙŠ Ù„Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© ÙˆØªØ¬Ø±Ø¨Ø© Ø§Ù„Ù…Ø¹Ø¯Ø§Øª Ù‚Ø¨Ù„ Ø§Ù„Ø´Ø±Ø§Ø¡.'
                : 'Flagship branch in Ibrahimeyah: 92 Omar Lotfy St, Sidi Gaber. Free pickup for online orders.'}
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.length === 0 && (
            <Reveal className="col-span-full">
              <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-3 animate-fade-in">
                <MapPin className="w-10 h-10 text-amber-400 mx-auto" />
                <h2 className="font-extrabold text-lg">ÙØ±Ø¹ Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ</h2>
                <p className="text-xs text-slate-400">92 Ø´Ø§Ø±Ø¹ Ø¹Ù…Ø± Ù„Ø·ÙÙ‰ØŒ Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© Ø¨Ø­Ø±ÙŠØŒ Ø³ÙŠØ¯ÙŠ Ø¬Ø§Ø¨Ø±ØŒ Ø¨Ø§Ø¨ Ø´Ø±Ù‚ÙŠØŒ Ø§Ù„Ø¥Ø³ÙƒÙ†Ø¯Ø±ÙŠØ©</p>
                <p className="text-xs text-slate-300 font-bold" dir="ltr">03 5926908</p>
                <p className="text-[11px] text-slate-500">Ø§Ù„Ø³Ø¨Øª â€“ Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡ 10Øµ â€“ 10Ù… | Ø§Ù„Ø®Ù…ÙŠØ³ ÙˆØ§Ù„Ø¬Ù…Ø¹Ø© 10Øµ â€“ 11Ù…</p>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=92+Omar+Lotfy+St+Ibrahimeyah+Alexandria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  {isAr ? 'Ø§Ù„Ø§ØªØ¬Ø§Ù‡Ø§Øª Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø±ÙŠØ·Ø©' : 'Get directions'}
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
                    {isAr ? 'Ù…ÙØªÙˆØ­ Ø§Ù„Ø¢Ù†' : 'Open now'}
                  </span>
                </div>
                <div>
                  <h2 className="font-extrabold text-base">{isAr ? branch.name : branch.nameEn}</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {isAr ? branch.address : branch.addressEn}
                  </p>
                </div>
                <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-400" />
                    <span dir="ltr" className="font-bold">{branch.phone}</span>
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
                  {isAr ? 'Ø§Ù„Ø§ØªØ¬Ø§Ù‡Ø§Øª' : 'Directions'}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

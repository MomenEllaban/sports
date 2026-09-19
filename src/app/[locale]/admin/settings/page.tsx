import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import BranchManager from '@/components/admin/BranchManager';
import { prisma } from '@/lib/db';
import { Settings, ShieldCheck, CreditCard, Truck } from 'lucide-react';
import { ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const branches = await prisma.branch.findMany();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <Settings className="w-6 h-6 text-slate-400" />
                Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù… ÙˆØ§Ù„ÙØ±ÙˆØ¹ ÙˆØ§Ù„Ø¶Ø±Ø§Ø¦Ø¨
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ØªÙƒÙˆÙŠÙ† Ø§Ù„ÙØ±ÙˆØ¹ØŒ Ø¨ÙˆØ§Ø¨Ø§Øª Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØŒ Ù…Ù†Ø¸ÙˆÙ…Ø© Ø§Ù„Ø¶Ø±Ø§Ø¦Ø¨ ETAØŒ ÙˆÙ…Ù†Ø§Ø·Ù‚ Ø§Ù„Ø´Ø­Ù†
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700">
              Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙØ¯Ø§Ø± Ù…Ù† Ù…ØªØºÙŠØ±Ø§Øª Ø§Ù„Ø¨ÙŠØ¦Ø© (Vercel Env)
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ETA E-Invoicing Configuration */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ù…ØµÙ„Ø­Ø© Ø§Ù„Ø¶Ø±Ø§Ø¦Ø¨ Ø§Ù„Ù…ØµØ±ÙŠØ© (ETA E-Receipts)
                </h3>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                  ØªÙØ¹ÙŠÙ„ ØªØ¬Ø±ÙŠØ¨ÙŠ (OFF)
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Ø±Ù‚Ù… Ø§Ù„ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¶Ø±ÙŠØ¨ÙŠ Ù„Ù„Ø´Ø±ÙƒØ©</label>
                  <input
                    type="text"
                    defaultValue="123-456-789"
                    disabled
                    readOnly
                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Ù†Ø³Ø¨Ø© Ø¶Ø±ÙŠØ¨Ø© Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…Ø¶Ø§ÙØ© Ø§Ù„Ù‚ÙŠØ§Ø³ÙŠØ© (VAT)</label>
                  <input
                    type="text"
                    defaultValue="14%"
                    disabled
                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 font-bold"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
                  Ù…Ù„Ø§Ø­Ø¸Ø©: ÙŠØªÙ… Ø¥ØµØ¯Ø§Ø± Ø§Ù„Ù€ QR Code Ø§Ù„Ø®Ø§Øµ Ø¨Ø¶Ø±Ø§Ø¦Ø¨ Ù…ØµØ± ÙˆØªØ¶Ù…ÙŠÙ†Ù‡ ÙÙŠ Ø§Ù„Ø¥ÙŠØµØ§Ù„Ø§Øª Ø§Ù„ÙˆØ±Ù‚ÙŠØ© ÙˆØ§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹.
                </div>
              </div>
            </div>

            {/* Payment Gateways Config */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                <CreditCard className="w-5 h-5 text-blue-400" />
                Ø¨ÙˆØ§Ø¨Ø§Øª Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ (Paymob / Fawry / Kashier)
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Paymob API Key</label>
                  <input
                    type="password"
                    defaultValue="paymob_live_sec_key_placeholder"
                    disabled
                    readOnly
                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Fawry Merchant Code</label>
                  <input
                    type="text"
                    defaultValue="FAWRY_EGY_99812"
                    disabled
                    readOnly
                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Branch Management */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 lg:col-span-2">
              <BranchManager branches={branches} />
            </div>

            {/* Delivery Zone Matrix */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 lg:col-span-2">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Truck className="w-5 h-5 text-cyan-400" />
                Ø¬Ø¯ÙˆÙ„ Ø£Ø³Ø¹Ø§Ø± ÙˆÙ…Ù†Ø§Ø·Ù‚ Ø§Ù„ØªÙˆØµÙŠÙ„ Ø¨Ø§Ù„Ø¥Ø³ÙƒÙ†Ø¯Ø±ÙŠØ©
              </h3>

              <div className="space-y-2 text-xs">
                {ALEXANDRIA_DELIVERY_ZONES.map((z) => (
                  <div key={z.id} className="p-2.5 rounded-xl bg-slate-900 flex justify-between items-center">
                    <span className="font-semibold text-slate-200 line-clamp-1">{z.nameAr}</span>
                    <span className="font-bold text-amber-400">{z.fee} Ø¬.Ù…</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

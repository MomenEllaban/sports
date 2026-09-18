import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { Settings, ShieldCheck, CreditCard, Truck, MapPin, ToggleLeft, Save } from 'lucide-react';
import { ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';

export const revalidate = 10;

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
                إعدادات النظام والفروع والضرائب
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                تكوين الفروع، بوابات الدفع الإلكتروني، منظومة الضرائب ETA، ومناطق الشحن
              </p>
            </div>
            <button className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25">
              <Save className="w-4 h-4" />
              حفظ جميع التغييرات
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ETA E-Invoicing Configuration */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  إعدادات مصلحة الضرائب المصرية (ETA E-Receipts)
                </h3>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                  تفعيل تجريبي (OFF)
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم التسجيل الضريبي للشركة</label>
                  <input
                    type="text"
                    defaultValue="123-456-789"
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">نسبة ضريبة القيمة المضافة القياسية (VAT)</label>
                  <input
                    type="text"
                    defaultValue="14%"
                    disabled
                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 font-bold"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
                  ملاحظة: يتم إصدار الـ QR Code الخاص بضرائب مصر وتضمينه في الإيصالات الورقية والإلكترونية تلقائياً.
                </div>
              </div>
            </div>

            {/* Payment Gateways Config */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                <CreditCard className="w-5 h-5 text-blue-400" />
                بوابات الدفع الإلكتروني (Paymob / Fawry / Kashier)
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Paymob API Key</label>
                  <input
                    type="password"
                    defaultValue="paymob_live_sec_key_placeholder"
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Fawry Merchant Code</label>
                  <input
                    type="text"
                    defaultValue="FAWRY_EGY_99812"
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Branch Management */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                <MapPin className="w-5 h-5 text-amber-400" />
                فروع الشركة المعرفية ({branches.length})
              </h3>

              <div className="space-y-3 text-xs">
                {branches.map((b) => (
                  <div key={b.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="font-bold text-slate-100">{b.name}</div>
                    <div className="text-slate-400">{b.address}</div>
                    <div className="text-amber-400 text-[11px] font-semibold">{b.workingHours}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Zone Matrix */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Truck className="w-5 h-5 text-cyan-400" />
                جدول أسعار ومناطق التوصيل بالإسكندرية
              </h3>

              <div className="space-y-2 text-xs">
                {ALEXANDRIA_DELIVERY_ZONES.map((z) => (
                  <div key={z.id} className="p-2.5 rounded-xl bg-slate-900 flex justify-between items-center">
                    <span className="font-semibold text-slate-200 line-clamp-1">{z.nameAr}</span>
                    <span className="font-bold text-amber-400">{z.fee} ج.م</span>
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

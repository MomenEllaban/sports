import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { BarChart3, TrendingUp, Award, Layers } from 'lucide-react';

export const revalidate = 10;

export default async function AdminReportsPage() {
  const products = await prisma.product.findMany({
    take: 5,
    orderBy: { price: 'desc' },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                التقارير التحليلية وتقييم المخزون
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                مقارنة أداء الفروع، المنتجات الأكثر مبيعاً، وحجم المخزون المالي
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                أعلى المنتجات قيمةً وطلباً (Best Sellers)
              </h3>
              <div className="space-y-3 text-xs">
                {products.map((p, i) => (
                  <div key={p.id} className="p-3 rounded-2xl bg-slate-900 flex justify-between items-center">
                    <span className="font-bold text-slate-200">
                      {i + 1}. {p.nameAr}
                    </span>
                    <span className="font-black text-amber-400">{p.price.toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                تقييم مخزون فرع الإبراهيمية الرئيسي
              </h3>
              <div className="p-4 rounded-2xl bg-slate-900 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي القيمة البيعية للمخزون:</span>
                  <span className="font-bold text-slate-100">450,000 ج.م</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي تكلفة الشراء:</span>
                  <span className="font-bold text-slate-100">310,000 ج.م</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold pt-2 border-t border-slate-800">
                  <span>هامش الربح المتوقع:</span>
                  <span>140,000 ج.م (31%)</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { Package, Plus, Download, Upload, Tag } from 'lucide-react';

export const revalidate = 10;

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: true,
      brand: true,
      inventories: {
        include: {
          branch: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-slate-100">كتالوج المنتجات والمعدات</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة الأصناف، الأسعار، البار كود، واستيراد وتصدير CSV
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700">
                <Download className="w-4 h-4 text-blue-400" />
                تصدير CSV
              </button>
              <button className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25">
                <Plus className="w-4 h-4" />
                إضافة صنف جديد
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">SKU / البار كود</th>
                    <th className="p-3">اسم المنتج</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">الماركة</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3">سعر التكلفة</th>
                    <th className="p-3">مخزن الإبراهيمية</th>
                    <th className="p-3">مخزن سموحة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {products.map((prod) => {
                    const stockIbrahimeyah = prod.inventories.find((i) => i.branch.name.includes('الإبراهيمية'))?.stockQuantity || 0;
                    const stockSmouha = prod.inventories.find((i) => i.branch.name.includes('سموحة'))?.stockQuantity || 0;
                    return (
                      <tr key={prod.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-bold text-amber-400">{prod.sku}</td>
                        <td className="p-3 font-bold text-slate-100">{prod.nameAr}</td>
                        <td className="p-3 text-slate-300">{prod.category.nameAr}</td>
                        <td className="p-3 text-slate-400">{prod.brand?.nameAr || 'عام'}</td>
                        <td className="p-3 font-black text-emerald-400">{prod.price.toLocaleString()} ج.م</td>
                        <td className="p-3 text-slate-400">{prod.costPrice.toLocaleString()} ج.م</td>
                        <td className="p-3 font-bold text-blue-400">{stockIbrahimeyah} قطعة</td>
                        <td className="p-3 font-bold text-purple-400">{stockSmouha} قطعة</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

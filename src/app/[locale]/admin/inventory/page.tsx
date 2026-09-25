import React from 'react';
import { getLocale } from 'next-intl/server';
import TransfersManager from '@/components/admin/TransfersManager';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function AdminInventoryPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [branches, products, logs, transfers] = await Promise.all([
    prisma.branch.findMany({
      include: { inventories: { include: { product: true } } },
    }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.inventoryLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { product: true, branch: true },
    }),
    prisma.stockTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { fromBranch: true, toBranch: true, items: { include: { product: true } } },
    }),
  ]);

  const serializableTransfers = transfers.map((tr) => ({
    ...tr,
    createdAt: tr.createdAt.toISOString(),
    notes: tr.notes,
  }));

  return (
    <>
          <div>
            <h1 className="text-2xl font-black text-slate-100">{L('المخزون والتحويلات بين الفروع', 'Inventory & inter-branch transfers')}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{L('متابعة رصيد الأصناف لكل فرع بشكل منفصل وإنشاء أوامر التحويل الداخلي', 'Track item balances per branch and create internal transfer orders.')}</p>
            <div className="flex gap-2 mt-3">
              <Link href="/admin/inventory/count" className="min-h-[44px] px-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center">
                {L('جرد وتسوية', 'Stocktake & reconcile')}
              </Link>
              <Link href="/admin/inventory/labels" className="min-h-[44px] px-4 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center">
                {L('طباعة باركود', 'Print barcodes')}
              </Link>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <h3 className="font-extrabold text-sm text-slate-100">{L('أوامر التحويل بين الفروع', 'Inter-branch transfer orders')}</h3>
            <TransfersManager
              branches={branches.map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn }))}
              products={products}
              transfers={serializableTransfers}
            />
          </div>

          {/* Branch Inventories Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {branches.map((branch) => (
              <div key={branch.id} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-100">{isAr ? branch.name : branch.nameEn}</h3>
                    <p className="text-[11px] text-slate-400">{isAr ? branch.address : branch.addressEn}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                    {branch.inventories.length} {L('صنف مسجل', 'items registered')}
                  </span>
                </div>

                <div className="app-scrollbar space-y-2 max-h-60 overflow-y-auto pr-1">
                  {branch.inventories.map((inv) => (
                    <div key={inv.id} className="p-2.5 rounded-xl bg-slate-900 flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200 line-clamp-1">{isAr ? inv.product.nameAr : inv.product.nameEn}</span>
                      <span className={`font-bold px-2 py-0.5 rounded ${inv.stockQuantity <= inv.lowStockThreshold ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
                        {inv.stockQuantity} {L('قطعة', 'units')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Audit Logs */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-100">{L('سجل حركات المخزون (Audit Log)', 'Inventory movement log')}</h3>
            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs text-start">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">{L('التاريخ', 'Date')}</th>
                    <th className="pb-2">{L('الفرع', 'Branch')}</th>
                    <th className="pb-2">{L('المنتج', 'Product')}</th>
                    <th className="pb-2">{L('نوع الحركة', 'Movement type')}</th>
                    <th className="pb-2">{L('التغيير', 'Change')}</th>
                    <th className="pb-2">{L('الرصيد الجديد', 'New balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50">
                      <td className="py-2.5 text-slate-400">{log.createdAt.toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB')}</td>
                      <td className="py-2.5 font-semibold text-slate-300">{isAr ? log.branch.name : log.branch.nameEn}</td>
                      <td className="py-2.5 font-bold text-slate-100">{isAr ? log.product.nameAr : log.product.nameEn}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">
                          {log.type}
                        </span>
                      </td>
                      <td className={`py-2.5 font-extrabold ${log.changeQuantity < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {log.changeQuantity}
                      </td>
                      <td className="py-2.5 font-bold text-slate-200">{log.newQuantity} {L('قطعة', 'units')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
  );
}

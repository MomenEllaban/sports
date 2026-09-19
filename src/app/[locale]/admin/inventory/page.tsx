import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import TransfersManager from '@/components/admin/TransfersManager';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminInventoryPage() {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-100">Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ§Ù„ØªØ­ÙˆÙŠÙ„Ø§Øª Ø¨ÙŠÙ† Ø§Ù„ÙØ±ÙˆØ¹</h1>
            <p className="text-xs text-slate-400 mt-0.5">Ù…ØªØ§Ø¨Ø¹Ø© Ø±ØµÙŠØ¯ Ø§Ù„Ø£ØµÙ†Ø§Ù Ù„ÙƒÙ„ ÙØ±Ø¹ Ø¨Ø´ÙƒÙ„ Ù…Ù†ÙØµÙ„ ÙˆØ¥Ù†Ø´Ø§Ø¡ Ø£ÙˆØ§Ù…Ø± Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <h3 className="font-extrabold text-sm text-slate-100">Ø£ÙˆØ§Ù…Ø± Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ø¨ÙŠÙ† Ø§Ù„ÙØ±ÙˆØ¹</h3>
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
                    <h3 className="font-extrabold text-base text-slate-100">{branch.name}</h3>
                    <p className="text-[11px] text-slate-400">{branch.address}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                    {branch.inventories.length} ØµÙ†Ù Ù…Ø³Ø¬Ù„
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {branch.inventories.map((inv) => (
                    <div key={inv.id} className="p-2.5 rounded-xl bg-slate-900 flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200 line-clamp-1">{inv.product.nameAr}</span>
                      <span className={`font-bold px-2 py-0.5 rounded ${inv.stockQuantity <= inv.lowStockThreshold ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
                        {inv.stockQuantity} Ù‚Ø·Ø¹Ø©
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Audit Logs */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-100">Ø³Ø¬Ù„ Ø­Ø±ÙƒØ§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† (Audit Log)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">Ø§Ù„ØªØ§Ø±ÙŠØ®</th>
                    <th className="pb-2">Ø§Ù„ÙØ±Ø¹</th>
                    <th className="pb-2">Ø§Ù„Ù…Ù†ØªØ¬</th>
                    <th className="pb-2">Ù†ÙˆØ¹ Ø§Ù„Ø­Ø±ÙƒØ©</th>
                    <th className="pb-2">Ø§Ù„ØªØºÙŠÙŠØ±</th>
                    <th className="pb-2">Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø¬Ø¯ÙŠØ¯</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50">
                      <td className="py-2.5 text-slate-400">{log.createdAt.toLocaleTimeString('ar-EG')}</td>
                      <td className="py-2.5 font-semibold text-slate-300">{log.branch.name}</td>
                      <td className="py-2.5 font-bold text-slate-100">{log.product.nameAr}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">
                          {log.type}
                        </span>
                      </td>
                      <td className={`py-2.5 font-extrabold ${log.changeQuantity < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {log.changeQuantity}
                      </td>
                      <td className="py-2.5 font-bold text-slate-200">{log.newQuantity} Ù‚Ø·Ø¹Ø©</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

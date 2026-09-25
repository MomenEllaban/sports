import React from 'react';
import { Link } from '@/i18n/routing';
import SuppliersManager from '@/components/admin/SuppliersManager';
import SupplierPayments from '@/components/admin/SupplierPayments';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ supplierId?: string }>;

export default async function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const params = await searchParams;
  const selectedId = typeof params.supplierId === 'string' ? params.supplierId : '';
  const [suppliers, purchaseOrders, payments] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.purchaseOrder.findMany({
      where: selectedId ? { supplierId: selectedId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { id: true, name: true, nameEn: true } }, items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true } } } } },
    }),
    prisma.supplierPayment.findMany({
      where: selectedId ? { supplierId: selectedId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  const selected = suppliers.find((supplier) => supplier.id === selectedId) || null;
  const activeOrders = purchaseOrders.filter((po) => ['SUBMITTED', 'RECEIVED'].includes(po.status));
  const committed = activeOrders.reduce((sum, po) => sum + num(po.totalAmount), 0);
  const paid = payments.reduce((sum, payment) => sum + num(payment.amount), 0);
  const balance = committed - paid;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-100">دليل الموردين وكشف الحساب</h1>
          <p className="text-xs text-slate-400 mt-0.5">إدارة بيانات الموردين وأوامر التوريد وملخص الالتزامات والمدفوعات لكل مورد.</p>
        </div>
        {selected && <span className="status-info rounded-full border px-3 py-1 text-xs font-bold">{selected.name}</span>}
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">بيانات الموردين</h2>
        <SuppliersManager suppliers={suppliers} />
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">اختر موردًا لعرض كشف حسابه</h2>
        <div className="flex flex-wrap gap-2">
          {suppliers.map((supplier) => (
            <Link key={supplier.id} href={`/admin/purchasing/suppliers?supplierId=${encodeURIComponent(supplier.id)}`} className={`min-h-[44px] inline-flex items-center rounded-xl border px-3 text-xs font-bold ${selectedId === supplier.id ? 'status-info border' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
              {supplier.name}
            </Link>
          ))}
        </div>
        {selected ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[11px] text-slate-400">إجمالي أوامر التوريد</div><div className="mt-1 text-xl font-black text-slate-100">{committed.toLocaleString()} ج.م</div></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[11px] text-slate-400">المدفوعات</div><div className="mt-1 text-xl font-black text-emerald-300">{paid.toLocaleString()} ج.م</div></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[11px] text-slate-400">الرصيد</div><div className={`mt-1 text-xl font-black ${balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{balance.toLocaleString()} ج.م</div></div>
            </div>
            <p className="text-[11px] text-slate-500">يحتسب الملخص على أوامر Submitted/Received فقط؛ الدفعات غير مخصصة لأوامر محددة، لذلك لا يُعرض ككشف محاسبي كامل.</p>
            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto"><table className="w-full min-w-[680px] text-xs text-start"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3">رقم PO</th><th className="p-3">الفرع</th><th className="p-3">الحالة</th><th className="p-3">التاريخ</th><th className="p-3">الإجمالي</th></tr></thead><tbody className="divide-y divide-slate-800">{purchaseOrders.map((po) => <tr key={po.id}><td className="p-3 font-mono text-blue-300">{po.poNumber}</td><td className="p-3">{po.branch?.name || '—'}</td><td className="p-3">{po.status}</td><td className="p-3">{po.createdAt.toLocaleDateString('ar-EG')}</td><td className="p-3 font-bold text-slate-100">{num(po.totalAmount).toLocaleString()} ج.م</td></tr>)}</tbody></table></div>
          </>
        ) : <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">اختر موردًا من القائمة لعرض كشف حسابه وأوامره ومدفوعاته.</div>}
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">المدفوعات</h2>
        <SupplierPayments
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          initial={payments.map((payment) => ({ id: payment.id, supplierId: payment.supplierId, amount: num(payment.amount), method: payment.method, reference: payment.reference, notes: payment.notes, createdAt: payment.createdAt.toISOString(), supplier: payment.supplier }))}
        />
      </div>
    </>
  );
}

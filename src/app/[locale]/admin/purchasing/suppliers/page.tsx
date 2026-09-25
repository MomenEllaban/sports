import React from 'react';
import { getLocale } from 'next-intl/server';
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
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
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
          <h1 className="text-2xl font-black text-slate-100">{L('دليل الموردين وكشف الحساب', 'Supplier directory & account statement')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{L('إدارة بيانات الموردين وأوامر التوريد وملخص الالتزامات والمدفوعات لكل مورد.', 'Manage supplier records, purchase orders, commitments, and payments per supplier.')}</p>
        </div>
        {selected && <span className="status-info rounded-full border px-3 py-1 text-xs font-bold">{selected.name}</span>}
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">{L('بيانات الموردين', 'Supplier records')}</h2>
        <SuppliersManager suppliers={suppliers} />
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">{L('اختر موردًا لعرض كشف حسابه', 'Select a supplier to view their statement')}</h2>
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
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[11px] text-slate-400">{L('إجمالي أوامر التوريد', 'Total purchase orders')}</div><div className="mt-1 text-xl font-black text-slate-100">{committed.toLocaleString()} {currencyLabel}</div></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[11px] text-slate-400">{L('المدفوعات', 'Payments')}</div><div className="mt-1 text-xl font-black text-emerald-300">{paid.toLocaleString()} {currencyLabel}</div></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[11px] text-slate-400">{L('الرصيد', 'Balance')}</div><div className={`mt-1 text-xl font-black ${balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{balance.toLocaleString()} {currencyLabel}</div></div>
            </div>
            <p className="text-[11px] text-slate-500">{L('يحتسب الملخص على أوامر Submitted/Received فقط؛ الدفعات غير مخصصة لأوامر محددة، لذلك لا يُعرض ككشف محاسبي كامل.', 'The summary includes Submitted/Received orders only; payments are not allocated to specific orders, so this is not a full accounting statement.')}</p>
            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto"><table className="w-full min-w-[680px] text-xs text-start"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3">رقم PO</th><th className="p-3">{L('الفرع', 'Branch')}</th><th className="p-3">{L('الحالة', 'Status')}</th><th className="p-3">{L('التاريخ', 'Date')}</th><th className="p-3">{L('الإجمالي', 'Total')}</th></tr></thead><tbody className="divide-y divide-slate-800">{purchaseOrders.map((po) => <tr key={po.id}><td className="p-3 font-mono text-blue-300">{po.poNumber}</td><td className="p-3">{isAr ? po.branch?.name || '—' : po.branch?.nameEn || '—'}</td><td className="p-3">{po.status}</td><td className="p-3">{po.createdAt.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</td><td className="p-3 font-bold text-slate-100">{num(po.totalAmount).toLocaleString()} {currencyLabel}</td></tr>)}</tbody></table></div>
          </>
        ) : <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">{L('اختر موردًا من القائمة لعرض كشف حسابه وأوامره ومدفوعاته.', 'Select a supplier to view their statement, orders, and payments.')}</div>}
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">{L('المدفوعات', 'Payments')}</h2>
        <SupplierPayments
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          initial={payments.map((payment) => ({ id: payment.id, supplierId: payment.supplierId, amount: num(payment.amount), method: payment.method, reference: payment.reference, notes: payment.notes, createdAt: payment.createdAt.toISOString(), supplier: payment.supplier }))}
        />
      </div>
    </>
  );
}

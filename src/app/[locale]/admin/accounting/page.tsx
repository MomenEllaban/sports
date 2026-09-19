import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import ExpensesManager from '@/components/admin/ExpensesManager';
import { StatusBadge } from '@/components/admin/ui';
import { prisma } from '@/lib/db';
import { DollarSign, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminAccountingPage() {
  const [orders, sales, expenses, branches, taxInvoices] = await Promise.all([
    prisma.order.findMany(),
    prisma.sale.findMany(),
    prisma.expense.findMany({ orderBy: { createdAt: 'desc' }, include: { branch: true } }),
    prisma.branch.findMany({ select: { id: true, name: true, nameEn: true } }),
    prisma.taxInvoice.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
  ]);

  const totalOnlineRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalPosRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalGrossRevenue = totalOnlineRevenue + totalPosRevenue;
  const totalVatCollected = orders.reduce((acc, o) => acc + o.taxAmount, 0) + sales.reduce((acc, s) => acc + s.taxAmount, 0);
  const totalExpensesAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalGrossRevenue - totalExpensesAmount;

  // Real COD reconciliation computed from data
  const codOrders = orders.filter((o) => o.paymentMethod === 'COD');
  const codCollected = codOrders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.totalAmount, 0);
  const codPending = codOrders.filter((o) => o.paymentStatus !== 'PAID').reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-400" />
                الحسابات والإقرارات الضريبية (P&L & ETA)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">متابعة الأرباح والخسائر، ضريبة القيمة المضافة 14%، وإصدارات الإيصالات الإلكترونية</p>
            </div>
          </div>

          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">إجمالي المبيعات الشاملة</div>
              <div className="text-2xl font-black text-slate-100">{totalGrossRevenue.toLocaleString()} ج.م</div>
              <div className="text-[11px] text-blue-400">Online + POS الكاشير</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">إجمالي ضريبة 14% المستحقة</div>
              <div className="text-2xl font-black text-amber-400">{totalVatCollected.toLocaleString()} ج.م</div>
              <div className="text-[11px] text-slate-400">مصلحة الضرائب المصرية</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">مصروفات التشغيل للفروع</div>
              <div className="text-2xl font-black text-rose-400">{totalExpensesAmount.toLocaleString()} ج.م</div>
              <div className="text-[11px] text-slate-400">صافي الربح التقريبي: {netProfit.toLocaleString()} ج.م</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">تسويات الدفع عند الاستلام (COD)</div>
              <div className="text-2xl font-black text-emerald-400">{codCollected.toLocaleString()} ج.م</div>
              <div className="text-[11px] text-amber-400">معلق لدى المناديب: {codPending.toLocaleString()} ج.م</div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <ExpensesManager expenses={expenses} branches={branches} />
          </div>

          {/* ETA E-Invoices Submission Log */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                سجل إرسالات الإيصالات الإلكترونية لضرائب مصر (ETA Submission Log)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">رقم الفاتورة/الإيصال</th>
                    <th className="p-3">كود ETA UUID</th>
                    <th className="p-3">المبلغ الكلي</th>
                    <th className="p-3">الضريبة 14%</th>
                    <th className="p-3">حالة الضرائب</th>
                    <th className="p-3">تاريخ الإصدار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {taxInvoices.map((tax) => (
                    <tr key={tax.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-amber-400">{tax.invoiceNumber}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">{tax.etaUuid}</td>
                      <td className="p-3 font-black text-slate-100">{tax.totalAmount.toLocaleString()} ج.م</td>
                      <td className="p-3 text-emerald-400">{tax.vatAmount.toLocaleString()} ج.م</td>
                      <td className="p-3"><StatusBadge value={tax.status} /></td>
                      <td className="p-3 text-slate-400">{tax.createdAt.toLocaleString('ar-EG')}</td>
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

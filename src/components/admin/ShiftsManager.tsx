'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Clock3, DollarSign, AlertCircle, CheckCircle2, Search, Filter, Printer, X } from 'lucide-react';
import { DataTable } from '@/components/ui/foundation';

export interface ShiftRow {
  id: string;
  cashierId: string;
  cashierName: string;
  cashierEmail: string;
  branchId: string;
  branchName: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  openNote: string | null;
  closeNote: string | null;
  salesCount: number;
}

export default function ShiftsManager({
  initialShifts,
  branches,
}: {
  initialShifts: ShiftRow[];
  branches: Array<{ id: string; name: string }>;
}) {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<ShiftRow | null>(null);

  // Close modal state
  const [closeTarget, setCloseTarget] = useState<ShiftRow | null>(null);
  const [actualCashInput, setActualCashInput] = useState('');
  const [adminCloseNote, setAdminCloseNote] = useState('');
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);
  const [closeError, setCloseError] = useState('');

  // Calculations for KPI cards
  const openShifts = shifts.filter((s) => s.status === 'OPEN');
  const totalExpectedInOpen = openShifts.reduce((acc, s) => acc + s.expectedCash, 0);
  const totalDifference = shifts.reduce((acc, s) => acc + s.difference, 0);
  const totalSales = shifts.reduce((acc, s) => acc + s.salesCount, 0);

  // Filtered rows
  const filteredRows = shifts.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (branchFilter !== 'ALL' && s.branchId !== branchFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.cashierName.toLowerCase().includes(q) ||
        s.cashierEmail.toLowerCase().includes(q) ||
        s.branchName.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAdminCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeTarget || !actualCashInput) return;
    setIsSubmittingClose(true);
    setCloseError('');

    try {
      const res = await fetch(`/api/pos/shifts/${closeTarget.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCash: Number(actualCashInput),
          closeNote: adminCloseNote.trim() || 'إغلاق وتسوية من لوحة الإدارة',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCloseError(data.error || 'تعذر إغلاق الوردية');
        setIsSubmittingClose(false);
        return;
      }

      // Update local shift
      setShifts((prev) =>
        prev.map((s) =>
          s.id === closeTarget.id
            ? {
                ...s,
                status: 'CLOSED',
                closedAt: new Date().toISOString(),
                actualCash: data.actual,
                difference: data.difference,
                expectedCash: data.expected,
                closeNote: adminCloseNote.trim() || 'إغلاق إداري',
              }
            : s
        )
      );
      setCloseTarget(null);
      setActualCashInput('');
      setAdminCloseNote('');
      router.refresh();
    } catch {
      setCloseError('حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      setIsSubmittingClose(false);
    }
  };

  const printZReport = (shift: ShiftRow) => {
    const printWindow = window.open('', '_blank', 'width=420,height=650');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير تقفيل الدرج Z-Report - ${shift.id}</title>
          <style>
            body { font-family: monospace, sans-serif; font-size: 12px; margin: 15px; color: #000; line-height: 1.4; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #444; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .header-title { font-size: 15px; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">SPORTS CHAMPIONS</div>
            <div>تقرير تقفيل الوردية (Z-REPORT)</div>
            <div class="divider"></div>
          </div>
          <div class="row"><span>الفرع:</span><span class="bold">${shift.branchName}</span></div>
          <div class="row"><span>الكاشير:</span><span class="bold">${shift.cashierName}</span></div>
          <div class="row"><span>معرف الوردية:</span><span>${shift.id.slice(-8)}</span></div>
          <div class="row"><span>تاريخ الفتح:</span><span>${new Date(shift.openedAt).toLocaleString('ar-EG')}</span></div>
          <div class="row"><span>تاريخ الإغلاق:</span><span>${shift.closedAt ? new Date(shift.closedAt).toLocaleString('ar-EG') : 'مفتوحة الآن'}</span></div>
          <div class="divider"></div>
          <div class="row"><span>رصيد الافتتاح:</span><span>${shift.openingFloat.toFixed(2)} ج.م</span></div>
          <div class="row"><span>عدد الفواتير:</span><span>${shift.salesCount}</span></div>
          <div class="row"><span>المتوقع بالدرج:</span><span class="bold">${shift.expectedCash.toFixed(2)} ج.م</span></div>
          <div class="row"><span>المعدود الفعلي:</span><span class="bold">${shift.actualCash.toFixed(2)} ج.م</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: 13px;">
            <span>الفرق (عجز / زيادة):</span>
            <span>${shift.difference > 0 ? '+' : ''}${shift.difference.toFixed(2)} ج.م</span>
          </div>
          ${shift.openNote ? `<div class="divider"></div><div><b>ملاحظة الفتح:</b> ${shift.openNote}</div>` : ''}
          ${shift.closeNote ? `<div class="divider"></div><div><b>ملاحظة الإغلاق:</b> ${shift.closeNote}</div>` : ''}
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 15px;">
            <div>توقيع الكاشير: ........................</div>
            <div style="margin-top: 8px;">اعتماد المدير: ........................</div>
          </div>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Clock3 className="w-6 h-6 text-amber-400" />
            {isAr ? 'إدارة الورديات ودرج النقدية' : 'Shifts & Cash Drawer Management'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'متابعة جلسات الكاشير الحية، جرد النقدية بالدرج، مراقبة الفروقات، والتسوية الإدارية'
              : 'Monitor live cashier shifts, cash drawer floats, variance tracking and administrative reconciliation'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isAr ? 'الورديات المفتوحة' : 'Open Shifts'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{openShifts.length}</div>
          <div className="text-[11px] text-emerald-400 mt-1">{isAr ? 'نشطة الآن في الفروع' : 'Active now'}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isAr ? 'متوقع بالأدراج المفتوحة' : 'Cash in Open Drawers'}</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {totalExpectedInOpen.toLocaleString('ar-EG')} <span className="text-xs font-normal text-slate-400">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{isAr ? 'رصيد الافتتاح + مبيعات الكاش' : 'Floats + Cash sales'}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isAr ? 'صافي الفروقات الكلي' : 'Net Discrepancy'}</span>
            <AlertCircle className={`w-4 h-4 ${totalDifference < 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${totalDifference < 0 ? 'text-rose-400' : totalDifference > 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
            {totalDifference > 0 ? '+' : ''}
            {totalDifference.toLocaleString('ar-EG')} <span className="text-xs font-normal text-slate-400">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{totalDifference < 0 ? (isAr ? 'إجمالي عجز نقدي' : 'Cash shortage') : (isAr ? 'مطابق أو فائض' : 'Balanced or surplus')}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isAr ? 'إجمالي الفواتير' : 'Shift Invoices'}</span>
            <Clock3 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{totalSales}</div>
          <div className="text-[11px] text-slate-400 mt-1">{isAr ? 'عملية بيع مسجلة بالورديات' : 'Recorded shift sales'}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isAr ? 'بحث باسم الكاشير أو الفرع...' : 'Search cashier or branch...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'CLOSED')}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">{isAr ? 'كافة الحالات' : 'All Statuses'}</option>
            <option value="OPEN">{isAr ? 'مفتوحة فقط' : 'Open Only'}</option>
            <option value="CLOSED">{isAr ? 'مغلقة فقط' : 'Closed Only'}</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">{isAr ? 'كافة الفروع' : 'All Branches'}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shifts Table */}
      <DataTable
        rows={filteredRows}
        emptyTitle={isAr ? 'لا توجد ورديات مطابقة' : 'No matching shifts found'}
        emptyHint={isAr ? 'جرب تغيير فلاتر البحث أو تصفية الحالات' : 'Try adjusting search or status filters'}
        columns={[
          {
            key: 'cashier',
            header: isAr ? 'الكاشير' : 'Cashier',
            render: (r) => (
              <div>
                <div className="font-bold text-slate-100">{r.cashierName}</div>
                <div className="text-[10px] text-slate-400">{r.cashierEmail}</div>
              </div>
            ),
          },
          {
            key: 'branch',
            header: isAr ? 'الفرع' : 'Branch',
            render: (r) => <span className="text-slate-300 font-medium">{r.branchName}</span>,
          },
          {
            key: 'status',
            header: isAr ? 'الحالة' : 'Status',
            render: (r) => (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  r.status === 'OPEN'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'OPEN' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {r.status === 'OPEN' ? (isAr ? 'مفتوحة' : 'Open') : (isAr ? 'مغلقة' : 'Closed')}
              </span>
            ),
          },
          {
            key: 'openedAt',
            header: isAr ? 'وقت الفتح' : 'Opened At',
            render: (r) => <span className="text-slate-400 text-[11px]">{new Date(r.openedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</span>,
          },
          {
            key: 'openingFloat',
            header: isAr ? 'رصيد الافتتاح' : 'Opening Float',
            render: (r) => <span className="text-slate-300">{r.openingFloat.toLocaleString()} ج.م</span>,
          },
          {
            key: 'expected',
            header: isAr ? 'المتوقع' : 'Expected',
            render: (r) => <span className="font-bold text-amber-300">{r.expectedCash.toLocaleString()} ج.م</span>,
          },
          {
            key: 'actual',
            header: isAr ? 'المعدود' : 'Counted',
            render: (r) => (
              <span className="text-slate-200">{r.status === 'OPEN' ? '—' : `${r.actualCash.toLocaleString()} ج.م`}</span>
            ),
          },
          {
            key: 'diff',
            header: isAr ? 'الفرق' : 'Variance',
            render: (r) => {
              if (r.status === 'OPEN') return <span className="text-slate-500 text-xs">قيد التشغيل</span>;
              return (
                <span className={`font-black ${r.difference < 0 ? 'text-rose-400' : r.difference > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {r.difference > 0 ? '+' : ''}
                  {r.difference.toLocaleString()} ج.م
                </span>
              );
            },
          },
          {
            key: 'actions',
            header: isAr ? 'الإجراءات' : 'Actions',
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedShift(r)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  {isAr ? 'تفاصيل' : 'Details'}
                </button>
                <button
                  type="button"
                  onClick={() => printZReport(r)}
                  title={isAr ? 'طباعة تقرير Z' : 'Print Z-Report'}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                {r.status === 'OPEN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCloseTarget(r);
                      setActualCashInput(String(r.expectedCash));
                      setCloseError('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold"
                  >
                    {isAr ? 'إغلاق إداري' : 'Force Close'}
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Details Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedShift(null)}>
          <div className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-slate-700 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-amber-400" />
                {isAr ? 'تفاصيل الوردية' : 'Shift Details'} — {selectedShift.id.slice(-8)}
              </h3>
              <button onClick={() => setSelectedShift(null)} className="text-slate-400 hover:text-slate-100 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'الكاشير' : 'Cashier'}</span>
                <span className="font-bold text-slate-100">{selectedShift.cashierName}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'الفرع' : 'Branch'}</span>
                <span className="font-bold text-slate-100">{selectedShift.branchName}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'وقت الفتح' : 'Opened'}</span>
                <span className="text-slate-200">{new Date(selectedShift.openedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'وقت الإغلاق' : 'Closed'}</span>
                <span className="text-slate-200">
                  {selectedShift.closedAt ? new Date(selectedShift.closedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : 'مفتوحة حتى الآن'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'رصيد الافتتاح' : 'Opening Float'}</span>
                <span className="font-bold text-slate-100">{selectedShift.openingFloat.toLocaleString()} ج.م</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'عدد الفواتير' : 'Invoices'}</span>
                <span className="font-bold text-slate-100">{selectedShift.salesCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'المتوقع بالدرج' : 'Expected Cash'}</span>
                <span className="font-bold text-amber-400">{selectedShift.expectedCash.toLocaleString()} ج.م</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{isAr ? 'المعدود الفعلي' : 'Actual Cash'}</span>
                <span className="font-bold text-slate-100">
                  {selectedShift.status === 'OPEN' ? '—' : `${selectedShift.actualCash.toLocaleString()} ج.م`}
                </span>
              </div>
            </div>

            {selectedShift.difference !== 0 && selectedShift.status === 'CLOSED' && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                selectedShift.difference < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                <span>{isAr ? 'فرق النقدية المسجل:' : 'Recorded Variance:'}</span>
                <span className="font-black text-sm">{selectedShift.difference > 0 ? '+' : ''}{selectedShift.difference} ج.م</span>
              </div>
            )}

            {selectedShift.openNote && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">{isAr ? 'ملاحظة الفتح:' : 'Opening Note:'}</span>
                <p className="text-slate-200">{selectedShift.openNote}</p>
              </div>
            )}

            {selectedShift.closeNote && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">{isAr ? 'ملاحظة الإغلاق والتسوية:' : 'Closing Note:'}</span>
                <p className="text-slate-200">{selectedShift.closeNote}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => printZReport(selectedShift)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                {isAr ? 'طباعة تقرير Z-Report' : 'Print Z-Report'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Close Modal */}
      {closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !isSubmittingClose && setCloseTarget(null)}>
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-rose-500/40 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {isAr ? 'إغلاق وتسوية إدارية للوردية' : 'Admin Force Close Shift'}
              </h3>
              <button disabled={isSubmittingClose} onClick={() => setCloseTarget(null)} className="text-slate-400 hover:text-slate-100 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr
                ? `سيتم إغلاق وردية الكاشير (${closeTarget.cashierName}) في فرع (${closeTarget.branchName}) وتسوية الدرج إدارياً.`
                : `Closing shift for (${closeTarget.cashierName}) at (${closeTarget.branchName}).`}
            </p>

            <form onSubmit={handleAdminCloseShift} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {isAr ? 'المبلغ الفعلي المعدود بالدرج (ج.م) *' : 'Actual Counted Cash *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:outline-none focus:border-rose-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {isAr ? `المبلغ المتوقع في السجلات: ${closeTarget.expectedCash} ج.م` : `Expected in drawer: ${closeTarget.expectedCash} EGP`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {isAr ? 'سبب الإغلاق الإداري والملاحظة' : 'Admin Reason / Note'}
                </label>
                <textarea
                  rows={2}
                  value={adminCloseNote}
                  onChange={(e) => setAdminCloseNote(e.target.value)}
                  placeholder={isAr ? 'مثال: تسوية نهاية اليوم لغياب الكاشير' : 'e.g. End of day reconciliation due to cashier leave'}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              {closeError && <p className="text-xs font-bold text-rose-400">{closeError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingClose}
                  onClick={() => setCloseTarget(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose || !actualCashInput}
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-slate-950 font-black text-xs"
                >
                  {isSubmittingClose ? (isAr ? 'جاري الإغلاق...' : 'Closing...') : (isAr ? 'تأكيد الإغلاق الإداري' : 'Confirm Close')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

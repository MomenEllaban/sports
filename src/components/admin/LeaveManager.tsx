'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import {
  Plus,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button } from '@/components/ui/foundation';
import Pagination from './Pagination';

interface EmployeeOpt {
  id: string;
  name: string;
  phone?: string;
  roleTitle?: string;
  branch: { name: string; nameEn: string };
}

interface BranchOpt {
  id: string;
  name: string;
  nameEn: string;
}

interface LeaveRow {
  id: string;
  employeeId: string;
  branchId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    phone?: string;
    roleTitle?: string;
  };
  branch: {
    id: string;
    name: string;
    nameEn: string;
  };
}

export default function LeaveManager({
  employees,
  branches,
}: {
  employees: EmployeeOpt[];
  branches: BranchOpt[];
}) {
  const locale = useLocale();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  // New Request Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id || '');
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Decision Modal
  const [decisionLeave, setDecisionLeave] = useState<LeaveRow | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionNote, setDecisionNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
      });
      if (statusFilter) params.set('status', statusFilter);
      if (branchFilter) params.set('branchId', branchFilter);

      const res = (await apiFetch(`/api/admin/leaves?${params.toString()}`, 'GET')) as {
        success?: boolean;
        items?: LeaveRow[];
        total?: number;
        pageCount?: number;
      };
      if (res.items) {
        setLeaves(res.items);
        setTotal(res.total || 0);
        setPageCount(res.pageCount || 1);
      }
    } catch {
      toast(L('فشل تحميل طلبات الإجازة', 'Failed to load leave requests'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter, branchFilter, page]);

  // Compute days
  const calculatedDays =
    startDate && endDate
      ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 1;

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setFormError(L('يرجى تحديد تاريخ البداية والنهاية', 'Please select start and end dates'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/leaves', 'POST', {
        employeeId: selectedEmployeeId,
        type: leaveType,
        startDate,
        endDate,
        reason: leaveReason || undefined,
      });

      toast(L('تم تقديم طلب الإجازة بنجاح', 'Leave request submitted successfully'), 'success');
      setShowNewModal(false);
      setLeaveReason('');
      fetchLeaves();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل تقديم الطلب', 'Could not submit request');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionLeave) return;
    setDeciding(true);
    try {
      await apiFetch(`/api/admin/leaves/${decisionLeave.id}`, 'PATCH', {
        status: decisionAction,
        decisionNote: decisionNote || undefined,
      });

      toast(
        decisionAction === 'APPROVED'
          ? L('تمت الموافقة على طلب الإجازة', 'Leave request approved')
          : L('تم رفض طلب الإجازة', 'Leave request rejected'),
        'success'
      );
      setDecisionLeave(null);
      setDecisionNote('');
      fetchLeaves();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في حفظ القرار', 'Could not record decision');
      toast(msg, 'error');
    } finally {
      setDeciding(false);
    }
  };

  const typeLabels: Record<string, { ar: string; en: string }> = {
    ANNUAL: { ar: 'سنوية اعتيادية', en: 'Annual' },
    SICK: { ar: 'مرضية', en: 'Sick' },
    UNPAID: { ar: 'بدون مرتب', en: 'Unpaid' },
    MARRIAGE: { ar: 'زواج / مناسبة', en: 'Marriage' },
    OTHER: { ar: 'أخرى / طارئة', en: 'Other' },
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">{L('جميع الحالات', 'All Statuses')}</option>
            <option value="PENDING">{L('قيد الانتظار (PENDING)', 'Pending')}</option>
            <option value="APPROVED">{L('مقبولة (APPROVED)', 'Approved')}</option>
            <option value="REJECTED">{L('مرفوضة (REJECTED)', 'Rejected')}</option>
            <option value="CANCELLED">{L('ملغاة (CANCELLED)', 'Cancelled')}</option>
          </select>

          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">{L('جميع الفروع', 'All Branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name : b.nameEn}
                </option>
              ))}
            </select>
          )}
        </div>

        <Button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            setStartDate(today);
            setEndDate(today);
            setShowNewModal(true);
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4" />
          {L('طلب إجازة جديد', 'Request Leave')}
        </Button>
      </div>

      {/* Leaves Register Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{L('كود الموظف', 'Code')}</th>
              <th className="p-3">{L('الموظف', 'Employee')}</th>
              <th className="p-3">{L('نوع الإجازة', 'Leave Type')}</th>
              <th className="p-3">{L('من تاريخ', 'Start Date')}</th>
              <th className="p-3">{L('إلى تاريخ', 'End Date')}</th>
              <th className="p-3">{L('المدة', 'Days')}</th>
              <th className="p-3">{L('السبب', 'Reason')}</th>
              <th className="p-3">{L('الحالة', 'Status')}</th>
              <th className="p-3">{L('إجراءات الإدارة', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {leaves.map((l) => (
              <tr key={l.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-mono font-bold text-sky-400">
                  {`EMP-${l.employee.id.slice(-4).toUpperCase()}`}
                </td>
                <td className="p-3 font-bold text-slate-100">{l.employee.name}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] border border-slate-700">
                    {typeLabels[l.type] ? (isAr ? typeLabels[l.type].ar : typeLabels[l.type].en) : l.type}
                  </span>
                </td>
                <td className="p-3 text-slate-300">{new Date(l.startDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</td>
                <td className="p-3 text-slate-300">{new Date(l.endDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</td>
                <td className="p-3 font-bold text-emerald-400">
                  {l.days} {L('يوم', 'days')}
                </td>
                <td className="p-3 text-slate-400">{l.reason || '—'}</td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[10px] border w-fit ${
                      l.status === 'APPROVED'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : l.status === 'PENDING'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {l.status === 'APPROVED'
                      ? L('مقبولة', 'Approved')
                      : l.status === 'PENDING'
                      ? L('قيد المراجعة', 'Pending')
                      : L('مرفوضة', 'Rejected')}
                  </span>
                </td>
                <td className="p-3">
                  {l.status === 'PENDING' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setDecisionLeave(l);
                          setDecisionAction('APPROVED');
                          setDecisionNote('');
                        }}
                        className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-[11px] flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {L('قبول', 'Approve')}
                      </button>
                      <button
                        onClick={() => {
                          setDecisionLeave(l);
                          setDecisionAction('REJECTED');
                          setDecisionNote('');
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-[11px] flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        {L('رفض', 'Reject')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      {l.decisionNote || (l.decidedAt ? new Date(l.decidedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : '—')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leaves.length === 0 && !loading && (
          <div className="text-center text-xs text-slate-500 py-12">
            {L('لا توجد طلبات إجازة مسجلة', 'No leave requests found')}
          </div>
        )}
      </div>

      {leaves.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`إجمالي: ${total} طلب`, `Total: ${total} requests`)}
          </span>
          <Pagination page={page} totalPages={pageCount} onPageChange={setPage} />
        </div>
      )}

      {/* New Leave Request Modal */}
      {showNewModal && (
        <Modal
          title={L('تقديم طلب إجازة موظف', 'Submit Leave Request')}
          onClose={() => setShowNewModal(false)}
        >
          <form onSubmit={handleCreateLeave} className="space-y-4 text-xs">
            {formError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('الموظف', 'Employee')}
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className={inputCls}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle || 'Employee'}) — {isAr ? emp.branch.name : emp.branch.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('نوع الإجازة', 'Leave Type')}
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className={inputCls}
              >
                <option value="ANNUAL">{L('سنوية اعتيادية (خصم من الرصيد)', 'Annual')}</option>
                <option value="SICK">{L('مرضية (مرفق تقرير طبي)', 'Sick')}</option>
                <option value="UNPAID">{L('بدون أجر (خصم من المرتب)', 'Unpaid')}</option>
                <option value="MARRIAGE">{L('زواج / مناسبة خاصة', 'Marriage')}</option>
                <option value="OTHER">{L('أخرى / طارئة', 'Other')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('من تاريخ', 'Start Date')}
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('إلى تاريخ', 'End Date')}
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">{L('إجمالي عدد الأيام المحسوبة:', 'Calculated Duration:')}</span>
              <span className="font-extrabold text-emerald-400">{calculatedDays} {L('يوم', 'days')}</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('سبب الإجازة', 'Reason')}
              </label>
              <textarea
                rows={2}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder={L('سبب الإجازة أو تفاصيل الظرف الطارئ...', 'Leave reason...')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {saving ? L('جاري التقديم...', 'Submitting...') : L('تقديم طلب الإجازة', 'Submit Request')}
            </button>
          </form>
        </Modal>
      )}

      {/* Decision Modal */}
      {decisionLeave && (
        <Modal
          title={`${decisionAction === 'APPROVED' ? L('الموافقة على الإجازة', 'Approve Leave') : L('رفض طلب الإجازة', 'Reject Leave')} — ${decisionLeave.employee.name}`}
          onClose={() => setDecisionLeave(null)}
        >
          <form onSubmit={handleDecision} className="space-y-4 text-xs">
            <p className="text-slate-300">
              {decisionAction === 'APPROVED'
                ? L(
                    `هل تؤكد الموافقة على إجازة ${decisionLeave.employee.name} لمدة ${decisionLeave.days} يوم (من ${decisionLeave.startDate.split('T')[0]} إلى ${decisionLeave.endDate.split('T')[0]})؟`,
                    `Confirm approval for ${decisionLeave.employee.name} (${decisionLeave.days} days)?`
                  )
                : L(
                    `هل تؤكد رفض طلب إجازة ${decisionLeave.employee.name}؟`,
                    `Confirm rejection for ${decisionLeave.employee.name}?`
                  )}
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('ملاحظات القرار (اختياري)', 'Decision Note (optional)')}
              </label>
              <input
                type="text"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={L('مثال: تم التنسيق مع بديل العمل...', 'e.g. Coverage confirmed...')}
                className={inputCls}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deciding}
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-white transition-all ${
                  decisionAction === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {deciding ? L('جاري الحفظ...', 'Saving...') : decisionAction === 'APPROVED' ? L('تأكيد القبول', 'Confirm Approval') : L('تأكيد الرفض', 'Confirm Rejection')}
              </button>
              <button
                type="button"
                onClick={() => setDecisionLeave(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
              >
                {L('إلغاء', 'Cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

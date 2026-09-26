'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Pencil,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { Modal, StatusBadge, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button } from '@/components/ui/foundation';
import Pagination from './Pagination';

interface EmployeeOpt {
  id: string;
  name: string;
  phone: string;
  roleTitle: string;
  branchId: string;
  branch: { name: string; nameEn: string };
}

interface BranchOpt {
  id: string;
  name: string;
  nameEn: string;
}

interface AttendanceRow {
  id: string;
  employeeId: string;
  branchId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  notes: string | null;
  employee: {
    id: string;
    name: string;
    roleTitle: string;
    branchId: string;
  };
  branch?: {
    id: string;
    name: string;
    nameEn: string;
  };
}

interface TotalsByStatus {
  PRESENT?: number;
  LATE?: number;
  HALF_DAY?: number;
  ABSENT?: number;
}

export default function AttendanceManager({
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

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [totals, setTotals] = useState<TotalsByStatus>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Edit / Record Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id || '');
  const [formDate, setFormDate] = useState(todayStr);
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('17:00');
  const [formStatus, setFormStatus] = useState('PRESENT');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Biometric integration modal
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: selectedDate,
        to: selectedDate,
        page: String(page),
        pageSize: '20',
      });
      if (branchFilter) params.set('branchId', branchFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = (await apiFetch(`/api/admin/attendance?${params.toString()}`, 'GET')) as {
        success?: boolean;
        items?: AttendanceRow[];
        totalsByStatus?: TotalsByStatus;
        total?: number;
        pageCount?: number;
      };

      if (res.items) {
        setRecords(res.items);
        setTotals(res.totalsByStatus || {});
        setTotalRecords(res.total || 0);
        setPageCount(res.pageCount || 1);
      }
    } catch {
      toast(L('فشل تحميل سجل الحضور', 'Failed to load attendance records'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, branchFilter, statusFilter, page]);

  const openRecordModal = (record?: AttendanceRow) => {
    if (record) {
      setSelectedEmployeeId(record.employeeId);
      setFormDate(record.date.split('T')[0]);
      setCheckInTime(record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
      setCheckOutTime(record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
      setFormStatus(record.status);
      setFormNotes(record.notes || '');
    } else {
      setSelectedEmployeeId(employees[0]?.id || '');
      setFormDate(selectedDate);
      setCheckInTime('09:00');
      setCheckOutTime('17:00');
      setFormStatus('PRESENT');
      setFormNotes('');
    }
    setFormError('');
    setShowModal(true);
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const checkInIso = checkInTime ? `${formDate}T${checkInTime}:00Z` : null;
      const checkOutIso = checkOutTime ? `${formDate}T${checkOutTime}:00Z` : null;

      await apiFetch('/api/admin/attendance', 'POST', {
        employeeId: selectedEmployeeId,
        date: formDate,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        status: formStatus,
        notes: formNotes || undefined,
      });

      toast(L('تم حفظ وتحديث سجل الحضور بنجاح', 'Attendance record saved'), 'success');
      setShowModal(false);
      fetchAttendance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في حفظ الحضور', 'Could not save attendance');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.employee.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      r.employee.roleTitle.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">{L('حاضر (PRESENT)', 'Present')}</div>
          <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            {totals.PRESENT || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">{L('تأخير (LATE)', 'Late')}</div>
          <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            {totals.LATE || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">{L('نصف يوم (HALF DAY)', 'Half Day')}</div>
          <div className="text-2xl font-black text-sky-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-sky-400" />
            {totals.HALF_DAY || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">{L('غياب (ABSENT)', 'Absent')}</div>
          <div className="text-2xl font-black text-rose-400 flex items-center gap-2">
            <UserX className="w-5 h-5 text-rose-400" />
            {totals.ABSENT || 0}
          </div>
        </div>
      </div>

      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-100 font-bold focus:outline-none"
            />
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder={L('بحث بالاسم أو كود الموظف...', 'Search employee name or code...')}
              className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-52 focus:outline-none focus:border-blue-500"
            />
          </div>

          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">{L('جميع الحالات', 'All Statuses')}</option>
            <option value="PRESENT">{L('حاضر', 'Present')}</option>
            <option value="LATE">{L('متأخر', 'Late')}</option>
            <option value="HALF_DAY">{L('نصف يوم', 'Half Day')}</option>
            <option value="ABSENT">{L('غائب', 'Absent')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowBiometricModal(true)}
            variant="secondary"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {L('ربط واستيراد البصمة', 'Biometric Sync')}
          </Button>

          <Button
            onClick={() => openRecordModal()}
            variant="primary"
          >
            <Plus className="w-4 h-4" />
            {L('تسجيل حضور يدوي', 'Record Attendance')}
          </Button>
        </div>
      </div>

      {/* Daily Attendance Register Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{L('كود الموظف', 'Code')}</th>
              <th className="p-3">{L('اسم الموظف', 'Employee Name')}</th>
              <th className="p-3">{L('القسم والوظيفة', 'Dept / Role')}</th>
              <th className="p-3">{L('الفرع', 'Branch')}</th>
              <th className="p-3">{L('وقت الحضور', 'Check-In')}</th>
              <th className="p-3">{L('وقت الانصراف', 'Check-Out')}</th>
              <th className="p-3">{L('الحالة', 'Status')}</th>
              <th className="p-3">{L('ملاحظات', 'Notes')}</th>
              <th className="p-3">{L('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredRecords.map((rec) => (
              <tr key={rec.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-mono font-bold text-sky-400">EMP-{rec.employee.id.slice(-4).toUpperCase()}</td>
                <td className="p-3 font-bold text-slate-100">{rec.employee.name}</td>
                <td className="p-3 text-slate-300">
                  {rec.employee.roleTitle || '—'}
                </td>
                <td className="p-3 text-slate-300">
                  {isAr ? (rec.branch?.name || '') : (rec.branch?.nameEn || rec.branch?.name || '')}
                </td>
                <td className="p-3 font-mono text-emerald-400 font-bold">
                  {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="p-3 font-mono text-slate-300 font-bold">
                  {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[10px] border w-fit ${
                      rec.status === 'PRESENT'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : rec.status === 'LATE'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : rec.status === 'HALF_DAY'
                        ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {rec.status === 'PRESENT'
                      ? L('حاضر', 'Present')
                      : rec.status === 'LATE'
                      ? L('تأخير', 'Late')
                      : rec.status === 'HALF_DAY'
                      ? L('نصف يوم', 'Half Day')
                      : L('غياب', 'Absent')}
                  </span>
                </td>
                <td className="p-3 text-slate-400">{rec.notes || '—'}</td>
                <td className="p-3">
                  <button
                    onClick={() => openRecordModal(rec)}
                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                    title={L('تعديل الحضور', 'Edit Attendance')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRecords.length === 0 && !loading && (
          <div className="text-center text-xs text-slate-500 py-12">
            {L('لا توجد سجلات حضور مسجلة لهذا التاريخ', 'No attendance records for this date')}
          </div>
        )}
      </div>

      {totalRecords > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`إجمالي: ${totalRecords} سجل`, `Total: ${totalRecords} records`)}
          </span>
          <Pagination page={page} totalPages={pageCount} onPageChange={setPage} />
        </div>
      )}

      {/* Manual Record / Edit Modal */}
      {showModal && (
        <Modal
          title={L('تسجيل / تعديل حضور الموظف', 'Record / Edit Attendance')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSaveAttendance} className="space-y-4 text-xs">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('التاريخ', 'Date')}
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('الحالة', 'Status')}
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className={inputCls}
                >
                  <option value="PRESENT">{L('حاضر (PRESENT)', 'Present')}</option>
                  <option value="LATE">{L('متأخر (LATE)', 'Late')}</option>
                  <option value="HALF_DAY">{L('نصف يوم (HALF DAY)', 'Half Day')}</option>
                  <option value="ABSENT">{L('غياب (ABSENT)', 'Absent')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('وقت الحضور (البصمة الأولى)', 'Check-In Time')}
                </label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('وقت الانصراف (البصمة الثانية)', 'Check-Out Time')}
                </label>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('ملاحظات المانجر / سبب التعديل', 'Manager Notes')}
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={L('سبب الاستئذان أو تعديل أوقات البصمة يدويًا...', 'Reason for adjustment...')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {saving ? L('جاري الحفظ...', 'Saving...') : L('حفظ السجل', 'Save Record')}
            </button>
          </form>
        </Modal>
      )}

      {/* Biometric Integration Modal */}
      {showBiometricModal && (
        <Modal
          title={L('بنية ربط أجهزة البصمة (Biometric Sync Architecture)', 'Biometric Integration Architecture')}
          onClose={() => setShowBiometricModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300">
              {L(
                'يدعم النظام ربط أجهزة ZKTeco وغيرها من أجهزة البصمة عبر جدول AttendanceRecord و API المسار POST /api/admin/attendance بنمط المعالجة المجمعة بدون أي بيانات وهمية.',
                'Integrates with ZKTeco and IP biometric attendance clocks via POST /api/admin/attendance atomic batch processing.'
              )}
            </div>

            <div>
              <h4 className="font-bold text-slate-200 mb-1">
                {L('تنسيق ملف استيراد الحركات (CSV / Logs Format):', 'CSV Punch Log Import Format:')}
              </h4>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300" dir="ltr">
{`EmployeeCode,Date,CheckIn,CheckOut
EMP-001,2026-09-26,08:58:12,17:05:40
EMP-002,2026-09-26,09:25:00,17:02:11`}
              </pre>
            </div>

            <div className="space-y-1.5 text-slate-400 leading-relaxed">
              <p>• {L('يتم تصنيف التأخير تلقائيًا بناءً على فترة السماح (Grace Period = 15 دقيقة) وبداية الشفت (09:00 صباحًا).', 'Automatic late classification based on 15-minute grace period.')}</p>
              <p>• {L('إذا كانت ساعات العمل أقل من 4 ساعات (240 دقيقة)، يتم تسجيل الحالة كنصف يوم عمل.', 'Under 4 hours worked automatically classified as Half Day.')}</p>
              <p>• {L('قاعدة البيانات محمية بقيد فريد @@unique([employeeId, date]) لمنع تكرار البصمات.', 'Database uniqueness guard @@unique([employeeId, date]) guarantees exactly-once daily punches.')}</p>
            </div>

            <button
              onClick={() => setShowBiometricModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all"
            >
              {L('إغلاق النافذة', 'Close')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

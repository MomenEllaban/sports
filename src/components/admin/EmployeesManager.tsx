'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus, Pencil, Trash2, UserCheck, UserX, Phone, Briefcase, DollarSign, Building2 } from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button } from '@/components/ui/foundation';
import Pagination from './Pagination';

interface BranchOpt { id: string; name: string; nameEn: string }
interface EmployeeRow {
  id: string;
  name: string;
  phone: string;
  roleTitle: string;
  salary: number;
  salaryType: string;
  commissionRate: number;
  isActive: boolean;
  branch: BranchOpt;
}

const SALARY_TYPES = ['MONTHLY', 'HOURLY', 'COMMISSION'];

const EMPTY_FORM = {
  name: '',
  phone: '',
  roleTitle: '',
  salary: '',
  salaryType: 'MONTHLY',
  commissionRate: '0',
  branchId: '',
};

export default function EmployeesManager({
  employees,
  branches,
}: {
  employees: EmployeeRow[];
  branches: BranchOpt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const okMsg = isAr ? 'تمت العملية بنجاح' : 'Done successfully';

  const [showAdd, setShowAdd] = useState(false);
  const [editEmp, setEditEmp] = useState<EmployeeRow | null>(null);
  const [deleteEmp, setDeleteEmp] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, branchId: branches[0]?.id || '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const labelCls = 'block text-[11px] font-bold text-slate-400 mb-1';

  const filtered = employees.filter((e) => {
    if (filterActive === 'active') return e.isActive;
    if (filterActive === 'inactive') return !e.isActive;
    return true;
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filterActive]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, branchId: branches[0]?.id || '' });
    setFormError('');
    setShowAdd(true);
  };

  const openEdit = (emp: EmployeeRow) => {
    setForm({
      name: emp.name,
      phone: emp.phone,
      roleTitle: emp.roleTitle,
      salary: String(emp.salary),
      salaryType: emp.salaryType,
      commissionRate: String((emp.commissionRate * 100).toFixed(2).replace(/\.00$/, '')),
      branchId: emp.branch.id,
    });
    setFormError('');
    setEditEmp(emp);
  };

  const [rowError, setRowError] = useState('');

  const handleToggleActive = async (emp: EmployeeRow) => {
    setRowError('');
    try {
      await apiFetch(`/api/admin/employees/${emp.id}`, 'PATCH', { isActive: !emp.isActive });
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل';
      setRowError(msg);
      toast(msg, 'error');
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/employees', 'POST', {
        ...form,
        salary: Number(form.salary),
        commissionRate: Number(form.commissionRate) || 0,
      });
      setShowAdd(false);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في إضافة الموظف';
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmp) return;
    setSaving(true);
    setFormError('');
    try {
      await apiFetch(`/api/admin/employees/${editEmp.id}`, 'PATCH', {
        ...form,
        salary: Number(form.salary),
        commissionRate: Number(form.commissionRate) || 0,
      });
      setEditEmp(null);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في تحديث بيانات الموظف';
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEmp) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/admin/employees/${deleteEmp.id}`, 'DELETE');
      setDeleteEmp(null);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في حذف الموظف';
      setDeleteError(msg);
      toast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const salaryTypeLabel = (t: string) =>
    t === 'MONTHLY' ? (isAr ? 'شهري' : 'Monthly')
    : t === 'HOURLY' ? (isAr ? 'بالساعة' : 'Hourly')
    : (isAr ? 'عمولة' : 'Commission');

  const EmployeeFormFields = () => (
    <>
      {formError && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            {isAr ? 'اسم الموظف *' : 'Employee Name *'}
          </label>
          <input
            required
            placeholder={isAr ? 'الاسم بالكامل' : 'Full name'}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            <Phone className="w-3 h-3 inline ml-1" />
            {isAr ? 'رقم الموبايل *' : 'Phone *'}
          </label>
          <input
            required
            type="tel"
            dir="ltr"
            placeholder="01xxxxxxxxx"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            <Briefcase className="w-3 h-3 inline ml-1" />
            {isAr ? 'المسمى الوظيفي *' : 'Job Title *'}
          </label>
          <input
            required
            placeholder={isAr ? 'مثال: كاشير، مدير فرع' : 'e.g. Cashier, Branch Manager'}
            value={form.roleTitle}
            onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            <Building2 className="w-3 h-3 inline ml-1" />
            {isAr ? 'الفرع *' : 'Branch *'}
          </label>
          <select
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            className={inputCls}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>
            <DollarSign className="w-3 h-3 inline ml-1" />
            {isAr ? 'الراتب الأساسي (ج.م) *' : 'Base Salary (EGP) *'}
          </label>
          <input
            required
            type="number"
            min="0"
            placeholder="0.00"
            value={form.salary}
            onChange={(e) => setForm({ ...form, salary: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'نوع الراتب' : 'Salary Type'}</label>
          <select
            value={form.salaryType}
            onChange={(e) => setForm({ ...form, salaryType: e.target.value })}
            className={inputCls}
          >
            {SALARY_TYPES.map((t) => (
              <option key={t} value={t}>{salaryTypeLabel(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'نسبة العمولة %' : 'Commission %'}</label>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="0"
            value={form.commissionRate}
            onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {rowError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold animate-fade-in">
          {rowError}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterActive === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? (isAr ? 'الكل' : 'All') : f === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Inactive')}
              <span className="mr-1 text-[10px] opacity-70">
                ({f === 'all' ? employees.length : f === 'active' ? employees.filter(e => e.isActive).length : employees.filter(e => !e.isActive).length})
              </span>
            </button>
          ))}
        </div>
        <Button onClick={openAdd} variant="primary">
          <Plus className="w-4 h-4" />
          {isAr ? 'إضافة موظف' : 'Add Employee'}
        </Button>
      </div>

      {/* Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'اسم الموظف' : 'Name'}</th>
              <th className="p-3">{isAr ? 'الموبايل' : 'Phone'}</th>
              <th className="p-3">{isAr ? 'المسمى الوظيفي' : 'Job Title'}</th>
              <th className="p-3">{isAr ? 'الفرع' : 'Branch'}</th>
              <th className="p-3">{isAr ? 'الراتب' : 'Salary'}</th>
              <th className="p-3">{isAr ? 'العمولة %' : 'Commission %'}</th>
              <th className="p-3">{isAr ? 'الحالة' : 'Status'}</th>
              <th className="p-3">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {pagedRows.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-bold text-slate-100">{emp.name}</td>
                <td className="p-3 text-amber-400 font-bold" dir="ltr">{emp.phone}</td>
                <td className="p-3 text-slate-300">{emp.roleTitle}</td>
                <td className="p-3 text-slate-400">{isAr ? emp.branch.name : emp.branch.nameEn}</td>
                <td className="p-3 font-black text-emerald-400">
                  {emp.salary.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
                  <span className="text-[10px] text-slate-500 mr-1">/{salaryTypeLabel(emp.salaryType)}</span>
                </td>
                <td className="p-3 text-slate-300">{emp.commissionRate > 0 ? `${(emp.commissionRate * 100).toFixed(2).replace(/\.00$/, '')}%` : '—'}</td>
                <td className="p-3">
                  <button
                    onClick={() => handleToggleActive(emp)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      emp.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {emp.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                    {emp.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Inactive')}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(emp)} title={isAr ? 'تعديل' : 'Edit'} className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeleteError(''); setDeleteEmp(emp); }} title={isAr ? 'حذف' : 'Delete'} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-12">
            {isAr ? 'لا يوجد موظفون' : 'No employees found'}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${filtered.length} موظف` : `${filtered.length} employees`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <Modal title={isAr ? 'إضافة موظف جديد' : 'Add New Employee'} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmitAdd} className="space-y-3 text-xs">
            {EmployeeFormFields()}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إضافة الموظف' : 'Add Employee')}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editEmp && (
        <Modal title={isAr ? `تعديل: ${editEmp.name}` : `Edit: ${editEmp.name}`} onClose={() => setEditEmp(null)}>
          <form onSubmit={handleSubmitEdit} className="space-y-3 text-xs">
            {EmployeeFormFields()}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteEmp && (
        <Modal title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'} onClose={() => setDeleteEmp(null)}>
          <div className="space-y-4 text-xs">
            {deleteError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {deleteError}
              </div>
            )}
            <p className="text-slate-300">
              {isAr ? `هل تريد حذف الموظف "${deleteEmp.name}"؟` : `Delete employee "${deleteEmp.name}"?`}
            </p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all">
                {deleting ? (isAr ? 'جاري...' : 'Deleting...') : (isAr ? 'حذف' : 'Delete')}
              </button>
              <button onClick={() => setDeleteEmp(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  Award,
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  FileText,
  User,
  UserPlus,
  UserCheck,
  AlertCircle,
  Check,
} from 'lucide-react';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { Button, DialogFrame } from '@/components/ui/foundation';
import { useTablePage, TablePager } from './tablePaging';

interface CustomerRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  notes: string | null;
  createdAt: string;
  addresses: Array<{ street: string; city: string }>;
  orders: Array<{ id: string }>;
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  notes: '',
  loyaltyPoints: '0',
};

interface CustomerModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  customer?: CustomerRow | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  isAr: boolean;
}

function CustomerModal({
  open,
  mode,
  customer,
  onClose,
  onSuccess,
  isAr,
}: CustomerModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && customer) {
      setForm({
        name: customer.name || '',
        phone: customer.phone,
        email: customer.email || '',
        notes: customer.notes || '',
        loyaltyPoints: String(customer.loyaltyPoints ?? 0),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [open, mode, customer]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = form.phone.trim();
    if (!cleanPhone || cleanPhone.length < 7) {
      setError(
        isAr
          ? 'يرجى إدخال رقم موبايل صحيح (7 أرقام على الأقل)'
          : 'Please enter a valid mobile number (at least 7 digits)'
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (mode === 'add') {
        await apiFetch('/api/admin/customers', 'POST', {
          ...form,
          phone: cleanPhone,
          loyaltyPoints: Number(form.loyaltyPoints) || 0,
        });
        onSuccess(isAr ? 'تمت إضافة العميل بنجاح' : 'Customer added successfully');
      } else if (customer) {
        await apiFetch(`/api/admin/customers/${customer.id}`, 'PATCH', {
          ...form,
          phone: cleanPhone,
          loyaltyPoints: Number(form.loyaltyPoints) || 0,
        });
        onSuccess(isAr ? 'تم تحديث بيانات العميل بنجاح' : 'Customer updated successfully');
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isAr
          ? 'فشل في حفظ بيانات العميل'
          : 'Failed to save customer data';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const isPhoneValid = form.phone.trim().length >= 10;

  return (
    <DialogFrame
      active={open}
      title={
        mode === 'add'
          ? isAr
            ? 'إضافة عميل جديد'
            : 'Add New Customer'
          : isAr
          ? `تعديل بيانات: ${customer?.name || customer?.phone}`
          : `Edit: ${customer?.name || customer?.phone}`
      }
      onClose={onClose}
      size="md"
      header={
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/25 to-indigo-600/15 border border-blue-500/30 text-blue-400 shadow-sm">
            {mode === 'add' ? <UserPlus className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-100 truncate">
              {mode === 'add'
                ? isAr
                  ? 'إضافة عميل جديد'
                  : 'Add New Customer'
                : isAr
                ? `تعديل بيانات: ${customer?.name || customer?.phone}`
                : `Edit: ${customer?.name || customer?.phone}`}
            </h3>
            <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
              {isAr
                ? 'بيانات العميل الأساسية، معلومات التواصل وبرنامج نقاط الولاء'
                : 'Customer master details, phone contact & loyalty points'}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="min-h-[42px] px-5"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={saving}
            className="min-h-[42px] px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-blue-600/25"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{mode === 'add' ? (isAr ? 'حفظ العميل' : 'Save Customer') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}</span>
              </span>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-shake"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Section 1: Phone and Name */}
        <div className="space-y-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 p-3.5">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>{isAr ? 'البيانات الأساسية والتواصل' : 'Contact & Identity'}</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
              <span>{isAr ? 'رقم الموبايل' : 'Mobile Phone'}</span>
              <span className="text-rose-400 ms-1">*</span>
              <span className="text-[10px] text-slate-500 font-normal ms-2">
                {isAr ? '(مطلوب للبحث ونقاط الولاء)' : '(Required for lookup)'}
              </span>
            </label>
            <div className="relative">
              <input
                required
                autoFocus
                type="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full min-h-[44px] ps-10 pe-10 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute start-3 top-3.5 pointer-events-none" />
              {isPhoneValid && (
                <div className="absolute end-3 top-3.5 text-emerald-400 flex items-center gap-1 text-[11px] font-bold">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {isAr ? 'مثال: 01012345678 أو 011 / 012 / 015' : 'e.g. 01012345678 (11 digits)'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
              <span>{isAr ? 'اسم العميل' : 'Customer Name'}</span>
              <span className="text-[10px] text-slate-500 font-normal ms-2">
                {isAr ? '(اختياري)' : '(Optional)'}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={isAr ? 'مثال: كابتن أحمد مصطفى' : 'e.g. Ahmed Mostafa'}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full min-h-[44px] ps-10 pe-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
              <User className="w-4 h-4 text-slate-400 absolute start-3 top-3.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Section 2: Email and Loyalty */}
        <div className="space-y-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 p-3.5">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{isAr ? 'الحساب والولاء' : 'Account & Loyalty'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                <span>{isAr ? 'البريد الإلكتروني' : 'Email Address'}</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  dir="ltr"
                  placeholder="client@domain.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full min-h-[44px] ps-10 pe-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                <span>{isAr ? 'رصيد نقاط الولاء' : 'Loyalty Points'}</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.loyaltyPoints}
                  onChange={(e) => setForm((prev) => ({ ...prev, loyaltyPoints: e.target.value }))}
                  className="w-full min-h-[44px] ps-10 pe-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                />
                <Award className="w-4 h-4 text-amber-400 absolute start-3 top-3.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Notes */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{isAr ? 'ملاحظات إضافية' : 'Notes & Preferences'}</span>
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              {isAr ? '(مقاسات، تفضيلات، إلخ)' : '(Sizes, sport, etc.)'}
            </span>
          </label>
          <textarea
            rows={2}
            placeholder={isAr ? 'مثال: يفضل ماركة Nike، مقاس الحذاء 43، لاعب جمنازيوم...' : 'Any customer notes, size preferences...'}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
          />
        </div>
      </form>
    </DialogFrame>
  );
}

export default function CustomersManager({
  customers,
  initialPhone = '',
}: {
  customers: CustomerRow[];
  initialPhone?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [search, setSearch] = useState(initialPhone);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const filtered = customers.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const { page: safePage, totalPages, paged, total: totalRows, setPage } = useTablePage(filtered);
  const pagedRows = paged;

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteCustomer) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/admin/customers/${deleteCustomer.id}`, 'DELETE');
      setDeleteCustomer(null);
      toast(isAr ? 'تم حذف العميل بنجاح' : 'Customer deleted successfully', 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في حذف العميل', 'Could not delete the customer');
      setDeleteError(msg);
      toast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200">
            {isAr ? `إجمالي العملاء: ${filtered.length}` : `Total: ${filtered.length} customers`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، موبايل، أو إيميل...' : 'Search by name, phone, or email...'}
              className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-64 focus:outline-none focus:border-blue-500"
            />
          </div>
          <Button onClick={() => setShowAddModal(true)} variant="primary">
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة عميل' : 'Add Customer'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'اسم العميل' : 'Name'}</th>
              <th className="p-3">{isAr ? 'رقم الموبايل' : 'Phone'}</th>
              <th className="p-3">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
              <th className="p-3">{isAr ? 'نقاط الولاء' : 'Loyalty'}</th>
              <th className="p-3">{isAr ? 'العنوان' : 'Address'}</th>
              <th className="p-3">{isAr ? 'الطلبات' : 'Orders'}</th>
              <th className="p-3">{isAr ? 'تاريخ التسجيل' : 'Since'}</th>
              <th className="p-3">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {pagedRows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-bold text-slate-100">
                  {c.name || <span className="text-slate-500 italic">{isAr ? 'بدون اسم' : 'No name'}</span>}
                </td>
                <td className="p-3 font-bold text-amber-400" dir="ltr">{c.phone}</td>
                <td className="p-3 text-slate-400 dir-ltr">{c.email || '—'}</td>
                <td className="p-3">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/30 flex items-center gap-1 w-fit">
                    <Award className="w-3.5 h-3.5" />
                    {c.loyaltyPoints} {isAr ? 'نقطة' : 'pts'}
                  </span>
                </td>
                <td className="p-3 text-slate-300">{c.addresses[0]?.street || '—'}</td>
                <td className="p-3 font-bold text-blue-400">{c.orders.length}</td>
                <td className="p-3 text-slate-400">
                  {new Date(c.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditCustomer(c)}
                      title={isAr ? 'تعديل' : 'Edit'}
                      className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setDeleteError(''); setDeleteCustomer(c); }}
                      title={isAr ? 'حذف' : 'Delete'}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 transition-colors"
                    >
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
            {search ? (isAr ? 'لا توجد نتائج للبحث' : 'No results found') : (isAr ? 'لا يوجد عملاء بعد' : 'No customers yet')}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${filtered.length} عميل` : `${filtered.length} customers`}
          </span>
          <TablePager page={safePage} totalPages={totalPages} total={totalRows} onPageChange={setPage} />
        </div>
      )}

      {/* Add Customer Modal */}
      <CustomerModal
        open={showAddModal}
        mode="add"
        onClose={() => setShowAddModal(false)}
        onSuccess={(msg) => {
          toast(msg, 'success');
          router.refresh();
        }}
        isAr={isAr}
      />

      {/* Edit Customer Modal */}
      <CustomerModal
        open={!!editCustomer}
        mode="edit"
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onSuccess={(msg) => {
          toast(msg, 'success');
          router.refresh();
        }}
        isAr={isAr}
      />

      {/* Delete Confirmation Modal */}
      {deleteCustomer && (
        <DialogFrame
          active={!!deleteCustomer}
          title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
          onClose={() => setDeleteCustomer(null)}
          size="sm"
          footer={
            <div className="flex w-full gap-2">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1"
              >
                {deleting ? (isAr ? 'جاري الحذف...' : 'Deleting...') : (isAr ? 'نعم، احذف' : 'Yes, Delete')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeleteCustomer(null)}
                className="flex-1"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {deleteError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {deleteError}
              </div>
            )}
            <p className="text-slate-300">
              {isAr
                ? `هل أنت متأكد من حذف العميل "${deleteCustomer.name || deleteCustomer.phone}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete customer "${deleteCustomer.name || deleteCustomer.phone}"? This cannot be undone.`}
            </p>
            {deleteCustomer.orders.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                {isAr
                  ? `⚠️ هذا العميل لديه ${deleteCustomer.orders.length} طلب مسجل — لن يمكن حذفه.`
                  : `⚠️ This customer has ${deleteCustomer.orders.length} orders — deletion will be blocked.`}
              </div>
            )}
          </div>
        </DialogFrame>
      )}
    </div>
  );
}

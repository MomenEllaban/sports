'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Award, Plus, Pencil, Trash2, Search, Phone, Mail, FileText, Star } from 'lucide-react';
import { Modal, apiFetch } from './ui';
import Pagination from './Pagination';

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

export default function CustomersManager({ customers, initialPhone = '' }: { customers: CustomerRow[]; initialPhone?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [search, setSearch] = useState(initialPhone);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filtered = customers.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const inputCls =
    'w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-[11px] font-bold text-slate-400 mb-1';

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowAddModal(true);
  };

  const openEdit = (c: CustomerRow) => {
    setForm({
      name: c.name || '',
      phone: c.phone,
      email: c.email || '',
      notes: c.notes || '',
      loyaltyPoints: String(c.loyaltyPoints),
    });
    setFormError('');
    setEditCustomer(c);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/customers', 'POST', {
        ...form,
        loyaltyPoints: Number(form.loyaltyPoints) || 0,
      });
      setShowAddModal(false);
      router.refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'فشل في إضافة العميل');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer) return;
    setSaving(true);
    setFormError('');
    try {
      await apiFetch(`/api/admin/customers/${editCustomer.id}`, 'PATCH', {
        ...form,
        loyaltyPoints: Number(form.loyaltyPoints) || 0,
      });
      setEditCustomer(null);
      router.refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'فشل في تحديث بيانات العميل');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCustomer) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/admin/customers/${deleteCustomer.id}`, 'DELETE');
      setDeleteCustomer(null);
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'فشل في حذف العميل');
    } finally {
      setDeleting(false);
    }
  };

  const CustomerForm = ({
    onSubmit,
    title,
    onClose,
  }: {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    title: string;
    onClose: () => void;
  }) => (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        {formError && (
          <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className={labelCls}>
              {isAr ? 'اسم العميل' : 'Customer Name'}
            </label>
            <input
              type="text"
              placeholder={isAr ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohamed'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>
            <Mail className="w-3 h-3 inline ml-1" />
            {isAr ? 'البريد الإلكتروني' : 'Email'}
          </label>
          <input
            type="email"
            dir="ltr"
            placeholder="example@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            <Star className="w-3 h-3 inline ml-1" />
            {isAr ? 'نقاط الولاء' : 'Loyalty Points'}
          </label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.loyaltyPoints}
            onChange={(e) => setForm({ ...form, loyaltyPoints: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            <FileText className="w-3 h-3 inline ml-1" />
            {isAr ? 'ملاحظات' : 'Notes'}
          </label>
          <textarea
            rows={2}
            placeholder={isAr ? 'أي ملاحظات خاصة بالعميل...' : 'Any notes about this customer...'}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all"
        >
          {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
        </button>
      </form>
    </Modal>
  );

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
          <button
            onClick={openAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة عميل' : 'Add Customer'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
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
                      onClick={() => openEdit(c)}
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
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <CustomerForm
          title={isAr ? 'إضافة عميل جديد' : 'Add New Customer'}
          onSubmit={handleSubmitAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editCustomer && (
        <CustomerForm
          title={isAr ? `تعديل بيانات: ${editCustomer.name || editCustomer.phone}` : `Edit: ${editCustomer.name || editCustomer.phone}`}
          onSubmit={handleSubmitEdit}
          onClose={() => setEditCustomer(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteCustomer && (
        <Modal
          title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
          onClose={() => setDeleteCustomer(null)}
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
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all"
              >
                {deleting ? (isAr ? 'جاري الحذف...' : 'Deleting...') : (isAr ? 'نعم، احذف' : 'Yes, Delete')}
              </button>
              <button
                onClick={() => setDeleteCustomer(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

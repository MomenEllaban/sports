'use client';

import React, { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus, Pencil, Trash2, Phone, Mail, MapPin, Building, ShieldCheck, Search, ReceiptText } from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls } from '@/components/ui/foundation';
import { useTablePage, TablePager } from './tablePaging';

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
}

const EMPTY_FORM = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
};

export default function SuppliersManager({
  suppliers,
  selectedId = '',
}: {
  suppliers: SupplierRow[];
  /** Id of the supplier whose statement is open, so the row can show as current. */
  selectedId?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const okMsg = isAr ? 'تمت العملية بنجاح' : 'Done successfully';

  const [showAdd, setShowAdd] = useState(false);
  const [editSup, setEditSup] = useState<SupplierRow | null>(null);
  const [deleteSup, setDeleteSup] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');

  // The whole directory already ships to the client for the form selects, so the
  // filter is a local slice rather than another round trip.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.code, s.contactPerson, s.phone, s.email, s.taxNumber]
        .some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [suppliers, query]);

  const { page: safePage, totalPages, paged, total: totalRows, setPage } = useTablePage(filtered);
  const pagedRows = paged;

  // Selecting a supplier drives the statement panel, so it is a navigation and
  // not local state: the server has to re-scope the orders and payments.
  const openStatement = (id: string) =>
    router.push(`/admin/purchasing/suppliers?supplierId=${encodeURIComponent(id)}`);

  const labelCls = 'block text-[11px] font-bold text-slate-400 mb-1';

  const openEdit = (sup: SupplierRow) => {
    setForm({
      name: sup.name,
      contactPerson: sup.contactPerson || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      taxNumber: sup.taxNumber || '',
    });
    setFormError('');
    setEditSup(sup);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/suppliers', 'POST', form);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في إضافة المورد', 'Could not add the supplier');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSup) return;
    setSaving(true);
    setFormError('');
    try {
      await apiFetch(`/api/admin/suppliers/${editSup.id}`, 'PATCH', form);
      setEditSup(null);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في تحديث المورد', 'Could not update the supplier');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSup) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/admin/suppliers/${deleteSup.id}`, 'DELETE');
      setDeleteSup(null);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في حذف المورد', 'Could not delete the supplier');
      setDeleteError(msg);
      toast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const SupplierFormFields = () => (
    <>
      {formError && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
          {formError}
        </div>
      )}
      <div>
        <label className={labelCls}>
          <Building className="w-3 h-3 inline ml-1" />
          {isAr ? 'اسم شركة المورد *' : 'Supplier Company Name *'}
        </label>
        <input
          required
          placeholder={isAr ? 'مثال: شركة نايك للتوريد' : 'e.g. Nike Supply Co.'}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{isAr ? 'مسئول الاتصال' : 'Contact Person'}</label>
          <input
            placeholder={isAr ? 'اسم المسئول' : 'Contact name'}
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            <Phone className="w-3 h-3 inline ml-1" />
            {isAr ? 'رقم التليفون' : 'Phone'}
          </label>
          <input
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
            <Mail className="w-3 h-3 inline ml-1" />
            {isAr ? 'البريد الإلكتروني' : 'Email'}
          </label>
          <input
            type="email"
            dir="ltr"
            placeholder="supplier@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            <ShieldCheck className="w-3 h-3 inline ml-1" />
            {isAr ? 'الرقم الضريبي' : 'Tax Number'}
          </label>
          <input
            placeholder={isAr ? 'مثال: 123-456-789' : 'e.g. 123-456-789'}
            dir="ltr"
            value={form.taxNumber}
            onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>
          <MapPin className="w-3 h-3 inline ml-1" />
          {isAr ? 'العنوان' : 'Address'}
        </label>
        <input
          placeholder={isAr ? 'عنوان المورد الكامل' : 'Full address'}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className={inputCls}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <span className="text-xs font-bold text-slate-300">
          {query.trim()
            ? L(`${filtered.length} من ${suppliers.length} مورد`, `${filtered.length} of ${suppliers.length} suppliers`)
            : isAr
              ? `${suppliers.length} مورد مسجل`
              : `${suppliers.length} registered suppliers`}
        </span>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowAdd(true); }}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          {isAr ? 'إضافة مورد جديد' : 'Add Supplier'}
        </button>
      </div>

      <div className="relative">
        <label className="sr-only" htmlFor="supplier-filter">
          {L('ابحث في الموردين', 'Search suppliers')}
        </label>
        <Search className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          id="supplier-filter"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder={L('ابحث بالاسم أو الكود أو الهاتف أو الرقم الضريبي...', 'Search by name, code, phone, or tax number...')}
          className={`${inputCls} ps-10 pe-4 bg-slate-900/90 border-slate-700/80 focus:border-blue-500`}
          autoComplete="off"
        />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-950/20">
            {suppliers.length === 0
              ? isAr ? 'لا يوجد موردون مسجلون بعد' : 'No suppliers registered yet'
              : isAr ? 'لا يوجد موردون مطابقون للبحث' : 'No suppliers match this search'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedRows.map((sup) => {
            const isOpen = sup.id === selectedId;
            return (
              <div
                key={sup.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between text-xs transition-all duration-200 shadow-sm ${
                  isOpen
                    ? 'border-blue-500/70 bg-slate-900/95 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openStatement(sup.id)}
                      className="text-start min-h-[44px] py-0.5 group focus:outline-none"
                      aria-current={isOpen ? 'true' : undefined}
                    >
                      <span className="font-extrabold text-slate-100 text-sm group-hover:text-blue-300 transition-colors block">
                        {sup.name}
                      </span>
                      <span className="inline-block text-amber-400 font-bold font-mono text-[10px] bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md mt-1">
                        {sup.code}
                      </span>
                    </button>
                    {isOpen && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {L('الكشف مفتوح', 'Active')}
                      </span>
                    )}
                  </div>

                  <div className="text-slate-400 space-y-1.5 border-t border-slate-800/60 pt-2.5">
                    {sup.contactPerson && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{sup.contactPerson}</span>
                      </div>
                    )}
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <a href={`tel:${sup.phone}`} dir="ltr" className="hover:text-blue-300 hover:underline">
                          {sup.phone}
                        </a>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <a href={`mailto:${sup.email}`} dir="ltr" className="hover:text-blue-300 hover:underline truncate">
                          {sup.email}
                        </a>
                      </div>
                    )}
                    {sup.taxNumber && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                        <ShieldCheck className="w-3 h-3 text-slate-600 shrink-0" />
                        <span>{isAr ? 'الرقم الضريبي:' : 'Tax:'} <span className="font-mono text-slate-400" dir="ltr">{sup.taxNumber}</span></span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                        <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                        <span className="truncate">{sup.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/60 mt-3">
                  <button
                    onClick={() => openStatement(sup.id)}
                    className={`min-h-[44px] flex-1 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                      isOpen
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                        : 'bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white'
                    }`}
                  >
                    <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{L('كشف الحساب', 'Statement')}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(sup)}
                      aria-label={L(`تعديل ${sup.name}`, `Edit ${sup.name}`)}
                      title={L('تعديل', 'Edit')}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setDeleteError(''); setDeleteSup(sup); }}
                      aria-label={L(`حذف ${sup.name}`, `Delete ${sup.name}`)}
                      title={L('حذف', 'Delete')}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Always shown, so a short list is distinguishable from a paginated one. */}
      <TablePager page={safePage} totalPages={totalPages} total={totalRows} onPageChange={setPage} />

      {/* Add Modal */}
      {showAdd && (
        <Modal title={isAr ? 'إضافة مورد جديد' : 'Add New Supplier'} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmitAdd} className="space-y-3 text-xs">
            {SupplierFormFields()}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إضافة المورد' : 'Add Supplier')}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editSup && (
        <Modal title={isAr ? `تعديل: ${editSup.name}` : `Edit: ${editSup.name}`} onClose={() => setEditSup(null)}>
          <form onSubmit={handleSubmitEdit} className="space-y-3 text-xs">
            {SupplierFormFields()}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteSup && (
        <Modal title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'} onClose={() => setDeleteSup(null)}>
          <div className="space-y-4 text-xs">
            {deleteError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {deleteError}
              </div>
            )}
            <p className="text-slate-300">
              {isAr ? `هل تريد حذف المورد "${deleteSup.name}"؟` : `Delete supplier "${deleteSup.name}"?`}
            </p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-60 text-white font-extrabold transition-all">
                {deleting ? (isAr ? 'جاري...' : 'Deleting...') : (isAr ? 'حذف' : 'Delete')}
              </button>
              <button onClick={() => setDeleteSup(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

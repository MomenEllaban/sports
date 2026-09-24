'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus, Pencil, Trash2, Phone, Mail, MapPin, Building, ShieldCheck } from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls } from '@/components/ui/foundation';
import Pagination from './Pagination';

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

export default function SuppliersManager({ suppliers }: { suppliers: SupplierRow[] }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const okMsg = isAr ? 'تمت العملية بنجاح' : 'Done successfully';

  const [showAdd, setShowAdd] = useState(false);
  const [editSup, setEditSup] = useState<SupplierRow | null>(null);
  const [deleteSup, setDeleteSup] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = suppliers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
      const msg = err instanceof Error ? err.message : 'فشل في إضافة المورد';
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
      const msg = err instanceof Error ? err.message : 'فشل في تحديث المورد';
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
      const msg = err instanceof Error ? err.message : 'فشل في حذف المورد';
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
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-300">
          {isAr ? `${suppliers.length} مورد مسجل` : `${suppliers.length} registered suppliers`}
        </span>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowAdd(true); }}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          {isAr ? 'إضافة مورد' : 'Add Supplier'}
        </button>
      </div>

      <div className="space-y-3">
        {suppliers.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-8">
            {isAr ? 'لا يوجد موردون مسجلون بعد' : 'No suppliers registered yet'}
          </div>
        )}
        {pagedRows.map((sup) => (
          <div key={sup.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
            <div className="flex flex-wrap justify-between items-start gap-2">
              <div>
                <div className="font-extrabold text-slate-100">{sup.name}</div>
                <div className="text-amber-400 font-bold text-[10px]">{sup.code}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(sup)}
                  className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setDeleteError(''); setDeleteSup(sup); }}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-slate-400 space-y-1">
              {sup.contactPerson && <div>{isAr ? 'المسئول' : 'Contact'}: {sup.contactPerson}</div>}
              {sup.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-blue-400" />
                  <span dir="ltr">{sup.phone}</span>
                </div>
              )}
              {sup.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-blue-400" />
                  <span dir="ltr">{sup.email}</span>
                </div>
              )}
              {sup.taxNumber && (
                <div className="text-[11px] text-slate-500">
                  {isAr ? 'الرقم الضريبي' : 'Tax'}: {sup.taxNumber}
                </div>
              )}
              {sup.address && (
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <MapPin className="w-3 h-3" />
                  {sup.address}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {suppliers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${suppliers.length} مورد` : `${suppliers.length} suppliers`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <Modal title={isAr ? 'إضافة مورد جديد' : 'Add New Supplier'} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmitAdd} className="space-y-3 text-xs">
            {SupplierFormFields()}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-extrabold transition-all">
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
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-extrabold transition-all">
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
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all">
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

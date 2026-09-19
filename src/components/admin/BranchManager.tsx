'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus, Edit2, Trash2, MapPin, Phone, Clock, Building, CheckCircle2, XCircle } from 'lucide-react';

interface BranchItem {
  id: string;
  name: string;
  nameEn: string;
  address: string;
  addressEn: string;
  phone: string;
  city: string;
  workingHours: string;
  isActive: boolean;
}

export default function BranchManager({ branches }: { branches: BranchItem[] }) {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [addressEn, setAddressEn] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Alexandria');
  const [workingHours, setWorkingHours] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setEditingBranch(null);
    setName('');
    setNameEn('');
    setAddress('');
    setAddressEn('');
    setPhone('');
    setCity('Alexandria');
    setWorkingHours('السبت-الأربعاء 10ص-10م، الخميس-الجمعة 10ص-11م');
    setIsActive(true);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (b: BranchItem) => {
    setEditingBranch(b);
    setName(b.name);
    setNameEn(b.nameEn || '');
    setAddress(b.address);
    setAddressEn(b.addressEn || '');
    setPhone(b.phone);
    setCity(b.city);
    setWorkingHours(b.workingHours);
    setIsActive(b.isActive);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name,
      nameEn: nameEn || name,
      address,
      addressEn: addressEn || address,
      phone,
      city,
      workingHours,
      isActive,
    };

    try {
      const url = editingBranch
        ? `/api/admin/branches/${editingBranch.id}`
        : '/api/admin/branches';
      const method = editingBranch ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت العملية');
      }

      setShowModal(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'حدث خطأ أثناء حفظ الفرع');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (b: BranchItem) => {
    const confirmMsg = isAr
      ? `هل أنت متأكد من حذف أو تعطيل فرع "${b.name}"؟`
      : `Are you sure you want to remove branch "${b.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    setDeleteError('');
    setDeletingId(b.id);
    try {
      const res = await fetch(`/api/admin/branches/${b.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setDeleteError(data.error || (isAr ? 'تعذر حذف الفرع' : 'Could not delete branch'));
        return;
      }
      router.refresh();
    } catch {
      setDeleteError(isAr ? 'فشل الاتصال لحذف الفرع' : 'Connection failed while deleting');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {deleteError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold animate-fade-in">
          {deleteError}
        </div>
      )}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
        <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
          <Building className="w-5 h-5 text-amber-400" />
          {isAr ? `فروع الشركة ونقاط البيع (${branches.length})` : `Company Branches (${branches.length})`}
        </h3>
        <button
          type="button"
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {isAr ? 'إضافة فرع جديد' : 'Add Branch'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {branches.map((b) => (
          <div
            key={b.id}
            className={`p-4 rounded-2xl border transition-all ${
              b.isActive
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                : 'bg-slate-950/60 border-rose-900/40 opacity-75'
            } space-y-2 text-xs`}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-black text-sm text-slate-100 flex items-center gap-1.5">
                  <span>{b.name}</span>
                  {b.isActive ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {isAr ? 'نشط' : 'Active'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <XCircle className="w-2.5 h-2.5" /> {isAr ? 'معطل' : 'Inactive'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">{b.nameEn}</div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditModal(b)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title={isAr ? 'تعديل الفرع' : 'Edit'}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b)}
                  disabled={deletingId === b.id}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 disabled:opacity-50"
                  title={isAr ? 'حذف / تعطيل' : 'Delete'}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-1 text-slate-400 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{b.address}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span dir="ltr">{b.phone}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{b.workingHours}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Branch Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-400" />
                {editingBranch
                  ? (isAr ? `تعديل الفرع: ${editingBranch.name}` : 'Edit Branch')
                  : (isAr ? 'إضافة فرع جديد' : 'Add New Branch')}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'اسم الفرع بالعربي *' : 'Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'مثال: فرع الإبراهيمية' : 'Branch Name'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'اسم الفرع بالإنجليزي' : 'Name (English)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ibrahimia Branch"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'العنوان التفصيلي *' : 'Address *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: 92 شارع عمر لطفي - الإسكندرية' : 'Full Address'}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'رقم هاتف الفرع *' : 'Phone *'}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="03-5912345 / 010..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'المدينة' : 'City'}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'مواعيد العمل' : 'Working Hours'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'مثال: يومياً من 10 صباحاً حتى 11 مساءً' : 'Working hours'}
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="branchIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-950 border-slate-800"
                />
                <label htmlFor="branchIsActive" className="text-slate-300 font-bold cursor-pointer">
                  {isAr ? 'الفرع نشط ويستقبل مبيعات وطلبات' : 'Branch is active'}
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold flex items-center justify-center gap-1 shadow-lg shadow-amber-500/20"
                >
                  {loading ? 'جاري الحفظ...' : (isAr ? 'حفظ بيانات الفرع' : 'Save Branch')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

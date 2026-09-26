'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  Award,
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface BrandItem {
  id: string;
  nameAr: string;
  nameEn: string;
  slug?: string | null;
  description?: string | null;
  logo?: string | null;
  productsCount: number;
}

export default function BrandsManager({
  brands: initialBrands,
}: {
  brands: BrandItem[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [brands, setBrands] = useState<BrandItem[]>(initialBrands);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) => b.nameAr.toLowerCase().includes(q) || b.nameEn.toLowerCase().includes(q)
    );
  }, [brands, search]);

  const totalProducts = useMemo(() => {
    return brands.reduce((sum, b) => sum + b.productsCount, 0);
  }, [brands]);

  const openCreateModal = () => {
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setDescription('');
    setLogo('');
    setIsModalOpen(true);
  };

  const openEditModal = (brand: BrandItem) => {
    setEditingId(brand.id);
    setNameAr(brand.nameAr);
    setNameEn(brand.nameEn);
    setDescription(brand.description || '');
    setLogo(brand.logo || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !nameEn.trim()) {
      toast(L('الرجاء إدخال اسم الماركة بالعربي والإنجليزي', 'Please provide brand name in both languages'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Edit existing brand
        const res = await apiFetch<{ brand?: BrandItem }>(`/api/admin/brands/${editingId}`, 'PATCH', {
          nameAr,
          nameEn,
          description,
          logo: logo || null,
        });

        const updated = res?.brand;
        setBrands((prev) =>
          prev.map((b) =>
            b.id === editingId
              ? { ...b, nameAr, nameEn, description, logo: updated?.logo ?? logo }
              : b
          )
        );
        toast(L('تم تحديث بيانات الماركة بنجاح', 'Brand updated successfully'), 'success');
      } else {
        // Create new brand
        const res = await apiFetch<{ brand?: BrandItem }>('/api/admin/brands', 'POST', {
          nameAr,
          nameEn,
          description,
          logo: logo || null,
        });

        const created = res?.brand;
        if (created) {
          setBrands((prev) => [
            {
              id: created.id,
              nameAr: created.nameAr,
              nameEn: created.nameEn,
              slug: created.slug,
              description: created.description,
              logo: created.logo,
              productsCount: 0,
            },
            ...prev,
          ]);
        }
        toast(L('تمت إضافة الماركة بنجاح', 'Brand created successfully'), 'success');
      }

      setIsModalOpen(false);
    } catch {
      toast(L('فشلت العملية، يرجى المحاولة لاحقاً', 'Operation failed, try again'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) {
      toast(
        L(`لا يمكن حذف الماركة لأن هناك ${count} منتج مسجل تحتها`, `Cannot delete: brand is linked to ${count} products`),
        'error'
      );
      return;
    }

    if (!confirm(L(`هل أنت متأكد من حذف الماركة "${name}"؟`, `Delete brand "${name}"?`))) return;

    try {
      await apiFetch(`/api/admin/brands/${id}`, 'DELETE');
      setBrands((prev) => prev.filter((b) => b.id !== id));
      toast(L('تم حذف الماركة', 'Brand deleted'), 'success');
    } catch {
      toast(L('فشل حذف الماركة', 'Failed to delete brand'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي الماركات الرياضية', 'Total Brands')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{brands.length}</span>
            <span className="text-xs text-slate-400 ms-2">{L('ماركة', 'brands')}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المنتجات المنسوبة لماركات', 'Branded Products')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{totalProducts}</span>
            <span className="text-xs text-slate-400 ms-2">{L('منتج', 'products')}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-sm text-slate-100">{L('إضافة ماركة جديدة', 'New Brand')}</h4>
            <p className="text-xs text-slate-400 mt-1">{L('تسجيل علامة تجارية أو براند', 'Register a brand')}</p>
          </div>
          <Button onClick={openCreateModal} variant="primary" className="bg-purple-600 hover:bg-purple-500">
            <Plus className="w-4 h-4" />
            {L('إضافة ماركة', 'Add Brand')}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث في الماركات (نايكي، أديداس، بوما...)...', 'Search brands (Nike, Adidas...)...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            {L('لا توجد ماركات مطابقة للبحث', 'No matching brands found')}
          </div>
        ) : (
          filtered.map((brand) => (
            <div
              key={brand.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt={brand.nameEn}
                        className="w-10 h-10 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-black text-sm">
                        {brand.nameEn.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-100">{brand.nameAr}</h4>
                      <p className="text-xs text-slate-400 font-medium">{brand.nameEn}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                    {brand.productsCount} {L('منتج', 'items')}
                  </span>
                </div>

                {brand.description && (
                  <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                    {brand.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-3 mt-4">
                <button
                  onClick={() => openEditModal(brand)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  title={L('تعديل', 'Edit')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(brand.id, brand.nameAr, brand.productsCount)}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors"
                  title={L('حذف', 'Delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Brand Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-100 text-sm">
                {editingId ? L('تعديل الماركة', 'Edit Brand') : L('إضافة ماركة جديدة', 'Add New Brand')}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('اسم الماركة (بالعربي)', 'Brand Name (Arabic)')} *
                </label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: نايكي، أديداس، بوما"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('اسم الماركة (بالإنجليزي)', 'Brand Name (English)')} *
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Nike, Adidas, Puma"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('رابط الشعار / اللوجو (اختياري)', 'Logo URL (Optional)')}
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('الوصف (اختياري)', 'Description (Optional)')}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={L('نبذة عن العلامة التجارية أو بلد المنشأ', 'Brief note about the brand')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                  {L('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-500">
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ الماركة', 'Save Brand')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  FolderTree,
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  X,
  Check,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface CategoryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  description?: string | null;
  productsCount: number;
}

export default function CategoriesManager({
  categories: initialCategories,
}: {
  categories: CategoryItem[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.nameAr.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const totalProducts = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.productsCount, 0);
  }, [categories]);

  const openCreateModal = () => {
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setNameAr(cat.nameAr);
    setNameEn(cat.nameEn);
    setDescription(cat.description || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !nameEn.trim()) {
      toast(L('الرجاء إدخال اسم التصنيف بالعربي والإنجليزي', 'Please provide category name in both languages'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Edit existing
        const res = await apiFetch<{ category?: CategoryItem }>(`/api/admin/categories/${editingId}`, 'PATCH', {
          nameAr,
          nameEn,
          description,
        });

        const updated = res?.category;
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? { ...c, nameAr, nameEn, description, slug: updated?.slug || c.slug }
              : c
          )
        );
        toast(L('تم تحديث التصنيف بنجاح', 'Category updated successfully'), 'success');
      } else {
        // Create new
        const res = await apiFetch<{ category?: CategoryItem }>('/api/admin/categories', 'POST', {
          nameAr,
          nameEn,
          description,
        });

        const created = res?.category;
        if (created) {
          setCategories((prev) => [
            {
              id: created.id,
              nameAr: created.nameAr,
              nameEn: created.nameEn,
              slug: created.slug,
              description: created.description,
              productsCount: 0,
            },
            ...prev,
          ]);
        }
        toast(L('تمت إضافة التصنيف بنجاح', 'Category created successfully'), 'success');
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
        L(`لا يمكن حذف التصنيف لأنه يحتوي على ${count} منتج`, `Cannot delete: category has ${count} products`),
        'error'
      );
      return;
    }

    if (!confirm(L(`هل أنت متأكد من حذف التصنيف "${name}"؟`, `Delete category "${name}"?`))) return;

    try {
      await apiFetch(`/api/admin/categories/${id}`, 'DELETE');
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast(L('تم حذف التصنيف', 'Category deleted'), 'success');
    } catch {
      toast(L('فشل حذف التصنيف', 'Failed to delete category'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي التصنيفات', 'Total Categories')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FolderTree className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{categories.length}</span>
            <span className="text-xs text-slate-400 ms-2">{L('تصنيف', 'categories')}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي المنتجات المصنفة', 'Categorized Products')}</span>
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
            <h4 className="font-extrabold text-sm text-slate-100">{L('إضافة تصنيف جديد', 'New Category')}</h4>
            <p className="text-xs text-slate-400 mt-1">{L('إنشاء قسم رئيسي أو فرعي', 'Create category group')}</p>
          </div>
          <Button onClick={openCreateModal} variant="primary" className="bg-blue-600 hover:bg-blue-500">
            <Plus className="w-4 h-4" />
            {L('إضافة تصنيف', 'Add Category')}
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
            placeholder={L('بحث في التصنيفات بالعربي أو الإنجليزي...', 'Search categories...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Categories Grid / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            {L('لا توجد تصنيفات مطابقة للبحث', 'No matching categories found')}
          </div>
        ) : (
          filtered.map((cat) => (
            <div
              key={cat.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-100">{cat.nameAr}</h4>
                      <p className="text-xs text-slate-400 font-medium">{cat.nameEn}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                    {cat.productsCount} {L('منتج', 'items')}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-500 mt-3" dir="ltr">
                  slug: /{cat.slug}
                </div>

                {cat.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-3 mt-4">
                <button
                  onClick={() => openEditModal(cat)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  title={L('تعديل', 'Edit')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(cat.id, cat.nameAr, cat.productsCount)}
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

      {/* Category Modal (Create / Edit) */}
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
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <FolderTree className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-100 text-sm">
                {editingId ? L('تعديل التصنيف', 'Edit Category') : L('إضافة تصنيف جديد', 'Add New Category')}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('اسم التصنيف (بالعربي)', 'Category Name (Arabic)')} *
                </label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: أحذية كرة قدم، ملابس تدريب"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('اسم التصنيف (بالإنجليزي)', 'Category Name (English)')} *
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Football Shoes, Training Apparel"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
                  placeholder={L('وصف موجز يظهر في المتجر وصفحات الـ SEO', 'Brief description for catalog & SEO')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                  {L('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500">
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ التصنيف', 'Save Category')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

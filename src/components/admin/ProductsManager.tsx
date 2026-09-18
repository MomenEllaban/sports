'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus, Download } from 'lucide-react';
import { Modal, apiFetch } from './ui';

interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  costPrice: number;
  isActive: boolean;
  category: { id: string; nameAr: string; nameEn: string };
  brand: { id: string; nameAr: string; nameEn: string } | null;
  inventories: Array<{ stockQuantity: number; branch: { name: string } }>;
}

export default function ProductsManager({
  products,
  categories,
  brands,
}: {
  products: ProductRow[];
  categories: Array<{ id: string; nameAr: string; nameEn: string }>;
  brands: Array<{ id: string; nameAr: string; nameEn: string }>;
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    nameAr: '',
    nameEn: '',
    price: '',
    costPrice: '',
    categoryId: categories[0]?.id || '',
    brandId: '',
    initialStock: '',
  });

  const filtered = products.filter(
    (p) =>
      p.nameAr.includes(search) ||
      p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const stockOf = (p: ProductRow, frag: string) =>
    p.inventories.find((i) => i.branch.name.includes(frag))?.stockQuantity ?? 0;

  const exportCsv = () => {
    const header = 'sku,nameAr,nameEn,price,costPrice,stockIbrahimeyah,stockSmouha,isActive';
    const lines = products.map((p) =>
      [p.sku, `"${p.nameAr}"`, `"${p.nameEn}"`, p.price, p.costPrice, stockOf(p, 'الإبراهيمية'), stockOf(p, 'سموحة'), p.isActive].join(',')
    );
    const blob = new Blob(['\ufeff' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await apiFetch(`/api/admin/products/${id}`, 'PATCH', { isActive });
      router.refresh();
    } catch {
      /* error shown per-row is overkill; refresh will reveal state */
    }
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/products', 'POST', {
        ...form,
        price: Number(form.price),
        costPrice: Number(form.costPrice) || 0,
        initialStock: Number(form.initialStock) || 0,
        brandId: form.brandId || undefined,
      });
      setShowModal(false);
      setForm({ sku: '', nameAr: '', nameEn: '', price: '', costPrice: '', categoryId: categories[0]?.id || '', brandId: '', initialStock: '' });
      router.refresh();
    } catch {
      setFormError(t('operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isAr ? 'بحث بالاسم أو SKU...' : 'Search by name or SKU...'}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-64 focus:outline-none focus:border-blue-500"
        />
        <div className="flex items-center gap-3">
          <button onClick={exportCsv} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all">
            <Download className="w-4 h-4 text-blue-400" />
            {t('exportCsv')}
          </button>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all">
            <Plus className="w-4 h-4" />
            {t('addProduct')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">{isAr ? 'اسم المنتج' : 'Product'}</th>
              <th className="p-3">{isAr ? 'التصنيف' : 'Category'}</th>
              <th className="p-3">{isAr ? 'سعر البيع' : 'Price'}</th>
              <th className="p-3">{isAr ? 'مخزن الإبراهيمية' : 'Ibrahimeyah'}</th>
              <th className="p-3">{isAr ? 'مخزن سموحة' : 'Smouha'}</th>
              <th className="p-3">{isAr ? 'الحالة' : 'Active'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((prod) => (
              <tr key={prod.id} className="hover:bg-slate-900/50">
                <td className="p-3 font-bold text-amber-400">{prod.sku}</td>
                <td className="p-3 font-bold text-slate-100">{isAr ? prod.nameAr : prod.nameEn}</td>
                <td className="p-3 text-slate-300">{isAr ? prod.category.nameAr : prod.category.nameEn}</td>
                <td className="p-3 font-black text-emerald-400">{prod.price.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</td>
                <td className="p-3 font-bold text-blue-400">{stockOf(prod, 'الإبراهيمية')}</td>
                <td className="p-3 font-bold text-purple-400">{stockOf(prod, 'سموحة')}</td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(prod.id, !prod.isActive)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${prod.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                  >
                    {prod.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Inactive')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-xs text-slate-500 py-12">{t('noData')}</div>}
      </div>

      {showModal && (
        <Modal title={t('addProduct')} onClose={() => setShowModal(false)}>
          <form onSubmit={createProduct} className="space-y-3 text-xs">
            {formError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder={t('sku')} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inputCls} />
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputCls}>
                {categories.map((c) => <option key={c.id} value={c.id}>{isAr ? c.nameAr : c.nameEn}</option>)}
              </select>
            </div>
            <input required placeholder={t('productNameAr')} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className={inputCls} />
            <input required placeholder={t('productNameEn')} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-3 gap-3">
              <input required type="number" min="0" placeholder={t('price')} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
              <input type="number" min="0" placeholder={t('costPrice')} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className={inputCls} />
              <input type="number" min="0" placeholder={t('initialStock')} value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value })} className={inputCls} />
            </div>
            <select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })} className={inputCls}>
              <option value="">{isAr ? 'بدون ماركة' : 'No brand'}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
            </select>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? t('loading') : t('createProduct')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

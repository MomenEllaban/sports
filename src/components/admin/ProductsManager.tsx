'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { Plus, Download, Pencil, Trash2, Search, Upload, Image as ImageIcon, Loader2, Cloud, Star } from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { inputCls, Button, SafeImage } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import Pagination from './Pagination';
import { apiRequest, getClientErrorMessage } from '@/lib/client-api';

interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  gs1Code: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  costPrice: number;
  size: string | null;
  color: string | null;
  isActive: boolean;
  images: string[];
  category: { id: string; nameAr: string; nameEn: string };
  brand: { id: string; nameAr: string; nameEn: string } | null;
  inventories: Array<{ stockQuantity: number; branch: { name: string; nameEn?: string } }>;
}

const EMPTY_PRODUCT = {
  sku: '',
  nameAr: '',
  nameEn: '',
  price: '',
  costPrice: '',
  categoryId: '',
  brandId: '',
  barcode: '',
  gs1Code: '',
  size: '',
  color: '',
  initialStock: '',
  images: [] as string[],
};

// Categories and brands are managed on their own pages (/admin/products/categories
// and /admin/products/brands). This component only ever renders the product
// list, so it carries no tab state and no second copy of those editors.

export default function ProductsManager({
  products,
  categories,
  brands,
  serverSide = false,
  totalCount,
  initialPage = 1,
  initialSearch = '',
  initialCategoryId = '',
  initialBrandId = '',
  initialStatus = '',
}: {
  products: ProductRow[];
  categories: Array<{ id: string; nameAr: string; nameEn: string }>;
  brands: Array<{ id: string; nameAr: string; nameEn: string }>;
  serverSide?: boolean;
  totalCount?: number;
  initialPage?: number;
  initialSearch?: string;
  initialCategoryId?: string;
  initialBrandId?: string;
  initialStatus?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname() || '';
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const okMsg = isAr ? 'تمت العملية بنجاح' : 'Done successfully';

  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId);
  const [brandFilter, setBrandFilter] = useState(initialBrandId);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [page, setPage] = useState(initialPage);
  // Kept in step with the server's page size by products/page.tsx.
  const PAGE_SIZE = 8;
  const [pendingId, setPendingId] = useState('');

  // Product modals
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<ProductRow | null>(null);
  const [deleteProductError, setDeleteProductError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

  const labelCls = 'block text-[11px] font-bold text-slate-400 mb-1';

  const filtered = serverSide
    ? products
    : products.filter(
        (p) =>
          p.nameAr.includes(search) ||
          p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase()) ||
          (p.barcode || '').includes(search) ||
          (p.gs1Code || '').includes(search),
      );
  const resultCount = serverSide ? totalCount || products.length : filtered.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = serverSide ? products : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (!serverSide) setPage(1);
  }, [search, serverSide]);

  useEffect(() => {
    if (serverSide) { setPage(initialPage); setSearch(initialSearch); setCategoryFilter(initialCategoryId); setBrandFilter(initialBrandId); setStatusFilter(initialStatus); }
  }, [initialPage, initialSearch, initialCategoryId, initialBrandId, initialStatus, serverSide]);

  /**
   * One builder for every navigation in this component. Rebuilding the query
   * string from scratch inside `changePage` used to drop the active filters, so
   * page 2 silently showed unfiltered rows while the filter boxes still looked
   * applied.
   */
  const buildUrl = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('query', search.trim());
    if (categoryFilter) params.set('categoryId', categoryFilter);
    if (brandFilter) params.set('brandId', brandFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const submitSearch = () => {
    if (!serverSide) return;
    router.push(buildUrl(1));
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    if (serverSide) router.push(buildUrl(nextPage));
  };

  /** Quotes every field and neutralises spreadsheet formula injection. */
  const csvCell = (value: unknown) => {
    const raw = value === null || value === undefined ? '' : String(value);
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const header = [
      'sku', 'barcode', 'nameAr', 'nameEn', 'size', 'color',
      'price', 'costPrice', 'category', 'brand', 'isActive', 'stock',
    ].join(',');
    const lines = products.map((p) =>
      [
        p.sku, p.barcode, p.nameAr, p.nameEn, p.size, p.color,
        p.price, p.costPrice,
        isAr ? p.category.nameAr : p.category.nameEn,
        p.brand ? (isAr ? p.brand.nameAr : p.brand.nameEn) : '',
        p.isActive ? 'yes' : 'no',
        p.inventories.reduce((acc, i) => acc + i.stockQuantity, 0),
      ].map(csvCell).join(','),
    );
    const blob = new Blob(['\ufeff' + header + '\n' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isAr ? 'المنتجات.csv' : 'products.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setPendingId(id);
    try {
      await apiFetch(`/api/admin/products/${id}`, 'PATCH', { isActive });
      router.refresh();
    } catch (err) {
      toast(getClientErrorMessage(err, L('تعذر تغيير حالة المنتج', 'Could not change the product status')), 'error');
    } finally {
      setPendingId('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageUploadError(isAr ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError(isAr ? 'حجم الصورة يجب ألا يتجاوز 10 ميجابايت' : 'Image must be under 10MB');
      return;
    }

    setUploadingImage(true);
    setImageUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await apiRequest<{ url?: string }>('/api/admin/upload', {
        method: 'POST',
        body: formData,
        errorKey: 'admin:upload:image',
      });
      const uploadedUrl = data.url;
      if (!uploadedUrl) throw new Error(isAr ? 'فشل رفع الصورة' : 'Failed to upload image');

      setProductForm((prev) => ({
        ...prev,
        images: [...prev.images, uploadedUrl],
      }));
    } catch (err: unknown) {
      setImageUploadError(err instanceof Error ? err.message : (isAr ? 'فشل رفع الصورة' : 'Upload failed'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddUrlImage = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;

    setUploadingImage(true);
    setImageUploadError('');
    try {
      if (trimmed.includes('res.cloudinary.com')) {
        setProductForm((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
        setImageUrlInput('');
        return;
      }

      try {
        const data = await apiRequest<{ url?: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ url: trimmed }),
          errorKey: 'admin:upload:image-url',
        });
        setProductForm((prev) => ({ ...prev, images: [...prev.images, data.url || trimmed] }));
      } catch {
        setProductForm((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
      }
      setImageUrlInput('');
    } catch {
      setProductForm((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
      setImageUrlInput('');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setProductForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const handleSetPrimaryImage = (indexToPrimary: number) => {
    setProductForm((prev) => {
      const selected = prev.images[indexToPrimary];
      const rest = prev.images.filter((_, idx) => idx !== indexToPrimary);
      return {
        ...prev,
        images: [selected, ...rest],
      };
    });
  };

  const openEditProduct = (p: ProductRow) => {
    setProductForm({
      sku: p.sku,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      price: String(p.price),
      costPrice: String(p.costPrice),
      categoryId: p.category.id,
      brandId: p.brand?.id || '',
      barcode: p.barcode || '',
      gs1Code: p.gs1Code || '',
      size: p.size || '',
      color: p.color || '',
      initialStock: '',
      images: Array.isArray(p.images) ? [...p.images] : [],
    });
    setFormError('');
    setImageUploadError('');
    setImageUrlInput('');
    setEditProduct(p);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/products', 'POST', {
        ...productForm,
        price: Number(productForm.price),
        costPrice: Number(productForm.costPrice) || 0,
        initialStock: Number(productForm.initialStock) || 0,
        brandId: productForm.brandId || undefined,
        barcode: productForm.barcode || undefined,
        gs1Code: productForm.gs1Code || undefined,
        size: productForm.size || undefined,
        color: productForm.color || undefined,
        images: productForm.images,
      });
      setShowAddProduct(false);
      setProductForm(EMPTY_PRODUCT);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في إضافة المنتج', 'Could not add the product');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setSaving(true);
    setFormError('');
    // Opening stock is create-only (it seeds BranchInventory rows), so it is
    // dropped from the PATCH body rather than being sent and ignored.
    const editable = { ...productForm };
    delete (editable as { initialStock?: string }).initialStock;
    try {
      await apiFetch(`/api/admin/products/${editProduct.id}`, 'PATCH', {
        ...editable,
        price: Number(productForm.price),
        costPrice: Number(productForm.costPrice) || 0,
        brandId: productForm.brandId || null,
        barcode: productForm.barcode || null,
        gs1Code: productForm.gs1Code || null,
        size: productForm.size || null,
        color: productForm.color || null,
        images: productForm.images,
      });
      setEditProduct(null);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في تحديث المنتج', 'Could not update the product');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    setDeleteProductError('');
    try {
      await apiFetch(`/api/admin/products/${deleteProduct.id}`, 'DELETE');
      setDeleteProduct(null);
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في حذف المنتج', 'Could not delete the product');
      setDeleteProductError(msg);
      toast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const ProductFormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <>
      {formError && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{isAr ? 'كود المنتج (SKU) *' : 'Product SKU *'}</label>
          <input
            required
            placeholder={isAr ? 'مثال: NIKE-SHOE-001' : 'Example: NIKE-SHOE-001'}
            value={productForm.sku}
            onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'التصنيف *' : 'Category *'}</label>
          <select
            value={productForm.categoryId}
            onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
            className={inputCls}
          >
            <option value="">{isAr ? '-- اختر تصنيف --' : '-- Select category --'}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{isAr ? c.nameAr : c.nameEn}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{isAr ? 'الاسم بالعربي *' : 'Name in Arabic *'}</label>
          <input
            required
            placeholder={isAr ? 'مثال: حذاء رياضي نايك' : 'Example: Nike running shoe'}
            value={productForm.nameAr}
            onChange={(e) => setProductForm({ ...productForm, nameAr: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'الاسم بالإنجليزي *' : 'Name in English *'}</label>
          <input
            required
            placeholder="e.g. Nike Running Shoe"
            value={productForm.nameEn}
            onChange={(e) => setProductForm({ ...productForm, nameEn: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>{isAr ? 'سعر البيع (ج.م) *' : 'Selling Price (EGP) *'}</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={productForm.price}
            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'سعر التكلفة (ج.م)' : 'Cost Price (EGP)'}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={productForm.costPrice}
            onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
        {/* Opening stock is a create-time field. It writes BranchInventory rows,
            which the update route deliberately does not touch — quantities are
            changed through stocktakes, transfers or sales instead. Showing it
            while editing would imply a value that is silently discarded. */}
        {!isEdit && (
          <div>
            <label className={labelCls}>{isAr ? 'مخزون افتتاحي' : 'Opening Stock'}</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={productForm.initialStock}
              onChange={(e) => setProductForm({ ...productForm, initialStock: e.target.value })}
              className={inputCls}
              dir="ltr"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {isAr
                ? 'يُسجَّل في أول فرع نشط فقط. لتغيير الكميات لاحقًا استخدم الجرد أو التحويل.'
                : 'Recorded in the first active branch only. Change quantities later via stocktake or transfers.'}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{isAr ? 'الماركة' : 'Brand'}</label>
          <select
            value={productForm.brandId}
            onChange={(e) => setProductForm({ ...productForm, brandId: e.target.value })}
            className={inputCls}
          >
            <option value="">{isAr ? 'بدون ماركة' : 'No brand'}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'الباركود (اختياري)' : 'Barcode (optional)'}</label>
          <input
            placeholder="123456789012"
            value={productForm.barcode}
            onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'كود GS1 للضرائب (ETA)' : 'GS1 code (ETA)'}</label>
          <input
            placeholder="8/12/13/14 digits"
            value={productForm.gs1Code}
            onChange={(e) => setProductForm({ ...productForm, gs1Code: e.target.value })}
            className={inputCls}
            dir="ltr"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{isAr ? 'المقاس (اختياري)' : 'Size (optional)'}</label>
          <input
            placeholder={isAr ? 'مثال: XL, 42, M' : 'e.g. XL, 42, M'}
            value={productForm.size}
            onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{isAr ? 'اللون (اختياري)' : 'Color (optional)'}</label>
          <input
            placeholder={isAr ? 'مثال: أسود, أبيض' : 'e.g. Black, White'}
            value={productForm.color}
            onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      {/* Product Images Management with Cloudinary */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-200">
              {isAr ? 'صور المنتج (Cloudinary)' : 'Product Images (Cloudinary)'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              {productForm.images.length}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {isAr ? 'الصورة الأولى هي المعروضة كصورة رئيسية للمنتج' : 'First image is the primary photo'}
          </span>
        </div>

        {imageUploadError && (
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold">
            {imageUploadError}
          </div>
        )}

        {/* Existing Images Gallery */}
        {productForm.images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {productForm.images.map((imgUrl, idx) => (
              <div
                key={idx}
                className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-square flex items-center justify-center shadow"
              >
                <SafeImage
                  src={imgUrl}
                  alt={`Product ${idx + 1}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
                {idx === 0 ? (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-black flex items-center gap-0.5 shadow">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {isAr ? 'رئيسية' : 'Main'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryImage(idx)}
                    title={isAr ? 'تعيين كرئيسية' : 'Set as primary'}
                    aria-label={isAr ? 'تعيين كرئيسية' : 'Set as primary'}
                    className="absolute top-1.5 right-1.5 min-h-[44px] min-w-[44px] px-2 rounded-md bg-slate-900/90 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[9px] font-bold opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    {isAr ? 'رئيسية' : 'Main'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  title={isAr ? 'حذف الصورة' : 'Remove image'}
                  aria-label={isAr ? 'حذف الصورة' : 'Remove image'}
                  className="absolute bottom-1.5 left-1.5 min-h-[44px] min-w-[44px] p-2 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[9px] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Direct File Upload to Cloudinary */}
          <div>
            <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-blue-500/40 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 font-bold text-xs cursor-pointer transition-all">
              {uploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isAr ? 'جاري الرفع لـ Cloudinary...' : 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{isAr ? 'رفع صورة من الجهاز' : 'Upload Image'}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploadingImage}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* External URL with Cloudinary Upload */}
          <div className="flex gap-1.5">
            <input
              placeholder={isAr ? 'أو ضع رابط صورة خارجي...' : 'Or paste image URL...'}
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              disabled={uploadingImage}
              className={inputCls}
              dir="ltr"
            />
            <button
              type="button"
              disabled={uploadingImage || !imageUrlInput.trim()}
              onClick={() => handleAddUrlImage(imageUrlInput)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold shrink-0 transition-colors"
            >
              {isAr ? 'إضافة' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
                placeholder={isAr ? 'بحث بالاسم أو SKU أو باركود...' : 'Search by name, SKU or barcode...'}
                aria-label={isAr ? 'بحث في المنتجات' : 'Search products'}
                className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-64 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
              />
            </div>
            {serverSide && <div className="flex flex-wrap items-center gap-2">
              <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); }} onBlur={submitSearch} aria-label={isAr ? 'التصنيف' : 'Category'} className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs"><option value="">{isAr ? 'كل التصنيفات' : 'All categories'}</option>{categories.map((item) => <option key={item.id} value={item.id}>{isAr ? item.nameAr : item.nameEn}</option>)}</select>
              <select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); }} onBlur={submitSearch} aria-label={isAr ? 'الماركة' : 'Brand'} className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs"><option value="">{isAr ? 'كل الماركات' : 'All brands'}</option>{brands.map((item) => <option key={item.id} value={item.id}>{isAr ? item.nameAr : item.nameEn}</option>)}</select>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }} onBlur={submitSearch} aria-label={isAr ? 'الحالة' : 'Status'} className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs"><option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option><option value="active">{isAr ? 'نشط' : 'Active'}</option><option value="inactive">{isAr ? 'موقوف' : 'Inactive'}</option></select>
            </div>}
            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all"
              >
                <Download className="w-4 h-4 text-blue-400" />
                {isAr ? 'تصدير CSV' : 'Export CSV'}
              </button>
              <Button
                onClick={() => {
                  setProductForm(EMPTY_PRODUCT);
                  setFormError('');
                  setImageUploadError('');
                  setImageUrlInput('');
                  setShowAddProduct(true);
                }}
                variant="primary"
              >
                <Plus className="w-4 h-4" />
                {isAr ? 'إضافة منتج' : 'Add Product'}
              </Button>
            </div>
          </div>

          <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs text-start">
              <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="p-3 w-14">{isAr ? 'الصورة' : 'Image'}</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">{isAr ? 'اسم المنتج' : 'Product'}</th>
                  <th className="p-3">{isAr ? 'التصنيف' : 'Category'}</th>
                  <th className="p-3">{isAr ? 'سعر البيع' : 'Price'}</th>
                  <th className="p-3">{isAr ? 'المخزون' : 'Stock'}</th>
                  <th className="p-3">{isAr ? 'الحالة' : 'Active'}</th>
                  <th className="p-3">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pagedRows.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3">
                      {prod.images && prod.images.length > 0 ? (
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 shadow-sm flex items-center justify-center group/img">
                          <SafeImage
                            src={prod.images[0]}
                            alt={isAr ? prod.nameAr : prod.nameEn}
                            fill
                            sizes="44px"
                            className="object-cover transition-transform group-hover/img:scale-110 duration-200"
                          />
                          {prod.images.length > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 bg-slate-950/90 text-[8px] px-1 rounded text-amber-400 font-bold border border-slate-800">
                              +{prod.images.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 flex items-center justify-center text-slate-600">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-bold text-amber-400">{prod.sku}</td>
                    <td className="p-3 font-bold text-slate-100">
                      <div>{isAr ? prod.nameAr : prod.nameEn}</div>
                      {(prod.size || prod.color) && (
                        <div className="text-[10px] text-slate-500">{[prod.size, prod.color].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">{isAr ? prod.category.nameAr : prod.category.nameEn}</td>
                    <td className="p-3 font-black text-emerald-400">{prod.price.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</td>
                    <td className="p-3 font-bold text-blue-400">
                      {/* Per-branch balances belong to /admin/inventory. Here we only
                          surface the total the viewer is allowed to see, which the
                          page query already limits to their scoped branches. */}
                      <Link href="/admin/inventory" title={isAr ? 'عرض في المخزون' : 'View in inventory'} className="hover:underline">
                        {prod.inventories.reduce((acc, i) => acc + i.stockQuantity, 0)}
                      </Link>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(prod.id, !prod.isActive)}
                        disabled={pendingId === prod.id}
                        aria-busy={pendingId === prod.id}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all disabled:opacity-60 ${prod.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                        {pendingId === prod.id
                          ? (isAr ? '...جارٍ' : '...')
                          : prod.isActive ? (isAr ? 'نعم' : 'Active') : (isAr ? 'موقوف' : 'Inactive')}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditProduct(prod)}
                          title={isAr ? 'تعديل' : 'Edit'}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setDeleteProductError(''); setDeleteProduct(prod); }}
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
            {(serverSide ? totalCount === 0 : filtered.length === 0) && (
              <div className="text-center text-xs text-slate-500 py-12">
                {search ? (isAr ? 'لا توجد نتائج' : 'No results') : (isAr ? 'لا توجد منتجات' : 'No products')}
              </div>
            )}
          </div>

          {resultCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400">
                {/* In server mode `products` is one page, so the visible count is
                    not the catalogue size. `totalCount` is the real total. */}
                {isAr ? `${resultCount} منتج` : `${resultCount} products`}
              </span>
              <Pagination page={safePage} totalPages={totalPages} onPageChange={changePage} />
            </div>
          )}
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <Modal title={isAr ? 'إضافة منتج جديد' : 'Add New Product'} onClose={() => setShowAddProduct(false)}>
          <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
            {ProductFormFields({})}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إضافة المنتج' : 'Create Product')}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Product Modal */}
      {editProduct && (
        <Modal title={isAr ? `تعديل: ${editProduct.nameAr}` : `Edit: ${editProduct.nameEn}`} onClose={() => setEditProduct(null)}>
          <form onSubmit={handleEditProduct} className="space-y-3 text-xs">
            {ProductFormFields({ isEdit: true })}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Product Modal */}
      {deleteProduct && (
        <Modal title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'} onClose={() => setDeleteProduct(null)}>
          <div className="space-y-4 text-xs">
            {deleteProductError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {deleteProductError}
              </div>
            )}
            <p className="text-slate-300">
              {isAr
                ? `هل تريد حذف المنتج "${deleteProduct.nameAr}"؟`
                : `Delete product "${deleteProduct.nameEn}"?`}
            </p>
            <div className="flex gap-2">
              <button onClick={handleDeleteProduct} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all">
                {deleting ? (isAr ? 'جاري...' : 'Deleting...') : (isAr ? 'حذف' : 'Delete')}
              </button>
              <button onClick={() => setDeleteProduct(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Sliders,
  Save,
  Megaphone,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface HeroBanner {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaTextAr: string;
  ctaTextEn: string;
  ctaLink: string;
  imageUrl: string;
  badgeAr?: string;
  badgeEn?: string;
  isActive: boolean;
}

export interface AnnouncementSettings {
  enabled: boolean;
  textAr: string;
  textEn: string;
  link?: string;
}

export default function WebsiteContentManager({
  initialAnnouncement,
  initialBanners,
}: {
  initialAnnouncement: AnnouncementSettings;
  initialBanners: HeroBanner[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [announcement, setAnnouncement] = useState<AnnouncementSettings>(initialAnnouncement);
  const [banners, setBanners] = useState<HeroBanner[]>(
    initialBanners.length > 0
      ? initialBanners
      : [
          {
            id: 'banner-1',
            titleAr: 'أحدث التشكيلات الرياضية العالمية',
            titleEn: 'Latest World Sports Collections',
            subtitleAr: 'خصومات حصرية حتى 40% على أحذية الجري وملابس التدريب الأصلية',
            subtitleEn: 'Exclusive discounts up to 40% on genuine running shoes & training apparel',
            ctaTextAr: 'تسوق الآن',
            ctaTextEn: 'Shop Now',
            ctaLink: '/products',
            imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=80',
            badgeAr: 'تخفيضات الموسم',
            badgeEn: 'Season Sale',
            isActive: true,
          },
        ]
  );

  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [savingBanners, setSavingBanners] = useState(false);

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnnouncement(true);
    try {
      await apiFetch('/api/admin/settings', 'PUT', {
        key: 'cms.announcement',
        value: announcement,
      });
      toast(L('تم حفظ شريط الإعلانات بنجاح', 'Announcement bar saved successfully'), 'success');
    } catch {
      toast(L('فشل الحفظ، يرجى المحاولة لاحقاً', 'Failed to save announcement'), 'error');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleSaveBanners = async () => {
    setSavingBanners(true);
    try {
      await apiFetch('/api/admin/settings', 'PUT', {
        key: 'cms.heroBanners',
        value: banners,
      });
      toast(L('تم حفظ وتحديث بنرات الواجهة بنجاح', 'Hero banners saved successfully'), 'success');
    } catch {
      toast(L('فشل الحفظ، يرجى المحاولة لاحقاً', 'Failed to save hero banners'), 'error');
    } finally {
      setSavingBanners(false);
    }
  };

  const addBanner = () => {
    const newBanner: HeroBanner = {
      id: `banner-${Date.now()}`,
      titleAr: 'عنوان العرض الترويجي الجديد',
      titleEn: 'New Promotional Offer Title',
      subtitleAr: 'وصف جذاب للمنتجات والعروض الخاصة',
      subtitleEn: 'Engaging description for featured items and discounts',
      ctaTextAr: 'اكتشف المزيد',
      ctaTextEn: 'Explore More',
      ctaLink: '/products',
      imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200&q=80',
      badgeAr: 'جديد',
      badgeEn: 'New Arrival',
      isActive: true,
    };
    setBanners((prev) => [...prev, newBanner]);
  };

  const removeBanner = (id: string) => {
    if (banners.length <= 1) {
      toast(L('يجب الإبقاء على بنر واحد على الأقل', 'Keep at least one banner'), 'error');
      return;
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBanner = (id: string, field: keyof HeroBanner, value: unknown) => {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  return (
    <div className="space-y-8">
      {/* 1. Announcement Bar Section */}
      <section className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">
                {L('شريط الإعلانات العلوي للمتجر (Top Announcement Bar)', 'Store Announcement Bar')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {L('يظهر بأعلى كل صفحات المتجر للإعلان عن الشحن المجاني أو الأكواد الترويجية', 'Displays at top of all storefront pages')}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-bold text-slate-300">
              {announcement.enabled ? L('مفعّل', 'Enabled') : L('معطل', 'Disabled')}
            </span>
            <input
              type="checkbox"
              checked={announcement.enabled}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
            />
          </label>
        </div>

        <form onSubmit={handleSaveAnnouncement} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                {L('نص الإعلان (بالعربي)', 'Announcement Text (Arabic)')}
              </label>
              <input
                type="text"
                value={announcement.textAr}
                onChange={(e) => setAnnouncement((prev) => ({ ...prev, textAr: e.target.value }))}
                placeholder="مثال: شحن مجاني لجميع الطلبات فوق 1000 جنيه لفترة محدودة!"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                {L('نص الإعلان (بالإنجليزي)', 'Announcement Text (English)')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={announcement.textEn}
                onChange={(e) => setAnnouncement((prev) => ({ ...prev, textEn: e.target.value }))}
                placeholder="e.g. Free shipping on all orders over 1000 EGP for a limited time!"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1">
              {L('رابط الزر أو التوجيه (اختياري)', 'Target Link (Optional)')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={announcement.link || ''}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, link: e.target.value }))}
              placeholder="/products or /coupons"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={savingAnnouncement} className="bg-amber-600 hover:bg-amber-500">
              <Save className="w-3.5 h-3.5" />
              {savingAnnouncement ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ شريط الإعلانات', 'Save Announcement')}
            </Button>
          </div>
        </form>
      </section>

      {/* 2. Hero Banners Slider Section */}
      <section className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">
                {L('بنرات الواجهة الرئيسية (Hero Slides & Banners)', 'Homepage Hero Banners')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {L('إدارة الشرائح الدوارة، الصور، العناوين، وأزرار الشراء المباشرة', 'Manage home carousels, images, call-to-actions')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={addBanner} variant="secondary" className="text-xs">
              <Plus className="w-3.5 h-3.5" />
              {L('إضافة بنر جديد', 'Add Banner')}
            </Button>
            <Button
              onClick={handleSaveBanners}
              variant="primary"
              disabled={savingBanners}
              className="bg-blue-600 hover:bg-blue-500 text-xs font-bold"
            >
              <Save className="w-3.5 h-3.5" />
              {savingBanners ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ كل البنرات', 'Save All Banners')}
            </Button>
          </div>
        </div>

        {/* Banners List with Live Preview */}
        <div className="space-y-8">
          {banners.map((b, index) => (
            <div
              key={b.id}
              className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs font-bold text-blue-400">
                  {L('شريحة العرض #', 'Slide #')}{index + 1}
                </span>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <span className="text-slate-400">{b.isActive ? L('نشط', 'Active') : L('مخفي', 'Hidden')}</span>
                    <input
                      type="checkbox"
                      checked={b.isActive}
                      onChange={(e) => updateBanner(b.id, 'isActive', e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600"
                    />
                  </label>

                  <button
                    onClick={() => removeBanner(b.id)}
                    className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title={L('حذف هذا البنر', 'Delete banner')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Banner Live Visual Preview Card */}
              <div
                className="relative rounded-2xl overflow-hidden min-h-[160px] p-6 flex flex-col justify-end text-white border border-slate-700 shadow-xl"
                style={{
                  backgroundImage: `linear-gradient(to top, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.3)), url(${b.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {b.badgeAr && (
                  <span className="self-start px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white uppercase tracking-wider mb-2">
                    {isAr ? b.badgeAr : b.badgeEn}
                  </span>
                )}
                <h4 className="text-lg font-black">{isAr ? b.titleAr : b.titleEn}</h4>
                <p className="text-xs text-slate-300 mt-1 max-w-lg line-clamp-2">
                  {isAr ? b.subtitleAr : b.subtitleEn}
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-slate-950 font-bold text-xs shadow-lg">
                    {isAr ? b.ctaTextAr : b.ctaTextEn}
                    <ExternalLink className="w-3 h-3 ms-1" />
                  </span>
                </div>
              </div>

              {/* Edit Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    {L('العنوان الرئيسي (عربي)', 'Title (AR)')}
                  </label>
                  <input
                    type="text"
                    value={b.titleAr}
                    onChange={(e) => updateBanner(b.id, 'titleAr', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    {L('العنوان الرئيسي (إنجليزي)', 'Title (EN)')}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={b.titleEn}
                    onChange={(e) => updateBanner(b.id, 'titleEn', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    {L('الوصف الترويجي (عربي)', 'Subtitle (AR)')}
                  </label>
                  <input
                    type="text"
                    value={b.subtitleAr}
                    onChange={(e) => updateBanner(b.id, 'subtitleAr', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    {L('الوصف الترويجي (إنجليزي)', 'Subtitle (EN)')}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={b.subtitleEn}
                    onChange={(e) => updateBanner(b.id, 'subtitleEn', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    {L('رابط صورة الخلفية', 'Background Image URL')}
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={b.imageUrl}
                    onChange={(e) => updateBanner(b.id, 'imageUrl', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {L('نص الزر', 'CTA Button')}
                    </label>
                    <input
                      type="text"
                      value={b.ctaTextAr}
                      onChange={(e) => updateBanner(b.id, 'ctaTextAr', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {L('رابط الزر', 'CTA Link')}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={b.ctaLink}
                      onChange={(e) => updateBanner(b.id, 'ctaLink', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

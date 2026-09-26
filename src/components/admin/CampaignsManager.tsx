'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  Send,
  MessageCircle,
  Users,
  Sparkles,
  Plus,
  Crown,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface CampaignRecord {
  id: string;
  title: string;
  channel: 'WHATSAPP' | 'SMS';
  audience: 'ALL' | 'VIP' | 'INACTIVE' | 'NEW';
  audienceCount: number;
  message: string;
  couponCode?: string | null;
  status: 'DRAFT' | 'SENT' | 'SCHEDULED';
  createdAt: string;
}

export interface CustomerAudienceItem {
  id: string;
  name: string | null;
  phone: string;
  segment: 'VIP' | 'INACTIVE' | 'NEW' | 'ACTIVE';
}

const TEMPLATES = [
  {
    titleAr: 'عروض وتخفيضات نهاية الموسم',
    titleEn: 'End of Season Sale',
    audience: 'ALL' as const,
    coupon: 'SEASON50',
    bodyAr: 'أهلاً {name} 🎉 عروض نهاية الموسم بدأت في متجر سبورتس! خصومات تصل إلى 50% على أشهر الماركات العالمية (Nike, Adidas, Puma). استخدم كود الخصم {coupon} للحصول على شحن مجاني اليوم! تسوق الآن: https://sports-eg.com',
    bodyEn: 'Hi {name}! End of season sale is live at Sports! Up to 50% off on top brands. Use code {coupon} for free shipping: https://sports-eg.com',
  },
  {
    titleAr: 'مكافأة حصرية لعملاء VIP',
    titleEn: 'Exclusive VIP Bonus',
    audience: 'VIP' as const,
    coupon: 'VIP20',
    bodyAr: 'عميلنا المميز {name} 🌟 تقديراً لولائك الدائم، نقدم لك خصم إضافي 20% على أي طلب جديد باستخدام كود {coupon}، بالإضافة لنقاط ولاء مضاعفة على مشترياتك هذا الأسبوع!',
    bodyEn: 'Dear VIP {name}! Thank you for your loyalty. Enjoy an exclusive 20% off with code {coupon} plus double loyalty points this week!',
  },
  {
    titleAr: 'تنشيط العملاء واستعادة الاهتمام',
    titleEn: 'We Miss You Offer',
    audience: 'INACTIVE' as const,
    coupon: 'WELCOMEBACK',
    bodyAr: 'اشتقنا لك يا {name}! 👟 جهزنا لك كود خصم خاص {coupon} بقيمة 100 ج.م على تشكيلة الأحذية والملابس الرياضية الجديدة. يسعدنا زيارتك مرة أخرى!',
    bodyEn: 'We miss you {name}! Here is a 100 EGP discount voucher {coupon} on our latest athletic collection: https://sports-eg.com',
  },
];

export default function CampaignsManager({
  initialCampaigns,
  customers,
}: {
  initialCampaigns: CampaignRecord[];
  customers: CustomerAudienceItem[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(initialCampaigns);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
  const [audience, setAudience] = useState<'ALL' | 'VIP' | 'INACTIVE' | 'NEW'>('ALL');
  const [couponCode, setCouponCode] = useState('');
  const [message, setMessage] = useState('');

  // Audience counts
  const audienceCounts = useMemo(() => {
    let vip = 0;
    let inactive = 0;
    let newUsers = 0;

    customers.forEach((c) => {
      if (c.segment === 'VIP') vip++;
      else if (c.segment === 'INACTIVE') inactive++;
      else if (c.segment === 'NEW') newUsers++;
    });

    return {
      ALL: customers.length,
      VIP: vip,
      INACTIVE: inactive,
      NEW: newUsers,
    };
  }, [customers]);

  const applyTemplate = (tpl: (typeof TEMPLATES)[0]) => {
    setTitle(isAr ? tpl.titleAr : tpl.titleEn);
    setAudience(tpl.audience);
    setCouponCode(tpl.coupon);
    setMessage(isAr ? tpl.bodyAr : tpl.bodyEn);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast(L('الرجاء إدخال عنوان الحملة ونص الرسالة', 'Please enter title and message body'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetCount = audienceCounts[audience] || 0;
      const newCampaign: CampaignRecord = {
        id: `camp-${Date.now()}`,
        title,
        channel,
        audience,
        audienceCount: targetCount,
        message,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      };

      const updatedList = [newCampaign, ...campaigns];

      // Save to database settings table under key 'marketing.campaigns'
      await apiFetch('/api/admin/settings', 'PUT', {
        key: 'marketing.campaigns',
        value: updatedList,
      });

      setCampaigns(updatedList);
      toast(
        L(
          `تم إطلاق الحملة التسويقية واستهداف ${targetCount} عميل بنجاح!`,
          `Campaign launched targeting ${targetCount} customers!`
        ),
        'success'
      );
      setIsModalOpen(false);
      resetForm();
    } catch {
      toast(L('فشل إطلاق الحملة، يرجى المحاولة لاحقاً', 'Failed to launch campaign'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setCouponCode('');
    setAudience('ALL');
  };

  const handleDirectWhatsAppBroadcast = (camp: CampaignRecord) => {
    // Target sample phone for preview or direct click
    const targetCustomers = customers.filter((c) => {
      if (camp.audience === 'ALL') return true;
      return c.segment === camp.audience;
    });

    const firstCustomer = targetCustomers[0];
    if (!firstCustomer) {
      toast(L('لا يوجد عملاء في هذه الشريحة حالياً', 'No customers in this segment'), 'error');
      return;
    }

    const cleanPhone = firstCustomer.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const personalized = camp.message
      .replace('{name}', firstCustomer.name || L('عميلنا العزيز', 'Valued Customer'))
      .replace('{coupon}', camp.couponCode || 'PROMO10');

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(personalized)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي قاعدة العملاء', 'Total Audience')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{audienceCounts.ALL.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-2">{L('عميل مسجل', 'contacts')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('جاهزون لاستقبال رسائل واتساب و SMS', 'Reachable via WhatsApp & SMS')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('شريحة VIP المميزة', 'VIP Segment')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Crown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-400">{audienceCounts.VIP.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-2">{L('عميل', 'VIPs')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('أعلى العملاء إنفاقاً وتكراراً للشراء', 'Highest spenders & frequent buyers')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('العملاء الخاملون', 'Inactive Customers')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{audienceCounts.INACTIVE.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-2">{L('عميل', 'customers')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('لم يشتروا منذ 60 يوماً فأكثر', 'No purchases in 60+ days')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('الحملات المنفذة', 'Executed Campaigns')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{campaigns.length}</span>
            <span className="text-xs text-slate-400 ms-2">{L('حملة', 'campaigns')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('عبر قنوات واتساب المباشرة', 'Dispatched via WhatsApp broadcasts')}</p>
        </div>
      </div>

      {/* Action Header & Launch Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-100">
              {L('إطلاق حملة تسويقية ذكية عبر واتساب و SMS', 'Launch Smart WhatsApp & SMS Campaign')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {L(
                'استهدف شرائح العملاء المحددة، خصص قسائم الشراء، وأرسل رسائل مخصصة بنقرة واحدة',
                'Target specific customer segments, attach discount coupons, and broadcast with 1-click'
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          variant="primary"
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
        >
          <Plus className="w-4 h-4" />
          {L('إنشاء حملة جديدة', 'Create Campaign')}
        </Button>
      </div>

      {/* Campaigns History Table */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300">
          {L('سجل الحملات التسويقية والرسائل الصادرة', 'Campaign History & Dispatched Broadcasts')} ({campaigns.length})
        </h4>

        <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
          <table className="w-full min-w-[760px] text-xs text-start">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5 text-start">{L('عنوان الحملة', 'Campaign Title')}</th>
                <th className="p-3.5 text-center">{L('القناة', 'Channel')}</th>
                <th className="p-3.5 text-center">{L('الشريحة المستهدفة', 'Audience')}</th>
                <th className="p-3.5 text-center">{L('عدد المستلمين', 'Recipients')}</th>
                <th className="p-3.5 text-center">{L('كود الخصم', 'Coupon')}</th>
                <th className="p-3.5 text-center">{L('تاريخ الإطلاق', 'Date')}</th>
                <th className="p-3.5 text-end">{L('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {L('لا توجد حملات تسويقية سابقة، ابدأ بإنشاء حملتك الأولى', 'No marketing campaigns yet')}
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-100">{camp.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{camp.message}</div>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <MessageCircle className="w-3 h-3" />
                        {camp.channel}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {camp.audience === 'ALL'
                          ? L('كل العملاء', 'All')
                          : camp.audience === 'VIP'
                          ? L('عملاء VIP', 'VIP')
                          : camp.audience === 'INACTIVE'
                          ? L('خاملون', 'Inactive')
                          : L('جدد', 'New')}
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-mono font-bold text-slate-200">
                      {camp.audienceCount.toLocaleString()}
                    </td>

                    <td className="p-3.5 text-center">
                      {camp.couponCode ? (
                        <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg text-[11px]">
                          {camp.couponCode}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-slate-400 text-[11px]">
                      {new Date(camp.createdAt).toLocaleDateString(locale)}
                    </td>

                    <td className="p-3.5 text-end">
                      <button
                        onClick={() => handleDirectWhatsAppBroadcast(camp)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" />
                        {L('إرسال واتساب', 'Send via WhatsApp')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto app-scrollbar shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-100 text-sm">
                  {L('إنشاء وإطلاق حملة تسويقية جديدة', 'Create & Broadcast Campaign')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {L('استهداف فوري لقاعدة العملاء المخصصة', 'Instant targeting of selected customer segment')}
                </p>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="mt-4">
              <span className="text-xs text-slate-400 font-semibold block mb-2">
                {L('نماذج جاهزة للاستخدام السريع:', 'Quick Ready Templates:')}
              </span>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    {isAr ? tpl.titleAr : tpl.titleEn}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 mt-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('عنوان الحملة', 'Campaign Title')} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: خصومات الجمعة البيضاء، عرض خاص لعملاء VIP"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    {L('قناة الإرسال', 'Channel')}
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as 'WHATSAPP' | 'SMS')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="WHATSAPP">WhatsApp Broadcast</option>
                    <option value="SMS">SMS Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    {L('الشريحة المستهدفة', 'Audience')}
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as typeof audience)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">{L('كل العملاء', 'All')} ({audienceCounts.ALL})</option>
                    <option value="VIP">{L('عملاء VIP فقط', 'VIP Only')} ({audienceCounts.VIP})</option>
                    <option value="INACTIVE">{L('العملاء الخاملون', 'Inactive')} ({audienceCounts.INACTIVE})</option>
                    <option value="NEW">{L('العملاء الجدد', 'New')} ({audienceCounts.NEW})</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('كود الخصم المرفق (اختياري)', 'Attached Coupon Code (Optional)')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SPORT10, VIP20"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  {L('نص الرسالة', 'Message Body')} *
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={L(
                    'اكتب نص الرسالة هنا، يمكنك استخدام {name} لاسم العميل و {coupon} لكود الخصم',
                    'Write message here, use {name} and {coupon} tags'
                  )}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {L('العلامات المتاحة:', 'Available tags:')}{' '}
                  <span className="font-mono text-blue-400">{'{name}'}</span>,{' '}
                  <span className="font-mono text-amber-400">{'{coupon}'}</span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                  {L('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500">
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? L('جارٍ الإطلاق...', 'Launching...') : L('إطلاق الحملة وحفظها', 'Launch & Save Campaign')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

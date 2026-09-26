import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { parseStored } from '@/lib/settings-registry';
import { num } from '@/lib/pricing';
import CampaignsManager, { CampaignRecord, CustomerAudienceItem } from '@/components/admin/CampaignsManager';

export const dynamic = 'force-dynamic';

export default async function AdminCampaignsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const [rawCustomers, campaignSetting] = await Promise.all([
    prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        orders: { select: { totalAmount: true, createdAt: true } },
        sales: { select: { totalAmount: true, createdAt: true } },
      },
    }),
    prisma.setting.findUnique({ where: { key: 'marketing.campaigns' } }),
  ]);

  const now = Date.now();
  const customers: CustomerAudienceItem[] = rawCustomers.map((c) => {
    const all = [
      ...c.orders.map((o) => ({ amount: num(o.totalAmount), date: o.createdAt })),
      ...c.sales.map((s) => ({ amount: num(s.totalAmount), date: s.createdAt })),
    ];
    const totalSpent = all.reduce((sum, t) => sum + t.amount, 0);
    const count = all.length;
    const daysSinceCreated = (now - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);

    all.sort((a, b) => b.date.getTime() - a.date.getTime());
    const lastDate = all[0] ? all[0].date.getTime() : null;
    const daysSinceLastOrder = lastDate ? (now - lastDate) / (1000 * 60 * 60 * 24) : 999;

    let segment: CustomerAudienceItem['segment'] = 'ACTIVE';
    if (totalSpent >= 3000 || count >= 5) {
      segment = 'VIP';
    } else if (daysSinceCreated <= 30 && count <= 1) {
      segment = 'NEW';
    } else if (count === 0 || daysSinceLastOrder > 60) {
      segment = 'INACTIVE';
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      segment,
    };
  });

  const parsed = campaignSetting ? (parseStored(campaignSetting.value, []).value as CampaignRecord[]) : [];
  const initialCampaigns: CampaignRecord[] = Array.isArray(parsed) ? parsed : [];

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'الحملات والرسائل التسويقية (Marketing Campaigns)' : 'Marketing Campaigns & Broadcasts'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'إنشاء وإطلاق حملات تسويقية ذكية لشرائح العملاء، إرسال عروض ترويجية وكوبونات خصم عبر واتساب و SMS'
            : 'Build and dispatch targeted WhatsApp & SMS promotional broadcasts to customer segments'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <CampaignsManager initialCampaigns={initialCampaigns} customers={customers} />
      </div>
    </>
  );
}

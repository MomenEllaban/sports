import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { parseStored } from '@/lib/settings-registry';
import AutoPromosManager from '@/components/admin/AutoPromosManager';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPromosPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const promoSetting = await prisma.setting.findUnique({
    where: { key: 'marketing.autoPromos' },
  });

  const parsed = promoSetting ? parseStored(promoSetting.value, null).value : null;

  const initialConfig = {
    freeShippingEnabled: true,
    freeShippingThreshold: 1000,
    bulkDiscountEnabled: true,
    bulkMinQty: 3,
    bulkPercent: 10,
    cartTierDiscountEnabled: false,
    cartTierMinTotal: 2500,
    cartTierPercent: 15,
    promoBannerTextAr: 'خصم 10% تلقائياً عند شراء 3 قطع أو أكثر + شحن مجاني فوق 1000 ج.م!',
    promoBannerTextEn: '10% off when buying 3+ items + Free shipping on orders over 1000 EGP!',
    ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
  };

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-400" />
          {L('العروض والخصومات التلقائية (Auto Promotions)', 'Automatic Cart Promotions & Bundles')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'قواعد الخصم الذكية المطبقة تلقائياً بدون كود (شحن مجاني عند حد معين، خصم شراء قطع متعددة، وخصم شرائح السلة).',
            'Smart automatic discount rules: Cart threshold free shipping, multi-item bulk discount, and announcement banner.'
          )}
        </p>
      </div>

      <div className="animate-fade-up">
        <AutoPromosManager initial={initialConfig} />
      </div>
    </>
  );
}

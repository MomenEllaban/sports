import React from 'react';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { TicketPercent } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import CouponsManager from '@/components/admin/CouponsManager';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <TicketPercent className="w-6 h-6 text-purple-400" />
          الكوبونات والعروض
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">أكواد خصم موحدة للمتجر والكاشير مع سقف وحد استخدام</p>
      </div>
      <CouponsManager
        initial={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          kind: c.kind,
          value: num(c.value),
          capAmount: num(c.capAmount),
          minTotal: num(c.minTotal),
          usageLimit: c.usageLimit,
          usedCount: c.usedCount,
          isActive: c.isActive,
          startsAt: c.startsAt?.toISOString() || null,
          endsAt: c.endsAt?.toISOString() || null,
        }))}
      />
    </>
  );
}

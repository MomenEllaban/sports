import React, { Suspense } from 'react';
import { getLocale } from 'next-intl/server';
import { PageHeader } from '@/components/ui/foundation';
import { requirePageRole } from '@/lib/auth/require-page';
import ActionQueuesSection from '@/components/admin/dashboard/ActionQueuesSection';
import KpiCardsSection from '@/components/admin/dashboard/KpiCardsSection';
import RevenueChartSection from '@/components/admin/dashboard/RevenueChartSection';
import RecentActivitySection from '@/components/admin/dashboard/RecentActivitySection';
import {
  ActionQueuesSkeleton,
  KpiCardsSkeleton,
  RevenueChartSkeleton,
  RecentActivitySkeleton,
} from '@/components/admin/dashboard/DashboardSkeletons';

export const dynamic = 'force-dynamic';

/**
 * KPI dashboard (Streaming & Suspense enabled):
 * Decoupled React Server Components streaming in parallel.
 * Non-blocking initial render under 50ms with instant skeleton cards.
 */
export default async function AdminDashboardPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';

  return (
    <>
      <PageHeader
        title={isAr ? 'لوحة التحكم والملخص العام' : 'Dashboard & Overview'}
        description={isAr ? 'متابعة فورية للمبيعات والمخزون والورديات عبر كافة الفروع' : 'Real-time sales, inventory, and shift monitoring across all branches'}
        actions={
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
            {isAr ? 'آخر تحديث عند الفتح' : 'Updated on open'}
          </span>
        }
      />

      {/* Action queues (Pending payments, unreviewed transfers, open shifts, RMA) */}
      <Suspense fallback={<ActionQueuesSkeleton />}>
        <ActionQueuesSection />
      </Suspense>

      {/* Primary KPI Metrics */}
      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCardsSection />
      </Suspense>

      {/* 7-day revenue trend chart */}
      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChartSection />
      </Suspense>

      {/* Recent Orders Table & Low-stock Alerts */}
      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivitySection />
      </Suspense>
    </>
  );
}

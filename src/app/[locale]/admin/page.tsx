import React, { Suspense } from 'react';
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

  return (
    <>
      <PageHeader
        title="لوحة التحكم والملخص العام"
        description="متابعة فورية للمبيعات والمخزون والورديات عبر كافة الفروع"
        actions={
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
            محدث مباشرة
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

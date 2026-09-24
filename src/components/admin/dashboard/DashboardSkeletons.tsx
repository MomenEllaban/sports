import React from 'react';
import { Skeleton } from '@/components/ui/foundation';

export function ActionQueuesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-16 rounded-2xl" />
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
      <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}

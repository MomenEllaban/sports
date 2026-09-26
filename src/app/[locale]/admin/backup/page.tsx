import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import DatabaseBackupManager, { DatabaseStats } from '@/components/admin/DatabaseBackupManager';

export const dynamic = 'force-dynamic';

export default async function AdminBackupPage() {
  await requirePageRole('SUPER_ADMIN');
  const isAr = (await getLocale()) === 'ar';

  const [
    customersCount,
    productsCount,
    ordersCount,
    salesCount,
    branchesCount,
    suppliersCount,
    inventoryCount,
    auditCount,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.sale.count(),
    prisma.branch.count(),
    prisma.supplier.count(),
    prisma.branchInventory.count(),
    prisma.auditLog.count(),
  ]);

  const stats: DatabaseStats = {
    customersCount,
    productsCount,
    ordersCount,
    salesCount,
    branchesCount,
    suppliersCount,
    inventoryCount,
    auditCount,
  };

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'النسخ الاحتياطي وصحة النظام (Database Backup & Disaster Recovery)' : 'Database Backup & Recovery'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'تصدير لقطات كاملة لقاعدة البيانات، تنزيل ملفات الجداول بصيغة JSON، ومتابعة صحة جداول النظام'
            : 'Export complete database snapshots, download table datasets in JSON, and monitor schema health'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <DatabaseBackupManager stats={stats} />
      </div>
    </>
  );
}

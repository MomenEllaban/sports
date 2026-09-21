import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import CodSettlementManager from '@/components/admin/CodSettlementManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function CodSettlementPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');

  const orders = await prisma.order.findMany({
    where: { paymentMethod: 'COD' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      branch: { select: { id: true, name: true, nameEn: true } },
      customer: { select: { name: true, phone: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-100">تسوية مبالغ الشحن النقدي (COD)</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              مطابقة كشوف التحصيل من شركات الشحن مع طلبات الدفع عند الاستلام وكشف الفروقات
            </p>
          </div>
          <div className="glass-panel rounded-3xl border border-slate-800 p-5">
            <CodSettlementManager
              initialOrders={orders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                branchId: o.branchId,
                branchName: o.branch.name,
                customerName: o.customer?.name || o.guestName,
                guestPhone: o.guestPhone,
                trackingNumber: o.trackingNumber,
                orderStatus: o.orderStatus,
                paymentStatus: o.paymentStatus,
                collectedAmount: num(o.totalAmount),
                remittedAmount: num(o.codRemitted),
                codReconciled: o.codReconciled,
                createdAt: o.createdAt.toISOString(),
              }))}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

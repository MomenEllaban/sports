import React from 'react';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import LabelsClient from '@/components/admin/LabelsClient';

export const dynamic = 'force-dynamic';

export default async function LabelsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, nameAr: true, sku: true, barcode: true, price: true },
    take: 2000,
  });
  return (
    <>
      <div className="border-b border-slate-800 pb-4 print:hidden">
        <h1 className="text-2xl font-black text-slate-100">طباعة ملصقات الباركود</h1>
        <p className="text-xs text-slate-400 mt-0.5">EAN-13 من الباركود المسجل (أو CODE128) — اختر الأصناف واطبع</p>
      </div>
      <LabelsClient products={products.map((p) => ({ ...p, price: num(p.price) }))} />
    </>
  );
}

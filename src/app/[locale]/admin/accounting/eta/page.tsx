import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import EtaTaxManager, { TaxInvoiceRow } from '@/components/admin/EtaTaxManager';

export const dynamic = 'force-dynamic';

export default async function AdminAccountingEtaPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';

  const rawInvoices = await prisma.taxInvoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      branch: { select: { name: true, nameEn: true } },
      order: { select: { orderNumber: true } },
      sale: { select: { saleNumber: true } },
    },
  });

  const invoices: TaxInvoiceRow[] = rawInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    etaUuid: inv.etaUuid,
    orderNumber: inv.order?.orderNumber || null,
    saleNumber: inv.sale?.saleNumber || null,
    branchName: isAr ? inv.branch.name : (inv.branch.nameEn || inv.branch.name),
    totalAmount: num(inv.totalAmount),
    vatAmount: num(inv.vatAmount),
    status: inv.status,
    qrCodeData: inv.qrCodeData,
    etaResponseText: inv.etaResponseText,
    createdAt: inv.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'منظومة الفاتورة الإلكترونية والضرائب (ETA E-Invoicing)' : 'Egyptian Tax Authority (ETA) E-Invoicing'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'متابعة الفواتير المعتمدة من مصلحة الضرائب المصرية، إقرارات ضريبة القيمة المضافة 14%، وإعادة إرسال الفواتير المعلقة'
            : 'Track ETA e-invoices, VAT 14% declarations, QR verification, and retry failed submissions'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <EtaTaxManager invoices={invoices} />
      </div>
    </>
  );
}

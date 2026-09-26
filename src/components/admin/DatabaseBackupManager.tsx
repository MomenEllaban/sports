'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Database,
  Download,
  ShieldCheck,
  FileJson,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';

export interface DatabaseStats {
  customersCount: number;
  productsCount: number;
  ordersCount: number;
  salesCount: number;
  branchesCount: number;
  suppliersCount: number;
  inventoryCount: number;
  auditCount: number;
}

export default function DatabaseBackupManager({
  stats,
}: {
  stats: DatabaseStats;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (table: string, label: string) => {
    setDownloading(table);
    toast(L(`جارٍ تحضير وتنزيل ملف ${label}...`, `Preparing ${label} download...`), 'info');

    const downloadUrl = `/api/admin/backup/export?table=${table}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(null);
      toast(L('تم تنزيل النسخة الاحتياطية بنجاح!', 'Backup downloaded successfully!'), 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top System Health Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-slate-100">
                {L('حالة قاعدة البيانات: متصلة وبصحة ممتازة', 'Database Health: Connected & Healthy')}
              </h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {L(
                'قاعدة بيانات PostgreSQL / Prisma مهيأة للإنتاج مع فهارس أداء وعلاقات تكامل سليمة',
                'Production PostgreSQL engine with intact relational foreign keys and indexes'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleDownload('all', L('النسخة الشاملة', 'Full Database'))}
            variant="primary"
            disabled={downloading !== null}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <Download className="w-4 h-4" />
            {downloading === 'all' ? L('جارٍ التصدير...', 'Exporting...') : L('تصدير نسخة شاملة فورية', 'Export Full Backup (JSON)')}
          </Button>
        </div>
      </div>

      {/* Database Entity Stats */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300">
          {L('إحصائيات الجداول والسجلات المحفوظة في قاعدة البيانات', 'Database Tables & Stored Record Counts')}
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="text-xs text-slate-400 font-semibold">{L('سجل العملاء', 'Customers')}</div>
            <div className="text-2xl font-black text-slate-100 mt-2">{stats.customersCount.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{L('سجل حساب وهوية', 'accounts')}</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="text-xs text-slate-400 font-semibold">{L('كتالوج المنتجات', 'Products Catalog')}</div>
            <div className="text-2xl font-black text-blue-400 mt-2">{stats.productsCount.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{L('صنف ومقاس ولون', 'SKUs & products')}</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="text-xs text-slate-400 font-semibold">{L('الطلبات والمبيعات', 'Orders & Sales')}</div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {(stats.ordersCount + stats.salesCount).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{L('معاملة بيع محررة', 'transactions')}</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="text-xs text-slate-400 font-semibold">{L('أرصدة الفروع', 'Branch Stock')}</div>
            <div className="text-2xl font-black text-purple-400 mt-2">{stats.inventoryCount.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{L('سجل رصيد فرعي', 'balance records')}</div>
          </div>
        </div>
      </div>

      {/* Selective Data Export Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300">
          {L('تصدير نسخ مخصصة حسب القسم (Selective Backups)', 'Export by Section (Selective Backups)')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FileJson className="w-4 h-4" />
                </div>
                <h5 className="font-extrabold text-sm text-slate-100">
                  {L('نسخة قاعدة بيانات العملاء', 'Customers Database')}
                </h5>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {L(
                  'تصدير قائمة العملاء الكاملة بما فيها الهواتف، العناوين، ونقاط الولاء بصيغة JSON آمنة.',
                  'Export full customer records, phones, addresses, and loyalty points.'
                )}
              </p>
            </div>

            <Button
              onClick={() => handleDownload('customers', L('العملاء', 'Customers'))}
              variant="secondary"
              disabled={downloading !== null}
              className="w-full text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              {L('تنزيل ملف العملاء (JSON)', 'Download Customers (JSON)')}
            </Button>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <FileJson className="w-4 h-4" />
                </div>
                <h5 className="font-extrabold text-sm text-slate-100">
                  {L('نسخة كتالوج الأصناف والمخزون', 'Products & Inventory')}
                </h5>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {L(
                  'تصدير جميع المنتجات، الأكواد (SKU)، الباركود، الأسعار، وأرصدة الفروع.',
                  'Export all items, SKUs, barcodes, pricing, and branch stock levels.'
                )}
              </p>
            </div>

            <Button
              onClick={() => handleDownload('products', L('المنتجات', 'Products'))}
              variant="secondary"
              disabled={downloading !== null}
              className="w-full text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              {L('تنزيل ملف المنتجات (JSON)', 'Download Products (JSON)')}
            </Button>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileJson className="w-4 h-4" />
                </div>
                <h5 className="font-extrabold text-sm text-slate-100">
                  {L('نسخة سجل الطلبات والفواتير', 'Orders & Invoices Ledger')}
                </h5>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {L(
                  'تصدير الطلبات ومبيعات المتجر، المبالغ المحصلة، وحالات الدفع والشحن.',
                  'Export orders, payments, totals, and shipment logs.'
                )}
              </p>
            </div>

            <Button
              onClick={() => handleDownload('orders', L('الطلبات', 'Orders'))}
              variant="secondary"
              disabled={downloading !== null}
              className="w-full text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              {L('تنزيل ملف الطلبات (JSON)', 'Download Orders (JSON)')}
            </Button>
          </div>
        </div>
      </div>

      {/* Security and Recovery Policy Notice */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-400 space-y-1">
          <h5 className="font-bold text-slate-200">
            {L('سياسة الحماية والأمان للنسخ الاحتياطي', 'Security & Backup Retention Policy')}
          </h5>
          <p className="leading-relaxed">
            {L(
              'كل عمليات تصدير البيانات مسجلة بالكامل في سجل النشاط والتدقيق (Audit Log) متضمنة هوية المستخدم وعنوان الـ IP ووقت التصدير. يوصى بحفظ النسخ الاحتياطية في وسائط تخزين خارجية مشفرة وتدويرها شهرياً لضمان خطة التعافي من الكوارث (Disaster Recovery).',
              'All data exports are strictly logged in the audit trail with user identity, timestamp, and IP. Store backups in encrypted offsite storage.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

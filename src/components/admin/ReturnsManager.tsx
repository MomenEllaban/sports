'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { DataTable, EmptyState } from '@/components/ui/foundation';

export interface ReturnRow {
  id: string;
  returnNumber: string;
  status: string;
  type: string;
  channel: string;
  source: string;
  createdAt: string;
  branch: { name: string };
  order: { orderNumber: string } | null;
  sale: { saleNumber: string } | null;
  items: Array<{ quantity: number; reasonCode: string; product: { nameAr: string } }>;
  refunds: Array<{ status: string; amount: number }>;
}

const STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUND_PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const NEEDS_ACTION = new Set(['REQUESTED', 'RECEIVED', 'REFUND_PENDING']);

const statusAr: Record<string, string> = {
  REQUESTED: 'بانتظار الاعتماد',
  APPROVED: 'معتمد',
  RECEIVED: 'مستلم',
  REFUND_PENDING: 'بانتظار الاسترداد',
  COMPLETED: 'مكتمل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغي',
};

export default function ReturnsManager({ initial, branches, counts }: {
  initial: ReturnRow[];
  branches: Array<{ id: string; name: string }>;
  counts: Record<string, number>;
}) {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status, channel, branch, q, setPage]);

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (channel) p.set('channel', channel);
      if (branch) p.set('branch', branch);
      if (q.trim()) p.set('q', q.trim());
      const res = await fetch(`/api/admin/returns?${p}`);
      const data = await res.json();
      if (data.success) setRows(data.returns);
    } finally {
      setLoading(false);
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Status chips */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="حالات المرتجعات">
        <button
          role="tab"
          aria-selected={status === ''}
          onClick={() => { setStatus(''); }}
          className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-bold ${status === '' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
        >
          الكل ({Object.values(counts).reduce((s, n) => s + n, 0)})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(status === s ? '' : s)}
            className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-bold ${status === s ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'} ${NEEDS_ACTION.has(s) ? 'ring-1 ring-amber-500/50' : ''}`}
          >
            {statusAr[s]} ({counts[s] || 0})
          </button>
        ))}
      </div>

      {/* Filters */}
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم RTN/طلب/هاتف..." aria-label="بحث" className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" dir="ltr" />
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="القناة" className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
          <option value="">كل القنوات</option>
          {['POS', 'ONLINE', 'WHATSAPP', 'ADMIN', 'AUTO_COURIER'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="الفرع" className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
          <option value="">كل الفروع</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="submit" disabled={loading} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold col-span-2 md:col-span-1">
          {loading ? '...' : 'بحث'}
        </button>
        <Link href="/admin/returns/new" className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 col-span-2 md:col-span-1">
          <Plus className="w-4 h-4" /> مرتجع جديد
        </Link>
      </form>

      {rows.length === 0 && !loading ? (
        <EmptyState
          title={isAr ? 'لا توجد مرتجعات مطابقة' : 'No matching returns'}
          hint={isAr ? 'أنشئ أول طلب مرتجع من الزر أعلاه.' : 'Create the first return above.'}
          actionLabel={isAr ? 'مرتجع جديد' : 'New return'}
          onAction={() => router.push('/admin/returns/new')}
        />
      ) : (
        <DataTable
          rows={rows.map((r) => ({ ...r }))}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          emptyTitle="لا توجد مرتجعات"
          columns={[
            {
              key: 'returnNumber', header: 'RTN', render: (r) => (
                <Link href={`/admin/returns/${r.id}`} className="font-mono font-black text-amber-400 hover:underline" dir="ltr">{r.returnNumber}</Link>
              ),
            },
            {
              key: 'doc', header: 'المستند', hideOnMobile: true, render: (r) => (
                <span className="font-mono text-slate-300" dir="ltr">{r.order?.orderNumber || r.sale?.saleNumber || '—'}</span>
              ),
            },
            {
              key: 'status', header: 'الحالة', render: (r) => (
                <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${NEEDS_ACTION.has(r.status) ? 'bg-amber-500/15 text-amber-300' : r.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {statusAr[r.status] || r.status}
                </span>
              ),
            },
            { key: 'channel', header: 'القناة', hideOnMobile: true, render: (r) => r.channel },
            { key: 'branch', header: 'الفرع', render: (r) => r.branch.name },
            {
              key: 'refund', header: 'الاسترداد', render: (r) => (
                r.refunds.length > 0
                  ? <span className={`font-bold text-[11px] ${r.refunds[0].status === 'DONE' ? 'text-emerald-400' : r.refunds[0].status === 'FAILED' || r.refunds[0].status === 'MANUAL_REQUIRED' ? 'text-rose-400' : 'text-amber-300'}`}>
                    {r.refunds[0].status} • {Number(r.refunds[0].amount).toLocaleString()}
                  </span>
                  : <span className="text-slate-500">—</span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

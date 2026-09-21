'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';

interface AuditRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  branchId: string | null;
  metadata: string | null;
}

export default function AuditViewer({ logs }: { logs: AuditRow[] }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [q, setQ] = useState('');

  const filtered = logs.filter(
    (l) =>
      !q ||
      l.action.toLowerCase().includes(q.toLowerCase()) ||
      l.entity.toLowerCase().includes(q.toLowerCase()) ||
      (l.entityId || '').includes(q)
  );

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={isAr ? 'بحث بفعل أو كيان أو معرف...' : 'Search action/entity/id...'}
        aria-label={isAr ? 'بحث في سجل التدقيق' : 'Search audit log'}
        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-72 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'الوقت' : 'Time'}</th>
              <th className="p-3">{isAr ? 'الفاعل' : 'Actor'}</th>
              <th className="p-3">{isAr ? 'الفعل' : 'Action'}</th>
              <th className="p-3">{isAr ? 'الكيان' : 'Entity'}</th>
              <th className="p-3">{isAr ? 'التفاصيل' : 'Details'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-slate-900/50">
                <td className="p-3 text-slate-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</td>
                <td className="p-3 font-mono text-[10px] text-slate-500">{l.actorId ? l.actorId.slice(-6) : '—'}</td>
                <td className="p-3 font-bold text-amber-400" dir="ltr">{l.action}</td>
                <td className="p-3 text-slate-300">{l.entity}{l.entityId ? <span className="text-slate-500 font-mono text-[10px]"> #{l.entityId.slice(-6)}</span> : null}</td>
                <td className="p-3 text-slate-400 font-mono text-[10px] max-w-[280px] truncate" dir="ltr">{l.metadata || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{isAr ? 'لا توجد قيود' : 'No entries'}</div>}
      </div>
    </div>
  );
}

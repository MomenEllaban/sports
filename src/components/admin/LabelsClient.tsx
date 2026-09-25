'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { NumberField } from '@/components/ui/foundation';
import { useLocale } from 'next-intl';

/** Printable EAN-13 label sheet (T13): search product → copies → print. */
export default function LabelsClient({ products }: {
  products: Array<{ id: string; nameAr: string; nameEn: string; sku: string; barcode: string | null; price: number }>;
}) {
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<typeof products>([]);
  const [copies, setCopies] = useState(12);
  const refs = useRef(new Map<string, SVGSVGElement>());

  const matches = query.trim()
    ? products.filter((p) => (isAr ? p.nameAr : p.nameEn).includes(query.trim()) || p.sku.toLowerCase().includes(query.trim().toLowerCase()) || (p.barcode || '').includes(query.trim())).slice(0, 8)
    : [];

  useEffect(() => {
    // Render EAN-13 (fallback to CODE128 when the value isn't 12/13 digits).
    for (const p of selected) {
      for (let i = 0; i < copies; i++) {
        const el = refs.current.get(`${p.id}-${i}`);
        if (!el || !p.barcode) continue;
        try {
          const digits = p.barcode.replace(/\D/g, '');
          if (digits.length === 12 || digits.length === 13) {
            JsBarcode(el, digits, { format: 'EAN13', width: 2, height: 60, displayValue: true, fontSize: 14 });
          } else {
            JsBarcode(el, p.barcode, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14 });
          }
        } catch {
          /* leave blank on invalid value */
        }
      }
    }
  }, [selected, copies]);

  const toggle = (p: (typeof products)[number]) => {
    setSelected((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]));
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_120px_auto] gap-2 text-xs print:hidden">
        <div className="relative">
          <label htmlFor="lb-search" className="block font-bold text-slate-300 mb-1">{L('بحث بالاسم / SKU / باركود', 'Search by name / SKU / barcode')}</label>
          <input id="lb-search" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          {matches.length > 0 && (
            <ul className="app-scrollbar absolute z-10 mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 max-h-48 overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { toggle(p); setQuery(''); }} className="w-full min-h-[44px] text-start px-3 py-2 hover:bg-slate-800 text-xs">
                    <span className="font-bold">{isAr ? p.nameAr : p.nameEn}</span> <span className="text-slate-500 font-mono">{p.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="lb-copies" className="block font-bold text-slate-300 mb-1">{L('نسخ/صنف', 'Copies/item')}</label>
          <NumberField id="lb-copies" min={1} max={100} step={1} value={copies} onChange={setCopies} inputClassName="w-full text-center" />
        </div>
        <div className="flex items-end">
          <button onClick={() => window.print()} disabled={selected.length === 0} className="w-full min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold">
            {L('طباعة', 'Print')} ({selected.length})
          </button>
        </div>
      </div>

      {selected.length === 0 ? (
        <p className="text-xs text-slate-500 print:hidden">{L('اختر أصنافاً لمعاينة الملصقات ثم اطبع.', 'Select items to preview labels, then print.')}</p>
      ) : (
        <div className="labels-sheet grid grid-cols-2 sm:grid-cols-3 gap-2">
          {selected.flatMap((p) =>
            Array.from({ length: copies }, (_, i) => (
              <div key={`${p.id}-${i}`} className="label-cell rounded-xl border border-slate-700 bg-white text-slate-900 p-2 text-center">
                <p className="text-[10px] font-bold truncate">{isAr ? p.nameAr : p.nameEn}</p>
                {p.barcode ? (
                  <svg ref={(el) => { if (el) refs.current.set(`${p.id}-${i}`, el); }} className="mx-auto" />
                ) : (
                  <p className="text-[10px] text-rose-600 font-bold">{L('بلا باركود', 'No barcode')}</p>
                )}
                <p className="text-[11px] font-black">{p.price.toLocaleString()} {L('ج.م', 'EGP')}</p>
              </div>
            ))
          )}
        </div>
      )}
      <style>{`@media print { body * { visibility: hidden; } .labels-sheet, .labels-sheet * { visibility: visible; } .labels-sheet { position: absolute; inset: 0; background: #fff; } .label-cell { break-inside: avoid; } }`}</style>
    </div>
  );
}

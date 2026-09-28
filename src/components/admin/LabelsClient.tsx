'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { NumberField } from '@/components/ui/foundation';
import { useLocale } from 'next-intl';
import { apiFetch } from './ui';
import { isPrintableCode, printCode, rawCode, symbologyOf } from '@/lib/labels/symbology';

type Product = {
  id: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  barcode: string | null;
  gs1Code: string | null;
  price: number;
};

const MAX_COPIES = 100;

export default function LabelsClient() {
  const isAr = useLocale() === 'ar';
  // Memoised so it can sit in the typeahead effect's dependency list without
  // re-triggering the search on every render.
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Product[]>([]);
  const [copies, setCopies] = useState(12);
  const [searchError, setSearchError] = useState('');
  const [showList, setShowList] = useState(false);
  const refs = useRef(new Map<string, SVGSVGElement>());

  // Server-side typeahead. Debounced and abortable so a fast typist does not
  // race several in-flight searches. The locale is in the dependency list so
  // an error message is re-labelled when the user switches language.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const data = (await apiFetch(
            `/api/admin/labels/search?q=${encodeURIComponent(term)}`,
            'GET',
          )) as { products: Product[] };
          if (!controller.signal.aborted) {
            setMatches(data.products);
            setSearchError('');
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            setSearchError(
              err instanceof Error ? err.message : L('تعذر البحث', 'Search failed'),
            );
            setMatches([]);
          }
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, L]);

  useEffect(() => {
    // Encode each label with the symbology its stored code actually supports.
    for (const p of selected) {
      const symbology = symbologyOf(p);
      const code = printCode(p);
      if (!symbology || !code) continue;
      for (let i = 0; i < copies; i++) {
        const el = refs.current.get(`${p.id}-${i}`);
        if (!el) continue;
        try {
          JsBarcode(el, code, {
            format: symbology,
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
          });
        } catch {
          /* leave blank on an invalid value rather than printing a broken label */
        }
      }
    }
  }, [selected, copies]);

  const add = (p: Product) => {
    if (!isPrintableCode(p)) {
      setSearchError(
        L(
          'هذا الصنف بلا باركود صالح. أضف كود GS1 أو باركود من صفحة المنتج أولًا.',
          'This item has no printable barcode. Add a GS1 code or barcode on the product page first.',
        ),
      );
      return;
    }
    setSelected((current) => (current.some((x) => x.id === p.id) ? current : [...current, p]));
    setQuery('');
    setMatches([]);
    setSearchError('');
  };

  const remove = (id: string) => setSelected((current) => current.filter((x) => x.id !== id));

  const totalLabels = selected.length * copies;
  const listId = 'lb-results';

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-xs print:hidden sm:grid-cols-[1fr_120px_auto]">
        <div className="relative">
          <label htmlFor="lb-search" className="mb-1 block font-bold text-slate-300">
            {L('بحث بالاسم / SKU / باركود', 'Search by name / SKU / barcode')}
          </label>
          <input
            id="lb-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
            role="combobox"
            aria-expanded={showList && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={L('اكتب حرفين على الأقل...', 'Type at least two characters...')}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5"
          />
          {showList && (matches.length > 0 || searching) && (
            <ul
              id={listId}
              role="listbox"
              className="app-scrollbar absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900"
            >
              {searching && matches.length === 0 && (
                <li className="px-3 py-2 text-xs text-slate-500">{L('جاري البحث...', 'Searching...')}</li>
              )}
              {matches.map((p) => {
                const code = rawCode(p);
                const already = selected.some((x) => x.id === p.id);
                return (
                  <li key={p.id} role="option" aria-selected={already}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(p)}
                      disabled={already}
                      className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-start text-xs hover:bg-slate-800 disabled:opacity-50"
                    >
                      <span>
                        <span className="font-bold">{isAr ? p.nameAr : p.nameEn}</span>{' '}
                        <span className="font-mono text-slate-500">{p.sku}</span>
                      </span>
                      {code ? (
                        <span className="font-mono text-[10px] text-emerald-400">
                          {p.gs1Code ? `GS1 ${code}` : code}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-400">
                          {L('بلا باركود', 'No barcode')}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="lb-copies" className="mb-1 block font-bold text-slate-300">
            {L('نسخ/صنف', 'Copies/item')}
          </label>
          <NumberField
            id="lb-copies"
            min={1}
            max={MAX_COPIES}
            step={1}
            value={copies}
            onChange={setCopies}
            inputClassName="w-full text-center"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => window.print()}
            disabled={selected.length === 0}
            className="min-h-[44px] w-full rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-500 disabled:opacity-50 print:hidden"
          >
            {L('طباعة', 'Print')}
            {selected.length > 0 && ` (${totalLabels})`}
          </button>
        </div>
      </div>

      {searchError && (
        <p role="alert" className="status-danger print:hidden rounded-xl border p-3 text-xs font-bold">
          {searchError}
        </p>
      )}

      {selected.length === 0 ? (
        <p className="text-xs text-slate-500 print:hidden">
          {L(
            'ابحث عن صنف وأضفه لمعاينة الملصقات ثم اطبع. الأصناف بلا باركود لا يمكن طباعتها.',
            'Search for an item and add it to preview labels, then print. Items without a barcode cannot be printed.',
          )}
        </p>
      ) : (
        <>
          {/* Selection summary stays on screen; only the label sheet is printed. */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs font-bold text-slate-300">
              {L(
                `${selected.length} صنف · ${totalLabels} ملصق`,
                `${selected.length} item${selected.length === 1 ? '' : 's'} · ${totalLabels} label${totalLabels === 1 ? '' : 's'}`,
              )}
            </span>
            {selected.map((p) => (
              <button
                key={p.id}
                onClick={() => remove(p.id)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 text-[11px] font-bold text-slate-300 hover:border-rose-500/40 hover:text-rose-400"
                aria-label={`${L('إزالة', 'Remove')} ${isAr ? p.nameAr : p.nameEn}`}
              >
                {p.sku}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              onClick={() => setSelected([])}
              className="min-h-[36px] rounded-full border border-slate-700 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-200"
            >
              {L('مسح الكل', 'Clear all')}
            </button>
          </div>

          <div className="labels-sheet grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selected.flatMap((p) => {
              const code = rawCode(p);
              return Array.from({ length: copies }, (_, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="label-cell rounded-xl border border-slate-700 bg-white p-2 text-center text-slate-900"
                >
                  <p className="truncate text-[10px] font-bold">{isAr ? p.nameAr : p.nameEn}</p>
                  <p className="font-mono text-[9px] text-[#64748b]">{p.sku}</p>
                  <svg
                    ref={(el) => {
                      if (el) refs.current.set(`${p.id}-${i}`, el);
                    }}
                    className="mx-auto"
                  />
                  <p className="text-[11px] font-black">
                    {p.price.toLocaleString()} {L('ج.م', 'EGP')}
                  </p>
                  {code ? null : (
                    <p className="text-[10px] font-bold text-rose-600">
                      {L('بلا باركود', 'No barcode')}
                    </p>
                  )}
                </div>
              ));
            })}
          </div>
        </>
      )}
      <style>{`@media print { body * { visibility: hidden; } .labels-sheet, .labels-sheet * { visibility: visible; } .labels-sheet { position: absolute; inset: 0; background: #fff; } .label-cell { break-inside: avoid; } }`}</style>
    </div>
  );
}

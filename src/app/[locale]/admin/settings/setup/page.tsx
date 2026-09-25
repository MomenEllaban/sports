import React from 'react';
import { prisma } from '@/lib/db';
import { ClipboardCheck } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import { SETTINGS_REGISTRY, SETUP_GROUPS, parseStored, statusOf, hasUsableValue } from '@/lib/settings-registry';
import { Link } from '@/i18n/routing';
import { getTranslations, getLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

/**
 * Setup checklist (F0 §1.1): grouped by feature, completion %, per-item
 * status, direct link to the field. Missing required items gate features.
 */
export default async function SetupPage() {
  await requirePageRole('SUPER_ADMIN');
  const t = await getTranslations('setup');
  const isAr = (await getLocale()) === 'ar';
  const rows = await prisma.setting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const items = SETTINGS_REGISTRY.map((def) => {
    const stored = parseStored(byKey.get(def.key) ?? null, def.defaultValue);
    const usable = hasUsableValue(stored.value);
    return { def, status: statusOf(def, stored, usable) };
  });

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-emerald-400" />
          {t('title')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {t('subtitle')}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500">{isAr ? 'لا بنود مسجلة.' : 'No items registered.'}</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {SETUP_GROUPS.map((g) => {
            const gi = items.filter((i) => i.def.group === g.id);
            if (gi.length === 0) return null;
            const req = gi.filter((i) => i.def.required);
            const done = req.filter((i) => i.status === 'CONFIRMED').length;
            const pct = req.length ? Math.round((done / req.length) * 100) : 100;
            return (
              <section key={g.id} className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="font-extrabold text-sm text-slate-100">{isAr ? g.ar : g.en}</h2>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${pct === 100 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {done}/{req.length} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <ul className="space-y-2 text-xs">
                  {gi.map(({ def, status }) => (
                    <li key={def.key} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-200">{isAr ? def.labelAr : def.labelEn} {def.required && <span className="text-rose-400">*</span>}</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{isAr ? def.helpAr : def.helpEn}</div>
                        <div className="text-[10px] text-slate-600 font-mono mt-1" dir="ltr">{def.key}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                          status === 'CONFIRMED' ? 'bg-emerald-500/15 text-emerald-400'
                          : status === 'MISSING' ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {status === 'CONFIRMED' ? t('confirmed') : status === 'MISSING' ? t('missing') : t('defaultUnconfirmed')}
                        </span>
                        <Link href={`/admin/settings#${encodeURIComponent(def.key)}`} className="text-[11px] font-bold text-blue-400 hover:underline min-h-[44px] flex items-center">
                          {t('edit')}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

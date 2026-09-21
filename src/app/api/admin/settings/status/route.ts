import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { SETTINGS_REGISTRY, parseStored, statusOf, hasUsableValue, SETUP_GROUPS } from '@/lib/settings-registry';

/**
 * Setup readiness status (F0 §1.1): per-key status + per-group completion
 * + gated features list. SUPER_ADMIN only.
 */
export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;
    const rows = await prisma.setting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const items = SETTINGS_REGISTRY.map((def) => {
      const stored = parseStored(byKey.get(def.key) ?? null, def.defaultValue);
      const usable = hasUsableValue(stored.value) || hasUsableValue(def.defaultValue);
      const status = statusOf(def, stored, hasUsableValue(stored.value) || usable);
      return { key: def.key, group: def.group, labelAr: def.labelAr, labelEn: def.labelEn, required: def.required, featureGate: def.featureGate, status };
    });
    const groups = SETUP_GROUPS.map((g) => {
      const gi = items.filter((i) => i.group === g.id);
      const req = gi.filter((i) => i.required);
      const done = req.filter((i) => i.status === 'CONFIRMED').length;
      return { id: g.id, ar: g.ar, en: g.en, total: gi.length, required: req.length, confirmed: done, pct: req.length ? Math.round((done / req.length) * 100) : 100 };
    });
    const missingRequired = items.filter((i) => i.required && i.status !== 'CONFIRMED').map((i) => i.key);
    return NextResponse.json({ success: true, items, groups, missingRequired, missingCount: missingRequired.length });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load setup status' }, { status: 500 });
  }
}

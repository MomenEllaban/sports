import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { setSetting, clearSettingsCache } from '@/lib/settings';
import { writeAudit } from '@/lib/audit';

// Keys editable via the settings UI (allowlist — nothing else is writable).
const EDITABLE_KEYS = new Set([
  'store.nameAr', 'store.nameEn', 'store.landline', 'store.whatsapp',
  'store.addressAr', 'store.addressEn', 'store.taxNumber',
  'vat.rate', 'shipping.zones', 'payments.methods',
  'loyalty.earnPerEgp', 'loyalty.pointsPerUnit',
  'discount.approvalThreshold', 'stock.lowThreshold',
  'receipt.headerAr', 'receipt.footerAr',
]);

function validateValue(key: string, value: unknown): string | null {
  switch (key) {
    case 'vat.rate': {
      if (typeof value !== 'number' || !(value >= 0 && value <= 1)) return 'VAT rate must be 0..1';
      return null;
    }
    case 'loyalty.earnPerEgp':
    case 'loyalty.pointsPerUnit':
    case 'discount.approvalThreshold':
    case 'stock.lowThreshold': {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return `${key} must be a non-negative number`;
      return null;
    }
    case 'shipping.zones': {
      if (!Array.isArray(value) || value.length === 0) return 'At least one shipping zone is required';
      for (const z of value as Array<Record<string, unknown>>) {
        if (typeof z.id !== 'string' || !z.id || typeof z.fee !== 'number' || z.fee < 0) {
          return 'Each zone needs an id and a non-negative fee';
        }
      }
      return null;
    }
    case 'payments.methods': {
      if (!Array.isArray(value)) return 'Payment methods must be a list';
      return null;
    }
    default: {
      if (typeof value !== 'string') return `${key} must be text`;
      return null;
    }
  }
}

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;
    const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const settings: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    }
    return NextResponse.json({ success: true, settings });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const body = await req.json();
    const { key, value } = body as { key?: unknown; value?: unknown };
    if (typeof key !== 'string' || !EDITABLE_KEYS.has(key)) {
      return NextResponse.json({ success: false, error: 'Setting is not editable' }, { status: 400 });
    }
    const problem = validateValue(key, value);
    if (problem) {
      return NextResponse.json({ success: false, error: problem }, { status: 400 });
    }
    await setSetting(key, value);
    clearSettingsCache();
    writeAudit({
      actorId: (session?.user as { id?: string })?.id,
      action: 'settings.update',
      entity: 'Setting',
      entityId: key,
      metadata: { key },
    }).catch(() => null);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save setting' }, { status: 500 });
  }
}

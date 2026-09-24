import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { setSetting, clearSettingsCache } from '@/lib/settings';
import { writeAudit } from '@/lib/audit';
import { REGISTRY_KEYS, SENSITIVE_KEYS, parseStored } from '@/lib/settings-registry';
import { maskSecret } from '@/lib/settings-secure';

// Keys editable via the settings UI: exactly the F0 registry allowlist.
const EDITABLE_KEYS = REGISTRY_KEYS;

function validateValue(key: string, value: unknown): string | null {
  switch (key) {
    case 'vat.rate': {
      if (typeof value !== 'number' || !(value >= 0 && value <= 1)) return 'VAT rate must be 0..1';
      return null;
    }
    case 'loyalty.earnPerEgp':
    case 'loyalty.pointsPerUnit':
    case 'loyalty.redeemRate':
    case 'loyalty.maxRedeemPct':
    case 'discount.approvalThreshold':
    case 'discount.maxTotalPct':
    case 'stock.lowThreshold':
    case 'orders.unpaidExpiryHours':
    case 'shifts.openingFloat':
    case 'shifts.maxShortage': {
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
      const validIds = new Set(['COD', 'PAYMOB', 'FAWRY', 'INSTAPAY', 'VODAFONE_CASH', 'CASH', 'CARD']);
      for (const method of value as Array<Record<string, unknown>>) {
        if (!method || typeof method.id !== 'string' || !validIds.has(method.id) || typeof method.enabled !== 'boolean') {
          return 'Each payment method needs a valid id and boolean enabled flag';
        }
        if (method.enabled && method.id === 'INSTAPAY' && (typeof method.handle !== 'string' || !method.handle.trim())) {
          return 'InstaPay destination handle is required before enabling it';
        }
        if (method.enabled && method.id === 'VODAFONE_CASH' && (typeof method.number !== 'string' || !method.number.trim())) {
          return 'Vodafone Cash wallet number is required before enabling it';
        }
      }
      return null;
    }
    case 'eta.mode': {
      if (value !== 'off' && value !== 'preprod' && value !== 'production') return 'ETA mode must be off, preprod or production';
      return null;
    }
    case 'whatsapp.mode': {
      if (value !== 'off' && value !== 'cloud') return 'WhatsApp mode must be off or cloud';
      return null;
    }
    case 'portal.enabled': {
      if (typeof value !== 'boolean') return 'portal.enabled must be true/false';
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
    const masked: Record<string, string> = {};
    for (const r of rows) {
      const { value } = parseStored(r.value, null);
      if (SENSITIVE_KEYS.has(r.key) && typeof value === 'string' && value) {
        // Never leak full secrets to the client; UI edits via blank=new value.
        const { decryptSecret } = await import('@/lib/settings-secure');
        try {
          settings[r.key] = '';
          masked[r.key] = maskSecret(await decryptSecret(value));
        } catch {
          settings[r.key] = '';
          masked[r.key] = '••••';
        }
      } else {
        try {
          settings[r.key] = JSON.parse(r.value);
        } catch {
          settings[r.key] = r.value;
        }
      }
    }
    return NextResponse.json({ success: true, settings, masked });
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
    // Sensitive keys are stored encrypted; blank means "keep existing".
    let toStore: unknown = value;
    if (SENSITIVE_KEYS.has(key)) {
      if (typeof value !== 'string') {
        return NextResponse.json({ success: false, error: `${key} must be text` }, { status: 400 });
      }
      if (!value.trim()) {
        return NextResponse.json({ success: true, kept: true });
      }
      const { encryptSecret } = await import('@/lib/settings-secure');
      toStore = await encryptSecret(value.trim());
    }
    // Mark admin-confirmed: envelope { v, _confirmed } (see settings-registry).
    await setSetting(key, { v: toStore, _confirmed: true });
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

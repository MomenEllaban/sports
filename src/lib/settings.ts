import { prisma } from '@/lib/db';

/**
 * Settings service (T12) — SINGLE SOURCE OF TRUTH for configurable business values.
 * Backed by the Setting table (JSON-encoded values), with sane fallbacks and a
 * short in-memory cache. T12 callers must use these getters, never hardcode.
 */

export const SETTING_KEYS = {
  storeNameAr: 'store.nameAr',
  storeNameEn: 'store.nameEn',
  landline: 'store.landline',
  whatsapp: 'store.whatsapp',
  addressAr: 'store.addressAr',
  addressEn: 'store.addressEn',
  taxNumber: 'store.taxNumber',
  vatRate: 'vat.rate',
  vatMode: 'vat.mode',
  shippingZones: 'shipping.zones',
  paymentMethods: 'payments.methods',
  loyaltyEarnPerEgp: 'loyalty.earnPerEgp',
  loyaltyPointsPerUnit: 'loyalty.pointsPerUnit',
  discountThreshold: 'discount.approvalThreshold',
  lowStockThreshold: 'stock.lowThreshold',
  receiptHeaderAr: 'receipt.headerAr',
  receiptFooterAr: 'receipt.footerAr',
  integrations: 'integrations',
  // 4.1 ETA eInvoicing (settings-gated: off until the customer fills credentials).
  etaMode: 'eta.mode',
  etaClientId: 'eta.clientId',
  etaClientSecret: 'eta.clientSecret',
  etaTaxRegNumber: 'eta.taxRegNumber',
  // 4.2 WhatsApp Business Cloud API (settings-gated).
  whatsappMode: 'whatsapp.mode',
  whatsappPhoneId: 'whatsapp.phoneId',
  whatsappToken: 'whatsapp.token',
  whatsappTemplateOrder: 'whatsapp.templateOrder',
  // 4.3 Customer portal toggle.
  portalEnabled: 'portal.enabled',
} as const;

const cache = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 30_000;

function parse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const row = await prisma.setting.findUnique({ where: { key } });
  let value = parse(row?.value ?? null, fallback);
  // F0: unwrap admin-confirmed envelope { v, _confirmed }.
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'v' in (value as Record<string, unknown>)) {
    value = (value as unknown as { v: T }).v;
  }
  // F0: decrypt sensitive values at the boundary (in-memory only).
  const { SENSITIVE_KEYS } = await import('./settings-registry');
  if (SENSITIVE_KEYS.has(key) && typeof value === 'string' && value) {
    const { decryptSecret } = await import('./settings-secure');
    try {
      value = (await decryptSecret(value)) as T;
    } catch {
      value = '' as T;
    }
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  cache.delete(key);
}

export function clearSettingsCache(): void {
  cache.clear();
}

export interface StoreInfo {
  nameAr: string;
  nameEn: string;
  landline: string;
  whatsapp: string;
  addressAr: string;
  addressEn: string;
  taxNumber: string;
}

export async function getStoreInfo(): Promise<StoreInfo> {
  const [nameAr, nameEn, landline, whatsapp, addressAr, addressEn, taxNumber] = await Promise.all([
    getSetting(SETTING_KEYS.storeNameAr, 'ابطال الرياضة الإبراهيمية'),
    getSetting(SETTING_KEYS.storeNameEn, 'Sports Champions Alexandria'),
    getSetting(SETTING_KEYS.landline, '03 5926908'),
    getSetting(SETTING_KEYS.whatsapp, '01224226876'),
    getSetting(SETTING_KEYS.addressAr, '92 شارع عمر لطفى، الإبراهيمية، الإسكندرية'),
    getSetting(SETTING_KEYS.addressEn, '92 Omar Lotfy St, Ibrahimeyah, Alexandria'),
    getSetting(SETTING_KEYS.taxNumber, '123-456-789'),
  ]);
  return { nameAr, nameEn, landline, whatsapp, addressAr, addressEn, taxNumber };
}

export async function getVatRate(): Promise<number> {
  const v = await getSetting<number>(SETTING_KEYS.vatRate, 0.14);
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.14;
}

export async function getDiscountThreshold(): Promise<number> {
  const v = await getSetting<number>(SETTING_KEYS.discountThreshold, 100);
  return typeof v === 'number' && v >= 0 ? v : 100;
}

export async function getLoyaltyRule(): Promise<{ earnPerEgp: number; pointsPerUnit: number }> {
  const [earnPerEgp, pointsPerUnit] = await Promise.all([
    getSetting<number>(SETTING_KEYS.loyaltyEarnPerEgp, 10),
    getSetting<number>(SETTING_KEYS.loyaltyPointsPerUnit, 1),
  ]);
  return {
    earnPerEgp: earnPerEgp > 0 ? earnPerEgp : 10,
    pointsPerUnit: pointsPerUnit > 0 ? pointsPerUnit : 1,
  };
}

export async function getLowStockThreshold(): Promise<number> {
  const v = await getSetting<number>(SETTING_KEYS.lowStockThreshold, 5);
  return typeof v === 'number' && v >= 0 ? Math.floor(v) : 5;
}

export interface ShippingZone {
  id: string;
  nameAr: string;
  nameEn: string;
  fee: number;
}

export async function getShippingZones(fallback: ShippingZone[]): Promise<ShippingZone[]> {
  const zones = await getSetting<ShippingZone[]>(SETTING_KEYS.shippingZones, fallback);
  return Array.isArray(zones) && zones.length > 0 ? zones : fallback;
}

export type EtaMode = 'off' | 'preprod' | 'production';

export interface EtaConfig {
  mode: EtaMode;
  clientId: string;
  clientSecret: string;
  taxRegNumber: string;
  /** Fully wired only when mode != off AND credentials are filled. */
  ready: boolean;
  /** Human-readable list of what's missing (shown in Settings UI). */
  missing: string[];
}

/** SINGLE SOURCE OF TRUTH for ETA activation state (4.1). */
export async function getEtaConfig(): Promise<EtaConfig> {
  const [mode, clientId, clientSecret, taxRegNumber] = await Promise.all([
    getSetting<string>(SETTING_KEYS.etaMode, 'off'),
    getSetting<string>(SETTING_KEYS.etaClientId, ''),
    getSetting<string>(SETTING_KEYS.etaClientSecret, ''),
    getSetting<string>(SETTING_KEYS.etaTaxRegNumber, ''),
  ]);
  const m: EtaMode = mode === 'production' || mode === 'preprod' ? mode : 'off';
  const missing: string[] = [];
  if (m !== 'off') {
    if (!clientId.trim()) missing.push('Client ID');
    if (!clientSecret.trim()) missing.push('Client Secret');
    if (!taxRegNumber.trim()) missing.push('Tax registration number');
  }
  return { mode: m, clientId, clientSecret, taxRegNumber, ready: m !== 'off' && missing.length === 0, missing };
}

export type WhatsappMode = 'off' | 'cloud';

export interface WhatsAppConfig {
  mode: WhatsappMode;
  phoneId: string;
  token: string;
  templateOrder: string;
  ready: boolean;
  missing: string[];
}

/** SINGLE SOURCE OF TRUTH for WhatsApp Business activation state (4.2). */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const [mode, phoneId, token, templateOrder] = await Promise.all([
    getSetting<string>(SETTING_KEYS.whatsappMode, 'off'),
    getSetting<string>(SETTING_KEYS.whatsappPhoneId, ''),
    getSetting<string>(SETTING_KEYS.whatsappToken, ''),
    getSetting<string>(SETTING_KEYS.whatsappTemplateOrder, 'order_confirmation'),
  ]);
  const m: WhatsappMode = mode === 'cloud' ? 'cloud' : 'off';
  const missing: string[] = [];
  if (m !== 'off') {
    if (!phoneId.trim()) missing.push('Phone Number ID');
    if (!token.trim()) missing.push('API token');
  }
  return { mode: m, phoneId, token, templateOrder, ready: m !== 'off' && missing.length === 0, missing };
}

export async function isPortalEnabled(): Promise<boolean> {
  return getSetting<boolean>(SETTING_KEYS.portalEnabled, true);
}

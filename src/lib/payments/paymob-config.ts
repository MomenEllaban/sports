import { getSetting } from '../settings';

export interface PaymobConfig {
  apiKey: string;
  integrationId: string;
  iframeId: string;
  hmacSecret: string;
  ready: boolean;
  missing: string[];
  /** Explicit mock provider for test/dev only — never in production. */
  mock: boolean;
}

/**
 * Placeholder-looking values (.env samples, docs examples) must NEVER count
 * as configured — otherwise checkout offers a gateway that 403s live (F1).
 */
const PLACEHOLDER_RE = /placeholder|example|changeme|your[-_]?key|test123|^\*+$/i;
export function isPlaceholderValue(v: string): boolean {
  const t = v.trim();
  if (!t) return true;
  if (PLACEHOLDER_RE.test(t)) return true;
  if (/^(123456|654321|1234|0000)$/.test(t)) return true;
  return false;
}

function clean(v: string): string {
  const t = v.trim();
  return isPlaceholderValue(t) ? '' : t;
}

/** SINGLE SOURCE OF TRUTH for Paymob activation (T01). Env = fallback. */
export async function getPaymobConfig(): Promise<PaymobConfig> {
  const [apiKeyS, intS, iframeS, hmacS] = await Promise.all([
    getSetting<string>('paymob.apiKey', ''),
    getSetting<string>('paymob.integrationId', ''),
    getSetting<string>('paymob.iframeId', ''),
    getSetting<string>('paymob.hmacSecret', ''),
  ]);
  const apiKey = clean(apiKeyS) || clean(process.env.PAYMOB_API_KEY || '');
  const integrationId = clean(intS) || clean(process.env.PAYMOB_INTEGRATION_ID || '');
  const iframeId = clean(iframeS) || clean(process.env.PAYMOB_FRAMES_ID || '');
  const hmacSecret = (hmacS.trim() || process.env.PAYMOB_HMAC_SECRET || '').trim();
  const missing: string[] = [];
  if (!apiKey) missing.push('API key');
  if (!integrationId) missing.push('Integration ID');
  if (!iframeId) missing.push('Iframe ID');
  const mock =
    process.env.PAYMOB_PROVIDER === 'mock' && process.env.NODE_ENV !== 'production';
  return { apiKey, integrationId, iframeId, hmacSecret, ready: missing.length === 0, missing, mock };
}

import { getSetting } from '../settings';
import { isPlaceholderValue } from './paymob-config';

export interface FawryConfig {
  merchantCode: string;
  secureKey: string;
  ready: boolean;
  missing: string[];
  mock: boolean;
}

function clean(v: string): string {
  const t = v.trim();
  return isPlaceholderValue(t) ? '' : t;
}

/** SINGLE SOURCE OF TRUTH for Fawry activation (T02). Env = fallback. */
export async function getFawryConfig(): Promise<FawryConfig> {
  const [codeS, keyS] = await Promise.all([
    getSetting<string>('fawry.merchantCode', ''),
    getSetting<string>('fawry.secureKey', ''),
  ]);
  const merchantCode = clean(codeS) || clean(process.env.FAWRY_MERCHANT_CODE || '');
  const secureKey = clean(keyS) || clean(process.env.FAWRY_SECURE_KEY || process.env.FAWRY_SECURITY_KEY || '');
  const missing: string[] = [];
  if (!merchantCode) missing.push('Merchant code');
  if (!secureKey) missing.push('Secure key');
  const mock = process.env.FAWRY_PROVIDER === 'mock' && process.env.NODE_ENV !== 'production';
  return { merchantCode, secureKey, ready: missing.length === 0, missing, mock };
}

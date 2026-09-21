import { getSetting } from '../settings';
import { isPlaceholderValue } from '../payments/paymob-config';

export interface CourierConfig {
  apiKey: string;
  ready: boolean;
  missing: string[];
  mock: boolean;
}

function clean(v: string): string {
  const t = v.trim();
  return isPlaceholderValue(t) ? '' : t;
}

function mockFlag(provider: 'BOSTA' | 'MYLERZ'): boolean {
  return process.env[`${provider}_PROVIDER`] === 'mock' && process.env.NODE_ENV !== 'production';
}

/** SINGLE SOURCE OF TRUTH for courier activation (T03). Env = fallback. */
export async function getCourierConfig(provider: 'BOSTA' | 'MYLERZ'): Promise<CourierConfig> {
  const key = provider === 'BOSTA' ? 'couriers.bostaApiKey' : 'couriers.mylerzApiKey';
  const fromSettings = clean(await getSetting<string>(key, '').catch(() => ''));
  const envName = provider === 'BOSTA' ? 'BOSTA_API_KEY' : 'MYLERZ_API_KEY';
  const apiKey = fromSettings || clean(process.env[envName] || '');
  return { apiKey, ready: apiKey.length > 0, missing: apiKey ? [] : ['API key'], mock: mockFlag(provider) };
}

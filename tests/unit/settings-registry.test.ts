import { describe, it, expect } from 'vitest';
import {
  SETTINGS_REGISTRY, REGISTRY_KEYS, SENSITIVE_KEYS, SETUP_GROUPS,
  parseStored, statusOf, hasUsableValue,
} from '../../src/lib/settings-registry.js';

describe('settings-registry (F0)', () => {
  it('every key is unique and belongs to a known group', () => {
    expect(new Set(SETTINGS_REGISTRY.map((d) => d.key)).size).toBe(SETTINGS_REGISTRY.length);
    const groups: ReadonlySet<string> = new Set(SETUP_GROUPS.map((g) => g.id));
    for (const d of SETTINGS_REGISTRY) expect(groups.has(d.group)).toBe(true);
    expect(REGISTRY_KEYS.size).toBe(SETTINGS_REGISTRY.length);
  });

  it('secrets are flagged sensitive (paymob/fawry/couriers/eta/whatsapp)', () => {
    for (const k of ['paymob.apiKey', 'paymob.hmacSecret', 'fawry.secureKey', 'couriers.bostaApiKey', 'eta.clientSecret', 'whatsapp.token']) {
      expect(SENSITIVE_KEYS.has(k)).toBe(true);
    }
    expect(SENSITIVE_KEYS.has('vat.rate')).toBe(false);
  });

  it('parseStored unwraps confirmed envelope; legacy values are unconfirmed', () => {
    expect(parseStored(JSON.stringify({ v: 'x', _confirmed: true }), '')).toEqual({ value: 'x', confirmed: true });
    expect(parseStored(JSON.stringify('plain'), '')).toEqual({ value: 'plain', confirmed: false });
    expect(parseStored(null, 5)).toEqual({ value: 5, confirmed: false });
  });

  it('statusOf: required empty -> MISSING, default -> DEFAULT_UNCONFIRMED, confirmed -> CONFIRMED', () => {
    const req = SETTINGS_REGISTRY.find((d) => d.key === 'store.landline')!;
    expect(statusOf(req, { value: '', confirmed: false }, false)).toBe('MISSING');
    expect(statusOf(req, { value: '03 x', confirmed: false }, true)).toBe('DEFAULT_UNCONFIRMED');
    expect(statusOf(req, { value: '03 x', confirmed: true }, true)).toBe('CONFIRMED');
  });

  it('hasUsableValue rejects empty strings/arrays', () => {
    expect(hasUsableValue('')).toBe(false);
    expect(hasUsableValue('  ')).toBe(false);
    expect(hasUsableValue([])).toBe(false);
    expect(hasUsableValue(0)).toBe(true);
    expect(hasUsableValue([{ id: 'COD' }])).toBe(true);
  });
});

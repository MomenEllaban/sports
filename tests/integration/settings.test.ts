import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from '../helpers/factories.js';
import { getSetting, setSetting, getVatRate, getDiscountThreshold, getLoyaltyRule, getStoreInfo } from '../../src/lib/settings.js';

describe('settings service (T12, RED first)', () => {
  beforeAll(async () => {
    await resetTestDb();
  }, 120000);

  afterAll(async () => {
    await testPrisma().$disconnect();
  });

  it('falls back to sane defaults when keys are missing', async () => {
    expect(await getSetting('nope.missing', 'fallback')).toBe('fallback');
    expect(await getVatRate()).toBe(0.14);
    expect(await getDiscountThreshold()).toBe(100);
    expect(await getLoyaltyRule()).toEqual({ earnPerEgp: 10, pointsPerUnit: 1 });
    const info = await getStoreInfo();
    expect(info.landline).toContain('5926908');
  });

  it('set then get round-trips and invalidates cache', async () => {
    await setSetting('vat.rate', 0.15);
    expect(await getVatRate()).toBe(0.15);
    await setSetting('vat.rate', 0.14);
    expect(await getVatRate()).toBe(0.14);
  });
});

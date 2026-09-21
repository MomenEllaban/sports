import { describe, it, expect } from 'vitest';
import { createBostaDelivery } from '../../src/lib/logistics/bosta.js';
import { createMylerzParcel } from '../../src/lib/logistics/mylerz.js';
import { createCourierShipment } from '../../src/lib/logistics/index.js';
import type { CourierConfig } from '../../src/lib/logistics/couriers-config.js';

const bostaCfg: CourierConfig = { apiKey: 'bosta-key', ready: true, missing: [], mock: false };
const mylerzCfg: CourierConfig = { apiKey: 'mylerz-key', ready: true, missing: [], mock: false };

const base = {
  orderNumber: 'ORD-2026-0009',
  codAmount: 570,
  customerName: 'Test',
  customerPhone: '01000000001',
  customerAddress: 'Street 1, Alexandria',
};

describe('courier clients (T03, HTTP mocked)', () => {
  it('bosta posts delivery and returns tracking', async () => {
    let sent: Record<string, unknown> = {};
    let auth = '';
    const f = (async (_url: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      auth = String((init?.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({ data: { _id: 'abc', trackingNumber: 'BST-111' } }), { status: 200 });
    }) as typeof fetch;
    const r = await createBostaDelivery(bostaCfg, base, f);
    expect(r.trackingNumber).toBe('BST-111');
    expect(auth).toBe('bosta-key');
    expect((sent.receiver as Record<string, unknown>).phone).toBe('01000000001');
    expect((sent.cod as Record<string, unknown>).amount).toBe(570);
  });

  it('bosta without tracking / http error throws (manual fallback upstream)', async () => {
    const f = (async () => new Response(JSON.stringify({ data: {} }), { status: 200 })) as typeof fetch;
    await expect(createBostaDelivery(bostaCfg, base, f)).rejects.toThrow('no tracking');
    const f500 = (async () => new Response('x', { status: 500 })) as typeof fetch;
    await expect(createBostaDelivery(bostaCfg, base, f500)).rejects.toThrow('HTTP 500');
  });

  it('mylerz posts parcel and returns tracking', async () => {
    const f = (async () => new Response(JSON.stringify({ TrackingNumber: 'MYL-222' }), { status: 200 })) as typeof fetch;
    const r = await createMylerzParcel(mylerzCfg, base, f);
    expect(r.trackingNumber).toBe('MYL-222');
  });
});

describe('shipment degrade (T03)', () => {
  it('unconfigured courier -> MANUAL record, never throws', async () => {
    // Hermetic: stash courier keys (settings + env) so readiness can't leak in.
    const { testPrisma } = await import('../helpers/factories.js');
    const db = testPrisma();
    const stashed = await db.setting.findMany({ where: { OR: [{ key: { startsWith: 'couriers' } }] } });
    await db.setting.deleteMany({ where: { key: { startsWith: 'couriers' } } });
    const envBak = { b: process.env.BOSTA_API_KEY, m: process.env.MYLERZ_API_KEY };
    delete process.env.BOSTA_API_KEY;
    delete process.env.MYLERZ_API_KEY;
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    try {
      const r = await createCourierShipment({ ...base, branchAddress: 'b', provider: 'BOSTA' as never });
      expect(r.manual).toBe(true);
      expect(r.trackingNumber.startsWith('MANUAL-')).toBe(true);
    } finally {
      for (const r of stashed) await db.setting.upsert({ where: { key: r.key }, create: { key: r.key, value: r.value }, update: { value: r.value } });
      if (envBak.b !== undefined) process.env.BOSTA_API_KEY = envBak.b;
      if (envBak.m !== undefined) process.env.MYLERZ_API_KEY = envBak.m;
      clearSettingsCache();
    }
  });

  it('pickup unaffected', async () => {
    const r = await createCourierShipment({ ...base, branchAddress: 'b', provider: 'PICKUP' as never });
    expect(r.manual).toBe(false);
    expect(r.trackingNumber.startsWith('PICKUP-')).toBe(true);
  });
});

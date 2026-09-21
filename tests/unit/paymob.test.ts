import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isPlaceholderValue } from '../../src/lib/payments/paymob-config.js';
import {
  paymobAuthToken, paymobRegisterOrder, paymobPaymentKey, paymobIframeUrl, createRealPaymobPayment,
} from '../../src/lib/payments/paymob.js';
import type { PaymobConfig } from '../../src/lib/payments/paymob-config.js';

const cfg: PaymobConfig = {
  apiKey: 'test-key', integrationId: '123', iframeId: '456', hmacSecret: 'hmac',
  ready: true, missing: [], mock: false,
};

const json = (data: unknown, ok = true, status = 200) =>
  new Response(JSON.stringify(data), { status: ok ? status : status, headers: { 'Content-Type': 'application/json' } });

describe('paymob client (T01, HTTP mocked)', () => {
  it('full flow: auth -> order (cents) -> key -> iframe url', async () => {
    const calls: string[] = [];
    const f = (async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith('/auth/tokens')) {
        expect(JSON.parse(String(init?.body)).api_key).toBe('test-key');
        return json({ token: 'auth-tok' });
      }
      if (u.endsWith('/ecommerce/orders')) {
        const b = JSON.parse(String(init?.body));
        expect(b.amount_cents).toBe('11400'); // 114 EGP -> piasters
        expect(b.merchant_order_id).toBe('ORD-2026-0001');
        expect(b.currency).toBe('EGP');
        return json({ id: 777 });
      }
      if (u.endsWith('/acceptance/payment_keys')) {
        const b = JSON.parse(String(init?.body));
        expect(b.amount_cents).toBe('11400');
        expect(b.integration_id).toBe(123);
        expect(b.order_id).toBe(777);
        return json({ token: 'pay-tok' });
      }
      throw new Error(`unexpected ${u}`);
    }) as typeof fetch;
    const r = await createRealPaymobPayment(cfg, 'ORD-2026-0001', 114, { phone: '01000000001', name: 'Test' }, f);
    expect(r.transactionRef).toBe('PAYMOB-777');
    expect(r.redirectUrl).toBe('https://accept.paymob.com/api/acceptance/iframes/456?payment_token=pay-tok');
    expect(calls).toHaveLength(3);
  });

  it('gateway errors surface (no silent fake success)', async () => {
    const f = (async () => new Response('err', { status: 500 })) as typeof fetch;
    await expect(paymobAuthToken(cfg, f)).rejects.toThrow('Paymob auth failed');
    await expect(paymobRegisterOrder('t', 'O-1', 10, f)).rejects.toThrow();
    await expect(paymobPaymentKey('t', 1, 10, cfg, { phone: '01' }, f)).rejects.toThrow();
  });

  it('invalid amounts rejected before network', async () => {
    const f = (async () => { throw new Error('must not be called'); }) as typeof fetch;
    await expect(paymobRegisterOrder('t', 'O-1', 0, f)).rejects.toThrow('Invalid amount');
    await expect(paymobRegisterOrder('t', 'O-1', -5, f)).rejects.toThrow('Invalid amount');
  });

  it('iframe url builder', () => {
    expect(paymobIframeUrl(cfg, 'tok')).toBe('https://accept.paymob.com/api/acceptance/iframes/456?payment_token=tok');
  });
});

describe('placeholder rejection (F1)', () => {
  it('docs/sample values never count as configured', () => {
    for (const v of ['', '  ', 'paymob_api_key_placeholder', 'YOUR_KEY', 'example-key', 'changeme', '123456', '****']) {
      expect(isPlaceholderValue(v)).toBe(true);
    }
    expect(isPlaceholderValue('sk_live_abc123')).toBe(false);
  });
});

describe('initializePayment gating (T01)', () => {
  const OLD = { ...process.env };
  beforeEach(() => { delete process.env.PAYMOB_PROVIDER; });
  afterEach(() => { process.env = { ...OLD }; });

  it('PAYMOB without keys and without mock -> unavailable (never fake)', async () => {
    // Hermetic: stash test-DB paymob rows + env so neither can mark ready.
    const { testPrisma } = await import('../helpers/factories.js');
    const db = testPrisma();
    const stashed = await db.setting.findMany({ where: { key: { startsWith: 'paymob' } } });
    await db.setting.deleteMany({ where: { key: { startsWith: 'paymob' } } });
    for (const k of ['PAYMOB_API_KEY', 'PAYMOB_INTEGRATION_ID', 'PAYMOB_FRAMES_ID', 'PAYMOB_HMAC_SECRET']) delete process.env[k];
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    try {
      const { initializePayment, PaymentUnavailableError } = await import('../../src/lib/payments/index.js');
      await expect(initializePayment('PAYMOB' as never, 'O-1', 100, '0100')).rejects.toBeInstanceOf(PaymentUnavailableError);
    } finally {
      for (const r of stashed) await db.setting.upsert({ where: { key: r.key }, create: { key: r.key, value: r.value }, update: { value: r.value } });
      clearSettingsCache();
    }
  });

  it('KASHIER always unavailable', async () => {
    const { initializePayment, PaymentUnavailableError } = await import('../../src/lib/payments/index.js');
    await expect(initializePayment('KASHIER' as never, 'O-1', 100, '0100')).rejects.toBeInstanceOf(PaymentUnavailableError);
  });
});

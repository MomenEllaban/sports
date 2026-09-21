import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  fawryChargeSignature, createRealFawryCharge, FAWRY_EXPIRY_HOURS,
} from '../../src/lib/payments/fawry.js';
import type { FawryConfig } from '../../src/lib/payments/fawry-config.js';

const cfg: FawryConfig = { merchantCode: 'M123', secureKey: 's3cr3t', ready: true, missing: [], mock: false };

describe('fawry client (T02, HTTP mocked)', () => {
  it('signature matches sha256(field order) — cross-checked with node:crypto', async () => {
    const args = {
      merchantCode: 'M123', merchantRefNum: 'ORD-2026-0007', customerProfileId: '01000000001',
      amount: '570.00', secureKey: 's3cr3t',
    };
    const expected = createHash('sha256')
      .update(`${args.merchantCode}${args.merchantRefNum}${args.customerProfileId}PAYATFAWRY${args.amount}${args.secureKey}`)
      .digest('hex');
    expect(await fawryChargeSignature(args)).toBe(expected);
  });

  it('charge posts merchantRef=orderNumber and returns the reference', async () => {
    let sent: Record<string, unknown> = {};
    const f = (async (_url: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ referenceNumber: '987654321', statusCode: 200 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const r = await createRealFawryCharge(cfg, 'ORD-2026-0007', 570, { phone: '01000000001', name: 'Test' }, f);
    expect(r.fawryRef).toBe('987654321');
    expect(r.merchantRefNum).toBe('ORD-2026-0007');
    expect(sent.merchantRefNum).toBe('ORD-2026-0007');
    expect(sent.amount).toBe('570.00');
    expect(typeof sent.signature).toBe('string');
    expect(Date.parse(r.expiresAt) - Date.now()).toBeGreaterThan((FAWRY_EXPIRY_HOURS - 1) * 3600_000);
  });

  it('gateway rejection and bad amounts throw (no fake code)', async () => {
    const f = (async () => new Response(JSON.stringify({ statusDescription: 'Invalid merchant' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    await expect(createRealFawryCharge(cfg, 'O-1', 100, { phone: '01' }, f)).rejects.toThrow('Invalid merchant');
    const f500 = (async () => new Response('err', { status: 500 })) as typeof fetch;
    await expect(createRealFawryCharge(cfg, 'O-1', 100, { phone: '01' }, f500)).rejects.toThrow('HTTP 500');
    await expect(createRealFawryCharge(cfg, 'O-1', 0, { phone: '01' }, f)).rejects.toThrow('Invalid amount');
  });

  it('FAWRY without keys and without mock -> unavailable', async () => {
    const { testPrisma } = await import('../helpers/factories.js');
    const db = testPrisma();
    const stashed = await db.setting.findMany({ where: { key: { startsWith: 'fawry' } } });
    await db.setting.deleteMany({ where: { key: { startsWith: 'fawry' } } });
    for (const k of ['FAWRY_MERCHANT_CODE', 'FAWRY_SECURE_KEY', 'FAWRY_SECURITY_KEY']) delete process.env[k];
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    try {
      const { initializePayment, PaymentUnavailableError } = await import('../../src/lib/payments/index.js');
      await expect(initializePayment('FAWRY' as never, 'O-1', 100, '0100')).rejects.toBeInstanceOf(PaymentUnavailableError);
    } finally {
      for (const r of stashed) await db.setting.upsert({ where: { key: r.key }, create: { key: r.key, value: r.value }, update: { value: r.value } });
      clearSettingsCache();
    }
  });
});

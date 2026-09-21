import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, makeUser, sessionFor } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { GET as summary } from '../../src/app/api/admin/reports/summary/route.js';

describe('reports summary T12', () => {
  beforeAll(async () => {
    await resetTestDb();
    const admin = await makeUser('SUPER_ADMIN', []);
    setMockSession(sessionFor(admin));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    const { testPrisma } = await import('../helpers/factories.js');
    await testPrisma().$disconnect();
  });

  it('returns all sections with filters', async () => {
    const res = await summary(new Request('http://t/api/admin/reports/summary?from=2026-01-01&to=2026-12-31'));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.success).toBe(true);
    for (const k of ['productProfit', 'branchProfit', 'cashierPerf', 'deadStock', 'shipping']) {
      expect(Array.isArray(d[k])).toBe(true);
    }
    expect(typeof d.deadDays).toBe('number');
  });

  it('rejects invalid dates', async () => {
    const res = await summary(new Request('http://t/api/admin/reports/summary?from=nope'));
    expect(res.status).toBe(400);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, sessionFor } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as submitReview } from '../../src/app/api/reviews/route.js';
import { GET as listReviews, PATCH as moderateReview } from '../../src/app/api/admin/reviews/route.js';

describe('reviews T08', () => {
  let productId = '';

  beforeAll(async () => {
    await resetTestDb();
    await makeBranch('Review Branch');
    const manager = await makeUser('BRANCH_MANAGER', []);
    const cat = await makeCategory();
    productId = (await makeProduct(cat.id, 300)).id;
    setMockSession(sessionFor(manager));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('public submission is stored unapproved; invalid ratings rejected', async () => {
    const bad = await submitReview(new Request('http://t/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, rating: 9 }),
    }));
    expect(bad.status).toBe(400);
    const ok = await submitReview(new Request('http://t/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, rating: 5, text: 'ممتاز' }),
    }));
    expect(ok.status).toBe(200);
    const row = await testPrisma().review.findFirstOrThrow({ where: { productId } });
    expect(row.approved).toBe(false);
    expect(row.rating).toBe(5);
  });

  it('staff approves; pending filter works', async () => {
    const before = await listReviews(new Request('http://t/api/admin/reviews?pending=1'));
    expect((await before.json()).reviews.length).toBeGreaterThan(0);
    const row = await testPrisma().review.findFirstOrThrow({ where: { productId } });
    const mod = await moderateReview(new Request('http://t/api/admin/reviews', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, approved: true }),
    }));
    expect(mod.status).toBe(200);
    const after = await listReviews(new Request('http://t/api/admin/reviews?pending=1'));
    expect((await after.json()).reviews.length).toBe(0);
  });
});

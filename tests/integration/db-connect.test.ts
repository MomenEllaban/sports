import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch } from '../helpers/factories.js';

describe('test database connectivity (integration smoke)', () => {
  beforeAll(async () => {
    await resetTestDb();
  }, 120000);

  afterAll(async () => {
    await testPrisma().$disconnect();
  });

  it('connects to the isolated test schema and round-trips a row', async () => {
    const db = testPrisma();
    await expect(db.$queryRaw`SELECT 1`).resolves.toBeTruthy();
    // Order-independent: create our own row instead of asserting global emptiness
    // (files may run in parallel workers sharing the test schema).
    const b = await makeBranch('Smoke Branch');
    await expect(db.branch.findUnique({ where: { id: b.id } })).resolves.toMatchObject({ name: 'Smoke Branch' });
    await db.branch.delete({ where: { id: b.id } });
  });
});

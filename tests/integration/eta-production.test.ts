import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from '../helpers/factories.js';
import { submitEtaDocument } from '../../src/lib/eta.js';

describe('eta production guards T14', () => {
  beforeAll(async () => {
    await resetTestDb();
  }, 180000);

  afterAll(async () => {
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    await testPrisma().$disconnect();
  });

  it('production refuses unsigned submissions', async () => {
    const db = testPrisma();
    await db.setting.deleteMany({ where: { key: 'eta.signingUrl' } });
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    await expect(
      submitEtaDocument('production', 'tok', {
        invoiceNumber: 'X1', totalAmount: 100, vatAmount: 14, taxRegNumber: '123', items: [],
      })
    ).rejects.toThrow('signing');
  });

  it('production requires GS1 codes on all items', async () => {
    const db = testPrisma();
    await db.setting.upsert({
      where: { key: 'eta.signingUrl' },
      create: { key: 'eta.signingUrl', value: JSON.stringify('https://sign.local') },
      update: { value: JSON.stringify('https://sign.local') },
    });
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    await expect(
      submitEtaDocument('production', 'tok', {
        invoiceNumber: 'X2', totalAmount: 100, vatAmount: 14, taxRegNumber: '123',
        items: [{ name: 'x', quantity: 1, unitPrice: 100, totalPrice: 100, vatAmount: 14 }],
      })
    ).rejects.toThrow('GS1');
    await db.setting.deleteMany({ where: { key: 'eta.signingUrl' } });
    clearSettingsCache();
  });
});

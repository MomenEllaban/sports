import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  testPrisma,
  resetTestDb,
  makeBranch,
  makeUser,
  makeCategory,
  makeProduct,
  stock,
  sessionFor,
} from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as transferCreate } from '../../src/app/api/admin/transfers/route.js';
import { POST as transferAction } from '../../src/app/api/admin/transfers/[id]/route.js';

const create = (body: unknown) =>
  transferCreate(
    new Request('http://t/api/admin/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

const act = (id: string, action: string) =>
  transferAction(
    new Request('http://t/api/admin/transfers/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id }) }
  );

const stockOf = async (branchId: string, productId: string) =>
  (await testPrisma().branchInventory.findUniqueOrThrow({
    where: { branchId_productId: { branchId, productId } },
  })).stockQuantity;

describe('stock transfer approval is atomic (T07)', () => {
  let fromId = '';
  let toId = '';
  let productId = '';

  beforeAll(async () => {
    await resetTestDb();
    const from = await makeBranch('Transfer From');
    const to = await makeBranch('Transfer To');
    fromId = from.id;
    toId = to.id;
    const admin = await makeUser('SUPER_ADMIN', [fromId]);
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(fromId, productId, 10);
    setMockSession(sessionFor(admin));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('approve moves stock to both branches with two TRANSFER logs, exactly once', async () => {
    const created = await create({
      fromBranchId: fromId,
      toBranchId: toId,
      items: [{ productId, quantity: 4 }],
    });
    expect(created.status).toBe(200);
    const transfer = (await created.json()) as { transfer: { id: string; transferNumber: string } };

    // Pending: no stock moved yet.
    expect(await stockOf(fromId, productId)).toBe(10);

    expect((await act(transfer.transfer.id, 'approve')).status).toBe(200);
    expect(await stockOf(fromId, productId)).toBe(6);
    expect(await stockOf(toId, productId)).toBe(4);

    const logs = await testPrisma().inventoryLog.findMany({
      where: { referenceId: transfer.transfer.transferNumber, type: 'TRANSFER' },
    });
    expect(logs.length).toBe(2);

    // Repeat approve is rejected and does not move stock again.
    expect((await act(transfer.transfer.id, 'approve')).status).toBe(400);
    expect(await stockOf(fromId, productId)).toBe(6);
    expect(await stockOf(toId, productId)).toBe(4);
  });

  it('approve with insufficient source stock fails and leaves the transfer PENDING', async () => {
    const created = await create({
      fromBranchId: fromId,
      toBranchId: toId,
      items: [{ productId, quantity: 999 }],
    });
    const transfer = (await created.json()) as { transfer: { id: string } };

    expect((await act(transfer.transfer.id, 'approve')).status).toBe(400);
    const after = await testPrisma().stockTransfer.findUniqueOrThrow({ where: { id: transfer.transfer.id } });
    expect(after.status).toBe('PENDING');
    expect(await stockOf(fromId, productId)).toBe(6);
    expect(await stockOf(toId, productId)).toBe(4);
  });
});

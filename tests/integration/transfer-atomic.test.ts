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
import { POST as transferCreate, GET as transferList } from '../../src/app/api/admin/transfers/route.js';
import { POST as transferAction, GET as transferDetail } from '../../src/app/api/admin/transfers/[id]/route.js';

const create = (body: unknown) =>
  transferCreate(
    new Request('http://t/api/admin/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

const act = (id: string, action: string, payload: Record<string, unknown> = {}) =>
  transferAction(
    new Request('http://t/api/admin/transfers/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    }),
    { params: Promise.resolve({ id }) }
  );

const detail = (id: string) =>
  transferDetail(new Request('http://t/api/admin/transfers/x'), {
    params: Promise.resolve({ id }),
  });

const list = (query: string) =>
  transferList(new Request(`http://t/api/admin/transfers${query}`));

/** A branch that has never stocked the product simply holds zero. */
const stockOf = async (branchId: string, productId: string) =>
  (await testPrisma().branchInventory.findUnique({
    where: { branchId_productId: { branchId, productId } },
  }))?.stockQuantity ?? 0;

describe('stock transfer lifecycle is atomic (T07)', () => {
  let fromId = '';
  let toId = '';
  let otherId = '';
  let productId = '';
  let requester: { id: string; name: string; email: string; role: string; branchIds: string[] };
  let approver: { id: string; name: string; email: string; role: string; branchIds: string[] };
  let outsider: { id: string; name: string; email: string; role: string; branchIds: string[] };

  beforeAll(async () => {
    await resetTestDb();
    const from = await makeBranch('Transfer From');
    const to = await makeBranch('Transfer To');
    const other = await makeBranch('Other Branch');
    fromId = from.id;
    toId = to.id;
    otherId = other.id;
    // Requester and approver are deliberately different users: separation of
    // duties forbids a transfer being actioned by whoever requested it.
    requester = await makeUser('SUPER_ADMIN', [fromId, toId]);
    approver = await makeUser('SUPER_ADMIN', [fromId, toId]);
    outsider = await makeUser('BRANCH_MANAGER', [otherId]);
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(fromId, productId, 10);
    setMockSession(sessionFor(requester));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('approve moves nothing; ship debits the source and receive credits the destination', async () => {
    const created = await create({
      fromBranchId: fromId,
      toBranchId: toId,
      items: [{ productId, quantity: 4 }],
    });
    expect(created.status).toBe(201);
    const transfer = (await created.json()) as {
      transfer: { id: string; transferNumber: string; items: { id: string }[] };
    };

    // Requested: no stock has moved yet.
    expect(await stockOf(fromId, productId)).toBe(10);
    expect(await stockOf(toId, productId)).toBe(0);

    // The requester cannot approve their own request.
    expect((await act(transfer.transfer.id, 'approve')).status).toBe(403);

    setMockSession(sessionFor(approver));
    expect((await act(transfer.transfer.id, 'approve')).status).toBe(200);

    // Approval is a paperwork step: stock only leaves on shipment.
    const approved = await testPrisma().stockTransfer.findUniqueOrThrow({
      where: { id: transfer.transfer.id },
    });
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedById).toBe(approver.id);
    expect(approved.approvedAt).not.toBeNull();
    expect(await stockOf(fromId, productId)).toBe(10);
    expect(await stockOf(toId, productId)).toBe(0);

    expect((await act(transfer.transfer.id, 'ship')).status).toBe(200);
    expect(await stockOf(fromId, productId)).toBe(6);
    expect(await stockOf(toId, productId)).toBe(0); // in transit, not yet sellable

    const logs = await testPrisma().inventoryLog.findMany({
      where: { referenceId: transfer.transfer.transferNumber },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.type)).toEqual(['TRANSFER_OUT']);

    // Receiving a partial quantity parks the transfer; the rest follows.
    const lineId = transfer.transfer.items[0].id;
    expect((await act(transfer.transfer.id, 'receive', { lines: [{ itemId: lineId, quantityReceived: 1 }] })).status).toBe(200);
    expect(await stockOf(toId, productId)).toBe(1);
    let current = await testPrisma().stockTransfer.findUniqueOrThrow({ where: { id: transfer.transfer.id } });
    expect(current.status).toBe('PARTIALLY_RECEIVED');

    // Receiving more than the outstanding quantity is rejected outright.
    expect(
      (await act(transfer.transfer.id, 'receive', { lines: [{ itemId: lineId, quantityReceived: 99 }] })).status
    ).toBe(400);
    expect(await stockOf(toId, productId)).toBe(1);

    expect((await act(transfer.transfer.id, 'receive', { lines: [{ itemId: lineId, quantityReceived: 3 }] })).status).toBe(200);
    expect(await stockOf(toId, productId)).toBe(4);
    current = await testPrisma().stockTransfer.findUniqueOrThrow({ where: { id: transfer.transfer.id } });
    expect(current.status).toBe('COMPLETED');
    expect(current.receivedAt).not.toBeNull();

    const finalLogs = await testPrisma().inventoryLog.findMany({
      where: { referenceId: transfer.transfer.transferNumber },
      orderBy: { createdAt: 'asc' },
    });
    expect(finalLogs.map((l) => l.type)).toEqual(['TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_IN']);
    expect(finalLogs.reduce((s, l) => s + l.changeQuantity, 0)).toBe(0); // goods conserved

    // A completed transfer accepts no further action.
    expect((await act(transfer.transfer.id, 'receive', { lines: [{ itemId: lineId, quantityReceived: 1 }] })).status).toBe(409);
    expect(await stockOf(toId, productId)).toBe(4);
  });

  it('cancelling before shipment keeps both balances untouched and requires a reason', async () => {
    setMockSession(sessionFor(requester));
    const created = await create({
      fromBranchId: fromId,
      toBranchId: toId,
      items: [{ productId, quantity: 2 }],
    });
    const transfer = (await created.json()) as { transfer: { id: string } };

    expect((await act(transfer.transfer.id, 'cancel')).status).toBe(400);
    expect((await act(transfer.transfer.id, 'cancel', { reason: 'wrong branch' })).status).toBe(200);

    const after = await testPrisma().stockTransfer.findUniqueOrThrow({ where: { id: transfer.transfer.id } });
    expect(after.status).toBe('CANCELLED');
    expect(after.cancelReason).toBe('wrong branch');
    expect(await stockOf(fromId, productId)).toBe(6);
    expect(await stockOf(toId, productId)).toBe(4);
  });

  it('shipment with insufficient source stock fails atomically and leaves the transfer APPROVED', async () => {
    setMockSession(sessionFor(requester));
    const created = await create({
      fromBranchId: fromId,
      toBranchId: toId,
      items: [{ productId, quantity: 999 }],
    });
    const transfer = (await created.json()) as { transfer: { id: string } };

    setMockSession(sessionFor(approver));
    expect((await act(transfer.transfer.id, 'approve')).status).toBe(200);
    expect((await act(transfer.transfer.id, 'ship')).status).toBe(400);

    const after = await testPrisma().stockTransfer.findUniqueOrThrow({ where: { id: transfer.transfer.id } });
    expect(after.status).toBe('APPROVED');
    expect(after.shippedAt).toBeNull();
    expect(await stockOf(fromId, productId)).toBe(6);
    expect(await stockOf(toId, productId)).toBe(4);
  });

  it('rejects a transfer whose branches are outside the actor assignment', async () => {
    setMockSession(sessionFor(requester));
    const created = await create({
      fromBranchId: fromId,
      toBranchId: toId,
      items: [{ productId, quantity: 1 }],
    });
    const transfer = (await created.json()) as { transfer: { id: string; transferNumber: string } };

    setMockSession(sessionFor(outsider));
    expect((await detail(transfer.transfer.id)).status).toBe(403);
    expect((await act(transfer.transfer.id, 'approve')).status).toBe(403);

    // The same outsider must not see the transfer in the list, and a search term
    // must not widen their scope.
    const scoped = (await list(`?q=${encodeURIComponent(transfer.transfer.transferNumber)}`)) as Response;
    expect(scoped.status).toBe(200);
    const body = (await scoped.json()) as { rows: { transferNumber: string }[]; total: number };
    expect(body.total).toBe(0);
    expect(body.rows).toEqual([]);

    expect((await list('')).status).toBe(200);
    const unfiltered = (await (await list('')).json()) as { total: number };
    expect(unfiltered.total).toBe(0);
  });
});

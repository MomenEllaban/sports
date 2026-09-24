import { describe, expect, it } from 'vitest';
import { notificationScope } from '../../src/lib/admin/notification-scope.js';

describe('notification branch scope', () => {
  it('keeps super admin unscoped', () => {
    expect(notificationScope({ user: { role: 'SUPER_ADMIN' } })).toEqual({});
  });

  it('limits branch managers to assigned branches and their role', () => {
    const scope = notificationScope({ user: { role: 'BRANCH_MANAGER', branchIds: ['branch-a', 'branch-b'] } });
    expect(scope).toEqual({
      AND: [
        { OR: [{ branchId: null }, { branchId: { in: ['branch-a', 'branch-b'] } }] },
        { OR: [{ targetRole: null }, { targetRole: 'BRANCH_MANAGER' }] },
      ],
    });
  });

  it('does not expose branch notifications to a user without branches', () => {
    expect(notificationScope({ user: { role: 'CASHIER', branchIds: [] } })).toEqual({
      AND: [{ branchId: null }, { OR: [{ targetRole: null }, { targetRole: 'CASHIER' }] }],
    });
  });
});

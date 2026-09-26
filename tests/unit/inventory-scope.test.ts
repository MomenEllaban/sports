import { describe, expect, it } from 'vitest';
import type { AppSession } from '../../src/lib/auth/guards.js';
import { allowedTransferActions } from '../../src/lib/inventory/transfers.js';
import { InventoryScopeError, parseListParams, resolveBranchFilter } from '../../src/lib/inventory/queries.js';

const superAdmin: AppSession = { user: { id: 'u1', role: 'SUPER_ADMIN', branchIds: [] } };
const manager: AppSession = { user: { id: 'u2', role: 'BRANCH_MANAGER', branchIds: ['b1'] } };
const unassigned: AppSession = { user: { id: 'u3', role: 'BRANCH_MANAGER', branchIds: [] } };

describe('transfer lifecycle policy', () => {
  it('exposes only the transitions valid for the current status', () => {
    expect(allowedTransferActions('PENDING', false).sort()).toEqual(['approve', 'cancel', 'reject']);
    expect(allowedTransferActions('APPROVED', false).sort()).toEqual(['cancel', 'ship']);
    expect(allowedTransferActions('IN_TRANSIT', false).sort()).toEqual(['receive']);
    expect(allowedTransferActions('PARTIALLY_RECEIVED', false).sort()).toEqual(['receive']);
  });

  it('closes a transfer once it is received, rejected or cancelled', () => {
    expect(allowedTransferActions('COMPLETED', false)).toEqual([]);
    expect(allowedTransferActions('REJECTED', false)).toEqual([]);
    expect(allowedTransferActions('CANCELLED', false)).toEqual([]);
  });

  it('never lets the requester approve, reject or ship their own transfer', () => {
    expect(allowedTransferActions('PENDING', true).sort()).toEqual(['cancel']);
    expect(allowedTransferActions('APPROVED', true)).toEqual([]);
  });

  it('stops a second approver from approving twice', () => {
    // APPROVED has no approve action, so the compare-and-swap in the service is
    // the only thing that could double-apply; the UI cannot even offer it.
    expect(allowedTransferActions('APPROVED', false)).not.toContain('approve');
    expect(allowedTransferActions('IN_TRANSIT', false)).not.toContain('ship');
  });
});

describe('inventory list parameters', () => {
  it('clamps paging instead of trusting the query string', () => {
    const url = new URL('https://example.test/api/admin/inventory/stock?page=-4&pageSize=100000');
    const params = parseListParams(url);
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(200);
  });

  it('falls back to defaults for junk input', () => {
    const params = parseListParams(new URL('https://example.test/x?page=abc&stockState=zzz&dir=sideways'));
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(25);
    expect(params.stockState).toBe(0);
    expect(params.dir).toBe('desc');
  });

  it('trims and bounds the search term', () => {
    const params = parseListParams(new URL(`https://example.test/x?q=${'a'.repeat(400)}`));
    expect(params.q).toHaveLength(120);
  });
});

describe('inventory branch scope', () => {
  it('lets a super admin read any branch without a filter', () => {
    const scope = resolveBranchFilter(superAdmin, undefined);
    expect(scope.allowedIds).toBeNull();
    expect(scope.branchId).toBeUndefined();
  });

  it('scopes a branch manager to the assigned branches', () => {
    const scope = resolveBranchFilter(manager, undefined);
    expect(scope.allowedIds).toEqual(['b1']);
    expect(resolveBranchFilter(manager, 'b1').branchId).toBe('b1');
  });

  it('rejects a branch outside the assignment instead of widening', () => {
    expect(() => resolveBranchFilter(manager, 'b2')).toThrow(InventoryScopeError);
    expect(() => resolveBranchFilter(manager, 'b2')).toThrow(/outside your assignment/);
  });

  it('treats an empty assignment as no access, not all access', () => {
    expect(resolveBranchFilter(unassigned, undefined).allowedIds).toEqual([]);
    expect(() => resolveBranchFilter(unassigned, 'b1')).toThrow(InventoryScopeError);
  });
});

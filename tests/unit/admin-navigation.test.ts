import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { adminNavigation, getVisibleAdminGroups, pathMatches } from '../../src/config/admin-navigation.js';

const root = join(process.cwd(), 'src', 'app', '[locale]');

function routeFile(route: string): string {
  const relative = route.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  return join(root, 'admin', ...relative, 'page.tsx');
}

describe('admin navigation config', () => {
  it('has unique item keys, hrefs, and real page targets', () => {
    const items = adminNavigation.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.href)).size).toBe(items.length);
    for (const item of items) expect(existsSync(routeFile(item.href)), item.href).toBe(true);
  });

  it('does not expose a role without an allowed page', () => {
    const groups = getVisibleAdminGroups('STAFF');
    expect(groups.some((group) => group.key === 'settings')).toBe(false);
    expect(groups.flatMap((group) => group.items).some((item) => item.href === '/admin/users')).toBe(false);
  });

  it('matches nested routes without making /admin match every child', () => {
    expect(pathMatches('/admin/orders/online', '/admin/orders')).toBe(true);
    expect(pathMatches('/admin/ordersx', '/admin/orders')).toBe(false);
    expect(pathMatches('/admin/settings/setup', '/admin')).toBe(true);
  });
});

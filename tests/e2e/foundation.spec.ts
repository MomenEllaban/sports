/**
 * F0 foundation guard: viewport matrix + zero console/network errors.
 * Viewports: 390x844 (mobile), 768x1024 (tablet portrait),
 * 1024x768 (tablet landscape), 1366x768 (small laptop).
 */
import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet-portrait' },
  { width: 1024, height: 768, name: 'tablet-landscape' },
  { width: 1366, height: 768, name: 'laptop' },
];

// Public pages only (no staff login needed) for the F0 gate.
const PUBLIC_PATHS = ['/ar', '/ar/catalog', '/ar/cart', '/ar/tracking', '/ar/branches'];

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal page overflow').toBeLessThanOrEqual(1);
}

for (const vp of VIEWPORTS) {
  test(`viewports/${vp.name}: storefront renders clean`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const p of PUBLIC_PATHS) {
      await page.goto(p, { waitUntil: 'networkidle' });
      await assertNoHorizontalOverflow(page);
    }
    expect(errors, `console/network errors @${vp.name}`).toEqual([]);
  });
}

test('touch targets: primary actions >= 44px on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ar/catalog', { waitUntil: 'networkidle' });
  const small = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a,button')].filter((el) => (el as HTMLElement).offsetParent !== null);
    return els
      .map((el) => ({ t: (el.textContent || '').trim().slice(0, 24), h: (el as HTMLElement).offsetHeight }))
      .filter((x) => x.h > 0 && x.h < 44 && x.t.length > 0)
      .slice(0, 10);
  });
  expect(small, 'undersized interactive elements').toEqual([]);
});

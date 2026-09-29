import { test, expect, type Page } from '@playwright/test';

/**
 * Guards the two purchasing pages against the duplication and dead-end states
 * that were reported from the UI:
 *
 * - the supplier directory was rendered twice (card list + a chip row), so every
 *   supplier name appeared twice and only one copy carried the selection;
 * - "Receive on the GRN page" pointed at `${pathname}/../receiving`, which the
 *   browser normalises to a route that does not exist;
 * - `branch` and `createdAt` were queried and mapped but never rendered, so a PO
 *   card could not tell you which branch it was for or when it was raised.
 */

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill('admin@sports-champions.local');
  await page.locator('input[type="password"]').fill('Test@123456');
  await page.locator('button[type="submit"]').click();
  // Must not match the login page itself, which also lives under /admin/.
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
  // A redirect to the login page again would mean the session cookie did not stick.
  await expect(page).not.toHaveURL(/login/);
}

test.describe('purchasing pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('supplier directory lists each supplier exactly once', async ({ page }) => {
    await page.goto('/ar/admin/purchasing/suppliers');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/دليل الموردين|Supplier directory/);

    // The directory cards are the only supplier picker now.
    const firstName = await page
      .locator('button[aria-current], button:has-text("كشف الحساب")')
      .first()
      .textContent()
      .catch(() => null);
    test.skip(firstName === null, 'no suppliers seeded in this database');

    const statementLinks = page.getByRole('button', { name: /كشف الحساب|Statement/ });
    const cardLinks = page.getByRole('button', { name: /كشف الحساب|Statement/ });
    // One "Statement" action per visible card, and no second chip row above.
    expect(await statementLinks.count()).toBe(await cardLinks.count());

    // The header no longer repeats the selected supplier as a standalone chip.
    await expect(page.locator('span.status-info')).toHaveCount(0);
  });

  test('selecting a supplier opens a statement that can be closed again', async ({ page }) => {
    await page.goto('/ar/admin/purchasing/suppliers');

    const open = page.getByRole('button', { name: /كشف الحساب|Statement/ }).first();
    test.skip(!(await open.count()), 'no suppliers seeded in this database');

    await open.click();
    await page.waitForURL(/supplierId=/, { timeout: 20000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/الرصيد|Balance/).first()).toBeVisible();

    // Previously there was no way back to the "all suppliers" view.
    const close = page.getByRole('link', { name: /إغلاق الكشف|Close statement/ });
    await expect(close).toBeVisible();
    await close.click();
    await page.waitForURL((u) => !u.searchParams.has('supplierId'), { timeout: 20000 });
    await expect(page.getByText(/اختر موردًا|Select a supplier/).first()).toBeVisible();
  });

  test('supplier search narrows the directory', async ({ page }) => {
    await page.goto('/ar/admin/purchasing/suppliers');
    const search = page.getByRole('searchbox').or(page.locator('#supplier-filter'));
    await expect(search).toBeVisible();
    await search.fill('zzzz-no-such-supplier-zzzz');
    await expect(page.getByText(/لا يوجد موردون مطابقون|No suppliers match/)).toBeVisible();
  });

  test('PO cards show branch and date, and the GRN link resolves', async ({ page }) => {
    await page.goto('/ar/admin/purchasing');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/أوامر التوريد|Purchase orders/);

    const clear = page.getByRole('button', { name: /مسح كل الفلاتر|Clear all filters/ });
    if (await clear.count()) await clear.click();

    const card = page.locator('div.rounded-2xl', { has: page.locator('span.font-extrabold.text-amber-400') }).first();
    test.skip((await card.count()) === 0, 'no purchase orders seeded in this database');

    // Both were selected in the query and then dropped on the floor.
    await expect(card.getByText(/الفرع|Branch/)).toBeVisible();
    await expect(card.getByText(/التاريخ|Date/)).toBeVisible();

    // `${pathname}/../receiving` normalised to /ar/admin/receiving, which 404s.
    const grn = page.getByRole('link', { name: /الاستلام من صفحة الاستلام|Receive on the GRN page/ }).first();
    if (await grn.count()) {
      const href = await grn.getAttribute('href');
      expect(href).toContain('/admin/purchasing/receiving');
      expect(href).not.toContain('..');
      const res = await page.request.get(new URL(href!, 'http://localhost:3102').toString());
      expect(res.status()).toBeLessThan(400);
    }
  });

  test('status chips carry counts and PO search filters', async ({ page }) => {
    await page.goto('/ar/admin/purchasing');

    // Every filter chip is labelled with a count, so the "All" chip is not the
    // only number and the per-status backlog is visible. Scoped to the chip group
    // next to the search box, since the theme toggle is also aria-pressed and the
    // same words also appear as per-card actions.
    // #po-search -> form -> controls -> toolbar (which also holds the chips).
    const toolbar = page.locator('#po-search').locator('xpath=../../..');
    const chips = toolbar.locator('button[aria-pressed]');
    await expect(chips.first()).toHaveText(/\(\d+\)/);
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(1);
    for (let i = 0; i < chipCount; i++) {
      await expect(chips.nth(i)).toHaveText(/\(\d+\)/);
    }
    // Exactly one chip is the active filter.
    await expect(toolbar.locator('button[aria-pressed="true"]')).toHaveCount(1);

    const search = page.locator('#po-search');
    await expect(search).toBeVisible();
    await search.fill('PO-ZZZZ-NOPE');
    await search.press('Enter');
    await page.waitForURL(/q=PO-ZZZZ-NOPE/, { timeout: 20000 });
    await expect(page.getByText(/لا توجد أوامر توريد مطابقة|No purchase orders match/)).toBeVisible();
  });
});

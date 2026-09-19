import { test, expect } from '@playwright/test';

test.describe('storefront smoke', () => {
  test('home (ar) loads with store title', async ({ page }) => {
    await page.goto('/ar');
    await expect(page).toHaveTitle(/ابطال الرياضة/);
  });

  test('branches page lists flagship branch', async ({ page }) => {
    await page.goto('/branches');
    await expect(page.getByText(/الإبراهيمية/).first()).toBeVisible();
  });

  test('admin login page renders', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('anonymous admin page redirects to login', async ({ page }) => {
    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/admin\/login/);
  });

  test('anonymous POS page redirects to login', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveURL(/admin\/login/);
  });
});

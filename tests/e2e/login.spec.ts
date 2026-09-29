import { test, expect } from '@playwright/test';

test('admin can log in with seed credentials', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill('admin@sports-champions.local');
  await page.locator('input[type="password"]').fill('Test@123456');
  await page.locator('button[type="submit"]').click();
  // `/en/admin/login` also matches /\/admin\//, so waiting on that pattern
  // returns while the browser is still sitting on the login page. Wait for a
  // URL that has actually left /login instead.
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
  // A redirect to the login page again would mean the session cookie did not stick.
  await expect(page).not.toHaveURL(/login/);
});

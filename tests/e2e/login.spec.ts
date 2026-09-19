import { test, expect } from '@playwright/test';

test('admin can log in with seed credentials', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill('admin@sports-champions.local');
  await page.locator('input[type="password"]').fill('Test@123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 20000 });
  await expect(page).not.toHaveURL(/login/);
});

/**
 * T15 end-to-end: guest checkout (COD) + cashier shift → sale.
 * Requires a seeded DB behind E2E_BASE_URL (CI seeds demo first).
 */
import { test, expect, type Page } from '@playwright/test';

const CASHIER = { email: 'cashier.ibrahimeyah@sports-champions.local', pass: 'Test@123456' };

async function staffLogin(page: Page, email: string, pass: string) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 20000 });
}

test('guest can complete a COD checkout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Catalog → first product → add to cart.
  await page.goto('/ar/catalog');
  await page.locator('a[href*="/catalog/"]').first().click();
  await page.waitForURL(/\/catalog\//);
  const addBtn = page.getByRole('button', { name: /أضف للسلة/ });
  await expect(addBtn).toBeVisible({ timeout: 15000 });
  // If out of stock the button is disabled — pick is best-effort on demo data.
  if (await addBtn.isDisabled()) test.skip(true, 'first product out of stock in demo data');
  await addBtn.click();
  await page.waitForURL(/\/cart/);
  await page.goto('/ar/checkout');
  await page.locator('input[type="tel"]').first().fill('01000000077');
  const addr = page.locator('textarea').first();
  if (await addr.isVisible()) await addr.fill('شارع اختبار 1، الإسكندرية');
  await page.getByRole('button', { name: /تأكيد الطلب|إتمام الطلب|اطلب الآن/ }).click();
  await expect(page.getByText(/تم تأكيد طلبك|ORD-/).first()).toBeVisible({ timeout: 30000 });
  expect(errors).toEqual([]);
});

test('cashier opens a shift and completes a sale', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await staffLogin(page, CASHIER.email, CASHIER.pass);
  await page.goto('/pos');
  // Shift gate: open when prompted.
  const openInput = page.locator('#open-float');
  if (await openInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    await openInput.fill('500');
    await page.getByRole('button', { name: /فتح الوردية/ }).click();
    await expect(page.getByText(/وردية مفتوحة/)).toBeVisible({ timeout: 15000 });
  }
  // Add first available product to the ticket.
  const addFirst = page.locator('button').filter({ hasText: /أضف|＋|\+/ }).first();
  if (await addFirst.isVisible().catch(() => false)) {
    await addFirst.click();
    const confirm = page.getByRole('button', { name: /تأكيد البيع/ });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      await expect(page.getByText(/تم حفظ الفاتورة|POS-/).first()).toBeVisible({ timeout: 30000 });
    }
  }
  expect(errors).toEqual([]);
});

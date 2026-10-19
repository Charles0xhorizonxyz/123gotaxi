import { expect, test } from '@playwright/test';

test('home page loads and switches language', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'gogogo.rodeo' })).toBeVisible();
  const html = page.locator('html');
  const before = (await html.getAttribute('lang')) ?? '';
  await page.locator('.lang-switch').click();
  await expect(html).not.toHaveAttribute('lang', before);
});

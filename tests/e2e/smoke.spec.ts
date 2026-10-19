import { expect, test } from '@playwright/test';

test('pasting coordinates makes a QR that can be saved', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await page.getByLabel(/Name on the card/).fill('Cihangir');
  await page.getByRole('button', { name: 'Make my QR' }).click();

  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();

  await page.getByRole('button', { name: 'Save on this device' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Cihangir/ })).toBeVisible();
});

test('a short link explains what to do', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('https://maps.app.goo.gl/abc123');
  await page.getByRole('button', { name: 'Make my QR' }).click();
  await expect(page.getByRole('alert')).toContainText('short link');
});

test('the driver screen lists navigation apps', async ({ page }) => {
  await page.goto('./#v=1&lat=41.0342&lon=28.9844&n=Cihangir');
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();
  const google = page.getByRole('link', { name: 'Google Maps' });
  await expect(google).toHaveAttribute('href', /destination=41\.0342%2C28\.9844/);
  await expect(page.getByRole('link', { name: 'Waze' })).toBeVisible();
});

test('a broken QR link falls back to the create screen', async ({ page }) => {
  await page.goto('./#lat=999&lon=0');
  await expect(page.getByRole('alert')).toContainText('looks broken');
});

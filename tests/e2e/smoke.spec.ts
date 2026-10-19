import { expect, test } from '@playwright/test';

test('pasting coordinates makes a QR that can be saved with a name and note', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await page.getByLabel(/^Name/).fill('Cihangir');
  await page.getByLabel(/^Note/).fill('Blue door');
  await page.getByRole('button', { name: 'Make my QR' }).click();

  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  const entry = page.getByRole('button', { name: /^Cihangir/ });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('Blue door');
  await expect(entry).not.toContainText('41.0342');
});

test('saving without a name asks for one', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await page.getByRole('button', { name: 'Make my QR' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Add a name above to save it.')).toBeVisible();
});

test('a multi-stop journey can be reordered and opens a route', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.01, 28.97');
  await page.getByRole('button', { name: '+ Add a stop' }).click();
  await page.getByLabel('Final stop', { exact: true }).fill('41.02, 28.98');

  // Move the final stop to the front with the keyboard.
  await page.getByRole('button', { name: /^Move stop 2/ }).press('ArrowUp');
  await expect(page.getByLabel('Stop 1', { exact: true })).toHaveValue('41.02, 28.98');

  await page.getByLabel(/^Name/).fill('Errands');
  await page.getByRole('button', { name: 'Make my QR' }).click();
  await expect(page.getByText('2 stops')).toBeVisible();

  await page.getByRole('link', { name: 'See what the driver sees' }).click();
  await expect(page.getByText('Your route · 2 stops')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
    'href',
    /destination=41\.01%2C28\.97&waypoints=41\.02%2C28\.98/,
  );
  await expect(page.getByRole('link', { name: 'Waze' })).toHaveCount(0);
});

test('a short link explains what to do', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('https://maps.app.goo.gl/abc123');
  await page.getByRole('button', { name: 'Make my QR' }).click();
  await expect(page.getByRole('alert')).toContainText('Short links');
});

test('the driver screen lists apps and puts the remembered one first', async ({ page }) => {
  await page.goto('./#v=1&lat=41.0342&lon=28.9844&n=Cihangir');
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
    'href',
    /destination=41\.0342%2C28\.9844/,
  );

  await page.getByLabel('Put my app first next time').check();
  const waze = page.getByRole('link', { name: 'Waze' });
  await waze.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await waze.click();

  await page.reload();
  await expect(page.locator('.app').first()).toHaveText('Waze');
  await expect(page.getByLabel('Put my app first next time')).toBeChecked();
  await expect(page.getByRole('link', { name: 'Back to gogogo.rodeo' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Made with/ })).toHaveAttribute(
    'href',
    'https://0xhorizon.xyz',
  );
});

test('a broken QR link falls back to the create screen', async ({ page }) => {
  await page.goto('./#lat=999&lon=0');
  await expect(page.getByRole('alert')).toContainText('looks broken');
});

import { expect, test } from '@playwright/test';

test('typing coordinates makes the QR by itself; name and note are saved', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make my QR' })).toHaveCount(0);

  await page.getByLabel(/^Name/).fill('Cihangir');
  await page.getByLabel(/^Note/).fill('Blue door');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  const entry = page.getByRole('button', { name: /^Cihangir/ });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('Blue door');
  await expect(entry).not.toContainText('41.0342');
  await expect(page.getByRole('heading', { name: 'Your places' })).toBeVisible();
  await expect(page.getByText('This list can disappear.')).toBeVisible();
});

test('the name stays on this device and is not in the QR link', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await page.getByLabel(/^Name/).fill('Secret home');
  await expect(page.getByRole('link', { name: 'See what the driver sees' })).toHaveAttribute(
    'href',
    '#v=1&lat=41.0342&lon=28.9844',
  );
});

test('saving without a name lists the coordinates', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^41\.0342, 28\.9844/ })).toBeVisible();
});

test('tapping Save straight after a paste or an edit saves the right place', async ({ page }) => {
  await page.goto('./');
  const where = page.getByLabel('Where to?');
  await where.fill('41.0342, 28.9844');
  await where.press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await where.fill('41.05, 28.99');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.saved-name')).toHaveText(['41.05, 28.99', '41.0342, 28.9844']);
});

test('a multi-stop journey can be reordered, previewed and come back intact', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.01, 28.97');
  await page.getByRole('button', { name: '+ Add a stop' }).click();
  await page.getByLabel('Final stop', { exact: true }).fill('41.02, 28.98');

  // Move the final stop to the front with the keyboard.
  await page.getByRole('button', { name: /^Move stop 2/ }).press('ArrowUp');
  await expect(page.getByLabel('Stop 1', { exact: true })).toHaveValue('41.02, 28.98');
  await expect(page.getByText('2 stops')).toBeVisible();
  await page.getByLabel(/^Note/).fill('Groceries first');

  await page.getByRole('link', { name: 'See what the driver sees' }).click();
  await expect(page.getByText('Your route · 2 stops')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
    'href',
    /destination=41\.01%2C28\.97&waypoints=41\.02%2C28\.98/,
  );
  await expect(page.getByRole('link', { name: 'Waze' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to 123go.taxi' }).click();
  await expect(page.getByLabel('Stop 1', { exact: true })).toHaveValue('41.02, 28.98');
  await expect(page.getByLabel('Final stop', { exact: true })).toHaveValue('41.01, 28.97');
  await expect(page.getByLabel(/^Note/)).toHaveValue('Groceries first');
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
});

test('a short link explains what to do', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?').fill('https://maps.app.goo.gl/abc123');
  await page.getByLabel('Where to?').press('Enter');
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
  await expect(page.getByRole('link', { name: /Made with/ })).toHaveAttribute(
    'href',
    'https://0xhorizon.xyz',
  );
});

test('a broken QR link falls back to the create screen', async ({ page }) => {
  await page.goto('./#lat=999&lon=0');
  await expect(page.getByRole('alert')).toContainText('looks broken');
});

test('before anything is entered the card shows an empty QR and nothing else', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('img', { name: 'Your QR appears here' })).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeHidden();

  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your QR appears here' })).toBeHidden();

  await page.getByLabel('Where to?').fill('');
  await expect(page.getByRole('img', { name: 'Your QR appears here' })).toBeVisible();
});

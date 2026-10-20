import { expect, test } from './fixtures';

const DRIVER_LINK = './#v=1&lat=41.0342&lon=28.9844&n=Cihangir';

test.beforeEach(async ({ page }) => {
  // Stand-in for Waze, so nothing leaves the test.
  await page.route('https://waze.com/**', (route) => route.fulfill({ body: 'Waze', contentType: 'text/html' }));
});

test('a scanned QR opens the chosen app directly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gogogo.app.v1', 'waze'));
  await page.goto(DRIVER_LINK);
  await page.waitForURL(/^https:\/\/waze\.com\/ul\?ll=41\.0342,28\.9844/);
});

test('with "open directly" unticked on the main page, the driver sees the list', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Navigation app').selectOption({ label: 'Waze' });
  await page.getByLabel('Open it directly').uncheck();

  await page.goto(DRIVER_LINK);
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();
  await expect(page.locator('.app').first()).toHaveText('Waze');
  await expect(page.getByLabel('Open this app directly next time')).not.toBeChecked();
  expect(page.url()).not.toContain('waze.com');
});

test('"Ask every time" forgets the app and greys out the tick box', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gogogo.app.v1', 'waze'));
  await page.goto('./');
  await expect(page.getByLabel('Navigation app')).toHaveValue('waze');
  await page.getByLabel('Navigation app').selectOption({ label: 'Ask every time' });
  await expect(page.getByLabel('Open it directly')).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('gogogo.app.v1'))).toBeNull();
});

test('the driver screen opened from "See what the driver sees" never jumps to the app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gogogo.app.v1', 'waze'));
  await page.goto('./');
  await page.getByLabel('Where to?').fill('41.0342, 28.9844');
  await page.getByRole('link', { name: 'See what the driver sees' }).click();
  await expect(page.getByRole('heading', { name: 'Open with' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(page.url()).not.toContain('waze.com');
});

test('Install is one button; on iPhone it shows the two steps', async ({ page }, testInfo) => {
  await page.goto('./');
  const install = page.getByRole('region', { name: 'Install' });
  // Android: the button waits for the browser's install offer, which tests never get.
  if (testInfo.project.name === 'android') {
    await expect(install).toBeHidden();
    return;
  }
  await expect(install.getByRole('button', { name: 'Install 123go.taxi' })).toBeVisible();
  await install.getByRole('button', { name: 'Install 123go.taxi' }).click();
  await expect(install).toContainText('Add to Home Screen');
});

test('Scan reads a 123go.taxi QR with the camera and opens its driver screen', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Scan a QR code' }).click();
  await expect(page.getByRole('dialog', { name: 'Scan a QR code' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lucy' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Close stops the scanner', async ({ page }) => {
  await page.addInitScript(() => {
    // A camera that never answers, so the scan can't finish first.
    navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Scan a QR code' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

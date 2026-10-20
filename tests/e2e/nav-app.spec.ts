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

test('choosing an app on the main page makes a scanned QR open it directly', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Navigation app', { exact: true }).selectOption({ label: 'Waze' });
  await page.goto('about:blank');
  await page.goto(DRIVER_LINK);
  await page.waitForURL(/^https:\/\/waze\.com\/ul\?ll=41\.0342,28\.9844/);
});

test('"Ask every time" shows the app list', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gogogo.app.v1', 'waze'));
  await page.goto('./');
  await page.getByLabel('Navigation app', { exact: true }).selectOption({ label: 'Ask every time' });
  await page.goto(DRIVER_LINK);
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();
  expect(page.url()).not.toContain('waze.com');
});

test('the driver screen opened from "See what the driver sees" never jumps to the app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gogogo.app.v1', 'waze'));
  await page.goto('./');
  await page.getByLabel('Where to?', { exact: true }).fill('41.0342, 28.9844');
  await page.getByRole('link', { name: 'See what the driver sees' }).click();
  await expect(page.getByRole('heading', { name: 'Open with' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(page.url()).not.toContain('waze.com');
});

test('Install is a round button in the corner; on iPhone it shows the two steps', async ({ page }, testInfo) => {
  await page.goto('./');
  const install = page.getByRole('button', { name: 'Install 123go.taxi' });
  // Android: the button waits for the browser's install offer, which tests never get.
  if (testInfo.project.name === 'android') {
    await expect(install).toBeHidden();
    return;
  }
  await install.click();
  await expect(page.locator('.corner-status')).toContainText('Add to Home Screen');
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

test('typing an address lists places; only a picked place makes the QR', async ({ page, photonRequests }) => {
  await page.goto('./');
  await page.getByLabel('Where to?', { exact: true }).pressSequentially('Sıraselviler 20');
  const place = page.getByRole('button', { name: /Sıraselviler Caddesi 20/ });
  await expect(place).toBeVisible();
  // Words alone never make a QR.
  await expect(page.getByRole('img', { name: /QR code/ })).toBeHidden();
  await page.getByLabel('Where to?', { exact: true }).press('Enter');
  await expect(page.getByRole('img', { name: /QR code/ })).toBeHidden();

  await place.click();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expect(page.getByLabel('Where to?', { exact: true })).toHaveValue('41.0342, 28.9844');
  await expect(page.getByLabel(/^Name/)).toHaveValue('Sıraselviler Caddesi 20');
  // The search sent the words; picking needed no second lookup.
  expect(photonRequests.some((u) => u.includes('/api?q=S%C4%B1raselviler%2020'))).toBe(true);
  expect(photonRequests.some((u) => u.includes('/reverse'))).toBe(false);
});

test('"Share 123go.taxi" shares the site itself', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { shared: unknown }).shared = null;
    navigator.share = async (data) => {
      (window as unknown as { shared: unknown }).shared = data;
    };
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Share 123go.taxi' }).click();
  expect(await page.evaluate(() => (window as unknown as { shared: { url: string } }).shared.url)).toBe('https://123go.taxi');
});

test('a shared Yandex place with an unreadable link offers the place by name', async ({ page, photonRequests }) => {
  await page.goto('./');
  await page.getByLabel('Where to?', { exact: true }).fill(
    'Galata Tower\nIstanbul, Beyoglu, Buyuk Hendek Avenue, 2\nhttps://yandex.com/maps/org/galata_kulesi/1087398212',
  );
  await page.getByLabel('Where to?', { exact: true }).press('Enter');
  await expect(page.locator('.suggestion').first()).toBeVisible();
  // Only the place name and address were searched, never the link.
  expect(photonRequests.some((u) => u.includes('/api?q=') && !u.includes('yandex'))).toBe(true);
});

test('a "?" opens a small box that closes when you tap elsewhere', async ({ page }) => {
  await page.goto('./');
  const help = page.getByText('Three ways to say where you’re going');
  await expect(help).toBeHidden();
  await page.getByRole('button', { name: 'About Where to?' }).click();
  await expect(help).toBeVisible();
  await page.getByRole('heading', { name: 'Your places' }).click();
  await expect(help).toBeHidden();
  await page.getByRole('button', { name: 'About Your places' }).click();
  await expect(page.getByText('Kept only in this browser')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Kept only in this browser')).toBeHidden();
});

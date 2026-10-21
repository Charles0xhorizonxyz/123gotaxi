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

test('the menu starts on "Choose your app", which can’t be picked back once an app is chosen', async ({ page }) => {
  await page.goto('./');
  const menu = page.getByLabel('Navigation app', { exact: true });
  await expect(menu.locator('option:checked')).toHaveText('Choose your app');
  await menu.selectOption({ label: 'Waze' });
  await expect(menu.locator('option', { hasText: 'Choose your app' })).toHaveCount(0);
  // Nothing chosen yet on another phone: the driver screen shows the list.
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(DRIVER_LINK);
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();
  expect(page.url()).not.toContain('waze.com');
});

test('"Open in navigation" opens the chosen app straight away, without adding a New place', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gogogo.app.v1', 'waze'));
  await page.goto('./');
  await page.getByLabel('Where to?', { exact: true }).fill('41.0342, 28.9844');
  await page.getByRole('link', { name: 'Open in navigation' }).click();
  await page.waitForURL(/^https:\/\/waze\.com\/ul\?ll=41\.0342,28\.9844/);
  const saved = await page.evaluate(() => localStorage.getItem('gogogo.saved.v2'));
  expect(saved ?? '[]').not.toContain('pending');
});

test('a 123go.taxi QR opened on this phone is added as New, with keep and remove', async ({ page }) => {
  await page.goto(DRIVER_LINK);
  await expect(page.getByRole('heading', { name: 'Cihangir' })).toBeVisible();
  await page.goto('./');
  await expect(page.locator('.chip.new')).toBeVisible();
  await page.getByRole('button', { name: 'Keep Cihangir' }).click();
  await expect(page.locator('.chip.new')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Cihangir/ })).toBeVisible();
  // Opening the same QR again doesn't add it twice.
  await page.goto(DRIVER_LINK);
  await page.goto('./');
  await expect(page.getByRole('button', { name: /^Cihangir/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete Cihangir' }).click();
  await expect(page.getByRole('button', { name: /^Cihangir/ })).toHaveCount(0);
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

test('"Put it on your website" puts the public name in the QR and gives the code', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?', { exact: true }).fill('41.0342, 28.9844');
  await page.getByRole('button', { name: 'Put it on your website' }).click();
  await page.getByLabel(/^Your place’s name/).fill('Pandeli');
  await expect(page.locator('#business-code')).toHaveValue(/n=Pandeli/);
  await expect(page.locator('#business-code')).toHaveValue(/Reach us with 123go\.taxi/);
  await page.getByLabel('Language of the card').selectOption({ label: 'Français' });
  await expect(page.locator('#business-code')).toHaveValue(/Rejoignez-nous avec 123go\.taxi/);
  // A guest opening it gets the place, by name, in their list.
  const link = await page.locator('.business-card').getAttribute('href');
  await page.goto('about:blank');
  await page.goto(link!.replace('https://123go.taxi/', './'));
  await expect(page.getByRole('heading', { name: 'Pandeli' })).toBeVisible();
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Keep Pandeli' })).toBeVisible();
});

test.describe('with Geoapify answering', () => {
  test.use({ geoapifyAnswers: true });

  test('searches and addresses come from Geoapify, and Photon is not asked', async ({ page, photonRequests, geoapifyRequests }) => {
    await page.goto('./');
    await page.getByLabel('Where to?', { exact: true }).pressSequentially('Sıraselviler 20');
    const place = page.getByRole('button', { name: /Sıraselviler Caddesi 20/ });
    await expect(place).toBeVisible();
    await place.click();
    await expect(page.locator('.result .address')).toHaveText('Sıraselviler Caddesi 20, Katip Mustafa Çelebi, Beyoğlu');
    expect(geoapifyRequests.some((u) => u.includes('/v1/geocode/autocomplete?text=S%C4%B1raselviler%2020'))).toBe(true);
    expect(photonRequests).toEqual([]);
  });
});

test('文A switches the whole page to another language, and remembers it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Language/ }).click();
  await page.getByRole('button', { name: 'Français' }).click();
  await expect(page.getByRole('heading', { name: 'Où allez-vous ?' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vos lieux' })).toBeVisible();
  // The driver screen speaks it too.
  await page.goto('about:blank');
  await page.goto(DRIVER_LINK);
  await expect(page.getByRole('heading', { name: 'Ouvrir avec' })).toBeVisible();
});

test('a phone set to Turkish gets the page in Turkish', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'tr-TR' });
  const page = await context.newPage();
  await page.route('https://**', (route) => route.abort());
  await page.goto('http://localhost:4173/');
  await expect(page.getByRole('heading', { name: 'Nereye?' })).toBeVisible();
  await context.close();
});

test('"Put it on your website" starts with the place’s name and the page’s language', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Where to?', { exact: true }).fill('41.0342, 28.9844');
  await page.getByLabel(/^Name/).fill('Pandeli');
  await page.getByRole('button', { name: 'Put it on your website' }).click();
  await expect(page.getByLabel(/^Your place’s name/)).toHaveValue('Pandeli');
  await expect(page.getByLabel('Language of the card')).toHaveValue('en');
});

test('the one-pager for places speaks the visitor’s language and leads to the app', async ({ page }) => {
  await page.goto('./onmysite/');
  await expect(page.getByRole('heading', { name: 'Bring your guests to your door by taxi' })).toBeVisible();
  await expect(page.locator('.business-card img')).toHaveAttribute('src', /^data:image\/png/);
  await page.getByRole('button', { name: /^Language/ }).click();
  await page.getByRole('button', { name: 'Türkçe' }).click();
  await expect(page.getByRole('heading', { name: 'Misafirlerinizi taksiyle kapınıza kadar getirin' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kartınızı oluşturun' })).toHaveCount(1);
  await page.getByRole('link', { name: 'Kartınızı oluşturun' }).click();
  await expect(page.getByRole('heading', { name: 'Nereye?' })).toBeVisible();
});

test('every app is in the menu and usable straight away; suggesting one is optional', async ({ page }, testInfo) => {
  await page.goto('./');
  const menu = page.getByLabel('Navigation app', { exact: true });
  await menu.selectOption({ label: '2GIS' });
  await expect(page.getByRole('link', { name: /isn’t listed\? Tell us/ })).toHaveAttribute('href', /issues\/new\?template=app-suggestion\.yml/);
  // Android: "Other app on this phone" opens any installed app; iPhone has no such way.
  const other = menu.locator('option', { hasText: 'Other app on this phone' });
  if (testInfo.project.name === 'android') {
    await menu.selectOption({ label: 'Other app on this phone' });
    await expect(page.getByText('Opens any navigation app on this phone')).toBeVisible();
    await menu.selectOption({ label: '2GIS' });
  } else {
    await expect(other).toHaveCount(0);
  }
  // Keep the list showing, to look at it: the chosen app comes first.
  await page.evaluate(() => localStorage.setItem('gogogo.app.direct.v1', '0'));
  await page.goto('about:blank');
  await page.goto(DRIVER_LINK);
  await expect(page.locator('.app').first()).toHaveText('2GIS');
});

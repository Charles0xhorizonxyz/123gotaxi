// Browser tests never call the real address service: every request to it gets
// this canned answer, and the tests can inspect what was asked.
import { test as base, expect } from '@playwright/test';

export const PHOTON_REPLY = {
  features: [
    {
      geometry: { coordinates: [28.9844, 41.0342] },
      properties: {
        housenumber: '20',
        street: 'Sıraselviler Caddesi',
        district: 'Katip Mustafa Çelebi',
        city: 'Beyoğlu',
        state: 'İstanbul',
      },
    },
  ],
};

export const ADDRESS = 'Sıraselviler Caddesi 20, Katip Mustafa Çelebi, Beyoğlu';

export const test = base.extend<{ photonRequests: string[] }>({
  photonRequests: [
    async ({ page }, use) => {
      const requests: string[] = [];
      await page.route('https://photon.komoot.io/**', (route) => {
        requests.push(route.request().url());
        return route.fulfill({
          json: PHOTON_REPLY,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      });
      await use(requests);
    },
    { auto: true },
  ],
});

export { expect };

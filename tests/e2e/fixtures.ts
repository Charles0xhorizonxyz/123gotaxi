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

/** Geoapify's answer in the tests that let it answer (see geoapifyAnswers). */
export const GEOAPIFY_REPLY = {
  results: [
    {
      lat: 41.0342,
      lon: 28.9844,
      housenumber: '20',
      street: 'Sıraselviler Caddesi',
      suburb: 'Katip Mustafa Çelebi',
      city: 'Beyoğlu',
    },
  ],
};

export const test = base.extend<{ photonRequests: string[]; geoapifyRequests: string[]; geoapifyAnswers: boolean }>({
  // By default Geoapify refuses (as it does on a developer's machine), so Photon,
  // the backup, answers. A test sets geoapifyAnswers to let Geoapify answer.
  geoapifyAnswers: [false, { option: true }],
  geoapifyRequests: [
    async ({ page, geoapifyAnswers }, use) => {
      const requests: string[] = [];
      await page.route('https://api.geoapify.com/**', (route) => {
        requests.push(route.request().url());
        return geoapifyAnswers
          ? route.fulfill({ json: GEOAPIFY_REPLY, headers: { 'Access-Control-Allow-Origin': '*' } })
          : route.fulfill({ status: 401, json: { error: 'Unauthorized' }, headers: { 'Access-Control-Allow-Origin': '*' } });
      });
      await use(requests);
    },
    { auto: true },
  ],
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

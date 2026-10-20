import { describe, expect, it } from 'vitest';
import { websiteSnippet } from '../../src/pages/business';

describe('websiteSnippet', () => {
  it('is one card linking to the place, words over the QR, escaped', () => {
    const code = websiteSnippet('https://123go.taxi/#v=1&lat=41&lon=29&n=Tom+%26+Jerry', 'data:image/png;base64,AAAA');
    expect(code).toContain('href="https://123go.taxi/#v=1&amp;lat=41&amp;lon=29&amp;n=Tom+%26+Jerry"');
    expect(code.indexOf('Reach us with 123go.taxi')).toBeLessThan(code.indexOf('<img src="data:image/png;base64,AAAA"'));
    expect(code.trim().endsWith('</a>')).toBe(true);
    expect(code).not.toContain('<script');
  });

  it('speaks the chosen language', () => {
    const code = websiteSnippet('https://123go.taxi/#v=1&lat=41&lon=29', 'data:x', 'fr');
    expect(code).toContain('lang="fr"');
    expect(code).toContain('Rejoignez-nous avec 123go.taxi');
  });
});

describe('the website guide', () => {
  it("has an example link that opens as the guide says", async () => {
    const { readFileSync } = await import('node:fs');
    const { parseJourney } = await import('../../src/destination-url');
    const guide = readFileSync('docs/ADD-TO-YOUR-WEBSITE.md', 'utf8');
    const llms = readFileSync('public/llms.txt', 'utf8');
    for (const text of [guide, llms]) {
      const link = /https:\/\/123go\.taxi\/#v=1&lat=41\.02564[^\s)`"]+/.exec(text)?.[0];
      expect(link).toBeDefined();
      const parsed = parseJourney(new URL(link!).hash);
      expect(parsed).toMatchObject({ kind: 'ok', journey: { label: 'Galata Kulesi', address: 'Bereketzade, Beyoğlu' } });
    }
  });
});

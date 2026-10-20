import { describe, expect, it } from 'vitest';
import { websiteSnippet } from '../../src/pages/business';

describe('websiteSnippet', () => {
  it('links to the place, shows its name, and escapes it', () => {
    const code = websiteSnippet('https://123go.taxi/#v=1&lat=41&lon=29&n=Tom+%26+Jerry', 'Tom & Jerry "Bar"', 'data:image/png;base64,AAAA');
    expect(code).toContain('href="https://123go.taxi/#v=1&amp;lat=41&amp;lon=29&amp;n=Tom+%26+Jerry"');
    expect(code).toContain('Get to Tom &amp; Jerry &quot;Bar&quot; by taxi');
    expect(code).toContain('<img src="data:image/png;base64,AAAA"');
    expect(code).not.toContain('<script');
  });

  it('says "Get here by taxi" without a name', () => {
    expect(websiteSnippet('https://123go.taxi/#v=1&lat=41&lon=29', '', 'data:x')).toContain('Get here by taxi');
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

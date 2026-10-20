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

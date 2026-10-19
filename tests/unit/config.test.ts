import { describe, expect, it } from 'vitest';
import { resolvePublicUrl } from '../../src/config';

describe('resolvePublicUrl', () => {
  it('uses the canonical domain in production', () => {
    expect(resolvePublicUrl({ dev: false, origin: 'https://example.org', basePath: '/' })).toBe(
      'https://gogogo.rodeo',
    );
  });

  it('follows the current address on the dev server', () => {
    expect(resolvePublicUrl({ dev: true, origin: 'http://192.168.1.20:5173', basePath: '/' })).toBe(
      'http://192.168.1.20:5173',
    );
  });

  it('prefers an explicit build setting and strips trailing slashes', () => {
    expect(
      resolvePublicUrl({ envUrl: 'https://maps.example.org/go/', dev: true, basePath: '/' }),
    ).toBe('https://maps.example.org/go');
  });
});

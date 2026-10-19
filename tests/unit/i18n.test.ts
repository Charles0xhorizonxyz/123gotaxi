import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { pickLanguage } from '../../src/i18n';

describe('pickLanguage', () => {
  it('picks Turkish for tr-TR', () => {
    expect(pickLanguage(['tr-TR', 'en-US'])).toBe('tr');
  });

  it('respects browser preference order', () => {
    expect(pickLanguage(['en-GB', 'tr'])).toBe('en');
  });

  it('skips unsupported languages', () => {
    expect(pickLanguage(['ru-RU', 'tr'])).toBe('tr');
  });

  it('falls back to English', () => {
    expect(pickLanguage(['ru-RU', 'ar'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });
});

describe('translations', () => {
  it('Turkish has every English key, none empty', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tr[key], key).toBeTruthy();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { LANGUAGES, pickLanguage, STRINGS } from '../../src/i18n';

describe('languages', () => {
  it('uses the saved choice, else the phone’s language, else English', () => {
    expect(pickLanguage('tr', ['fr-FR'])).toBe('tr');
    expect(pickLanguage(null, ['pt-BR', 'fr-CA', 'en'])).toBe('fr');
    expect(pickLanguage('xx', ['ja-JP'])).toBe('en');
  });

  it('has every phrase in every language, never empty', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k]));
    const english = keys(STRINGS.en).sort();
    for (const code of Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]) {
      expect(keys(STRINGS[code]).sort()).toEqual(english);
      const empty = Object.entries(STRINGS[code]).filter(([, v]) => v === '');
      expect(empty).toEqual([]);
    }
  });

  it('counts in Russian the Russian way', () => {
    expect(STRINGS.ru.nStops(2)).toBe('2 остановки');
    expect(STRINGS.ru.addedPlaces(5)).toBe('Добавлено 5 мест.');
    expect(STRINGS.ru.addedPlaces(1)).toBe('Добавлено 1 место.');
  });
});

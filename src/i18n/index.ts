import { en, type MessageKey } from './en';
import { tr } from './tr';

export const LANGUAGES = { en, tr } as const;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = 'en';

/** Pick the first supported language from the browser's preference list. */
export function pickLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base && base in LANGUAGES) return base as Language;
  }
  return DEFAULT_LANGUAGE;
}

let current: Language = DEFAULT_LANGUAGE;

export function setLanguage(lang: Language): void {
  current = lang;
}

export function getLanguage(): Language {
  return current;
}

export function t(key: MessageKey): string {
  return LANGUAGES[current][key];
}

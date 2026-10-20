import { describe, expect, it } from 'vitest';
import { AppPreference, DIRECT_KEY } from '../../src/preferences';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('AppPreference', () => {
  it('opens directly unless turned off', () => {
    const storage = memoryStorage();
    const preference = new AppPreference(storage);
    expect(preference.direct).toBe(true);
    preference.setDirect(false);
    expect(preference.direct).toBe(false);
    expect(storage.getItem(DIRECT_KEY)).toBe('0');
    preference.setDirect(true);
    expect(storage.getItem(DIRECT_KEY)).toBeNull();
  });

  it('remembers and forgets the app', () => {
    const preference = new AppPreference(memoryStorage());
    preference.set('waze');
    expect(preference.get()).toBe('waze');
    preference.forget();
    expect(preference.get()).toBeNull();
  });
});

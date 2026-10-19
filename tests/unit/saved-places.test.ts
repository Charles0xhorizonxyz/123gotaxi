import { describe, expect, it } from 'vitest';
import { MAX_SAVED, SavedPlaces, STORAGE_KEY } from '../../src/saved-places';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('SavedPlaces', () => {
  it('saves newest first', () => {
    const store = new SavedPlaces(memoryStorage());
    store.add({ lat: 1, lon: 1, label: 'A' }, 1);
    store.add({ lat: 2, lon: 2, label: 'B' }, 2);
    expect(store.list().map((p) => p.label)).toEqual(['B', 'A']);
  });

  it('moves a re-saved place to the top instead of duplicating it', () => {
    const store = new SavedPlaces(memoryStorage());
    store.add({ lat: 1, lon: 1, label: 'A' }, 1);
    store.add({ lat: 2, lon: 2, label: 'B' }, 2);
    store.add({ lat: 1, lon: 1, label: 'A' }, 3);
    expect(store.list().map((p) => p.label)).toEqual(['A', 'B']);
  });

  it('removes and clears', () => {
    const store = new SavedPlaces(memoryStorage());
    const a = store.add({ lat: 1, lon: 1 });
    store.add({ lat: 2, lon: 2 });
    store.remove(a.id);
    expect(store.list()).toHaveLength(1);
    store.clear();
    expect(store.list()).toEqual([]);
  });

  it('keeps at most MAX_SAVED places', () => {
    const store = new SavedPlaces(memoryStorage());
    for (let i = 0; i < MAX_SAVED + 5; i++) store.add({ lat: 1, lon: i / 100 }, i);
    expect(store.list()).toHaveLength(MAX_SAVED);
  });

  it('survives corrupted or tampered storage', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(new SavedPlaces(storage).list()).toEqual([]);
    storage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'x', savedAt: 1, lat: 999, lon: 0 }, 'junk']));
    expect(new SavedPlaces(storage).list()).toEqual([]);
  });

  it('does nothing when storage is blocked', () => {
    const store = new SavedPlaces(null);
    expect(store.available).toBe(false);
    store.add({ lat: 1, lon: 1 });
    expect(store.list()).toEqual([]);
  });
});

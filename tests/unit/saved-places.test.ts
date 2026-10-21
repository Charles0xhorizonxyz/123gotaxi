import { describe, expect, it } from 'vitest';
import { MAX_SAVED, SavedPlaces, STORAGE_KEY } from '../../src/saved-places';
import { AppPreference } from '../../src/preferences';

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

const at = (lat: number, lon = lat) => ({ stops: [{ lat, lon }] });

describe('SavedPlaces', () => {
  it('saves name and note, new places at the bottom', () => {
    const store = new SavedPlaces(memoryStorage());
    store.add({ ...at(1), name: 'A', note: 'Blue door' }, 1);
    store.add({ ...at(2), name: 'B' }, 2);
    const [a, b] = store.list();
    expect(b).toMatchObject({ name: 'B', note: undefined });
    expect(a).toMatchObject({ name: 'A', note: 'Blue door' });
  });

  it('treats the name as optional', () => {
    const store = new SavedPlaces(memoryStorage());
    store.add({ ...at(1), name: '   ', note: 'Corner shop' });
    expect(store.list()[0]).toMatchObject({ name: undefined, note: 'Corner shop' });
  });

  it('keeps the looked-up address, including through export and import', () => {
    const phone = new SavedPlaces(memoryStorage());
    phone.add({ ...at(1), address: 'Sıraselviler Caddesi 20, Beyoğlu' });
    expect(phone.list()[0]?.address).toBe('Sıraselviler Caddesi 20, Beyoğlu');
    const laptop = new SavedPlaces(memoryStorage());
    laptop.importJson(phone.exportJson());
    expect(laptop.list()[0]?.address).toBe('Sıraselviler Caddesi 20, Beyoğlu');
  });

  it('keeps multi-stop journeys in order', () => {
    const store = new SavedPlaces(memoryStorage());
    const stops = [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, { lat: 3, lon: 3 }];
    store.add({ stops, name: 'Errands' });
    expect(store.list()[0]?.stops).toEqual(stops);
  });

  it('moves a re-saved journey to the top instead of duplicating it', () => {
    const store = new SavedPlaces(memoryStorage());
    store.add({ ...at(1), name: 'A' }, 1);
    store.add({ ...at(2), name: 'B' }, 2);
    store.add({ ...at(1), name: 'A', note: 'updated' }, 3);
    expect(store.list().map((p) => [p.name, p.note])).toEqual([
      ['A', 'updated'],
      ['B', undefined],
    ]);
  });

  it('removes and clears', () => {
    const store = new SavedPlaces(memoryStorage());
    const a = store.add({ ...at(1), name: 'A' });
    store.add({ ...at(2), name: 'B' });
    store.remove(a.id);
    expect(store.list()).toHaveLength(1);
    store.clear();
    expect(store.list()).toEqual([]);
  });

  it(`keeps at most ${MAX_SAVED} places`, () => {
    const store = new SavedPlaces(memoryStorage());
    for (let i = 0; i < MAX_SAVED + 5; i++) store.add({ ...at(1, i / 1000), name: `P${i}` }, i);
    expect(store.list()).toHaveLength(MAX_SAVED);
  });

  it('survives corrupted or tampered storage', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(new SavedPlaces(storage).list()).toEqual([]);
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'x', name: 'Bad', savedAt: 1, stops: [{ lat: 999, lon: 0 }] }, 'junk']),
    );
    expect(new SavedPlaces(storage).list()).toEqual([]);
  });

  it('brings over places saved by the first version', () => {
    const storage = memoryStorage();
    storage.setItem(
      'gogogo.saved.v1',
      JSON.stringify([{ id: 'a', lat: 41.03, lon: 28.98, label: 'Home', savedAt: 5 }, { id: 'b', lat: 1, lon: 2, savedAt: 6 }]),
    );
    const places = new SavedPlaces(storage).list();
    expect(places.map((p) => p.name)).toEqual(['Home', undefined]);
    expect(storage.getItem('gogogo.saved.v1')).toBeNull();
  });

  it('does nothing when storage is blocked', () => {
    const store = new SavedPlaces(null);
    expect(store.available).toBe(false);
    store.add({ ...at(1), name: 'A' });
    expect(store.list()).toEqual([]);
  });
});

describe('export and import', () => {
  it('moves a list to another device without duplicates', () => {
    const phone = new SavedPlaces(memoryStorage());
    phone.add({ ...at(1), name: 'Home', note: 'Ring twice' });
    phone.add({ stops: [{ lat: 2, lon: 2 }, { lat: 3, lon: 3 }], name: 'Errands' });
    const file = phone.exportJson();

    const laptop = new SavedPlaces(memoryStorage());
    laptop.add({ ...at(1), name: 'Home', note: 'Ring twice' });
    expect(laptop.importJson(file)).toBe(1);
    expect(laptop.list().map((p) => p.name).sort()).toEqual(['Errands', 'Home']);
    expect(laptop.importJson(file)).toBe(0);
  });

  it('still imports files exported under the old gogogo.rodeo name', () => {
    const store = new SavedPlaces(memoryStorage());
    const file = JSON.stringify({ format: 'gogogo.rodeo/places', version: 1, places: [{ name: 'Old', stops: [{ lat: 1, lon: 1 }] }] });
    expect(store.importJson(file)).toBe(1);
  });

  it('rejects files that are not ours', () => {
    const store = new SavedPlaces(memoryStorage());
    expect(() => store.importJson('hello')).toThrow('not-json');
    expect(() => store.importJson('{"places": []}')).toThrow('wrong-format');
  });

  it('skips broken entries in an otherwise valid file', () => {
    const store = new SavedPlaces(memoryStorage());
    const file = JSON.stringify({
      format: '123go.taxi/places',
      version: 1,
      places: [{ name: 'Ok', stops: [{ lat: 1, lon: 1 }] }, { name: 'Bad', stops: [{ lat: 500, lon: 1 }] }, { name: 'No stops' }],
    });
    expect(store.importJson(file)).toBe(1);
  });
});

describe('AppPreference', () => {
  it('remembers and forgets the driver app', () => {
    const pref = new AppPreference(memoryStorage());
    expect(pref.get()).toBeNull();
    pref.set('waze');
    expect(pref.get()).toBe('waze');
    pref.forget();
    expect(pref.get()).toBeNull();
  });

  it('is harmless without storage', () => {
    const pref = new AppPreference(null);
    pref.set('waze');
    expect(pref.get()).toBeNull();
    expect(pref.available).toBe(false);
  });
});

describe('places opened from a QR', () => {
  it('are added once, as New, until kept', () => {
    const saved = new SavedPlaces(memoryStorage());
    const journey = { stops: [{ lat: 41.0342, lon: 28.9844 }], label: 'Pandeli' };
    const place = saved.addScanned(journey);
    expect(place).toMatchObject({ name: 'Pandeli', pending: true });
    saved.addScanned(journey);
    expect(saved.list()).toHaveLength(1);
    expect(JSON.parse(saved.exportJson()).places).toHaveLength(0);
    saved.keep(place.id);
    expect(saved.list()[0]!.pending).toBeUndefined();
    expect(JSON.parse(saved.exportJson()).places).toHaveLength(1);
  });
});

describe('reordering', () => {
  it('keeps the order the places were dragged into', () => {
    const saved = new SavedPlaces(memoryStorage());
    const a = saved.add({ stops: [{ lat: 1, lon: 1 }], name: 'A' }, 1);
    const b = saved.add({ stops: [{ lat: 2, lon: 2 }], name: 'B' }, 2);
    const c = saved.add({ stops: [{ lat: 3, lon: 3 }], name: 'C' }, 3);
    expect(saved.list().map((p) => p.name)).toEqual(['A', 'B', 'C']);
    saved.reorder([c.id, a.id, b.id]);
    expect(saved.list().map((p) => p.name)).toEqual(['C', 'A', 'B']);
    // Saving one of them again keeps its place in the order.
    saved.add({ stops: [{ lat: 1, lon: 1 }], name: 'A', note: 'again' }, 4);
    expect(saved.list().map((p) => p.name)).toEqual(['C', 'A', 'B']);
    expect(saved.list()[1]!.note).toBe('again');
  });
});

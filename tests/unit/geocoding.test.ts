import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPhotonAddress, photonGeocoder } from '../../src/geocoding';

// Real Photon answers for Istanbul, trimmed to the fields we use.
describe('formatPhotonAddress', () => {
  it('street, number, neighbourhood, town', () => {
    expect(
      formatPhotonAddress({
        housenumber: '20',
        street: 'Sıraselviler Caddesi',
        district: 'Katip Mustafa Çelebi',
        city: 'Beyoğlu',
        state: 'İstanbul',
      }),
    ).toBe('Sıraselviler Caddesi 20, Katip Mustafa Çelebi, Beyoğlu');
  });

  it('leads with the place name and drops repeats', () => {
    expect(
      formatPhotonAddress({
        name: 'Galata Kulesi',
        street: 'Bereketzade Mahallesi',
        locality: 'Kuledibi',
        district: 'Bereketzade',
        city: 'İstanbul',
      }),
    ).toBe('Galata Kulesi, Bereketzade Mahallesi, İstanbul');
  });

  it('falls back to locality and state', () => {
    expect(formatPhotonAddress({ street: 'Hastane Caddesi', locality: 'Uğur Mumcu', state: 'İstanbul' })).toBe(
      'Hastane Caddesi, Uğur Mumcu, İstanbul',
    );
  });

  it('ignores a house number without a street', () => {
    expect(formatPhotonAddress({ housenumber: '5', city: 'Beyoğlu' })).toBe('Beyoğlu');
  });

  it('returns null when there is nothing useful', () => {
    expect(formatPhotonAddress({})).toBeNull();
  });
});

describe('photonGeocoder', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, ok = true) {
    const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>>(
      async () => ({ ok, json: async () => body }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('sends only the coordinates and caches the answer', async () => {
    const fetchMock = stubFetch({ features: [{ properties: { street: 'Sıraselviler Caddesi', city: 'Beyoğlu' } }] });
    const geocoder = photonGeocoder('https://photon.example');
    const point = { lat: 41.034212, lon: 28.98441 };

    expect(await geocoder.reverse(point)).toBe('Sıraselviler Caddesi, Beyoğlu');
    expect(await geocoder.reverse(point)).toBe('Sıraselviler Caddesi, Beyoğlu');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://photon.example/reverse?lat=41.03421&lon=28.98441&limit=1');
  });

  it('returns null for an empty answer or a server error', async () => {
    stubFetch({ features: [] });
    expect(await photonGeocoder('https://photon.example').reverse({ lat: 1, lon: 2 })).toBeNull();
    stubFetch({}, false);
    expect(await photonGeocoder('https://photon.example').reverse({ lat: 1, lon: 2 })).toBeNull();
  });
});

describe('toSuggestions', () => {
  it('keeps places with an address, once each, name first', async () => {
    const { toSuggestions } = await import('../../src/geocoding');
    const place = { geometry: { coordinates: [28.98, 41.03] as [number, number] }, properties: { name: 'Galata Kulesi', street: 'Bereketzade', city: 'Beyoğlu' } };
    expect(
      toSuggestions({ features: [place, place, { properties: { name: 'No geometry' } }] }),
    ).toEqual([{ lat: 41.03, lon: 28.98, name: 'Galata Kulesi', address: 'Galata Kulesi, Bereketzade, Beyoğlu' }]);
  });
});

describe('Geoapify, with Photon as backup', () => {
  it('reads Geoapify results like Photon ones', async () => {
    const { geoapifySuggestions } = await import('../../src/geocoding');
    expect(
      geoapifySuggestions({
        results: [{ lat: 41.0256, lon: 28.9742, name: 'Galata Tower', street: 'Bereketzade Mahallesi', suburb: 'Bereketzade Mahallesi', city: 'İstanbul' }],
      }),
    ).toEqual([{ lat: 41.0256, lon: 28.9742, name: 'Galata Tower', address: 'Galata Tower, Bereketzade Mahallesi, İstanbul' }]);
  });

  it('asks the backup when the first service fails, and remembers what it learned', async () => {
    const { withBackup } = await import('../../src/geocoding');
    const failing = { attribution: '', reverse: vi.fn(async () => { throw new Error('HTTP 429'); }), search: vi.fn(async () => { throw new Error('HTTP 429'); }) };
    const backup = { attribution: '', reverse: vi.fn(async () => 'Backup street 1'), search: vi.fn(async () => [{ lat: 1, lon: 2, name: 'B', address: 'B, Town' }]) };
    const geocoder = withBackup(failing, backup);
    expect(await geocoder.reverse({ lat: 3, lon: 4 })).toBe('Backup street 1');
    expect(await geocoder.search('b')).toHaveLength(1);
    // Picking the suggestion needs no further lookup.
    expect(await geocoder.reverse({ lat: 1, lon: 2 })).toBe('B, Town');
    expect(backup.reverse).toHaveBeenCalledTimes(1);
  });
});

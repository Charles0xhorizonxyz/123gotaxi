import { describe, expect, it } from 'vitest';
import { parseLocation } from '../../src/link-parsing';

function coords(input: string) {
  const result = parseLocation(input);
  return result.ok ? [result.place.lat, result.place.lon] : result.reason;
}

describe('raw coordinates', () => {
  it.each([
    ['41.0342, 28.9844', [41.0342, 28.9844]],
    ['41.0342,28.9844', [41.0342, 28.9844]],
    ['41.0342 28.9844', [41.0342, 28.9844]],
    ['  41.0342 ; 28.9844 ', [41.0342, 28.9844]],
    ['41.0342° N, 28.9844° E', [41.0342, 28.9844]],
    ['33.8688 S, 151.2093 E', [-33.8688, 151.2093]],
    ['40.7128, -74.006', [40.7128, -74.006]],
  ])('%s', (input, expected) => {
    expect(coords(input)).toEqual(expected);
  });

  it('rejects out-of-range numbers', () => {
    expect(coords('141.03, 28.98')).toBe('unrecognised');
  });
});

describe('geo: URIs', () => {
  it('reads coordinates and label', () => {
    expect(parseLocation('geo:41.0342,28.9844?q=41.0342,28.9844(Home)')).toEqual({
      ok: true,
      place: { lat: 41.0342, lon: 28.9844, label: 'Home' },
    });
  });
});

describe('Google Maps', () => {
  it('prefers the exact place pin over the map centre', () => {
    const url =
      'https://www.google.com/maps/place/Galata+Kulesi/@41.0256,28.9741,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d41.025631!4d28.974155';
    expect(parseLocation(url)).toEqual({
      ok: true,
      place: { lat: 41.025631, lon: 28.974155, label: 'Galata Kulesi' },
    });
  });

  it.each([
    ['https://www.google.com/maps/@41.0342,28.9844,15z', [41.0342, 28.9844]],
    ['https://maps.google.com/?q=41.0342,28.9844', [41.0342, 28.9844]],
    ['https://www.google.com/maps/search/?api=1&query=41.0342%2C28.9844', [41.0342, 28.9844]],
    ['https://www.google.com.tr/maps/dir/?api=1&destination=41.0342,28.9844', [41.0342, 28.9844]],
    ['https://www.google.com/maps/search/41.0342,+28.9844', [41.0342, 28.9844]],
    ['google.com/maps/@41.0342,28.9844,15z', [41.0342, 28.9844]],
  ])('%s', (input, expected) => {
    expect(coords(input)).toEqual(expected);
  });
});

describe('Yandex (longitude first!)', () => {
  it.each([
    ['https://yandex.com.tr/maps/?ll=28.9844%2C41.0342&z=16', [41.0342, 28.9844]],
    ['https://yandex.ru/maps/?pt=28.9844,41.0342&z=17&l=map', [41.0342, 28.9844]],
    ['https://yandex.com/maps/?rtext=~41.0342%2C28.9844&rtt=auto', [41.0342, 28.9844]],
    [
      'https://yandex.com.tr/maps/?ll=29.0,41.1&rtext=41.0,29.0~41.0342,28.9844&rtt=auto',
      [41.0342, 28.9844],
    ],
    [
      'https://yandex.com.tr/maps/?whatshere%5Bpoint%5D=28.9844%2C41.0342&whatshere%5Bzoom%5D=17',
      [41.0342, 28.9844],
    ],
  ])('%s', (input, expected) => {
    expect(coords(input)).toEqual(expected);
  });
});

describe('Apple Maps and OpenStreetMap', () => {
  it.each([
    ['https://maps.apple.com/?ll=41.0342,28.9844&q=Home', [41.0342, 28.9844]],
    ['https://maps.apple.com/?daddr=41.0342,28.9844&dirflg=d', [41.0342, 28.9844]],
    ['https://maps.apple.com/place?coordinate=41.0342,28.9844&name=Home', [41.0342, 28.9844]],
    ['https://www.openstreetmap.org/?mlat=41.0342&mlon=28.9844#map=17/41.0342/28.9844', [41.0342, 28.9844]],
    ['https://www.openstreetmap.org/#map=17/41.0342/28.9844', [41.0342, 28.9844]],
  ])('%s', (input, expected) => {
    expect(coords(input)).toEqual(expected);
  });
});

describe('123go.taxi links', () => {
  it('reads our own QR links back', () => {
    expect(parseLocation('https://123go.taxi/#v=1&lat=41.0342&lon=28.9844&n=Home')).toEqual({
      ok: true,
      place: { lat: 41.0342, lon: 28.9844, label: 'Home' },
    });
  });
});

describe('things we cannot read', () => {
  it.each([
    'https://maps.app.goo.gl/AbCdEf123',
    'https://goo.gl/maps/AbCdEf123',
    'https://yandex.com.tr/maps/-/CDqZaS~f',
    'https://maps.apple/p/AbCdEf',
  ])('flags short link %s', (input) => {
    expect(coords(input)).toBe('short-link');
  });

  it('finds a short link inside shared text and keeps only the link', () => {
    expect(parseLocation('Bâton Rouge Grillhouse & Bar\nhttps://maps.app.goo.gl/42vbXakpmaLpAsuD9?g_st=ac')).toEqual({
      ok: false,
      reason: 'short-link',
      link: 'https://maps.app.goo.gl/42vbXakpmaLpAsuD9?g_st=ac',
    });
  });

  it('reads a long link inside shared text', () => {
    expect(coords('Galata Tower, Istanbul https://www.google.com/maps/@41.0256,28.9741,17z.')).toEqual([41.0256, 28.9741]);
  });

  it.each(['Istiklal Caddesi 12', 'https://example.com/page', 'hello'])(
    'does not guess from %s',
    (input) => {
      expect(coords(input)).toBe('unrecognised');
    },
  );

  it('reports empty input', () => {
    expect(coords('   ')).toBe('empty');
  });
});

describe('links rebuilt by the expander', () => {
  it('reads the place and its name', () => {
    const link = `https://www.google.com/maps/place/${encodeURIComponent('Bâton Rouge Grillhouse & Bar, 2844 Rue King Ouest')}/data=!3d45.3970493!4d-71.9420658`;
    expect(parseLocation(link)).toEqual({
      ok: true,
      place: { lat: 45.3970493, lon: -71.9420658, label: 'Bâton Rouge Grillhouse & Bar, 2844 Rue King Ouest' },
    });
  });
});

// Real links shared from map apps on our own phones (collected with the field-test page).
// Each must land within a few hundred metres of where it really is.
import { describe, expect, it } from 'vitest';
import { parseLocation } from '../../src/link-parsing';

const GALATA = { lat: 41.025636, lon: 28.974167 };

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

const CASES: { app: string; what: string; text: string; place: { lat: number; lon: number } }[] = [
  {
    app: 'Yandex Maps, Android',
    what: 'street address',
    text: 'Siraselviler Avenue, No:20\nBeyoglu, Istanbul\nhttps://yandex.com/maps?whatshere%5Bpoint%5D=28.98451095138285%2C41.03424737350657&whatshere%5Bzoom%5D=16.0&ll=28.98451095138284%2C41.034247373131834&z=16.0',
    place: { lat: 41.03424737, lon: 28.98451095 },
  },
  {
    app: 'Yandex Maps, Android',
    what: 'dropped pin (map centre elsewhere)',
    text: 'Nurgul Street\nGayrettepe Neighborhood, Besiktas, Istanbul\nhttps://yandex.com/maps?whatshere%5Bpoint%5D=29.002198431069164%2C41.0590604584971&whatshere%5Bzoom%5D=14.146932&ll=29.002198431069164%2C41.056309507328464&z=14.146932',
    place: { lat: 41.05906046, lon: 29.00219843 },
  },
  {
    app: 'Yandex Maps, Android',
    what: 'route to Galata Tower',
    text: 'https://yandex.com/maps?rtext=41.029528%2C28.981307~41.025625%2C28.974194&rtt=auto',
    place: GALATA,
  },
  {
    app: 'Waze, Android',
    what: 'Galata Tower',
    text: 'Use Waze to drive to galata tower: https://waze.com/ul/hsxk97kd2j',
    place: GALATA,
  },
  {
    app: 'Waze, Android',
    what: 'street address',
    text: 'Use Waze to drive to Sıraselviler Cd. No:20: https://waze.com/ul/hsxk97w1cu',
    place: { lat: 41.03424737, lon: 28.98451095 },
  },
];

describe('real shared links', () => {
  it.each(CASES)('$app: $what', ({ text, place }) => {
    const result = parseLocation(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(metres(result.place, place)).toBeLessThan(60);
  });
});

// One spot (Kadıköy, Istanbul) as Organic Maps offers to copy it, six ways.
describe('the same spot written six ways', () => {
  const SPOT = { lat: 40.983834, lon: 29.038862 };
  it.each([
    ['decimal, as copied (with invisible marks)', '⁨40.983834, 29.038862⁩'],
    ['degrees, minutes, seconds', `40°59'01.8"N 29°02'19.9"E`],
    ['Plus Code', '8GGFX2MQ+GG'],
    ['OpenStreetMap short link', 'https://osm.org/go/x2SYaXKm-?m='],
    ['UTM', '35T 671518 4538964'],
    ['MGRS', '35T PF 71518 38964'],
  ])('%s', (_, text) => {
    const result = parseLocation(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(metres(result.place, SPOT)).toBeLessThan(30);
  });
});

describe('dropped pins', () => {
  it('Waze, Android: a random spot', () => {
    const result = parseLocation('Use Waze to drive to Erneydanı Sk: https://waze.com/ul/hsxk97rujq');
    expect(result.ok && metres(result.place, { lat: 41.044471, lon: 28.976719 })).toBeLessThan(10);
  });
});

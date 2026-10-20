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
];

describe('real shared links', () => {
  it.each(CASES)('$app: $what', ({ text, place }) => {
    const result = parseLocation(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(metres(result.place, place)).toBeLessThan(50);
  });
});

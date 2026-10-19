import { describe, expect, it } from 'vitest';
import {
  buildJourneyUrl,
  cleanLabel,
  formatCoord,
  parseJourney,
  type Journey,
} from '../../src/destination-url';

const home = { lat: 41.0342, lon: 28.9844 };

describe('formatCoord', () => {
  it('rounds to 5 decimals and drops trailing zeros', () => {
    expect(formatCoord(41.034212345)).toBe('41.03421');
    expect(formatCoord(28.98)).toBe('28.98');
    expect(formatCoord(-0.000001)).toBe('0');
  });
});

describe('buildJourneyUrl', () => {
  it('puts everything after # so servers never see it', () => {
    expect(buildJourneyUrl('https://123go.taxi', { stops: [home] })).toBe(
      'https://123go.taxi/#v=1&lat=41.0342&lon=28.9844',
    );
  });

  it('encodes Turkish labels and spaces', () => {
    expect(buildJourneyUrl('https://123go.taxi', { stops: [home], label: 'Kadıköy İskele' })).toBe(
      'https://123go.taxi/#v=1&lat=41.0342&lon=28.9844&n=Kad%C4%B1k%C3%B6y+%C4%B0skele',
    );
  });

  it('puts earlier stops in "via", keeping lat/lon as the final destination', () => {
    const journey: Journey = {
      stops: [
        { lat: 41.01, lon: 28.97 },
        { lat: 41.02, lon: 28.98 },
        home,
      ],
      label: 'Errands',
    };
    expect(buildJourneyUrl('https://123go.taxi', journey)).toBe(
      'https://123go.taxi/#v=1&lat=41.0342&lon=28.9844&n=Errands&via=41.01,28.97~41.02,28.98',
    );
  });

  it('carries the readable address of the final stop', () => {
    expect(
      buildJourneyUrl('https://123go.taxi', { stops: [home], address: 'Sıraselviler Caddesi 20, Beyoğlu' }),
    ).toBe('https://123go.taxi/#v=1&lat=41.0342&lon=28.9844&a=S%C4%B1raselviler+Caddesi+20,+Beyo%C4%9Flu');
  });

  it('works under a sub-path', () => {
    expect(buildJourneyUrl('https://x.github.io/123gotaxi', { stops: [{ lat: 1, lon: 2 }] })).toBe(
      'https://x.github.io/123gotaxi/#v=1&lat=1&lon=2',
    );
  });
});

describe('parseJourney', () => {
  it('round-trips single and multi-stop journeys', () => {
    for (const journey of [
      { stops: [home], label: 'Ev & bahçe #2' },
      { stops: [{ lat: -33.8688, lon: 151.2093 }, { lat: 1, lon: 2 }, home], label: 'Tour' },
      { stops: [home], address: 'Galata Kulesi, Bereketzade Mahallesi, İstanbul (a + b ~ c)' },
    ]) {
      const hash = new URL(buildJourneyUrl('https://123go.taxi', journey)).hash;
      expect(parseJourney(hash)).toEqual({ kind: 'ok', journey });
    }
  });

  it('accepts links without v= and the old query-string form', () => {
    expect(parseJourney('?lat=41.0342&lon=28.9844&n=Home')).toEqual({
      kind: 'ok',
      journey: { stops: [home], label: 'Home' },
    });
  });

  it('keeps reading future versions', () => {
    expect(parseJourney('#v=7&lat=1&lon=2&extra=x').kind).toBe('ok');
  });

  it('reports no journey when there are no coordinates', () => {
    expect(parseJourney('')).toEqual({ kind: 'none' });
    expect(parseJourney('#about')).toEqual({ kind: 'none' });
  });

  it('flags broken coordinates and stops', () => {
    expect(parseJourney('#lat=91&lon=0')).toEqual({ kind: 'invalid' });
    expect(parseJourney('#lat=abc&lon=1')).toEqual({ kind: 'invalid' });
    expect(parseJourney('#lat=41')).toEqual({ kind: 'invalid' });
    expect(parseJourney('#lat=1&lon=2&via=1,2~oops')).toEqual({ kind: 'invalid' });
    expect(parseJourney('#lat=1&lon=2&via=1,2,3')).toEqual({ kind: 'invalid' });
  });

  it('refuses more stops than navigation apps accept', () => {
    expect(parseJourney('#lat=1&lon=2&via=1,1~2,2~3,3').kind).toBe('ok');
    expect(parseJourney('#lat=1&lon=2&via=1,1~2,2~3,3~4,4')).toEqual({ kind: 'invalid' });
  });

  it('caps long addresses', () => {
    const parsed = parseJourney(`#lat=1&lon=2&a=${'a'.repeat(300)}`);
    expect(parsed.kind === 'ok' && parsed.journey.address?.length).toBe(100);
  });

  it('caps long labels', () => {
    const parsed = parseJourney(`#lat=1&lon=2&n=${'a'.repeat(200)}`);
    expect(parsed.kind === 'ok' && parsed.journey.label?.length).toBe(60);
  });
});

describe('cleanLabel', () => {
  it('collapses whitespace and drops empty labels', () => {
    expect(cleanLabel('  Home \n  sweet  ')).toBe('Home sweet');
    expect(cleanLabel('   ')).toBeUndefined();
  });
});

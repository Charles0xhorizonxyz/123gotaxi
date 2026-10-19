import { describe, expect, it } from 'vitest';
import {
  buildDestinationUrl,
  cleanLabel,
  formatCoord,
  parseDestination,
} from '../../src/destination-url';

describe('formatCoord', () => {
  it('rounds to 5 decimals and drops trailing zeros', () => {
    expect(formatCoord(41.034212345)).toBe('41.03421');
    expect(formatCoord(28.98)).toBe('28.98');
    expect(formatCoord(-0.000001)).toBe('0');
  });
});

describe('buildDestinationUrl', () => {
  it('puts everything after # so servers never see it', () => {
    expect(buildDestinationUrl('https://gogogo.rodeo', { lat: 41.0342, lon: 28.9844 })).toBe(
      'https://gogogo.rodeo/#v=1&lat=41.0342&lon=28.9844',
    );
  });

  it('encodes Turkish labels and spaces', () => {
    const url = buildDestinationUrl('https://gogogo.rodeo', {
      lat: 41.0342,
      lon: 28.9844,
      label: 'Kadıköy İskele',
    });
    expect(url).toBe(
      'https://gogogo.rodeo/#v=1&lat=41.0342&lon=28.9844&n=Kad%C4%B1k%C3%B6y%20%C4%B0skele',
    );
  });

  it('works under a sub-path', () => {
    expect(buildDestinationUrl('https://x.github.io/gogogo-rodeo', { lat: 1, lon: 2 })).toBe(
      'https://x.github.io/gogogo-rodeo/#v=1&lat=1&lon=2',
    );
  });
});

describe('parseDestination', () => {
  it('round-trips a built URL', () => {
    const destination = { lat: 41.0342, lon: 28.9844, label: 'Ev & bahçe #2' };
    const hash = new URL(buildDestinationUrl('https://gogogo.rodeo', destination)).hash;
    expect(parseDestination(hash)).toEqual({ kind: 'ok', destination });
  });

  it('accepts links without v= and the old query-string form', () => {
    expect(parseDestination('?lat=41.0342&lon=28.9844&n=Home')).toEqual({
      kind: 'ok',
      destination: { lat: 41.0342, lon: 28.9844, label: 'Home' },
    });
  });

  it('keeps reading future versions', () => {
    expect(parseDestination('#v=7&lat=1&lon=2&extra=x').kind).toBe('ok');
  });

  it('reports no destination when there are no coordinates', () => {
    expect(parseDestination('')).toEqual({ kind: 'none' });
    expect(parseDestination('#about')).toEqual({ kind: 'none' });
  });

  it('flags broken coordinates', () => {
    expect(parseDestination('#lat=91&lon=0')).toEqual({ kind: 'invalid' });
    expect(parseDestination('#lat=abc&lon=1')).toEqual({ kind: 'invalid' });
    expect(parseDestination('#lat=41')).toEqual({ kind: 'invalid' });
  });

  it('caps long labels', () => {
    const parsed = parseDestination(`#lat=1&lon=2&n=${'a'.repeat(200)}`);
    expect(parsed.kind === 'ok' && parsed.destination.label?.length).toBe(60);
  });
});

describe('cleanLabel', () => {
  it('collapses whitespace and drops empty labels', () => {
    expect(cleanLabel('  Home \n  sweet  ')).toBe('Home sweet');
    expect(cleanLabel('   ')).toBeUndefined();
  });
});

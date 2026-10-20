import { describe, expect, it, vi } from 'vitest';
import worker, { addressWithoutCoordinates, expand, locate, unwrapConsent } from '../../worker/src/index';

const SHORT = 'https://maps.app.goo.gl/42vbXakpmaLpAsuD9?g_st=ac';
const LONG =
  'https://www.google.com/maps/place/B%C3%A2ton+Rouge+Grillhouse+%26+Bar/data=!4m6!3m5!1s0x0:0x0!8m2!3d45.397037999999995!4d-71.94208499999999';

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

function call(url: string, origin = 'https://123go.taxi', method = 'GET'): Promise<Response> {
  return worker.fetch(new Request(`https://123go-expand.example.workers.dev${url}`, { method, headers: { origin } }));
}

describe('expand', () => {
  it('follows a Google short link to the long map link', async () => {
    const fetcher = vi.fn(async () => redirect(LONG));
    expect(await expand(new URL(SHORT), fetcher as unknown as typeof fetch)).toBe(LONG);
    // "?g_st=ac" is dropped before asking Google.
    expect(fetcher).toHaveBeenCalledWith(SHORT.split('?')[0], expect.objectContaining({ redirect: 'manual' }));
  });

  it('follows a chain of short links', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(redirect('https://goo.gl/maps/abc'))
      .mockResolvedValueOnce(redirect(LONG, 301));
    expect(await expand(new URL(SHORT), fetcher as unknown as typeof fetch)).toBe(LONG);
  });

  it('gives up when there is no redirect, or it never ends', async () => {
    expect(await expand(new URL(SHORT), (async () => new Response('page')) as typeof fetch)).toBeNull();
    expect(await expand(new URL(SHORT), (async () => redirect(SHORT)) as typeof fetch)).toBeNull();
  });
});

describe('links without coordinates', () => {
  const NO_COORDS =
    'https://www.google.com/maps/place/B%C3%A2ton+Rouge+Grillhouse+%26+Bar,+2844+Rue+King+Ouest,+Sherbrooke,+Quebec+J1L+1C5,+Canada/data=!4m2!3m1!1s0x4cb7b4a269933f83:0x67934ab493ca3a9!18m1!1e1?entry=gps';

  function photon(type: string, lon = -71.9420658, lat = 45.3970493): Response {
    return Response.json({ features: [{ geometry: { coordinates: [lon, lat] }, properties: { type } }] });
  }

  it('finds the address in a Google place link that has no coordinates', () => {
    expect(addressWithoutCoordinates(NO_COORDS)).toBe(
      'Bâton Rouge Grillhouse & Bar, 2844 Rue King Ouest, Sherbrooke, Quebec J1L 1C5, Canada',
    );
    expect(addressWithoutCoordinates(LONG)).toBeNull();
    expect(addressWithoutCoordinates('https://www.google.com/maps/place/X/@45.39,-71.94,17z')).toBeNull();
    expect(addressWithoutCoordinates('https://yandex.com.tr/maps/?text=x')).toBeNull();
  });

  it('also finds it in the "?q=" and "/search/" forms', () => {
    const address = 'ÖzdilekPark İstanbul AVM, Büyükdere Cd. No:181, 34394 Şişli/İstanbul';
    expect(addressWithoutCoordinates(`https://maps.google.com/?q=${encodeURIComponent(address)}&ftid=0x14cab7:0x1&entry=gps`)).toBe(address);
    expect(addressWithoutCoordinates(`https://www.google.com/maps?q=${encodeURIComponent(address)}`)).toBe(address);
    expect(addressWithoutCoordinates(`https://www.google.com/maps/search/${encodeURIComponent(address)}`)).toBe(address);
    expect(addressWithoutCoordinates('https://www.google.com/maps?q=41.0773,29.0116')).toBeNull();
  });

  it("takes the real link out of Google's cookie page", () => {
    const consent = new URL(`https://consent.google.com/m?continue=${encodeURIComponent(LONG)}&gl=DE`);
    expect(unwrapConsent(consent).toString()).toBe(new URL(LONG).toString());
    expect(unwrapConsent(new URL(LONG)).toString()).toBe(new URL(LONG).toString());
  });

  it('retries without the place name, and keeps a house-level answer', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ features: [] }))
      .mockResolvedValueOnce(photon('house'));
    expect(await locate('Bâton Rouge, 2844 Rue King Ouest, Sherbrooke', fetcher as unknown as typeof fetch)).toEqual({
      lat: 45.3970493,
      lon: -71.9420658,
    });
    expect(fetcher.mock.calls[1]![0]).toContain(encodeURIComponent('2844 Rue King Ouest, Sherbrooke'));
  });

  it('refuses answers as vague as a street or a town', async () => {
    const fetcher = vi.fn(async () => photon('street'));
    expect(await locate('Somewhere, Rue King Ouest, Sherbrooke', fetcher as unknown as typeof fetch)).toBeNull();
  });
});

describe('worker', () => {
  it('refuses anything that is not a map short link', async () => {
    expect((await call(`/expand?url=${encodeURIComponent('https://example.com/x')}`)).status).toBe(422);
    expect((await call(`/expand?url=${encodeURIComponent('http://maps.app.goo.gl/x')}`)).status).toBe(422);
    expect((await call(`/expand?url=${encodeURIComponent('https://goo.gl/notmaps')}`)).status).toBe(422);
    expect((await call('/expand?url=not-a-url')).status).toBe(400);
    expect((await call('/other')).status).toBe(404);
  });

  it('only lets 123go.taxi and local development read the answer', async () => {
    const ours = await call('/expand?url=bad');
    expect(ours.headers.get('access-control-allow-origin')).toBe('https://123go.taxi');
    const dev = await call('/expand?url=bad', 'http://192.168.1.16:5173');
    expect(dev.headers.get('access-control-allow-origin')).toBe('http://192.168.1.16:5173');
    const stranger = await call('/expand?url=bad', 'https://evil.example');
    expect(stranger.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('never lets answers be cached', async () => {
    expect((await call('/expand?url=bad')).headers.get('cache-control')).toBe('no-store');
  });
});

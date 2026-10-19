import { describe, expect, it, vi } from 'vitest';
import worker, { expand } from '../../worker/src/index';

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
    expect(fetcher).toHaveBeenCalledWith(SHORT, expect.objectContaining({ redirect: 'manual' }));
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

// 123go.taxi link expander, a Cloudflare Worker.
//
// Browsers may not read where another site redirects, so a static page cannot
// turn "https://maps.app.goo.gl/…" into the long link that holds the
// coordinates. This worker does exactly that and nothing more:
//
//   GET /expand?url=<short map link>  →  { "url": "<long link>" }
//
// - Only map short links are accepted (see SHORT_HOSTS); anything else is refused.
// - It follows the redirects by reading their Location headers; it never
//   downloads the destination page.
// - Some Google links lead to a place page with an address but no coordinates.
//   Then the address written in that link (never anything from the person) is
//   looked up in Photon, the open address service the site already uses.
// - It stores nothing and logs nothing (observability is off in wrangler.toml).
// - Only 123go.taxi (and a developer's own machine) may call it from a browser.

const ALLOWED_ORIGINS = [/^https:\/\/123go\.taxi$/, /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/];

/** Hosts whose links are short redirects to a full map link. */
const SHORT_HOSTS: Record<string, (path: string) => boolean> = {
  'maps.app.goo.gl': () => true,
  'goo.gl': (path) => path.startsWith('/maps'),
  'maps.apple': () => true,
};

const MAX_HOPS = 5;
const PHOTON_URL = 'https://photon.komoot.io/api/';
/** Photon results this vague could be a whole street or town away: better no answer. */
const VAGUE_TYPES = new Set(['street', 'locality', 'district', 'city', 'county', 'state', 'country', 'other']);
const MAX_INPUT_LENGTH = 500;

function isShortLink(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.replace(/^www\./, '');
  if (host in SHORT_HOSTS) return SHORT_HOSTS[host]!(url.pathname);
  // Yandex short links: yandex.<tld>/maps/-/<code>
  return /^yandex\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps/-/');
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
  if (origin && ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** Follow redirects until the link is no longer a short link. Returns null if it never resolves. */
export async function expand(short: URL, fetcher: typeof fetch = fetch): Promise<string | null> {
  let current = short;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const response = await fetcher(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      // A plain browser-like request: no cookies, nothing about the person asking.
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; 123go.taxi link expander)' },
    });
    const location = response.headers.get('location');
    // Drop the body unread: we only want the redirect target.
    await response.body?.cancel();
    if (response.status < 300 || response.status >= 400 || !location) return null;
    const next = new URL(location, current);
    if (!isShortLink(next)) return next.toString();
    current = next;
  }
  return null;
}

/** A Google place link with an address but no coordinates → that address; otherwise null. */
export function addressWithoutCoordinates(link: string): string | null {
  const url = new URL(link);
  if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname)) return null;
  if (/@-?\d|!3d-?\d/.test(url.pathname) || /[?&](q|query|ll|center)=-?\d/.test(url.search)) return null;
  const place = /\/maps\/place\/([^/]+)/.exec(url.pathname)?.[1];
  if (!place) return null;
  try {
    return decodeURIComponent(place.replace(/\+/g, ' ')).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Look the address up in Photon. Google writes "Name, street, city, …": Photon
 * often misses with the name in front, so the second try leaves it out.
 */
export async function locate(address: string, fetcher: typeof fetch = fetch): Promise<{ lat: number; lon: number } | null> {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const queries = parts.length > 2 ? [parts.join(', '), parts.slice(1).join(', ')] : [parts.join(', ')];
  for (const query of queries) {
    const response = await fetcher(`${PHOTON_URL}?limit=1&q=${encodeURIComponent(query)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; 123go.taxi link expander)' },
    });
    if (!response.ok) continue;
    const data = (await response.json()) as {
      features?: { geometry?: { coordinates?: [number, number] }; properties?: { type?: string } }[];
    };
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (coordinates && !VAGUE_TYPES.has(feature.properties?.type ?? 'other')) {
      return { lat: coordinates[1], lon: coordinates[0] };
    }
  }
  return null;
}

/** The long link, with coordinates added from the address when Google left them out. */
async function withCoordinates(long: string): Promise<string> {
  const address = addressWithoutCoordinates(long);
  if (!address) return long;
  const found = await locate(address).catch(() => null);
  if (!found) return long;
  return `https://www.google.com/maps/place/${encodeURIComponent(address)}/data=!3d${found.lat}!4d${found.lon}`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return json(null, 204, origin);
    if (request.method !== 'GET' || url.pathname !== '/expand') return json({ error: 'not-found' }, 404, origin);

    const raw = url.searchParams.get('url') ?? '';
    let short: URL;
    try {
      if (raw.length > MAX_INPUT_LENGTH) throw new Error('too long');
      short = new URL(raw);
    } catch {
      return json({ error: 'bad-url' }, 400, origin);
    }
    if (!isShortLink(short)) return json({ error: 'not-a-short-link' }, 422, origin);

    try {
      const expanded = await expand(short);
      const long = expanded && (await withCoordinates(expanded));
      return long ? json({ url: long }, 200, origin) : json({ error: 'did-not-resolve' }, 502, origin);
    } catch {
      return json({ error: 'upstream-failed' }, 502, origin);
    }
  },
};

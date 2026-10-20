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
//   looked up in OpenStreetMap's address services, Photon and Nominatim.
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

/**
 * "maps.app.goo.gl/<code>?g_st=ac": the code is the place; "?g_st=…" only says
 * where it was shared from, and with it Google sometimes answers with a link
 * that has no place in it at all. So it's dropped.
 */
export function withoutShareTags(url: URL): URL {
  if (url.hostname !== 'maps.app.goo.gl' || !url.search) return url;
  const clean = new URL(url);
  clean.search = '';
  return clean;
}

/** Follow redirects until the link is no longer a short link. Returns null if it never resolves. */
export async function expand(short: URL, fetcher: typeof fetch = fetch): Promise<string | null> {
  let current = withoutShareTags(short);
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
    const next = unwrapConsent(new URL(location, current));
    if (!isShortLink(next)) return next.toString();
    current = next;
  }
  return null;
}

/**
 * Some regions get Google's cookie page first ("consent.google.com/…?continue=<link>").
 * The link we want is inside it; the page itself is never opened.
 */
export function unwrapConsent(url: URL): URL {
  if (!/^consent\.google\.[a-z.]+$/.test(url.hostname)) return url;
  const target = url.searchParams.get('continue');
  try {
    return target ? new URL(target) : url;
  } catch {
    return url;
  }
}

/**
 * A Google Maps link with a place's address but no coordinates → that address;
 * otherwise null. Google uses several forms, and not always the same one:
 * "/maps/place/<address>/…", "/maps/search/<address>" and "/maps?q=<address>".
 */
export function addressWithoutCoordinates(link: string): string | null {
  const url = new URL(link);
  if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.hostname !== 'maps.google.com') return null;
  if (/@-?\d|!3d-?\d/.test(url.pathname) || /[?&](ll|center)=-?\d/.test(url.search)) return null;
  const query = url.searchParams.get('q') ?? url.searchParams.get('query');
  if (query && /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(query)) return null;
  const inPath = /\/maps\/(?:place|search)\/([^/]+)/.exec(url.pathname)?.[1];
  let text = query;
  if (!text && inPath) {
    try {
      text = decodeURIComponent(inPath.replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  return text?.trim() || null;
}

type Point = { lat: number; lon: number };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/** One slow address service must not hold the answer up for long. */
const LOOKUP_TIMEOUT_MS = 9000;
/** Nominatim's place_rank: 26-27 is a street, 28+ a building, house or venue. */
const MIN_NOMINATIM_RANK = 28;
const LOOKUP_HEADERS = { 'user-agent': '123go.taxi link expander (https://123go.taxi)' };

async function photonLookup(query: string, fetcher: typeof fetch): Promise<Point | null> {
  const response = await fetcher(`${PHOTON_URL}?limit=1&q=${encodeURIComponent(query)}`, {
    headers: LOOKUP_HEADERS,
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    features?: { geometry?: { coordinates?: [number, number] }; properties?: { type?: string } }[];
  };
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates || VAGUE_TYPES.has(feature.properties?.type ?? 'other')) return null;
  return { lat: coordinates[1], lon: coordinates[0] };
}

async function nominatimLookup(query: string, fetcher: typeof fetch): Promise<Point | null> {
  const response = await fetcher(`${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
    headers: LOOKUP_HEADERS,
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as unknown;
  const first = Array.isArray(data) ? (data[0] as { lat?: string; lon?: string; place_rank?: number }) : undefined;
  if (!first?.lat || !first.lon || (first.place_rank ?? 0) < MIN_NOMINATIM_RANK) return null;
  return { lat: Number(first.lat), lon: Number(first.lon) };
}

/** The first lookup to find a precise place; null when none does. */
function firstFound(lookups: Promise<Point | null>[]): Promise<Point | null> {
  return new Promise((resolve) => {
    let pending = lookups.length;
    for (const lookup of lookups) {
      lookup
        .catch(() => null)
        .then((found) => {
          if (found) resolve(found);
          else if (--pending === 0) resolve(null);
        });
    }
  });
}

/**
 * Look the address up, asking Photon and Nominatim (both OpenStreetMap) at the
 * same time and taking the first precise answer: Photon copes with loose
 * spelling but can be slow, Nominatim is quick but strict. Google writes
 * "Name, street, city, ...", which Photon often misses with the name in front,
 * so it is also asked without it.
 */
export function locate(address: string, fetcher: typeof fetch = fetch): Promise<Point | null> {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const full = parts.join(', ');
  const withoutName = parts.length > 2 ? parts.slice(1).join(', ') : null;
  return firstFound([
    photonLookup(full, fetcher),
    ...(withoutName ? [photonLookup(withoutName, fetcher)] : []),
    nominatimLookup(withoutName ?? full, fetcher),
  ]);
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

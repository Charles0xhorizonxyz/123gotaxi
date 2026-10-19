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
      const long = await expand(short);
      return long ? json({ url: long }, 200, origin) : json({ error: 'did-not-resolve' }, 502, origin);
    } catch {
      return json({ error: 'upstream-failed' }, 502, origin);
    }
  },
};

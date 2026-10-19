// Short map links (maps.app.goo.gl/…) hide the coordinates behind a redirect
// that browsers may not read. Our small link expander (worker/) reads it and
// sends back the long link. It only ever receives the short link itself.

const TIMEOUT_MS = 8000;

export async function expandShortLink(shortLink: string, expanderUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${expanderUrl}/expand?url=${encodeURIComponent(shortLink)}`, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { url?: unknown };
    return typeof data.url === 'string' ? data.url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Turning coordinates into a readable address ("reverse geocoding"), and
// typed words into places ("search").
//
// Reverse: it sends the coordinates of the final stop, nothing else (no name,
// no note), and only from the phone making the QR: the address then travels
// inside the QR link, so the driver's phone never looks anything up.
// Search: it sends what was typed in "Where to?", only when that isn't a link
// or coordinates.
//
// The provider sits behind a small interface so it can be swapped (another
// Photon server, Pelias, a commercial service) by changing config.ts.

import { formatCoord, formatPoint, type Point } from '../destination-url';

/** One search result: where it is, what it's called, and its readable address. */
export interface Suggestion extends Point {
  name: string;
  address: string;
}

export interface ReverseGeocoder {
  /** A short readable address, or null when the provider knows nothing useful there. */
  reverse(point: Point, signal?: AbortSignal): Promise<string | null>;
  /** Places matching typed words, best first. */
  search(query: string, signal?: AbortSignal): Promise<Suggestion[]>;
  /** Credit line the provider's data licence asks us to show. */
  attribution: string;
}

/** The fields we use from a Photon (OpenStreetMap) result. */
export interface PhotonProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  state?: string;
}

/**
 * "Sıraselviler Caddesi 20, Katip Mustafa Çelebi, Beyoğlu": place name if any,
 * street and number, neighbourhood, town. Skips parts that repeat an earlier one
 * (e.g. district "Bereketzade" after street "Bereketzade Mahallesi").
 */
export function formatPhotonAddress(p: PhotonProperties): string | null {
  const parts: string[] = [];
  const add = (value: string | undefined) => {
    const text = value?.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const lower = text.toLocaleLowerCase('tr');
    if (parts.some((part) => part.toLocaleLowerCase('tr').includes(lower))) return;
    parts.push(text);
  };
  add(p.name);
  if (p.street) add([p.street, p.housenumber].filter(Boolean).join(' '));
  add(p.district ?? p.locality);
  add(p.city ?? p.state);
  return parts.length > 0 ? parts.join(', ') : null;
}

const TIMEOUT_MS = 6000;
const SUGGESTIONS = 5;

/** fetch() with our timeout, following an outside abort too. */
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    return response.ok ? ((await response.json()) as T) : null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

interface PhotonReply {
  features?: { geometry?: { coordinates?: [number, number] }; properties?: PhotonProperties }[];
}

/** Photon results → suggestions, dropping duplicates and anything without a place. */
export function toSuggestions(reply: PhotonReply | null): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const feature of reply?.features ?? []) {
    const [lon, lat] = feature.geometry?.coordinates ?? [];
    const address = feature.properties ? formatPhotonAddress(feature.properties) : null;
    if (lat === undefined || lon === undefined || !address || seen.has(address)) continue;
    seen.add(address);
    const [name, ...rest] = address.split(', ');
    out.push({ lat, lon, address, name: rest.length ? name! : address });
  }
  return out;
}

export function photonGeocoder(baseUrl: string): ReverseGeocoder {
  // One lookup per spot per visit: retyping or reordering doesn't ask again.
  const cache = new Map<string, string | null>();

  return {
    attribution: 'Address © OpenStreetMap contributors, via Photon',
    async reverse(point, signal) {
      const key = formatPoint(point);
      if (cache.has(key)) return cache.get(key)!;
      const data = await fetchJson<PhotonReply>(
        `${baseUrl}/reverse?lat=${formatCoord(point.lat)}&lon=${formatCoord(point.lon)}&limit=1`,
        signal,
      );
      if (!data) return null;
      const properties = data.features?.[0]?.properties;
      const address = properties ? formatPhotonAddress(properties) : null;
      cache.set(key, address);
      return address;
    },
    async search(query, signal) {
      const data = await fetchJson<PhotonReply>(
        `${baseUrl}/api?q=${encodeURIComponent(query)}&limit=${SUGGESTIONS}`,
        signal,
      );
      const found = toSuggestions(data);
      // Remember each address, so picking one doesn't need a second lookup.
      for (const s of found) cache.set(formatPoint(s), s.address);
      return found;
    },
  };
}

// Turning coordinates into a readable address ("reverse geocoding"), and
// typed words into places ("search"). Geoapify answers first; the free Photon
// server is the backup. Both serve OpenStreetMap data.
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

/** The free public Photon server can take 5–7 seconds on a busy day. */
const TIMEOUT_MS = 12000;
const SUGGESTIONS = 5;

/**
 * fetch() with a timeout, following an outside abort too. Without `strict`, a
 * refused answer resolves null; with it, it throws, so a backup can take over.
 */
async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
  { timeoutMs = TIMEOUT_MS, strict = false } = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.ok) return (await response.json()) as T;
    if (strict) throw new Error(`HTTP ${response.status}`);
    return null;
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

// Geoapify: the same OpenStreetMap data, answering in about a second where
// the free Photon server can take four or five. Its key is public (it sits in
// the page) but only works from 123go.taxi.

/** Give Geoapify this long before Photon takes over. */
const GEOAPIFY_TIMEOUT_MS = 5000;

/** The fields we use from a Geoapify result. */
export interface GeoapifyResult {
  lat?: number;
  lon?: number;
  name?: string;
  housenumber?: string;
  street?: string;
  suburb?: string;
  district?: string;
  city?: string;
  state?: string;
}

/** Geoapify results in Photon's shape, so both read the same way. */
function asPhoton(results: GeoapifyResult[] | undefined): PhotonReply {
  return {
    features: (results ?? []).map((r) => ({
      geometry: r.lat !== undefined && r.lon !== undefined ? { coordinates: [r.lon, r.lat] } : undefined,
      properties: {
        name: r.name,
        housenumber: r.housenumber,
        street: r.street,
        district: r.suburb ?? r.district,
        city: r.city,
        state: r.state,
      },
    })),
  };
}

export function geoapifySuggestions(reply: { results?: GeoapifyResult[] } | null): Suggestion[] {
  return toSuggestions(asPhoton(reply?.results));
}

export function geoapifyGeocoder(baseUrl: string, apiKey: string): ReverseGeocoder {
  const options = { timeoutMs: GEOAPIFY_TIMEOUT_MS, strict: true };
  return {
    attribution: 'Address © OpenStreetMap contributors, via Geoapify',
    async reverse(point, signal) {
      const data = await fetchJson<{ results?: GeoapifyResult[] }>(
        `${baseUrl}/v1/geocode/reverse?lat=${formatCoord(point.lat)}&lon=${formatCoord(point.lon)}&format=json&apiKey=${apiKey}`,
        signal,
        options,
      );
      const properties = asPhoton(data?.results).features?.[0]?.properties;
      return properties ? formatPhotonAddress(properties) : null;
    },
    async search(query, signal) {
      const data = await fetchJson<{ results?: GeoapifyResult[] }>(
        `${baseUrl}/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=${SUGGESTIONS}&format=json&apiKey=${apiKey}`,
        signal,
        options,
      );
      return geoapifySuggestions(data);
    },
  };
}

/**
 * Ask `primary` first; when it fails (slow, down, over its daily limit, or
 * refusing this address, as on a developer's own machine), ask `backup`.
 * Remembers every address it learns, so nothing is looked up twice.
 */
export function withBackup(primary: ReverseGeocoder, backup: ReverseGeocoder): ReverseGeocoder {
  const cache = new Map<string, string | null>();
  const either = async <T>(ask: (g: ReverseGeocoder) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    try {
      return await ask(primary);
    } catch (error) {
      if (signal?.aborted) throw error;
      return ask(backup);
    }
  };
  return {
    attribution: 'Address © OpenStreetMap contributors, via Geoapify and Photon',
    async reverse(point, signal) {
      const key = formatPoint(point);
      if (cache.has(key)) return cache.get(key)!;
      const address = await either((g) => g.reverse(point, signal), signal);
      cache.set(key, address);
      return address;
    },
    async search(query, signal) {
      const found = await either((g) => g.search(query, signal), signal);
      for (const s of found) cache.set(formatPoint(s), s.address);
      return found;
    },
  };
}

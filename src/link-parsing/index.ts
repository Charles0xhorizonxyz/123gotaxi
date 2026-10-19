// Pull coordinates out of whatever the user pastes: raw coordinates, geo: URIs,
// or links from Google Maps, Yandex, Apple Maps, OpenStreetMap and gogogo.rodeo.

import { isValidCoordinate, parseDestination, type Destination } from '../destination-url';

export type ParseResult =
  | { ok: true; destination: Destination }
  | { ok: false; reason: 'empty' | 'short-link' | 'unrecognised' };

const NUM = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
const PAIR = new RegExp(String.raw`^\s*(${NUM})\s*,\s*(${NUM})\s*$`);

const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'maps.apple'];

function point(lat: number, lon: number, label?: string): Destination | null {
  return isValidCoordinate(lat, lon) ? { lat, lon, label } : null;
}

/** "41.03,28.98" → lat/lon. Yandex writes "lon,lat", so callers can swap. */
function pair(value: string | null | undefined, order: 'latlon' | 'lonlat'): Destination | null {
  const match = value ? PAIR.exec(value) : null;
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return order === 'latlon' ? point(a, b) : point(b, a);
}

/** Plain coordinates: "41.0342, 28.9844", "41.0342 28.9844", "41.0342° N, 28.9844° E". */
function parseRawCoordinates(text: string): Destination | null {
  const match = new RegExp(
    String.raw`^\s*(${NUM})\s*°?\s*([NS])?\s*[,;\s]\s*(${NUM})\s*°?\s*([EW])?\s*$`,
    'i',
  ).exec(text);
  if (!match) return null;
  let lat = Number(match[1]);
  let lon = Number(match[3]);
  if (match[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (match[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
  return point(lat, lon);
}

function parseGeoUri(text: string): Destination | null {
  const match = new RegExp(String.raw`^geo:(${NUM}),(${NUM})`, 'i').exec(text.trim());
  if (!match) return null;
  const label = /\(([^)]+)\)\s*$/.exec(text)?.[1];
  return point(Number(match[1]), Number(match[2]), label ? safeDecode(label) : undefined);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function lastMatch(text: string, pattern: RegExp): RegExpExecArray | null {
  let last: RegExpExecArray | null = null;
  for (const match of text.matchAll(pattern)) last = match;
  return last;
}

function parseGoogle(url: URL): Destination | null {
  const text = safeDecode(url.pathname) + url.search;
  const placeName = /\/maps\/place\/([^/@]+)/.exec(url.pathname)?.[1];
  const label = placeName ? safeDecode(placeName) : undefined;

  // "!3d<lat>!4d<lon>" is the exact place; "@lat,lon" is only the map's centre.
  const pin = lastMatch(text, new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`, 'g'));
  if (pin) return point(Number(pin[1]), Number(pin[2]), label);

  for (const key of ['destination', 'daddr', 'q', 'query', 'll', 'center']) {
    const found = pair(url.searchParams.get(key), 'latlon');
    if (found) return { ...found, label };
  }

  const centre = new RegExp(String.raw`@(${NUM}),(${NUM})`).exec(url.pathname);
  if (centre) return point(Number(centre[1]), Number(centre[2]), label);

  // "/maps/search/41.03,28.98" and "/maps/dir//41.03,28.98"
  const inPath = lastMatch(
    safeDecode(url.pathname),
    new RegExp(String.raw`/(${NUM}),\s*(${NUM})(?=/|$)`, 'g'),
  );
  return inPath ? point(Number(inPath[1]), Number(inPath[2]), label) : null;
}

function parseYandex(url: URL): Destination | null {
  // Yandex puts longitude first in pt, ll and whatshere[point].
  const marker =
    pair(url.searchParams.get('pt')?.split('~').pop()?.split(',').slice(0, 2).join(','), 'lonlat') ??
    pair(url.searchParams.get('whatshere[point]'), 'lonlat');
  if (marker) return marker;

  // rtext lists route points as "lat,lon~lat,lon"; the last one is the destination.
  const route = url.searchParams.get('rtext')?.split('~').filter(Boolean).pop();
  const routeEnd = pair(route, 'latlon');
  if (routeEnd) return routeEnd;

  return pair(url.searchParams.get('ll'), 'lonlat');
}

function parseApple(url: URL): Destination | null {
  const label = url.searchParams.get('name') ?? url.searchParams.get('q') ?? undefined;
  for (const key of ['coordinate', 'destination', 'daddr', 'll', 'q', 'sll']) {
    const found = pair(url.searchParams.get(key), 'latlon');
    if (found) return { ...found, label: key === 'q' ? undefined : label };
  }
  return null;
}

function parseOsm(url: URL): Destination | null {
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat && mlon) return point(Number(mlat), Number(mlon));
  const map = new RegExp(String.raw`map=\d+(?:\.\d+)?/(${NUM})/(${NUM})`).exec(url.hash);
  return map ? point(Number(map[1]), Number(map[2])) : null;
}

function toUrl(text: string): URL | null {
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

function isShortLink(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  if (SHORT_LINK_HOSTS.includes(host)) return true;
  return host.startsWith('yandex.') && url.pathname.startsWith('/maps/-/');
}

export function parseLocation(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: 'empty' };

  const direct = parseRawCoordinates(text) ?? parseGeoUri(text);
  if (direct) return { ok: true, destination: direct };

  const url = toUrl(text);
  if (!url) return { ok: false, reason: 'unrecognised' };
  if (isShortLink(url)) return { ok: false, reason: 'short-link' };

  const host = url.hostname.replace(/^www\./, '');
  let found: Destination | null = null;
  if (/(^|\.)google\.[a-z.]+$/.test(host)) found = parseGoogle(url);
  else if (/(^|\.)yandex\.[a-z.]+$/.test(host)) found = parseYandex(url);
  else if (host === 'maps.apple.com') found = parseApple(url);
  else if (host.endsWith('openstreetmap.org')) found = parseOsm(url);
  else {
    const own = parseDestination(url.hash || url.search);
    if (own.kind === 'ok') found = own.destination;
  }

  return found ? { ok: true, destination: found } : { ok: false, reason: 'unrecognised' };
}

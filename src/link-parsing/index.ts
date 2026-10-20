// Pull coordinates out of whatever the user pastes: raw coordinates, geo: URIs,
// or links from Google Maps, Yandex, Waze, Apple Maps, OpenStreetMap and 123go.taxi.

import { finalStop, isValidCoordinate, parseJourney } from '../destination-url';
import { decodeOsmShortCode, decodePlusCode, parseDms, parseMgrs, parseUtm, withoutInvisibles } from './coordinates';

/** One place found in pasted text, with its name when the link carries one. */
export interface Place {
  lat: number;
  lon: number;
  label?: string;
}

export type ParseResult =
  | { ok: true; place: Place }
  | { ok: false; reason: 'empty' | 'unrecognised' }
  /** `link` is the short link alone, without any text shared around it. */
  | { ok: false; reason: 'short-link'; link: string };

const NUM = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
const PAIR = new RegExp(String.raw`^\s*(${NUM})\s*,\s*(${NUM})\s*$`);

const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'maps.apple'];

function point(lat: number, lon: number, label?: string): Place | null {
  return isValidCoordinate(lat, lon) ? { lat, lon, label } : null;
}

/** "41.03,28.98" → lat/lon. Yandex writes "lon,lat", so callers can swap. */
function pair(value: string | null | undefined, order: 'latlon' | 'lonlat'): Place | null {
  const match = value ? PAIR.exec(value) : null;
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return order === 'latlon' ? point(a, b) : point(b, a);
}

/** Plain coordinates: "41.0342, 28.9844", "41.0342 28.9844", "41.0342° N, 28.9844° E". */
function parseRawCoordinates(text: string): Place | null {
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

function parseGeoUri(text: string): Place | null {
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

function parseGoogle(url: URL): Place | null {
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

function parseYandex(url: URL): Place | null {
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

function parseApple(url: URL): Place | null {
  const label = url.searchParams.get('name') ?? url.searchParams.get('q') ?? undefined;
  for (const key of ['coordinate', 'destination', 'daddr', 'll', 'q', 'sll']) {
    const found = pair(url.searchParams.get(key), 'latlon');
    if (found) return { ...found, label: key === 'q' ? undefined : label };
  }
  return null;
}

/** Degrees-minutes-seconds, Plus Codes, UTM and MGRS, as map apps offer to copy them. */
function otherNotations(text: string): Place | null {
  const found = parseDms(text) ?? decodePlusCode(text) ?? parseMgrs(text) ?? parseUtm(text);
  return found ? point(found.lat, found.lon) : null;
}

function parseOsm(url: URL): Place | null {
  // "Share > Short link": osm.org/go/<code>
  const short = /^\/go\/([A-Za-z0-9_~@]+)/.exec(url.pathname)?.[1];
  if (short) {
    const centre = decodeOsmShortCode(short);
    if (centre) return point(centre.lat, centre.lon);
  }
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat && mlon) return point(Number(mlat), Number(mlon));
  const map = new RegExp(String.raw`map=\d+(?:\.\d+)?/(${NUM})/(${NUM})`).exec(url.hash);
  return map ? point(Number(map[1]), Number(map[2])) : null;
}

const GEOHASH = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Geohash ("sxk97kd2j") → the centre of its cell. 9 characters is about 5 m. */
export function decodeGeohash(hash: string): { lat: number; lon: number } | null {
  const lat = [-90, 90];
  const lon = [-180, 180];
  let even = true;
  for (const char of hash.toLowerCase()) {
    const value = GEOHASH.indexOf(char);
    if (value < 0) return null;
    for (const bit of [16, 8, 4, 2, 1]) {
      const range = even ? lon : lat;
      const mid = (range[0]! + range[1]!) / 2;
      if (value & bit) range[0] = mid;
      else range[1] = mid;
      even = !even;
    }
  }
  return { lat: (lat[0]! + lat[1]!) / 2, lon: (lon[0]! + lon[1]!) / 2 };
}

/**
 * Waze: "waze.com/ul/h<geohash>" (what the app shares), "waze.com/ul?ll=lat,lon"
 * and "waze.com/live-map/directions?to=ll.lat,lon".
 */
function parseWaze(url: URL): Place | null {
  const hash = /^\/ul\/h([0-9a-z]{5,12})\/?$/i.exec(url.pathname)?.[1];
  if (hash) {
    const centre = decodeGeohash(hash);
    return centre ? point(centre.lat, centre.lon) : null;
  }
  const to = url.searchParams.get('to')?.replace(/^ll\./, '');
  return pair(url.searchParams.get('ll') ?? url.searchParams.get('latlng') ?? to, 'latlon');
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

/**
 * Map apps often share a place as "Name, address https://maps.app.goo.gl/…".
 * When the whole text isn't readable, try each link found inside it.
 */
export function parseLocation(input: string): ParseResult {
  const text = withoutInvisibles(input).trim();
  if (!text) return { ok: false, reason: 'empty' };
  const whole = parseText(text);
  if (whole.ok || whole.reason === 'short-link') return whole;
  for (const [link] of text.matchAll(/https?:\/\/[^\s<>"]+/gi)) {
    if (link === text) continue;
    const found = parseText(link.replace(/[.,;:!?)\]]+$/, ''));
    if (found.ok || found.reason === 'short-link') return found;
  }
  return whole;
}

function parseText(text: string): ParseResult {

  const direct = parseRawCoordinates(text) ?? parseGeoUri(text) ?? otherNotations(text);
  if (direct) return { ok: true, place: direct };

  const url = toUrl(text);
  if (!url) return { ok: false, reason: 'unrecognised' };
  if (isShortLink(url)) return { ok: false, reason: 'short-link', link: text };

  const host = url.hostname.replace(/^www\./, '');
  let found: Place | null = null;
  if (/(^|\.)google\.[a-z.]+$/.test(host)) found = parseGoogle(url);
  else if (/(^|\.)yandex\.[a-z.]+$/.test(host)) found = parseYandex(url);
  else if (host === 'maps.apple.com') found = parseApple(url);
  else if (host.endsWith('openstreetmap.org') || host === 'osm.org') found = parseOsm(url);
  else if (host === 'waze.com' || host === 'ul.waze.com') found = parseWaze(url);
  else {
    const own = parseJourney(url.hash || url.search);
    if (own.kind === 'ok') found = { ...finalStop(own.journey), label: own.journey.label };
  }

  return found ? { ok: true, place: found } : { ok: false, reason: 'unrecognised' };
}

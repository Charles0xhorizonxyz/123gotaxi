// Our own QR link format:
//   one stop:   https://123go.taxi/#v=1&lat=41.0342&lon=28.9844&n=Label
//   more stops: https://123go.taxi/#v=1&lat=41.0342&lon=28.9844&n=Label&via=41.03,28.98~41.04,28.99
//
// lat/lon is always the final destination and "via" lists the stops before it,
// in order. A reader that ignores "via" still takes the driver to the right end.
// Everything sits after "#", which browsers never send to the server, so the
// hosting provider can't see or log destinations. Old "?lat=" links still work.

export interface Point {
  lat: number;
  lon: number;
}

export interface Journey {
  /** In driving order; the last one is the final destination. */
  stops: Point[];
  label?: string;
}

export const FORMAT_VERSION = 1;
export const MAX_LABEL_LENGTH = 60;
/** Google Maps accepts at most 3 extra stops when opened from a phone browser. */
export const MAX_STOPS = 4;

/** 5 decimals is about 1 metre: precise enough for a door, short enough for a small QR. */
export function formatCoord(value: number): string {
  return String(Math.round(value * 1e5) / 1e5);
}

export function formatPoint(point: Point): string {
  return `${formatCoord(point.lat)},${formatCoord(point.lon)}`;
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

export function cleanLabel(label: string | undefined | null): string | undefined {
  const trimmed = label?.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed || undefined;
}

export function finalStop(journey: Journey): Point {
  const last = journey.stops[journey.stops.length - 1];
  if (!last) throw new Error('A journey needs at least one stop.');
  return last;
}

export function buildJourneyHash(journey: Journey): string {
  const end = finalStop(journey);
  const params = new URLSearchParams({
    v: String(FORMAT_VERSION),
    lat: formatCoord(end.lat),
    lon: formatCoord(end.lon),
  });
  const label = cleanLabel(journey.label);
  if (label) params.set('n', label);
  const via = journey.stops.slice(0, -1).map(formatPoint).join('~');
  if (via) params.set('via', via);
  // Keep "," and "~" readable: they are safe in a URL fragment and keep the QR small.
  return `#${params.toString().replace(/\+/g, '%20').replace(/%2C/g, ',').replace(/%7E/g, '~')}`;
}

export function buildJourneyUrl(baseUrl: string, journey: Journey): string {
  return `${baseUrl}/${buildJourneyHash(journey)}`;
}

export type JourneyParse = { kind: 'none' } | { kind: 'invalid' } | { kind: 'ok'; journey: Journey };

function parsePoint(text: string): Point | null {
  const [lat, lon, extra] = text.split(',').map((part) => (part.trim() === '' ? NaN : Number(part)));
  if (extra !== undefined || lat === undefined || lon === undefined) return null;
  return isValidCoordinate(lat, lon) ? { lat, lon } : null;
}

/** Read a journey from a URL hash ("#v=1&lat=…") or query string ("?lat=…"). */
export function parseJourney(fragment: string): JourneyParse {
  const params = new URLSearchParams(fragment.replace(/^[#?]/, ''));
  const rawLat = params.get('lat');
  const rawLon = params.get('lon');
  if (rawLat === null && rawLon === null) return { kind: 'none' };

  // Versions newer than we know are read the same way: lat/lon/n/via are frozen in v1.
  const end = rawLat && rawLon ? parsePoint(`${rawLat},${rawLon}`) : null;
  if (!end) return { kind: 'invalid' };

  const viaText = params.get('via');
  const via = viaText ? viaText.split('~').map(parsePoint) : [];
  if (via.some((p) => p === null) || via.length >= MAX_STOPS) return { kind: 'invalid' };

  return {
    kind: 'ok',
    journey: { stops: [...(via as Point[]), end], label: cleanLabel(params.get('n')) },
  };
}

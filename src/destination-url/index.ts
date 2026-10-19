// Our own QR link format: https://gogogo.rodeo/#v=1&lat=41.0342&lon=28.9844&n=Label
//
// Everything sits after "#", which browsers never send to the server, so the
// hosting provider can't see or log destinations. Old "?lat=" links are still
// read, in case one gets typed or shared that way.

export interface Destination {
  lat: number;
  lon: number;
  label?: string;
}

export const FORMAT_VERSION = 1;
export const MAX_LABEL_LENGTH = 60;

/** 5 decimals is about 1 metre: precise enough for a door, short enough for a small QR. */
export function formatCoord(value: number): string {
  return String(Math.round(value * 1e5) / 1e5);
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

export function cleanLabel(label: string | undefined): string | undefined {
  const trimmed = label?.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed || undefined;
}

export function buildDestinationHash(destination: Destination): string {
  const params = new URLSearchParams({
    v: String(FORMAT_VERSION),
    lat: formatCoord(destination.lat),
    lon: formatCoord(destination.lon),
  });
  const label = cleanLabel(destination.label);
  if (label) params.set('n', label);
  return `#${params.toString().replace(/\+/g, '%20')}`;
}

export function buildDestinationUrl(baseUrl: string, destination: Destination): string {
  return `${baseUrl}/${buildDestinationHash(destination)}`;
}

export type DestinationParse =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'ok'; destination: Destination };

/** Read a destination from a URL hash ("#v=1&lat=…") or query string ("?lat=…"). */
export function parseDestination(fragment: string): DestinationParse {
  const params = new URLSearchParams(fragment.replace(/^[#?]/, ''));
  const rawLat = params.get('lat');
  const rawLon = params.get('lon');
  if (rawLat === null && rawLon === null) return { kind: 'none' };

  // Versions newer than we know are read the same way: lat/lon/n are frozen in v1.
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!rawLat || !rawLon || !isValidCoordinate(lat, lon)) return { kind: 'invalid' };

  return { kind: 'ok', destination: { lat, lon, label: cleanLabel(params.get('n') ?? undefined) } };
}

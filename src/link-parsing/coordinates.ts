// Ways of writing a spot besides "lat, lon", as map apps offer to copy them
// (Organic Maps, OsmAnd, Google Maps...). All are decoded here, on the phone:
// nothing is looked up. Each returns the centre of what the text describes,
// or null when it isn't that format.

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Copied text often carries invisible characters: direction marks around
 * numbers, zero-width spaces, no-break spaces. They break matching, so they go.
 */
export function withoutInvisibles(text: string): string {
  return text
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ');
}

// ---------- 40°59'01.8"N 29°02'19.9"E ----------

const DMS_PART = String.raw`([NSEW])?\s*(\d{1,3}(?:[.,]\d+)?)\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['′’]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|''|′′)\s*)?([NSEW])?`;
const DMS = new RegExp(String.raw`^\s*${DMS_PART}\s*[,;\s]\s*${DMS_PART}\s*$`, 'i');

function dmsValue(deg: string, min?: string, sec?: string): number {
  const n = (s?: string) => (s ? Number(s.replace(',', '.')) : 0);
  return n(deg) + n(min) / 60 + n(sec) / 3600;
}

/** Degrees, minutes, seconds with N/S/E/W before or after: "40°59'01.8"N 29°02'19.9"E". */
export function parseDms(text: string): LatLon | null {
  const m = DMS.exec(text);
  if (!m) return null;
  const parts = [
    { hemi: (m[1] ?? m[5])?.toUpperCase(), value: dmsValue(m[2]!, m[3], m[4]) },
    { hemi: (m[6] ?? m[10])?.toUpperCase(), value: dmsValue(m[7]!, m[8], m[9]) },
  ];
  if (parts.some((p) => !p.hemi)) return null;
  const latPart = parts.find((p) => p.hemi === 'N' || p.hemi === 'S');
  const lonPart = parts.find((p) => p.hemi === 'E' || p.hemi === 'W');
  if (!latPart || !lonPart) return null;
  const lat = latPart.hemi === 'S' ? -latPart.value : latPart.value;
  const lon = lonPart.hemi === 'W' ? -lonPart.value : lonPart.value;
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

// ---------- Plus Codes: 8GGFX2MQ+GG ----------
// Open Location Code, https://github.com/google/open-location-code

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';

/** A full Plus Code (8 characters, "+", then 2 or more). Short codes need a town, so they're not handled here. */
export function decodePlusCode(text: string): LatLon | null {
  const code = text.trim().toUpperCase();
  if (!/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,7}$/.test(code)) return null;
  const digits = code.replace('+', '');
  let lat = -90;
  let lon = -180;
  let latSize = 400;
  let lonSize = 400;
  // The first ten digits come in pairs: latitude, then longitude, each 20 times finer.
  for (let i = 0; i < Math.min(digits.length, 10); i += 2) {
    latSize /= 20;
    lonSize /= 20;
    lat += OLC_ALPHABET.indexOf(digits[i]!) * latSize;
    lon += OLC_ALPHABET.indexOf(digits[i + 1]!) * lonSize;
  }
  // Beyond ten, each digit picks a cell in a 5 x 4 grid.
  for (let i = 10; i < digits.length; i++) {
    latSize /= 5;
    lonSize /= 4;
    const value = OLC_ALPHABET.indexOf(digits[i]!);
    lat += Math.floor(value / 4) * latSize;
    lon += (value % 4) * lonSize;
  }
  return { lat: lat + latSize / 2, lon: lon + lonSize / 2 };
}

// ---------- OpenStreetMap short links: https://osm.org/go/x2SYaXKm-?m= ----------
// The format of openstreetmap.org's "Share > Short link".

const OSM_SHORT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_~';

export function decodeOsmShortCode(code: string): LatLon | null {
  let x = 0;
  let y = 0;
  let used = 0;
  for (const char of code.replace(/@/g, '~')) {
    const digit = OSM_SHORT_ALPHABET.indexOf(char);
    if (digit < 0) break;
    x *= 8;
    y *= 8;
    for (let bit = 2; bit >= 0; bit--) {
      if (digit & (1 << (2 * bit + 1))) x += 1 << bit;
      if (digit & (1 << (2 * bit))) y += 1 << bit;
    }
    used++;
  }
  if (used < 2) return null;
  const scale = Math.pow(2, 2 - 3 * used);
  // The code names a square; its centre is half a square up and right.
  const half = Math.pow(2, -3 * used - 1);
  const lon = (x * scale + half * 4) * 90 - 180;
  const lat = (y * scale + half * 4) * 45 - 90;
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

// ---------- UTM: 35T 671518 4538964, and MGRS: 35T PF 71518 38964 ----------
// WGS84, the formulas of the US Army's TM 8358.2 (the usual Krüger series).

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const BANDS = 'CDEFGHJKLMNPQRSTUVWX';

function utmToLatLon(zone: number, north: boolean, easting: number, northing: number): LatLon | null {
  if (zone < 1 || zone > 60) return null;
  const x = easting - 500000;
  const y = north ? northing : northing - 10000000;
  const m = y / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin = Math.sin(phi1);
  const cos = Math.cos(phi1);
  const tan = Math.tan(phi1);
  const n1 = A / Math.sqrt(1 - E2 * sin * sin);
  const t1 = tan * tan;
  const c1 = EP2 * cos * cos;
  const r1 = (A * (1 - E2)) / Math.pow(1 - E2 * sin * sin, 1.5);
  const d = x / (n1 * K0);
  const lat =
    phi1 -
    ((n1 * tan) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) /
    cos;
  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  return { lat: (lat * 180) / Math.PI, lon: centralMeridian + (lon * 180) / Math.PI };
}

/** Northing of a latitude on a zone's central meridian: where a latitude band starts. */
function northingAt(latDeg: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 * E2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  return K0 * m;
}

/** "35T 671518 4538964" (zone, latitude band or N/S, easting, northing in metres). */
export function parseUtm(text: string): LatLon | null {
  const m = /^\s*(\d{1,2})\s*([C-HJ-NP-X])\s+(\d{5,7}(?:\.\d+)?)\s*(?:m?E)?\s*,?\s+(\d{6,8}(?:\.\d+)?)\s*(?:m?N)?\s*$/i.exec(text);
  if (!m) return null;
  const band = m[2]!.toUpperCase();
  return utmToLatLon(Number(m[1]), band >= 'N', Number(m[3]), Number(m[4]));
}

/** "35T PF 71518 38964" (zone, band, 100 km square, easting and northing digits). */
export function parseMgrs(text: string): LatLon | null {
  const m = /^\s*(\d{1,2})\s*([C-HJ-NP-X])\s*([A-HJ-NP-Z])([A-HJ-NP-V])\s*(\d{1,5})\s*(\d{1,5})\s*$/i.exec(text);
  if (!m) return null;
  const [eDigits, nDigits] = [m[5]!, m[6]!];
  if (eDigits.length !== nDigits.length) return null;
  const zone = Number(m[1]);
  const band = m[2]!.toUpperCase();
  const column = m[3]!.toUpperCase();
  const row = m[4]!.toUpperCase();
  const columnSets = ['STUVWXYZ', 'ABCDEFGH', 'JKLMNPQR'];
  const columnIndex = columnSets[zone % 3]!.indexOf(column);
  if (columnIndex < 0) return null;
  const rows = 'ABCDEFGHJKLMNPQRSTUV';
  // Even zones start their row letters five places later.
  const rowIndex = (rows.indexOf(row) - (zone % 2 === 0 ? 5 : 0) + 20) % 20;
  const scale = Math.pow(10, 5 - eDigits.length);
  const easting = (columnIndex + 1) * 100000 + Number(eDigits) * scale;
  let northing = rowIndex * 100000 + Number(nDigits) * scale;
  // Rows repeat every 2,000 km: climb to the band the letter names.
  const bandStart = BANDS.indexOf(band) * 8 - 80;
  const north = band >= 'N';
  const minimum = north ? northingAt(bandStart) : 10000000 - northingAt(-bandStart - 8);
  while (northing < minimum - 100000) northing += 2000000;
  return utmToLatLon(zone, north, easting, northing);
}

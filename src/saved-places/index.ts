// Journeys saved for later. They live only in this browser's localStorage:
// nothing is sent anywhere, so nobody else (including us) can read them.
// Export/import moves the list between devices as a file the user controls.

import {
  cleanAddress,
  cleanLabel,
  isValidCoordinate,
  MAX_STOPS,
  type Journey,
  type Point,
} from '../destination-url';

export interface SavedPlace {
  id: string;
  name?: string;
  note?: string;
  /** Readable address of the final stop, so reopening doesn't look it up again. */
  address?: string;
  stops: Point[];
  savedAt: number;
  /** Added by opening a 123go.taxi QR; waits for the user to keep (✓) or remove (✕) it. */
  pending?: boolean;
}

export const STORAGE_KEY = 'gogogo.saved.v2';
const LEGACY_KEY = 'gogogo.saved.v1';
export const MAX_SAVED = 200;
export const MAX_NOTE_LENGTH = 200;
const EXPORT_FORMAT = '123go.taxi/places';
/** Files exported before the move from gogogo.rodeo still import. */
const ACCEPTED_FORMATS = [EXPORT_FORMAT, 'gogogo.rodeo/places'];

/** localStorage, or null when the browser blocks it (private mode, some in-app browsers). */
export function browserStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    const probe = '__gogogo_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function cleanNote(note: string | undefined | null): string | undefined {
  const trimmed = note?.trim().slice(0, MAX_NOTE_LENGTH);
  return trimmed || undefined;
}

function toPoint(value: unknown): Point | null {
  const p = value as Point;
  return typeof p === 'object' && p !== null && isValidCoordinate(p.lat, p.lon)
    ? { lat: p.lat, lon: p.lon }
    : null;
}

/** Accepts current entries and v1 entries ({ lat, lon, label }); rejects anything else. */
function toSavedPlace(value: unknown): SavedPlace | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const rawStops = Array.isArray(v.stops) ? v.stops : [v];
  const stops = rawStops.map(toPoint);
  if (stops.length === 0 || stops.length > MAX_STOPS || stops.some((s) => s === null)) return null;
  const name = cleanLabel(typeof v.name === 'string' ? v.name : (v.label as string | undefined));
  return {
    id: typeof v.id === 'string' && v.id ? v.id : newId(),
    name,
    note: cleanNote(typeof v.note === 'string' ? v.note : undefined),
    address: cleanAddress(typeof v.address === 'string' ? v.address : undefined),
    stops: stops as Point[],
    savedAt: typeof v.savedAt === 'number' ? v.savedAt : Date.now(),
    pending: v.pending === true ? true : undefined,
  };
}

function sameStops(a: { stops: Point[] }, b: { stops: Point[] }): boolean {
  return a.stops.length === b.stops.length && a.stops.every((s, i) => s.lat === b.stops[i]?.lat && s.lon === b.stops[i]?.lon);
}

function newId(now = Date.now()): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sameJourney(a: SavedPlace, b: SavedPlace): boolean {
  return (
    a.name === b.name &&
    a.stops.length === b.stops.length &&
    a.stops.every((s, i) => s.lat === b.stops[i]?.lat && s.lon === b.stops[i]?.lon)
  );
}

export class SavedPlaces {
  constructor(private readonly storage: Storage | null) {
    this.migrate();
  }

  get available(): boolean {
    return this.storage !== null;
  }

  list(): SavedPlace[] {
    try {
      const parsed: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(toSavedPlace).filter((p): p is SavedPlace => p !== null);
    } catch {
      return [];
    }
  }

  /**
   * Save a journey at the bottom of the list, so the places people put on top stay
   * there. Saving the same one again updates it where it is.
   */
  add(journey: Journey & { name?: string; note?: string }, now = Date.now()): SavedPlace {
    const place: SavedPlace = {
      id: newId(now),
      name: cleanLabel(journey.name),
      note: cleanNote(journey.note),
      address: cleanAddress(journey.address),
      stops: journey.stops.map(({ lat, lon }) => ({ lat, lon })),
      savedAt: now,
    };
    const list = this.list();
    const at = list.findIndex((p) => sameJourney(p, place));
    if (at >= 0) list[at] = { ...place, id: list[at]!.id };
    else list.push(place);
    this.write(list);
    return place;
  }

  /**
   * A 123go.taxi QR was opened on this phone: add it as New, unless the same
   * stops are already in the list. Returns the place, new or existing.
   */
  addScanned(journey: Journey, now = Date.now()): SavedPlace {
    const existing = this.list().find((p) => sameStops(p, journey));
    if (existing) return existing;
    const place: SavedPlace = {
      id: newId(now),
      name: cleanLabel(journey.label),
      address: cleanAddress(journey.address),
      stops: journey.stops.map(({ lat, lon }) => ({ lat, lon })),
      savedAt: now,
      pending: true,
    };
    // At the bottom, like any new place.
    this.write([...this.list(), place]);
    return place;
  }

  /** ✓ on a New place: it becomes an ordinary saved place. */
  keep(id: string): void {
    this.write(this.list().map((p) => (p.id === id ? { ...p, pending: undefined } : p)));
  }

  /** Put the places in this order (by id), as dragged in Your places. */
  reorder(ids: readonly string[]): void {
    const all = this.list();
    const rank = (p: SavedPlace) => {
      const i = ids.indexOf(p.id);
      return i < 0 ? ids.length : i;
    };
    this.write([...all].sort((a, b) => rank(a) - rank(b)));
  }

  remove(id: string): void {
    this.write(this.list().filter((p) => p.id !== id));
  }

  clear(): void {
    this.storage?.removeItem(STORAGE_KEY);
  }

  /** The whole list as a JSON file body the user can keep or move to another device. */
  exportJson(): string {
    return JSON.stringify(
      {
        format: EXPORT_FORMAT,
        version: 1,
        // Ids are per-device; the importing device makes its own.
        // New places nobody has kept yet stay out of the file.
        places: this.list().filter((p) => !p.pending).map(({ name, note, address, stops, savedAt }) => ({
          name,
          note,
          address,
          stops,
          savedAt,
        })),
      },
      null,
      2,
    );
  }

  /** Merge places from an exported file. Returns how many were added. Throws on a file that isn't ours. */
  importJson(text: string): number {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('not-json');
    }
    const places = (data as { format?: unknown; places?: unknown })?.places;
    if (!ACCEPTED_FORMATS.includes((data as { format?: string })?.format ?? '') || !Array.isArray(places)) {
      throw new Error('wrong-format');
    }
    const current = this.list();
    const incoming = places
      .map(toSavedPlace)
      .filter((p): p is SavedPlace => p !== null)
      .filter((p) => !current.some((c) => sameJourney(c, p)))
      .map((p) => ({ ...p, id: newId() }));
    this.write([...current, ...incoming]);
    return incoming.length;
  }

  private write(places: SavedPlace[]): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(places.slice(0, MAX_SAVED)));
  }

  /** Bring over places saved by the first version (single stop, optional label). */
  private migrate(): void {
    const legacy = this.storage?.getItem(LEGACY_KEY);
    if (!legacy || !this.storage) return;
    try {
      const old: unknown = JSON.parse(legacy);
      const converted = (Array.isArray(old) ? old : [])
        .map(toSavedPlace)
        .filter((p): p is SavedPlace => p !== null);
      this.write([...this.list(), ...converted]);
    } catch {
      // Unreadable old data: nothing worth keeping.
    }
    this.storage.removeItem(LEGACY_KEY);
  }
}

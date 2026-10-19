// Journeys saved for later. They live only in this browser's localStorage:
// nothing is sent anywhere, so nobody else (including us) can read them.
// Export/import moves the list between devices as a file the user controls.

import {
  cleanLabel,
  isValidCoordinate,
  MAX_STOPS,
  type Journey,
  type Point,
} from '../destination-url';

export interface SavedPlace {
  id: string;
  name: string;
  note?: string;
  stops: Point[];
  savedAt: number;
}

export const STORAGE_KEY = 'gogogo.saved.v2';
const LEGACY_KEY = 'gogogo.saved.v1';
export const MAX_SAVED = 200;
export const MAX_NOTE_LENGTH = 200;
const EXPORT_FORMAT = 'gogogo.rodeo/places';

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
  if (!name) return null;
  return {
    id: typeof v.id === 'string' && v.id ? v.id : newId(),
    name,
    note: cleanNote(typeof v.note === 'string' ? v.note : undefined),
    stops: stops as Point[],
    savedAt: typeof v.savedAt === 'number' ? v.savedAt : Date.now(),
  };
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

  /** Save a journey under a name, newest first. Saving the same one again moves it to the top. */
  add(journey: Journey & { name: string; note?: string }, now = Date.now()): SavedPlace {
    const name = cleanLabel(journey.name);
    if (!name) throw new Error('A saved place needs a name.');
    const place: SavedPlace = {
      id: newId(now),
      name,
      note: cleanNote(journey.note),
      stops: journey.stops.map(({ lat, lon }) => ({ lat, lon })),
      savedAt: now,
    };
    this.write([place, ...this.list().filter((p) => !sameJourney(p, place))]);
    return place;
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
        places: this.list().map(({ name, note, stops, savedAt }) => ({ name, note, stops, savedAt })),
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
    if ((data as { format?: unknown })?.format !== EXPORT_FORMAT || !Array.isArray(places)) {
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
        .map((p: Record<string, unknown>) => toSavedPlace({ ...p, name: p.label ?? `${p.lat}, ${p.lon}` }))
        .filter((p): p is SavedPlace => p !== null);
      this.write([...this.list(), ...converted]);
    } catch {
      // Unreadable old data: nothing worth keeping.
    }
    this.storage.removeItem(LEGACY_KEY);
  }
}

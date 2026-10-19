// Places saved for later. They live only in this browser's localStorage:
// nothing is sent anywhere, so nobody else (including us) can read them.

import { cleanLabel, isValidCoordinate, type Destination } from '../destination-url';

export interface SavedPlace extends Destination {
  id: string;
  savedAt: number;
}

export const STORAGE_KEY = 'gogogo.saved.v1';
export const MAX_SAVED = 50;

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

function isSavedPlace(value: unknown): value is SavedPlace {
  const p = value as SavedPlace;
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof p.id === 'string' &&
    typeof p.savedAt === 'number' &&
    isValidCoordinate(p.lat, p.lon)
  );
}

export class SavedPlaces {
  constructor(private readonly storage: Storage | null) {}

  get available(): boolean {
    return this.storage !== null;
  }

  list(): SavedPlace[] {
    try {
      const parsed: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isSavedPlace) : [];
    } catch {
      return [];
    }
  }

  /** Save a place, newest first. Saving the same spot again moves it to the top. */
  add(destination: Destination, now = Date.now()): SavedPlace {
    const place: SavedPlace = {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      lat: destination.lat,
      lon: destination.lon,
      label: cleanLabel(destination.label),
      savedAt: now,
    };
    const others = this.list().filter(
      (p) => !(p.lat === place.lat && p.lon === place.lon && p.label === place.label),
    );
    this.write([place, ...others].slice(0, MAX_SAVED));
    return place;
  }

  remove(id: string): void {
    this.write(this.list().filter((p) => p.id !== id));
  }

  clear(): void {
    this.storage?.removeItem(STORAGE_KEY);
  }

  private write(places: SavedPlace[]): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(places));
  }
}

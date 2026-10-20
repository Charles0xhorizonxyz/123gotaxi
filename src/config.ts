// Single place for values a self-hoster may want to change.

export const CANONICAL_URL = 'https://123go.taxi';

interface PublicUrlInputs {
  /** VITE_PUBLIC_URL, set at build time. */
  envUrl?: string;
  /** True on the local dev server. */
  dev: boolean;
  /** location.origin of the page that is running. */
  origin?: string;
  /** Vite's BASE_URL, e.g. "/" or "/123gotaxi/". */
  basePath: string;
}

/**
 * Address that QR codes point to, without a trailing slash.
 * On the dev server it follows the current address, so a phone on the same
 * Wi-Fi can scan codes made from the network URL.
 */
export function resolvePublicUrl({ envUrl, dev, origin, basePath }: PublicUrlInputs): string {
  const url = envUrl || (dev && origin ? origin + basePath : CANONICAL_URL);
  return url.replace(/\/+$/, '');
}

export function publicUrl(): string {
  return resolvePublicUrl({
    envUrl: import.meta.env.VITE_PUBLIC_URL,
    dev: import.meta.env.DEV,
    origin: globalThis.location?.origin,
    basePath: import.meta.env.BASE_URL,
  });
}

/** Where readable addresses come from. Any Photon server works; see src/geocoding. */
export const PHOTON_URL = 'https://photon.komoot.io';

/**
 * Geoapify answers address searches much faster than the free Photon server.
 * The key is public by design: Geoapify only accepts it from 123go.taxi.
 * Self-hosting? Use your own key, or leave it empty to use Photon alone.
 */
export const GEOAPIFY_URL = 'https://api.geoapify.com';
export const GEOAPIFY_KEY = 'e0d14429c9a14eefa00c17f367869ccf';

/**
 * The link expander (worker/) that turns short map links into long ones.
 * Empty: short links show "open it and copy the long link" instead.
 */
export const EXPANDER_URL = 'https://123go-expand.123go-taxi.workers.dev';

/** Where the source code lives; linked from the footer. */
export const SOURCE_URL = 'https://github.com/Charles0xhorizonxyz/123gotaxi';

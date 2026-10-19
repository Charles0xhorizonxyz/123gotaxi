// Single place for values a self-hoster may want to change.

/** Canonical public address. QR codes point here. Override with VITE_PUBLIC_URL at build time. */
export const PUBLIC_URL: string = (import.meta.env.VITE_PUBLIC_URL || 'https://gogogo.rodeo').replace(
  /\/+$/,
  '',
);

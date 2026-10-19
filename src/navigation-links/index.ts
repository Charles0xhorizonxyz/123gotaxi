// Links that open each navigation app with a driving route to the destination.
// Sources (checked 2026-10):
//   Google: https://developers.google.com/maps/documentation/urls/get-started
//   Waze:   https://developers.google.com/waze/deeplinks
//   Apple:  https://developer.apple.com/documentation/mapkit/unified-map-urls
//   Yandex: yandexnavi:// scheme is thinly documented; verify on real phones.

import { formatCoord, type Destination } from '../destination-url';

export type Platform = 'android' | 'ios' | 'other';

export interface NavApp {
  id: string;
  name: string;
  /** Platforms the button is shown on. */
  platforms: readonly Platform[];
  url(destination: Destination, platform: Platform): string;
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

function coords(d: Destination): { lat: string; lon: string } {
  return { lat: formatCoord(d.lat), lon: formatCoord(d.lon) };
}

export function yandexMapsUrl(d: Destination): string {
  const { lat, lon } = coords(d);
  return `https://yandex.com.tr/maps/?rtext=~${lat},${lon}&rtt=auto`;
}

export const NAV_APPS: readonly NavApp[] = [
  {
    id: 'google',
    name: 'Google Maps',
    platforms: ['android', 'ios', 'other'],
    url(d) {
      const { lat, lon } = coords(d);
      return `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lon}&travelmode=driving&dir_action=navigate`;
    },
  },
  {
    id: 'yandex-navi',
    name: 'Yandex Navigator',
    platforms: ['android', 'ios'],
    url(d, platform) {
      const { lat, lon } = coords(d);
      const query = `lat_to=${lat}&lon_to=${lon}`;
      if (platform === 'android') {
        // intent:// lets Android fall back to Yandex Maps on the web if Navigator is missing.
        const fallback = encodeURIComponent(yandexMapsUrl(d));
        return `intent://build_route_on_map?${query}#Intent;scheme=yandexnavi;package=ru.yandex.yandexnavi;S.browser_fallback_url=${fallback};end`;
      }
      return `yandexnavi://build_route_on_map?${query}`;
    },
  },
  {
    id: 'yandex-maps',
    name: 'Yandex Maps',
    platforms: ['android', 'ios', 'other'],
    url: yandexMapsUrl,
  },
  {
    id: 'waze',
    name: 'Waze',
    platforms: ['android', 'ios', 'other'],
    url(d) {
      const { lat, lon } = coords(d);
      return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes&utm_source=gogogo.rodeo`;
    },
  },
  {
    id: 'apple',
    name: 'Apple Maps',
    platforms: ['ios', 'other'],
    url(d) {
      const { lat, lon } = coords(d);
      return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    },
  },
  {
    id: 'geo',
    name: 'Other app',
    platforms: ['android'],
    url(d) {
      const { lat, lon } = coords(d);
      // Parentheses would end the label early, so drop them.
      const label = d.label ? `(${encodeURIComponent(d.label.replace(/[()]/g, ''))})` : '';
      return `geo:${lat},${lon}?q=${lat},${lon}${label}`;
    },
  },
];

export function appsFor(platform: Platform): NavApp[] {
  return NAV_APPS.filter((app) => app.platforms.includes(platform));
}

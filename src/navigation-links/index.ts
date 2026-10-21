// Links that open each navigation app with a driving route through the journey.
// Sources (checked 2026-10):
//   Google: https://developers.google.com/maps/documentation/urls/get-started
//           (waypoints: "|"-separated, up to 3 in mobile browsers, 9 otherwise)
//   Waze:   https://developers.google.com/waze/deeplinks (single destination only)
//   Apple:  https://developer.apple.com/documentation/mapkit/unified-map-urls
//           (no documented multi-stop link)
//   Yandex Navigator: yandex.ru/dev/yandex-apps-launch/navigator/doc/concepts/navigator-url-params-docpage/
//           (lat_to/lon_to, lat_via_N/lon_via_N)

import { finalStop, formatCoord, formatPoint, type Journey } from '../destination-url';
import { MORE_APPS, SUGGEST_APP_URL, type MoreApp } from './more';

export type Platform = 'android' | 'ios' | 'other';

export interface NavApp {
  id: string;
  name: string;
  /** Platforms the button is shown on. */
  platforms: readonly Platform[];
  /** Whether the app follows every stop, not just the final one. */
  multiStop: boolean;
  url(journey: Journey, platform: Platform): string;
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

export function yandexMapsUrl(journey: Journey): string {
  // A leading "~" means "from where I am now".
  return `https://yandex.com.tr/maps/?rtext=~${journey.stops.map(formatPoint).join('~')}&rtt=auto`;
}

export const NAV_APPS: readonly NavApp[] = [
  {
    id: 'google',
    name: 'Google Maps',
    platforms: ['android', 'ios', 'other'],
    multiStop: true,
    url(journey) {
      const encode = (p: { lat: number; lon: number }) => formatPoint(p).replace(',', '%2C');
      const via = journey.stops.slice(0, -1).map(encode).join('%7C');
      return (
        `https://www.google.com/maps/dir/?api=1&destination=${encode(finalStop(journey))}` +
        (via ? `&waypoints=${via}` : '') +
        '&travelmode=driving&dir_action=navigate'
      );
    },
  },
  {
    id: 'yandex-navi',
    name: 'Yandex Navigator',
    platforms: ['android', 'ios'],
    multiStop: true,
    url(journey, platform) {
      const end = finalStop(journey);
      const query = [
        `lat_to=${formatCoord(end.lat)}`,
        `lon_to=${formatCoord(end.lon)}`,
        ...journey.stops
          .slice(0, -1)
          .flatMap((p, i) => [`lat_via_${i}=${formatCoord(p.lat)}`, `lon_via_${i}=${formatCoord(p.lon)}`]),
      ].join('&');
      if (platform === 'android') {
        // intent:// lets Android fall back to Yandex Maps on the web if Navigator is missing.
        const fallback = encodeURIComponent(yandexMapsUrl(journey));
        return `intent://build_route_on_map?${query}#Intent;scheme=yandexnavi;package=ru.yandex.yandexnavi;S.browser_fallback_url=${fallback};end`;
      }
      return `yandexnavi://build_route_on_map?${query}`;
    },
  },
  {
    id: 'yandex-maps',
    name: 'Yandex Maps',
    platforms: ['android', 'ios', 'other'],
    multiStop: true,
    url: yandexMapsUrl,
  },
  {
    id: 'waze',
    name: 'Waze',
    platforms: ['android', 'ios', 'other'],
    multiStop: false,
    url(journey) {
      return `https://waze.com/ul?ll=${formatPoint(finalStop(journey))}&navigate=yes&utm_source=123go.taxi`;
    },
  },
  {
    id: 'apple',
    name: 'Apple Maps',
    platforms: ['ios', 'other'],
    multiStop: false,
    url(journey) {
      return `https://maps.apple.com/?daddr=${formatPoint(finalStop(journey))}&dirflg=d`;
    },
  },
  {
    id: 'geo',
    name: 'Other app',
    platforms: ['android'],
    multiStop: false,
    url(journey) {
      const point = formatPoint(finalStop(journey));
      // Parentheses would end the label early, so drop them.
      const text = journey.label ?? journey.address;
      const label = text ? `(${encodeURIComponent(text.replace(/[()]/g, ''))})` : '';
      return `geo:${point}?q=${point}${label}`;
    },
  },
];

/**
 * Apps to offer: right platform, and able to follow every stop of the journey.
 * `more`: ids of the extra apps this phone switched on (see more.ts), after the usual ones.
 */
export function appsFor(platform: Platform, stopCount = 1, more: readonly string[] = []): NavApp[] {
  return [...NAV_APPS, ...MORE_APPS.filter((app) => more.includes(app.id))].filter(
    (app) => app.platforms.includes(platform) && (stopCount === 1 || app.multiStop),
  );
}

/** The extra apps this platform can offer in "More apps". */
export function moreAppsFor(platform: Platform): MoreApp[] {
  return MORE_APPS.filter((app) => app.platforms.includes(platform));
}

export { MORE_APPS, SUGGEST_APP_URL, type MoreApp };

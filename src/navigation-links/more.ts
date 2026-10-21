// "More apps": navigation apps people can switch on for their phone in
// "Your navigation app". Each link format comes from the app maker's own
// documentation (checked 2026-10):
//   2GIS:          help.2gis.com, "launching 2GIS navigation using deeplink"
//                  (dgis://2gis.ru/routeSearch/rsType/car/to/<lon>,<lat>; no start = current position)
//   Mapy.com:      developer.mapy.com, "Mapy.cz URL" (/fnc/v1/route, navigate=true opens the app)
//   Organic Maps:  its source (libs/map/mwm_url.cpp): a route link needs the start
//                  position, which we don't have, so the share link opens the place
//   OsmAnd:        iOS 2.90 release notes, osmand.net/go?lat=&lon=&z= (opens the place)
//   HERE WeGo:     docs.here.com Deeplinking API, share.here.com/l/<lat>,<lon>,<title> (opens the place)
// Ride apps, to book a ride there (pickup: where the rider is):
//   Uber:          developer.uber.com/docs/deep-linking, m.uber.com/looking with drop[n] JSON
//                  locations (several drops = several stops)
//   Yandex Go:     yandex.com/dev/taxi, "Generating links to an order":
//                  3.redirect.appmetrica.yandex.com/route with end-lat/end-lon and Yandex's tracking id
// Bolt and BiTaksi publish no link format; people can ask for them on GitHub.
// Apps without a documented link (Sygic, Magic Earth, Petal Maps...) are left
// out until one is confirmed: suggestions go to GitHub.

import { finalStop, formatCoord, type Journey } from '../destination-url';
import type { NavApp } from './index';

/** A ready-filled GitHub issue to suggest a missing app. */
export const SUGGEST_APP_URL =
  'https://github.com/Charles0xhorizonxyz/123gotaxi/issues/new?template=app-suggestion.yml';

const GE0_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Organic Maps' "ge0" code for a spot: a zoom character, then nine for the position (about 1 m). */
export function encodeGe0(lat: number, lon: number, zoom = 17): string {
  const max = 2 ** 30 - 1;
  const latI = Math.min(max, Math.max(0, Math.round(((lat + 90) / 180) * max)));
  let lonI = Math.floor(((lon + 180) / 360) * (max + 1) + 0.5);
  if (lonI <= 0 || lonI >= max + 1) lonI = 0;
  let code = GE0_ALPHABET[Math.round((Math.min(Math.max(zoom, 4), 19.75) - 4) * 4)]!;
  for (let shift = 27; shift >= 3; shift -= 3) {
    const la = (latI >> shift) & 7;
    const lo = (lonI >> shift) & 7;
    code += GE0_ALPHABET[
      (((la >> 2) & 1) << 5) |
        (((lo >> 2) & 1) << 4) |
        (((la >> 1) & 1) << 3) |
        (((lo >> 1) & 1) << 2) |
        ((la & 1) << 1) |
        (lo & 1)
    ]!;
  }
  return code;
}

const title = (journey: Journey) => journey.label ?? journey.address ?? '';
const lonLat = (p: { lat: number; lon: number }) => `${formatCoord(p.lon)},${formatCoord(p.lat)}`;

export interface MoreApp extends NavApp {
  /** Opens the place rather than a route: the driver taps the app's own route button. */
  opensPlace: boolean;
}

export const MORE_APPS: readonly MoreApp[] = [
  {
    id: '2gis',
    name: '2GIS',
    platforms: ['android', 'ios', 'other'],
    multiStop: false,
    opensPlace: false,
    url(journey, platform) {
      const path = `2gis.ru/routeSearch/rsType/car/to/${lonLat(finalStop(journey))}`;
      if (platform === 'android') {
        const fallback = encodeURIComponent(`https://${path}`);
        return `intent://${path}#Intent;scheme=dgis;package=ru.dublgis.dgismobile;S.browser_fallback_url=${fallback};end`;
      }
      return platform === 'ios' ? `dgis://${path}` : `https://${path}`;
    },
  },
  {
    id: 'mapy',
    name: 'Mapy.com',
    platforms: ['android', 'ios', 'other'],
    multiStop: true,
    opensPlace: false,
    url(journey) {
      const via = journey.stops.slice(0, -1).map(lonLat).join(';');
      return (
        `https://mapy.com/fnc/v1/route?end=${lonLat(finalStop(journey))}&routeType=car_fast` +
        (via ? `&waypoints=${via}` : '') +
        '&navigate=true'
      );
    },
  },
  {
    id: 'organic',
    name: 'Organic Maps',
    platforms: ['android', 'ios', 'other'],
    multiStop: false,
    opensPlace: true,
    url(journey) {
      const end = finalStop(journey);
      const name = title(journey).replace(/\s+/g, '_').slice(0, 60);
      return `https://omaps.app/${encodeGe0(end.lat, end.lon)}${name ? `/${encodeURIComponent(name)}` : ''}`;
    },
  },
  {
    id: 'osmand',
    name: 'OsmAnd',
    platforms: ['android', 'ios', 'other'],
    multiStop: false,
    opensPlace: true,
    url(journey) {
      const end = finalStop(journey);
      return `https://osmand.net/go?lat=${formatCoord(end.lat)}&lon=${formatCoord(end.lon)}&z=17`;
    },
  },
  {
    id: 'here',
    name: 'HERE WeGo',
    platforms: ['android', 'ios', 'other'],
    multiStop: false,
    opensPlace: true,
    url(journey) {
      const end = finalStop(journey);
      const name = title(journey).replace(/[,/?#]/g, ' ').trim();
      return `https://share.here.com/l/${formatCoord(end.lat)},${formatCoord(end.lon)}${name ? `,${encodeURIComponent(name)}` : ''}`;
    },
  },
  {
    id: 'uber',
    name: 'Uber',
    platforms: ['android', 'ios', 'other'],
    multiStop: true,
    opensPlace: false,
    url(journey) {
      const drops = journey.stops.map((p, i) => {
        const last = i === journey.stops.length - 1;
        const place = { latitude: p.lat, longitude: p.lon, ...(last && title(journey) ? { addressLine1: title(journey) } : {}) };
        return `drop[${i}]=${encodeURIComponent(JSON.stringify(place))}`;
      });
      return `https://m.uber.com/looking?${drops.join('&')}`;
    },
  },
  {
    id: 'yandex-go',
    name: 'Yandex Go',
    platforms: ['android', 'ios', 'other'],
    multiStop: false,
    opensPlace: false,
    url(journey) {
      const end = finalStop(journey);
      return (
        `https://3.redirect.appmetrica.yandex.com/route?end-lat=${formatCoord(end.lat)}&end-lon=${formatCoord(end.lon)}` +
        `&ref=123go.taxi&appmetrica_tracking_id=1178268795219780156&lang=${globalThis.document?.documentElement?.lang || 'en'}`
      );
    },
  },
];

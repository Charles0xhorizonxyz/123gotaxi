import { describe, expect, it } from 'vitest';
import type { Journey } from '../../src/destination-url';
import { appsFor, detectPlatform, MORE_APPS, NAV_APPS, type Platform } from '../../src/navigation-links';
import { parseLocation } from '../../src/link-parsing';

const home: Journey = { stops: [{ lat: 41.034212, lon: 28.98441 }], label: 'Ev (Cihangir) & bahçe' };
const tour: Journey = {
  stops: [
    { lat: 41.01, lon: 28.97 },
    { lat: 41.02, lon: 28.98 },
    { lat: 41.03, lon: 28.99 },
  ],
};

function url(id: string, journey: Journey = home, platform: Platform = 'android'): string {
  const app = NAV_APPS.find((a) => a.id === id);
  if (!app) throw new Error(`no app ${id}`);
  return app.url(journey, platform);
}

describe('single destination', () => {
  it('Google Maps: driving directions with encoded comma', () => {
    expect(url('google')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=41.03421%2C28.98441&travelmode=driving&dir_action=navigate',
    );
  });

  it('Waze: navigate straight away', () => {
    expect(url('waze')).toBe(
      'https://waze.com/ul?ll=41.03421,28.98441&navigate=yes&utm_source=123go.taxi',
    );
  });

  it('Apple Maps: driving directions', () => {
    expect(url('apple', home, 'ios')).toBe('https://maps.apple.com/directions?destination=41.03421,28.98441&mode=driving');
  });

  it('Yandex Maps: route from here on the Turkish site', () => {
    expect(url('yandex-maps')).toBe('https://yandex.com.tr/maps/?rtext=~41.03421,28.98441&rtt=auto');
  });

  it('Yandex Navigator on Android falls back to the web', () => {
    const link = url('yandex-navi', home, 'android');
    expect(link).toMatch(/^intent:\/\/build_route_on_map\?lat_to=41.03421&lon_to=28.98441#Intent;/);
    expect(link).toContain('package=ru.yandex.yandexnavi');
    expect(link).toContain(
      `S.browser_fallback_url=${encodeURIComponent('https://yandex.com.tr/maps/?rtext=~41.03421,28.98441&rtt=auto')}`,
    );
    expect(link.endsWith(';end')).toBe(true);
  });

  it('Yandex Navigator on iPhone uses its app scheme', () => {
    expect(url('yandex-navi', home, 'ios')).toBe(
      'yandexnavi://build_route_on_map?lat_to=41.03421&lon_to=28.98441',
    );
  });

  it('geo: drops parentheses from the label and encodes the rest', () => {
    expect(url('geo')).toBe(
      'geo:41.03421,28.98441?q=41.03421,28.98441(Ev%20Cihangir%20%26%20bah%C3%A7e)',
    );
  });

  it('geo: uses the address when there is no name', () => {
    expect(url('geo', { stops: [{ lat: 1, lon: 2 }], address: 'Galata Kulesi, İstanbul' })).toBe(
      'geo:1,2?q=1,2(Galata%20Kulesi%2C%20%C4%B0stanbul)',
    );
  });

  it('geo: works without a label', () => {
    expect(url('geo', { stops: [{ lat: 1, lon: 2 }] })).toBe('geo:1,2?q=1,2');
  });
});

describe('multi-stop journeys', () => {
  it('Google Maps: earlier stops become pipe-separated waypoints', () => {
    expect(url('google', tour)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=41.03%2C28.99&waypoints=41.01%2C28.97%7C41.02%2C28.98&travelmode=driving&dir_action=navigate',
    );
  });

  it('Yandex Maps: every stop in rtext, in order', () => {
    expect(url('yandex-maps', tour)).toBe(
      'https://yandex.com.tr/maps/?rtext=~41.01,28.97~41.02,28.98~41.03,28.99&rtt=auto',
    );
  });

  it('Yandex Navigator: numbered via points', () => {
    expect(url('yandex-navi', tour, 'ios')).toBe(
      'yandexnavi://build_route_on_map?lat_to=41.03&lon_to=28.99&lat_via_0=41.01&lon_via_0=28.97&lat_via_1=41.02&lon_via_1=28.98',
    );
  });

  it('only apps that follow every stop are offered', () => {
    expect(appsFor('android', 3).map((a) => a.id)).toEqual(['google', 'yandex-navi', 'yandex-maps']);
    expect(appsFor('ios', 3).map((a) => a.id)).toEqual(['google', 'yandex-navi', 'yandex-maps', 'apple']);
  });
});

describe('appsFor', () => {
  const ids = (platform: Platform) => appsFor(platform).map((a) => a.id);

  it('Android gets the OS chooser but not Apple Maps', () => {
    expect(ids('android')).toContain('geo');
    expect(ids('android')).not.toContain('apple');
  });

  it('iPhone gets Apple Maps but not geo:', () => {
    expect(ids('ios')).toContain('apple');
    expect(ids('ios')).not.toContain('geo');
  });

  it('desktop only gets web links', () => {
    expect(ids('other')).toEqual(['google', 'yandex-maps', 'waze', 'apple']);
  });
});

describe('detectPlatform', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36', 0, 'android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0, 'other'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 'other'],
  ] as const)('%s', (ua, touch, expected) => {
    expect(detectPlatform(ua, touch)).toBe(expected);
  });
});

describe('More apps', () => {
  const journey = { stops: [{ lat: 41.02564, lon: 28.97417 }], label: 'Galata Kulesi' };
  const more = (id: string) => MORE_APPS.find((a) => a.id === id)!;

  it('come after the usual apps, and "Other app" (Android) always last', () => {
    expect(appsFor('android').some((a) => a.id === '2gis')).toBe(false);
    const ids = appsFor('android', 1, ['2gis', 'organic']).map((a) => a.id);
    expect(ids.slice(-3)).toEqual(['2gis', 'organic', 'geo']);
    expect(appsFor('ios', 1, 'all').map((a) => a.id)).toEqual(['google', 'yandex-navi', 'yandex-maps', 'waze', 'apple', '2gis', 'mapy', 'organic', 'osmand', 'here', 'uber', 'yandex-go']);
  });

  it('Apple Maps follows every stop with Apple’s current link format', () => {
    const route = { stops: [{ lat: 41.03, lon: 28.98 }, { lat: 41.02564, lon: 28.97417 }] };
    expect(NAV_APPS.find((a) => a.id === 'apple')!.url(route, 'ios')).toBe(
      'https://maps.apple.com/directions?destination=41.02564,28.97417&waypoint=41.03,28.98&mode=driving',
    );
  });

  it('2GIS starts a car route from where the driver is (longitude first)', () => {
    expect(more('2gis').url(journey, 'ios')).toBe('dgis://2gis.ru/routeSearch/rsType/car/to/28.97417,41.02564');
    expect(more('2gis').url(journey, 'android')).toMatch(/^intent:\/\/2gis\.ru\/routeSearch\/rsType\/car\/to\/28\.97417,41\.02564#Intent;scheme=dgis;package=ru\.dublgis\.dgismobile;/);
  });

  it('Mapy.com navigates, following every stop', () => {
    const route = { stops: [{ lat: 41.03, lon: 28.98 }, ...journey.stops] };
    expect(more('mapy').url(route, 'android')).toBe(
      'https://mapy.com/fnc/v1/route?end=28.97417,41.02564&routeType=car_fast&waypoints=28.98,41.03&navigate=true',
    );
  });

  it('Organic Maps gets a link our own reader opens at the same spot, with the name', () => {
    const link = more('organic').url(journey, 'ios');
    expect(link).toMatch(/^https:\/\/omaps\.app\/[A-Za-z0-9_-]{10}\/Galata_Kulesi$/);
    const back = parseLocation(link);
    expect(back.ok && Math.abs(back.place.lat - 41.02564) < 1e-4 && Math.abs(back.place.lon - 28.97417) < 1e-4).toBe(true);
  });

  it('OsmAnd and HERE WeGo open the place', () => {
    expect(more('osmand').url(journey, 'ios')).toBe('https://osmand.net/go?lat=41.02564&lon=28.97417&z=17');
    expect(more('here').url(journey, 'ios')).toBe('https://share.here.com/l/41.02564,28.97417,Galata%20Kulesi');
  });
});

describe('ride apps', () => {
  const journey = { stops: [{ lat: 41.02564, lon: 28.97417 }], label: 'Galata Kulesi' };
  const more = (id: string) => MORE_APPS.find((a) => a.id === id)!;

  it('Uber books a ride there, every stop as a drop, with the name', () => {
    const route = { stops: [{ lat: 41.03, lon: 28.98 }, ...journey.stops], label: 'Galata Kulesi' };
    const link = new URL(more('uber').url(route, 'ios'));
    expect(link.origin + link.pathname).toBe('https://m.uber.com/looking');
    expect(JSON.parse(link.searchParams.get('drop[0]')!)).toEqual({ latitude: 41.03, longitude: 28.98 });
    expect(JSON.parse(link.searchParams.get('drop[1]')!)).toEqual({ latitude: 41.02564, longitude: 28.97417, addressLine1: 'Galata Kulesi' });
  });

  it('Yandex Go orders a ride to the destination with Yandex’s own link', () => {
    expect(more('yandex-go').url(journey, 'android')).toBe(
      'https://3.redirect.appmetrica.yandex.com/route?end-lat=41.02564&end-lon=28.97417&ref=123go.taxi&appmetrica_tracking_id=1178268795219780156&lang=en',
    );
  });

  it('sit in the menu after the navigation apps, before "Other app"', () => {
    expect(appsFor('android', 1, 'all').map((a) => a.id).slice(-6)).toEqual(['uber', 'yandex-go', 'bolt', 'bitaksi', 'citymapper', 'geo']);
    expect(appsFor('ios', 1, 'all').some((a) => ['bolt', 'bitaksi', 'citymapper'].includes(a.id))).toBe(false);
  });

  it('Bolt, BiTaksi and Citymapper get the location directly on Android, or their store page', () => {
    expect(more('bolt').url(journey, 'android')).toBe(
      'intent:41.02564,28.97417?q=41.02564,28.97417(Galata%20Kulesi)#Intent;scheme=geo;package=ee.mtakso.client;' +
        'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dee.mtakso.client;end',
    );
    expect(more('bitaksi').url(journey, 'android')).toContain('package=com.bitaksi.musteri;');
    expect(more('citymapper').url(journey, 'android')).toContain('package=com.citymapper.app.release;');
  });
});

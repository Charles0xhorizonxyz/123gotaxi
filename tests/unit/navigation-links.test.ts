import { describe, expect, it } from 'vitest';
import type { Journey } from '../../src/destination-url';
import { appsFor, detectPlatform, NAV_APPS, type Platform } from '../../src/navigation-links';

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
    expect(url('apple', home, 'ios')).toBe('https://maps.apple.com/?daddr=41.03421,28.98441&dirflg=d');
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
    expect(appsFor('ios', 3).map((a) => a.id)).toEqual(['google', 'yandex-navi', 'yandex-maps']);
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

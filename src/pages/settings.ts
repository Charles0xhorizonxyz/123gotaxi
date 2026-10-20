import { h } from '../dom';
import { sectionHead } from './common';
import { appsFor, detectPlatform } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';

/** "Your navigation app": which app a QR scanned on this phone opens straight away. */
export function navAppSettings(): HTMLElement {
  const preference = new AppPreference(browserStorage());
  const heading = sectionHead(
    'Your navigation app',
    'Pick your app, and a 123go.taxi QR scanned with this phone opens it straight away. Pick “Ask every time” to choose each time.',
  );
  if (!preference.available) {
    return h(
      'section',
      { class: 'settings block' },
      heading,
      h('p', { class: 'hint' }, "This browser doesn't allow saving (private mode?)."),
    );
  }

  const apps = appsFor(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  // A chosen app opens straight away; "Ask every time" shows the list.
  const remembered = preference.direct ? preference.get() : null;
  const select = h(
    'select',
    { id: 'nav-app' },
    h('option', { value: '' }, 'Ask every time'),
    ...apps.map((app) => h('option', { value: app.id, selected: app.id === remembered }, app.name)),
  );
  select.addEventListener('change', () => {
    if (select.value) {
      preference.set(select.value);
      preference.setDirect(true);
    } else preference.forget();
  });

  return h(
    'section',
    { class: 'settings block' },
    heading,
    h('label', { for: 'nav-app', class: 'visually-hidden' }, 'Navigation app'),
    select,
  );
}

import { h } from '../dom';
import { sectionHead } from './common';
import { t } from '../i18n';
import { appsFor, detectPlatform } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';

/** "Your navigation app": which app a QR scanned on this phone opens straight away. */
export function navAppSettings(): HTMLElement {
  const preference = new AppPreference(browserStorage());
  const heading = sectionHead(t.yourNavApp, t.navAppHelp, { id: 'help-nav-app' });
  if (!preference.available) {
    return h(
      'section',
      { class: 'settings block' },
      heading,
      h('p', { class: 'hint' }, t.savingBlockedPrivate),
    );
  }

  const apps = appsFor(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  // A chosen app opens straight away; "Ask every time" shows the list.
  const remembered = preference.direct ? preference.get() : null;
  const select = h(
    'select',
    { id: 'nav-app' },
    h('option', { value: '' }, t.askEveryTime),
    ...apps.map((app) => h('option', { value: app.id, selected: app.id === remembered }, app.id === 'geo' ? t.otherApp : app.name)),
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
    h('label', { for: 'nav-app', class: 'visually-hidden' }, t.navAppLabel),
    select,
  );
}

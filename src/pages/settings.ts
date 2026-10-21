import { h } from '../dom';
import { sectionHead } from './common';
import { t } from '../i18n';
import { appsFor, detectPlatform, SUGGEST_APP_URL } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';

/**
 * "Your navigation app": which app a QR scanned on this phone opens straight
 * away. Every app we know is in the menu; on Android, "Other app" opens any
 * installed one. A missing app can be suggested, but nobody has to first.
 */
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

  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  // A chosen app opens straight away. Until one is chosen, the driver screen shows the list.
  const remembered = preference.direct ? preference.get() : null;
  const select = h(
    'select',
    { id: 'nav-app' },
    // Only a prompt: it can't be picked, and goes once an app is chosen.
    remembered ? null : h('option', { value: '', disabled: true, selected: true }, t.chooseApp),
    ...appsFor(platform, 1, 'all').map((app) =>
      h('option', { value: app.id, selected: app.id === remembered }, app.id === 'geo' ? t.otherAppOnPhone : app.name),
    ),
  );
  // "Other app": what it does, in one line.
  const otherHint = h('p', { class: 'hint', hidden: remembered !== 'geo' }, t.otherAppHint);
  select.addEventListener('change', () => {
    preference.set(select.value);
    preference.setDirect(true);
    select.querySelector('option[value=""]')?.remove();
    otherHint.hidden = select.value !== 'geo';
  });

  return h(
    'section',
    { class: 'settings block' },
    heading,
    h('label', { for: 'nav-app', class: 'visually-hidden' }, t.navAppLabel),
    select,
    otherHint,
    // Optional, afterwards: help everyone get the app as a button of its own.
    h('a', { class: 'text-link suggest-app', href: SUGGEST_APP_URL, rel: 'noopener', target: '_blank' }, t.suggestApp),
  );
}

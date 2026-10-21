import { h } from '../dom';
import { sectionHead } from './common';
import { t } from '../i18n';
import { appsFor, detectPlatform, moreAppsFor, SUGGEST_APP_URL } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';

/**
 * "Your navigation app": which app a QR scanned on this phone opens straight
 * away, and "More apps" to switch on beyond the usual ones.
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
  const select = h('select', { id: 'nav-app' });

  /** The menu lists the usual apps plus the ones switched on below. */
  function fillSelect(): void {
    // A chosen app opens straight away; "Ask every time" shows the list.
    const remembered = preference.direct ? preference.get() : null;
    select.replaceChildren(
      h('option', { value: '' }, t.askEveryTime),
      ...appsFor(platform, 1, preference.more).map((app) =>
        h('option', { value: app.id, selected: app.id === remembered }, app.id === 'geo' ? t.otherApp : app.name),
      ),
    );
  }
  select.addEventListener('change', () => {
    if (select.value) {
      preference.set(select.value);
      preference.setDirect(true);
    } else preference.forget();
  });
  fillSelect();

  const more = h(
    'ul',
    { class: 'more-apps' },
    ...moreAppsFor(platform).map((app) => {
      const box = h('input', { type: 'checkbox', id: `more-${app.id}`, checked: preference.more.includes(app.id) });
      box.addEventListener('change', () => {
        const on = new Set(preference.more);
        if (box.checked) on.add(app.id);
        else {
          on.delete(app.id);
          if (preference.get() === app.id) preference.forget();
        }
        preference.setMore([...on]);
        fillSelect();
      });
      return h('li', {}, h('label', { class: 'remember', for: `more-${app.id}` }, box, app.name));
    }),
  );

  return h(
    'section',
    { class: 'settings block' },
    heading,
    h('label', { for: 'nav-app', class: 'visually-hidden' }, t.navAppLabel),
    select,
    h(
      'details',
      { class: 'more-apps-box' },
      h('summary', {}, t.moreApps),
      h('p', { class: 'hint' }, t.moreAppsHint),
      more,
      h('a', { class: 'text-link', href: SUGGEST_APP_URL, rel: 'noopener', target: '_blank' }, t.suggestApp),
    ),
  );
}

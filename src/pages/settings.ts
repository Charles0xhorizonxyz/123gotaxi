import { h } from '../dom';
import { sectionHead } from './common';
import { appsFor, detectPlatform } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';

/** "Your navigation app": which app a QR scanned on this phone opens, and whether it skips the list. */
export function navAppSettings(): HTMLElement {
  const preference = new AppPreference(browserStorage());
  const heading = sectionHead('Your navigation app', 'The app a 123go.taxi QR opens when you scan it with this phone.');
  if (!preference.available) {
    return h(
      'section',
      { class: 'settings block' },
      heading,
      h('p', { class: 'hint' }, "This browser doesn't allow saving (private mode?)."),
    );
  }

  const apps = appsFor(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  const remembered = preference.get();
  const select = h(
    'select',
    { id: 'nav-app' },
    h('option', { value: '' }, 'Ask every time'),
    ...apps.map((app) => h('option', { value: app.id, selected: app.id === remembered }, app.name)),
  );
  const directBox = h('input', { type: 'checkbox', id: 'nav-direct', checked: preference.direct });
  const directLabel = h('label', { class: 'remember', for: 'nav-direct' }, directBox, 'Open it directly');

  function sync(): void {
    const none = select.value === '';
    directBox.disabled = none;
    directLabel.classList.toggle('disabled', none);
  }

  select.addEventListener('change', () => {
    if (select.value) preference.set(select.value);
    else preference.forget();
    sync();
  });
  directBox.addEventListener('change', () => preference.setDirect(directBox.checked));
  sync();

  return h(
    'section',
    { class: 'settings block' },
    heading,
    h('label', { for: 'nav-app', class: 'visually-hidden' }, 'Navigation app'),
    select,
    directLabel,
  );
}

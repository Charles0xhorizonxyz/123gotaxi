import { h } from '../dom';
import { formatPoint, type Journey } from '../destination-url';
import { appsFor, detectPlatform, type NavApp } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';
import { creditFooter, SHARE_RESULT_TEXT, shareLink } from './common';

export function renderDestination(root: HTMLElement, journey: Journey): void {
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const preference = new AppPreference(browserStorage());
  const multiStop = journey.stops.length > 1;
  const pretty = (i: number) => formatPoint(journey.stops[i]!).replace(',', ', ');

  // The remembered app goes first; everything else keeps its usual order.
  const remembered = preference.get();
  const apps = appsFor(platform, journey.stops.length).sort(
    (a, b) => Number(b.id === remembered) - Number(a.id === remembered),
  );

  const rememberBox = h('input', {
    type: 'checkbox',
    id: 'remember',
    checked: remembered !== null && apps.some((a) => a.id === remembered),
  });
  rememberBox.addEventListener('change', () => {
    if (!rememberBox.checked) preference.forget();
  });

  const button = (app: NavApp, index: number) =>
    h(
      'a',
      {
        class: `button app app-${app.id}${index === 0 && app.id === remembered ? ' go' : ''}`,
        href: app.url(journey, platform),
        rel: 'noopener',
        onclick: () => {
          if (rememberBox.checked) preference.set(app.id);
        },
      },
      app.name,
    );

  const shareButton = h('button', { type: 'button', class: 'text-link' }, 'Share');
  shareButton.addEventListener('click', async () => {
    const outcome = await shareLink(location.href, journey.label ?? 'gogogo.rodeo');
    shareButton.textContent = SHARE_RESULT_TEXT[outcome];
  });

  root.replaceChildren(
    h(
      'nav',
      { class: 'topbar' },
      h('a', { href: import.meta.env.BASE_URL, class: 'back', 'aria-label': 'Back to gogogo.rodeo' }, '←'),
      shareButton,
    ),
    h(
      'header',
      { class: 'masthead' },
      h('p', { class: 'eyebrow' }, multiStop ? `Your route · ${journey.stops.length} stops` : 'Next stop'),
      h('h1', { class: 'destination-name' }, journey.label ?? pretty(journey.stops.length - 1)),
      multiStop
        ? h(
            'ol',
            { class: 'route' },
            ...journey.stops.map((_, i) =>
              h('li', {}, h('span', { class: 'coords' }, pretty(i))),
            ),
          )
        : journey.label
          ? h('p', { class: 'coords' }, pretty(0))
          : null,
    ),
    h(
      'section',
      { class: 'apps', 'aria-label': 'Open with' },
      h('h2', {}, 'Open with'),
      h('div', { class: 'app-list' }, ...apps.map(button)),
      preference.available
        ? h('label', { class: 'remember', for: 'remember' }, rememberBox, 'Put my app first next time')
        : null,
      multiStop
        ? h(
            'p',
            { class: 'hint' },
            "Waze, Apple Maps and other apps can't follow several stops from a link, so only apps that can are listed.",
          )
        : null,
      h(
        'p',
        { class: 'hint' },
        "We can't see which apps are on this phone. If the one you pick isn't installed, you'll get its website or app store instead.",
      ),
    ),
    creditFooter(),
  );
}

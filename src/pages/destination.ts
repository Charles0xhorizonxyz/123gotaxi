import { h } from '../dom';
import { formatPoint, type Journey } from '../destination-url';
import { appsFor, detectPlatform, type NavApp } from '../navigation-links';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';
import { creditFooter, SHARE_RESULT_TEXT, shareLink } from './common';

export function renderDestination(
  root: HTMLElement,
  journey: Journey,
  {
    backToCreate,
    autoOpen = false,
  }: {
    backToCreate?: () => void;
    /** Freshly opened from a scanned QR: the chosen app may open straight away. */
    autoOpen?: boolean;
  } = {},
): void {
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const preference = new AppPreference(browserStorage());
  const multiStop = journey.stops.length > 1;
  const pretty = (i: number) => formatPoint(journey.stops[i]!).replace(',', ', ');

  // The remembered app goes first; everything else keeps its usual order.
  const remembered = preference.get();
  const apps = appsFor(platform, journey.stops.length).sort(
    (a, b) => Number(b.id === remembered) - Number(a.id === remembered),
  );

  const chosen = apps.find((a) => a.id === remembered);
  const opening = autoOpen && preference.direct ? chosen : undefined;

  const rememberBox = h('input', {
    type: 'checkbox',
    id: 'remember',
    checked: chosen !== undefined && preference.direct,
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
          if (!rememberBox.checked) return;
          preference.set(app.id);
          preference.setDirect(true);
        },
      },
      app.name,
    );

  const shareButton = h('button', { type: 'button', class: 'text-link' }, 'Share');
  shareButton.addEventListener('click', async () => {
    const outcome = await shareLink(location.href, journey.label ?? '123go.taxi');
    shareButton.textContent = SHARE_RESULT_TEXT[outcome];
  });

  root.replaceChildren(
    h(
      'nav',
      { class: 'topbar' },
      h(
        'a',
        {
          href: import.meta.env.BASE_URL,
          class: 'back',
          'aria-label': 'Back to 123go.taxi',
          onclick: (event: Event) => {
            if (!backToCreate) return;
            event.preventDefault();
            backToCreate();
          },
        },
        '←',
      ),
      shareButton,
    ),
    h(
      'header',
      { class: 'masthead' },
      h('p', { class: 'eyebrow' }, multiStop ? `Your route · ${journey.stops.length} stops` : 'Next stop'),
      h(
        'h1',
        { class: 'destination-name' },
        journey.label ?? journey.address ?? (multiStop ? 'Your route' : pretty(journey.stops.length - 1)),
      ),
      // An old link with a name: the address goes under it.
      journey.label && journey.address ? h('p', { class: 'address' }, journey.address) : null,
      multiStop
        ? h(
            'ol',
            { class: 'route' },
            ...journey.stops.map((_, i) =>
              h('li', {}, h('span', { class: 'coords' }, pretty(i))),
            ),
          )
        : journey.label || journey.address
          ? h('p', { class: 'coords' }, pretty(0))
          : null,
    ),
    h(
      'section',
      { class: 'apps', 'aria-label': 'Open with' },
      h('h2', {}, 'Open with'),
      opening
        ? h('p', { class: 'opening', role: 'status' }, `Opening ${opening.name}… Didn't open? Tap it below.`)
        : null,
      h('div', { class: 'app-list' }, ...apps.map(button)),
      preference.available
        ? h('label', { class: 'remember', for: 'remember' }, rememberBox, 'Open this app directly next time')
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

  // The list stays underneath, so coming back (or an app that won't open) still leaves a choice.
  if (opening) location.assign(opening.url(journey, platform));
}

import { h } from '../dom';
import { formatPoint, type Journey } from '../destination-url';
import { appsFor, detectPlatform, MORE_APPS, type NavApp } from '../navigation-links';
import { appLogo } from '../navigation-links/logos';
import { AppPreference } from '../preferences';
import { browserStorage } from '../saved-places';
import { creditFooter, SHARE_RESULT_TEXT, shareLink } from './common';
import { t } from '../i18n';

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
  const apps = appsFor(platform, journey.stops.length, remembered ? [remembered] : []).sort(
    (a, b) => Number(b.id === remembered) - Number(a.id === remembered),
  );

  const chosen = apps.find((a) => a.id === remembered);
  // Some extra apps can only show the place; say so, so the driver taps their route button.
  const placeOnly = MORE_APPS.filter((m) => m.opensPlace && apps.some((a) => a.id === m.id));
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
      appLogo(app.id),
      h('span', { class: 'app-name' }, app.id === 'geo' ? t.otherApp : app.name),
    );

  const shareButton = h('button', { type: 'button', class: 'text-link' }, t.share);
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
          'aria-label': t.back,
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
      h('p', { class: 'eyebrow' }, multiStop ? t.yourRouteStops(journey.stops.length) : t.nextStop),
      h(
        'h1',
        { class: 'destination-name' },
        journey.label ?? journey.address ?? (multiStop ? t.yourRoute : pretty(journey.stops.length - 1)),
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
      { class: 'apps', 'aria-label': t.openWith },
      h('h2', {}, t.openWith),
      opening
        ? h('p', { class: 'opening', role: 'status' }, t.opening(opening.id === 'geo' ? t.otherApp : opening.name))
        : null,
      h('div', { class: 'app-list' }, ...apps.map(button)),
      preference.available
        ? h('label', { class: 'remember', for: 'remember' }, rememberBox, t.openDirectlyNextTime)
        : null,
      placeOnly.length
        ? h('p', { class: 'hint' }, t.opensPlaceHint(placeOnly.map((a) => a.name).join(', ')))
        : null,
      multiStop
        ? h(
            'p',
            { class: 'hint' },
            t.multiStopHint,
          )
        : null,
      h(
        'p',
        { class: 'hint' },
        t.cantSeeApps,
      ),
    ),
    creditFooter(),
  );

  // The list stays underneath, so coming back (or an app that won't open) still leaves a choice.
  if (opening) location.assign(opening.url(journey, platform));
}

import { h } from '../dom';
import { formatCoord, type Destination } from '../destination-url';
import { appsFor, detectPlatform } from '../navigation-links';

export function renderDestination(root: HTMLElement, destination: Destination): void {
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const coords = `${formatCoord(destination.lat)}, ${formatCoord(destination.lon)}`;

  const buttons = appsFor(platform).map((app) =>
    h('a', { class: `button app app-${app.id}`, href: app.url(destination, platform), rel: 'noopener' }, app.name),
  );

  root.replaceChildren(
    h(
      'header',
      { class: 'masthead' },
      h('p', { class: 'eyebrow' }, 'Next stop'),
      h('h1', { class: 'destination-name' }, destination.label ?? coords),
      destination.label ? h('p', { class: 'coords' }, coords) : null,
    ),
    h(
      'section',
      { class: 'apps', 'aria-label': 'Open with' },
      h('h2', {}, 'Open with'),
      h('div', { class: 'app-list' }, ...buttons),
      h(
        'p',
        { class: 'hint' },
        "We can't see which apps are on this phone. If the one you pick isn't installed, you'll get its website or app store instead.",
      ),
    ),
    h(
      'footer',
      {},
      h(
        'a',
        { href: import.meta.env.BASE_URL, class: 'footer-brand' },
        h('img', { src: `${import.meta.env.BASE_URL}logo.svg`, alt: '', width: '32', height: '33' }),
        'Make your own QR at gogogo.rodeo',
      ),
    ),
  );
}

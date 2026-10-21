// A small logo for each app button. Logos ship with the site (the page never
// loads images from other sites): brand marks from Simple Icons (CC0,
// simpleicons.org) where it has them, otherwise a round badge with the app's
// initials in its own colour.

import { siApple, siGooglemaps, siHere, siOrganicmaps, siOsmand, siUber, siWaze } from 'simple-icons';
import { h } from '../dom';

const MARKS: Record<string, { path: string; hex: string }> = {
  google: siGooglemaps,
  waze: siWaze,
  apple: siApple,
  uber: siUber,
  here: siHere,
  osmand: siOsmand,
  organic: siOrganicmaps,
};

/** Apps Simple Icons doesn't have: initials on the app's colour. */
const BADGES: Record<string, { text: string; bg: string; fg: string }> = {
  'yandex-navi': { text: 'Я', bg: '#fc3f1d', fg: '#ffffff' },
  'yandex-maps': { text: 'Я', bg: '#fc3f1d', fg: '#ffffff' },
  'yandex-go': { text: 'Go', bg: '#ffdd00', fg: '#141414' },
  '2gis': { text: '2G', bg: '#19aa1e', fg: '#ffffff' },
  mapy: { text: 'M', bg: '#0b8a3d', fg: '#ffffff' },
  bolt: { text: 'B', bg: '#34d186', fg: '#ffffff' },
  bitaksi: { text: 'bi', bg: '#2a0f6e', fg: '#ffffff' },
  citymapper: { text: 'C', bg: '#2fb04a', fg: '#ffffff' },
};

/** "Other app": a map pin. Static markup, no user data. */
const PIN =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';

export function appLogo(id: string): HTMLElement {
  const logo = h('span', { class: 'app-logo', 'aria-hidden': 'true' });
  const mark = MARKS[id];
  const badge = BADGES[id];
  if (mark) {
    // Static path data from the Simple Icons package, no user data.
    logo.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#${mark.hex}" d="${mark.path}"/></svg>`;
  } else if (badge) {
    logo.textContent = badge.text;
    logo.classList.add('app-badge');
    logo.style.background = badge.bg;
    logo.style.color = badge.fg;
  } else {
    logo.innerHTML = PIN;
  }
  return logo;
}

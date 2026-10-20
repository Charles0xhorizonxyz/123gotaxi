import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/alfa-slab-one/400.css';
// Alfa Slab One has no Cyrillic: Russian titles use a matching heavy slab instead.
import '@fontsource/roboto-slab/cyrillic-900.css';
import './styles/main.css';
import { h } from './dom';
import { parseJourney } from './destination-url';
import { browserStorage, SavedPlaces } from './saved-places';
import { renderCreate } from './pages/create';
import { renderDestination } from './pages/destination';
import { language, t } from './i18n';

// One page, two screens: a journey in the link means a driver scanned a QR.
// The create screen is built once and only hidden while the driver screen
// shows, so coming back from "Open in navigation" keeps what was typed.
document.documentElement.lang = language;
const root = document.querySelector<HTMLElement>('#app')!;
const createView = h('div', { class: 'view' });
const destinationView = h('div', { class: 'view' });
root.replaceChildren(createView, destinationView);
let createBuilt = false;
let createScroll = 0;

/** Set by the in-app scanner: the next driver screen may open the app, like a camera scan would. */
let scanned = false;
/** Set by "Open in navigation": open the chosen app, without adding the place as New. */
let navigationAsked = false;

function takeScanned(): boolean {
  const was = scanned;
  scanned = false;
  return was;
}

function takeNavigationAsked(): boolean {
  const was = navigationAsked;
  navigationAsked = false;
  return was;
}

function navigationType(): string | undefined {
  return (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
}

function route(): void {
  const parsed = parseJourney(location.hash || location.search);
  if (parsed.kind === 'ok') {
    if (!createView.hidden) createScroll = window.scrollY;
    const fromScan = takeScanned();
    // A QR opened on this phone (camera, Scan or a tapped link) goes into Your
    // places as New. "Open in navigation" on our own screen doesn't.
    if (fromScan || !createBuilt) {
      try {
        new SavedPlaces(browserStorage()).addScanned(parsed.journey);
      } catch {
        // Storage full or blocked: the ride itself still works.
      }
    }
    document.title = t.pageTitleDriver;
    renderDestination(destinationView, parsed.journey, {
      // Opened from our own create screen: the back arrow returns to it as it was.
      backToCreate: createBuilt ? () => history.back() : undefined,
      // Only a fresh scan opens the app by itself: not a reload, not coming back from the app.
      autoOpen: fromScan || takeNavigationAsked() || (!createBuilt && navigationType() === 'navigate'),
    });
    createView.hidden = true;
    destinationView.hidden = false;
    window.scrollTo(0, 0);
  } else {
    document.title = '123go.taxi';
    if (!createBuilt) {
      renderCreate(createView, {
        brokenLink: parsed.kind === 'invalid',
        openScanned: (hash) => {
          scanned = true;
          location.hash = hash;
        },
        openNavigation: (hash) => {
          navigationAsked = true;
          location.hash = hash;
        },
      });
      createBuilt = true;
    }
    destinationView.hidden = true;
    destinationView.replaceChildren();
    createView.hidden = false;
    window.scrollTo(0, createScroll);
  }
}

window.addEventListener('hashchange', route);
route();

import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/alfa-slab-one/400.css';
import './styles/main.css';
import { h } from './dom';
import { parseJourney } from './destination-url';
import { renderCreate } from './pages/create';
import { renderDestination } from './pages/destination';

// One page, two screens: a journey in the link means a driver scanned a QR.
// The create screen is built once and only hidden while the driver screen
// shows, so coming back from "See what the driver sees" keeps what was typed.
const root = document.querySelector<HTMLElement>('#app')!;
const createView = h('div', { class: 'view' });
const destinationView = h('div', { class: 'view' });
root.replaceChildren(createView, destinationView);
let createBuilt = false;
let createScroll = 0;

function route(): void {
  const parsed = parseJourney(location.hash || location.search);
  if (parsed.kind === 'ok') {
    if (!createView.hidden) createScroll = window.scrollY;
    document.title = 'Next stop · 123go.taxi';
    renderDestination(destinationView, parsed.journey, {
      // Opened from our own create screen: the back arrow returns to it as it was.
      backToCreate: createBuilt ? () => history.back() : undefined,
    });
    createView.hidden = true;
    destinationView.hidden = false;
    window.scrollTo(0, 0);
  } else {
    document.title = '123go.taxi';
    if (!createBuilt) {
      renderCreate(createView, { brokenLink: parsed.kind === 'invalid' });
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

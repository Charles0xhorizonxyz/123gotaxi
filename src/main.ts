import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/alfa-slab-one/400.css';
import './styles/main.css';
import { parseDestination } from './destination-url';
import { renderCreate } from './pages/create';
import { renderDestination } from './pages/destination';

// One page, two screens: a destination in the link means a driver scanned a QR.
function route(): void {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  const parsed = parseDestination(location.hash || location.search);
  if (parsed.kind === 'ok') {
    document.title = `${parsed.destination.label ?? 'Destination'} · gogogo.rodeo`;
    renderDestination(root, parsed.destination);
  } else {
    document.title = 'gogogo.rodeo';
    renderCreate(root, { brokenLink: parsed.kind === 'invalid' });
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

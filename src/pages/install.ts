import { h } from '../dom';
import { detectPlatform } from '../navigation-links';
import { browserStorage } from '../saved-places';

export const INSTALL_DISMISSED_KEY = 'gogogo.install.dismissed.v1';

/** Chrome's install prompt (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

function installed(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * "Keep 123go.taxi on your phone": an Install button where the browser offers
 * one, otherwise the steps for this phone. Hidden once installed or dismissed.
 */
export function installCard(): HTMLElement | null {
  const storage = browserStorage();
  if (installed()) return null;
  try {
    if (storage?.getItem(INSTALL_DISMISSED_KEY)) return null;
  } catch {
    // Can't read the choice: show the card.
  }

  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const steps = h(
    'p',
    { class: 'hint' },
    platform === 'ios'
      ? 'Tap the Share button, then “Add to Home Screen”.'
      : 'Open your browser’s menu (⋮), then tap “Add to Home screen” or “Install app”.',
  );
  const installButton = h('button', { type: 'button', class: 'go', hidden: true }, 'Install');
  const notNow = h('button', { type: 'button', class: 'text-link' }, 'Not now');
  const card = h(
    'section',
    { class: 'install', 'aria-label': 'Install' },
    h('h2', {}, 'Keep 123go.taxi on your phone'),
    h('p', {}, 'It sits on your home screen like an app. No store, no account.'),
    steps,
    h('div', { class: 'more' }, installButton, notNow),
  );
  // A computer without an install prompt: nothing useful to say.
  if (platform === 'other') card.hidden = true;

  let prompt: BeforeInstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as BeforeInstallPromptEvent;
    steps.hidden = true;
    installButton.hidden = false;
    card.hidden = false;
  });
  window.addEventListener('appinstalled', () => card.remove());
  installButton.addEventListener('click', () => {
    void prompt?.prompt();
    prompt = null;
  });
  notNow.addEventListener('click', () => {
    try {
      storage?.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // Not saved: it just comes back next visit.
    }
    card.remove();
  });
  return card;
}

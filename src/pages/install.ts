import { CANONICAL_URL } from '../config';
import { h } from '../dom';
import { SHARE_RESULT_TEXT, shareLink } from './common';
import { detectPlatform } from '../navigation-links';

/** Chrome's install prompt (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Opened from the home screen, as an installed app. */
export function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * One "Install 123go.taxi" button. Android: shown once the browser offers to
 * install. iPhone can't install from a page, so the button shows the two steps.
 * Gone once installed.
 */
export function installButton(): HTMLElement | null {
  if (isInstalled()) return null;
  const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios';

  const button = h('button', { type: 'button', class: 'install-button' }, 'Install 123go.taxi');
  const steps = h('p', { class: 'hint', hidden: true }, 'Tap the Share button, then “Add to Home Screen”.');
  const section = h('section', { class: 'install', 'aria-label': 'Install', hidden: !ios }, button, steps);

  let prompt: BeforeInstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as BeforeInstallPromptEvent;
    section.hidden = false;
  });
  window.addEventListener('appinstalled', () => section.remove());
  button.addEventListener('click', () => {
    if (prompt) void prompt.prompt();
    else steps.hidden = false;
  });
  return section;
}

// The share symbol each phone's own apps use. Static markup, no user data.
const SHARE_ICONS = {
  ios: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>',
  other: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7 15.4 6.6M8.6 13.3l6.8 4.1" stroke="currentColor" stroke-width="2"/></svg>',
};

/** A round share button in the bottom-right corner: sends 123go.taxi itself to someone. */
export function shareAppButton(): HTMLElement {
  const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios';
  const button = h('button', { type: 'button', class: 'share-app', 'aria-label': 'Share 123go.taxi' });
  button.innerHTML = ios ? SHARE_ICONS.ios : SHARE_ICONS.other;
  const status = h('span', { class: 'share-app-status', role: 'status' });
  button.addEventListener('click', async () => {
    const outcome = await shareLink(CANONICAL_URL, '123go.taxi');
    status.textContent = outcome === 'shared' ? '' : SHARE_RESULT_TEXT[outcome];
    if (status.textContent) setTimeout(() => (status.textContent = ''), 2500);
  });
  return h('div', { class: 'share-app-corner' }, status, button);
}

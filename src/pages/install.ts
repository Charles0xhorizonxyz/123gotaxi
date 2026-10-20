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

// Static markup, no user data.
const ICONS = {
  // The share symbol each phone's own apps use.
  shareIos:
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>',
  shareOther:
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7 15.4 6.6M8.6 13.3l6.8 4.1" stroke="currentColor" stroke-width="2"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M5 20h14"/></svg>',
};

/**
 * Two round buttons floating in the bottom-right corner: install 123go.taxi
 * (only until it's installed; on Android once Chrome offers it), and share it.
 * iPhone can't install from a page, so its install button shows the two steps.
 */
export function cornerButtons(): HTMLElement {
  const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios';
  const status = h('span', { class: 'corner-status', role: 'status' });
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string, ms = 2500) => {
    clearTimeout(statusTimer);
    status.textContent = text;
    if (text) statusTimer = setTimeout(() => (status.textContent = ''), ms);
  };

  const share = h('button', { type: 'button', class: 'corner-button', 'aria-label': 'Share 123go.taxi' });
  share.innerHTML = ios ? ICONS.shareIos : ICONS.shareOther;
  share.addEventListener('click', async () => {
    const outcome = await shareLink(CANONICAL_URL, '123go.taxi');
    say(outcome === 'shared' ? '' : SHARE_RESULT_TEXT[outcome]);
  });

  const install = h('button', {
    type: 'button',
    class: 'corner-button',
    'aria-label': 'Install 123go.taxi',
    hidden: isInstalled() || !ios,
  });
  install.innerHTML = ICONS.download;
  let prompt: BeforeInstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as BeforeInstallPromptEvent;
    install.hidden = false;
  });
  window.addEventListener('appinstalled', () => install.remove());
  install.addEventListener('click', () => {
    if (prompt) void prompt.prompt();
    else say('To install: tap Share in Safari’s toolbar, then “Add to Home Screen”.', 7000);
  });

  return h('div', { class: 'corner' }, status, install, share);
}

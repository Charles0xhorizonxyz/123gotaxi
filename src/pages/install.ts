import { h } from '../dom';
import { detectPlatform } from '../navigation-links';

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
 * One "Install 123go.taxi" button. Android: shown once the browser offers to
 * install. iPhone can't install from a page, so the button shows the two steps.
 * Gone once installed.
 */
export function installButton(): HTMLElement | null {
  if (installed()) return null;
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

// "Your navigation app" as our own menu, so each app shows its logo (a phone's
// built-in menu can't show pictures). A button shows the chosen app; it opens a
// list of every app. Keyboard: arrows move, Enter picks, Escape closes.

import { h } from '../dom';
import { appLogo } from '../navigation-links/logos';

export interface AppChoice {
  id: string;
  name: string;
}

export function appMenu({
  label,
  apps,
  selected,
  placeholder,
  onPick,
}: {
  /** What the menu is, for screen readers ("Navigation app"). */
  label: string;
  apps: AppChoice[];
  selected: string | null;
  /** Shown until an app is picked. */
  placeholder: string;
  onPick: (id: string) => void;
}): HTMLElement {
  let current = selected;
  const listId = 'nav-app-list';
  const button = h('button', {
    type: 'button',
    class: 'app-menu-button',
    id: 'nav-app',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    'aria-controls': listId,
  });
  const list = h('ul', { class: 'app-menu-list', id: listId, role: 'listbox', 'aria-label': label, hidden: true });

  const options = apps.map((app) => {
    const option = h(
      'li',
      { role: 'option', id: `nav-app-${app.id}`, 'aria-selected': String(app.id === current), tabindex: '-1' },
      appLogo(app.id),
      h('span', {}, app.name),
    );
    option.addEventListener('click', () => pick(app.id));
    return option;
  });
  list.append(...options);

  function show(): void {
    const app = apps.find((a) => a.id === current);
    button.replaceChildren(
      app ? appLogo(app.id) : h('span', { class: 'app-logo app-logo-empty', 'aria-hidden': 'true' }),
      h('span', { class: 'app-menu-name' }, app ? app.name : placeholder),
    );
    button.setAttribute('aria-label', `${label}: ${app ? app.name : placeholder}`);
    for (const [i, option] of options.entries()) option.setAttribute('aria-selected', String(apps[i]!.id === current));
  }

  function open(): void {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const at = options[Math.max(0, apps.findIndex((a) => a.id === current))]!;
    at.focus();
    at.scrollIntoView({ block: 'nearest' });
  }

  function close(focusButton = true): void {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  }

  function pick(id: string): void {
    current = id;
    show();
    close();
    onPick(id);
  }

  button.addEventListener('click', () => (list.hidden ? open() : close()));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (event) => {
    const i = options.indexOf(document.activeElement as HTMLLIElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = options[Math.min(options.length - 1, Math.max(0, i + (event.key === 'ArrowDown' ? 1 : -1)))]!;
      next.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && i >= 0) {
      event.preventDefault();
      pick(apps[i]!.id);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      close(event.key === 'Escape');
    }
  });
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node;
    if (!list.hidden && !list.contains(target) && !button.contains(target)) close(false);
  });

  show();
  return h('div', { class: 'app-menu' }, button, list);
}

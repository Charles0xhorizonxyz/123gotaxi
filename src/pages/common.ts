import { SOURCE_URL } from '../config';
import { h } from '../dom';

/** GitHub's mark. Static markup, no user data. */
const GITHUB_SVG = `<svg viewBox="0 0 16 16" width="28" height="28" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

/**
 * A section title with a small "?" beside it. Tapping "?" opens a little box
 * with the explanation; tapping anywhere else, or Escape, closes it.
 */
export function sectionHead(
  title: string,
  help: string | Node,
  { titleClass }: { titleClass?: string } = {},
): HTMLElement {
  const id = `help-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const box = h('div', { class: 'help-box', id, role: 'note', hidden: true }, help);
  const toggle = h(
    'button',
    { type: 'button', class: 'help-toggle', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': `About ${title}` },
    '?',
  );
  const setOpen = (open: boolean) => {
    box.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(box.hidden === true));
  document.addEventListener('click', (event) => {
    if (!box.hidden && !box.contains(event.target as Node) && !toggle.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !box.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  return h(
    'div',
    { class: 'section-head' },
    h('div', { class: 'section-title' }, h('h2', { class: titleClass }, title), toggle),
    box,
  );
}

/** Footer: one GitHub mark, linking to the source code. */
export function creditFooter(): HTMLElement {
  const github = h('a', {
    href: SOURCE_URL,
    rel: 'noopener',
    target: '_blank',
    class: 'credit',
    'aria-label': 'Source code on GitHub',
  });
  github.innerHTML = GITHUB_SVG;
  // Addresses and searches come from OpenStreetMap, whose licence asks for this credit.
  const link = (href: string, text: string) => h('a', { href, rel: 'noopener', target: '_blank' }, text);
  const osm = h(
    'p',
    { class: 'osm-credit' },
    'Address © ',
    link('https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors'),
    ', via ',
    link('https://www.geoapify.com', 'Geoapify'),
    ' and ',
    link('https://photon.komoot.io', 'Photon'),
  );
  return h('footer', {}, h('div', { class: 'footer-row' }, github, osm));
}

/**
 * Open the phone's share sheet, or copy the link where sharing isn't available.
 * Returns what happened so the button can say so.
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const SHARE_RESULT_TEXT = {
  shared: 'Share',
  copied: 'Link copied',
  failed: "Couldn't share",
} as const;

// "Put it on your website": for restaurants, hotels and other places. The
// place gives its public name (it goes into the QR, so guests and drivers see
// it) and gets a "Get here by taxi" button and QR to paste into its website.

import { buildJourneyUrl, type Journey } from '../destination-url';
import { h } from '../dom';
import { qrDataUrl } from '../qr';

const BUTTON_STYLE = [
  'display:inline-flex',
  'align-items:center',
  'gap:8px',
  'padding:12px 20px',
  'border-radius:999px',
  'background:#141414',
  'color:#ffc61a',
  'font:700 16px/1.2 system-ui,-apple-system,sans-serif',
  'text-decoration:none',
].join(';');

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The code a website pastes: a button for phones, a QR for computers. */
export function websiteSnippet(url: string, name: string, qr: string): string {
  const label = name ? `Get to ${name} by taxi` : 'Get here by taxi';
  return [
    `<!-- 123go.taxi: ${escapeHtml(label)} -->`,
    `<a href="${escapeHtml(url)}" style="${BUTTON_STYLE}">🚕 ${escapeHtml(label)}</a>`,
    `<br><img src="${qr}" width="180" height="180" alt="QR code: ${escapeHtml(label)} with 123go.taxi">`,
  ].join('\n');
}

export interface BusinessPanel {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
  /** Call when the QR's place changes (null: no place yet). */
  update(journey: Journey | null): void;
}

export function businessPanel(publicUrl: () => string): BusinessPanel {
  let journey: Journey | null = null;
  let version = 0;
  const toggle = h('button', { type: 'button', class: 'text-link', 'aria-expanded': 'false', 'aria-controls': 'business' }, 'Put it on your website');
  const nameInput = h('input', {
    id: 'public-name',
    type: 'text',
    maxlength: '60',
    autocomplete: 'organization',
    placeholder: 'e.g. Pandeli Restaurant',
  });
  const preview = h('a', { class: 'business-button', href: '#', target: '_blank', rel: 'noopener' });
  const qr = h('img', { class: 'business-qr', alt: '', width: '180', height: '180' });
  const code = h('textarea', { id: 'business-code', class: 'business-code', rows: '4', readonly: true, spellcheck: 'false' });
  const copy = h('button', { type: 'button', class: 'go' }, 'Copy the code');
  const download = h('a', { class: 'text-link', href: '#', download: '123go-qr.png' }, 'Download the QR');
  const panel = h(
    'div',
    { class: 'business', id: 'business', hidden: true },
    h('label', { for: 'public-name' }, 'Your place’s name ', h('span', { class: 'optional' }, '(shown to guests and drivers)')),
    nameInput,
    h('div', { class: 'business-preview' }, preview, qr),
    h('label', { for: 'business-code' }, 'Paste this on your Contact or Getting here page'),
    code,
    h('div', { class: 'actions' }, copy, h('span', { class: 'more' }, download)),
    h('p', { class: 'hint' }, 'On a phone, guests tap the button; on a computer, they scan the QR. Either way it lands in their places, ready for the driver.'),
  );

  async function refresh(): Promise<void> {
    if (!journey || panel.hidden) return;
    const mine = ++version;
    const name = nameInput.value.trim();
    const url = buildJourneyUrl(publicUrl(), { ...journey, label: name || undefined });
    const image = await qrDataUrl(url);
    if (mine !== version) return;
    preview.href = url;
    preview.textContent = `🚕 ${name ? `Get to ${name} by taxi` : 'Get here by taxi'}`;
    qr.src = image;
    download.href = image;
    code.value = websiteSnippet(url, name, image);
    copy.textContent = 'Copy the code';
  }

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    void refresh();
  });
  nameInput.addEventListener('input', () => void refresh());
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      copy.textContent = 'Copied';
    } catch {
      code.select();
      copy.textContent = 'Select all and copy';
    }
  });

  return {
    toggle,
    panel,
    update(next) {
      journey = next;
      toggle.disabled = !next;
      if (!next) panel.hidden = true;
      void refresh();
    },
  };
}

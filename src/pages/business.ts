// "Put it on your website": for restaurants, hotels and other places. The
// place gives its public name (it goes into the QR, so guests and drivers see
// it) and gets one card, "Reach us with 123go.taxi" over the QR, to paste into
// its website, in the language of its guests.

import { buildJourneyUrl, type Journey } from '../destination-url';
import { h } from '../dom';
import { language, LANGUAGES, t } from '../i18n';
import { qrDataUrl } from '../qr';

/** The card's words, per language: what it says, and the QR's description for screen readers. */
export const CARD_LANGUAGES = {
  en: { text: 'Reach us with 123go.taxi', alt: 'QR code: reach us with 123go.taxi' },
  fr: { text: 'Rejoignez-nous avec 123go.taxi', alt: 'Code QR : rejoignez-nous avec 123go.taxi' },
  tr: { text: '123go.taxi ile bize ulaşın', alt: 'QR kod: 123go.taxi ile bize ulaşın' },
  de: { text: 'Mit 123go.taxi zu uns', alt: 'QR-Code: mit 123go.taxi zu uns' },
  es: { text: 'Llega hasta nosotros con 123go.taxi', alt: 'Código QR: llega hasta nosotros con 123go.taxi' },
  ru: { text: 'Доберитесь до нас с 123go.taxi', alt: 'QR-код: доберитесь до нас с 123go.taxi' },
} as const;
export type CardLanguage = keyof typeof CARD_LANGUAGES;

const CARD_STYLE = [
  'display:inline-flex',
  'flex-direction:column',
  'align-items:center',
  'gap:12px',
  'max-width:220px',
  'padding:16px',
  'border-radius:18px',
  'background:#141414',
  'color:#ffc61a',
  'font:700 16px/1.25 system-ui,-apple-system,sans-serif',
  'text-align:center',
  'text-decoration:none',
].join(';');
const QR_STYLE = 'display:block;width:180px;height:180px;border-radius:8px;background:#fff';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The code a website pastes: one card, the words over the QR, the whole card a link (for phones). */
export function websiteSnippet(url: string, qr: string, language: CardLanguage = 'en'): string {
  const words = CARD_LANGUAGES[language];
  return [
    `<!-- 123go.taxi -->`,
    `<a href="${escapeHtml(url)}" style="${CARD_STYLE}" lang="${language}">`,
    `  <span>${escapeHtml(words.text)}</span>`,
    `  <img src="${qr}" width="180" height="180" alt="${escapeHtml(words.alt)}" style="${QR_STYLE}">`,
    `</a>`,
  ].join('\n');
}

export interface BusinessPanel {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
  /** Call when the QR's place changes (null: no place yet). */
  update(journey: Journey | null): void;
}

/**
 * `suggestedName`: the place's name when the page already knows it (typed in
 * Name, or carried by the link or the search). It fills the public name until
 * the user types their own.
 */
export function businessPanel(publicUrl: () => string, suggestedName: () => string): BusinessPanel {
  let journey: Journey | null = null;
  let version = 0;
  const toggle = h(
    'button',
    { type: 'button', class: 'text-link', 'aria-expanded': 'false', 'aria-controls': 'business' },
    t.putOnWebsite,
  );
  let nameTyped = false;
  const nameInput = h('input', {
    id: 'public-name',
    type: 'text',
    maxlength: '60',
    autocomplete: 'organization',
    placeholder: t.placeNamePlaceholder,
  });
  const languageSelect = h(
    'select',
    { id: 'card-language' },
    ...Object.keys(CARD_LANGUAGES).map((code) =>
      h('option', { value: code, selected: code === language }, LANGUAGES[code as CardLanguage]),
    ),
  );
  const cardText = h('span', {});
  const cardQr = h('img', { alt: '', width: '180', height: '180' });
  const card = h('a', { class: 'business-card', href: '#', target: '_blank', rel: 'noopener' }, cardText, cardQr);
  const code = h('textarea', { id: 'business-code', class: 'business-code', rows: '4', readonly: true, spellcheck: 'false' });
  const copy = h('button', { type: 'button', class: 'go' }, t.copyCode);
  const download = h('a', { class: 'text-link', href: '#', download: '123go-qr.png' }, t.downloadQr);
  const panel = h(
    'div',
    { class: 'business', id: 'business', hidden: true },
    h('label', { for: 'public-name' }, t.placeName, h('span', { class: 'optional' }, t.placeNameNote)),
    nameInput,
    h('label', { for: 'card-language' }, t.cardLanguage),
    languageSelect,
    h('div', { class: 'business-preview' }, card),
    h('label', { for: 'business-code' }, t.pasteThis),
    code,
    h('div', { class: 'actions' }, copy, h('span', { class: 'more' }, download)),
    h('p', { class: 'hint' }, t.businessHint),
    h('a', { class: 'text-link', href: `${import.meta.env.BASE_URL}onmysite/` }, `${t.placesPage} →`),
  );

  async function refresh(): Promise<void> {
    if (!journey || panel.hidden) return;
    if (!nameTyped) nameInput.value = suggestedName();
    const mine = ++version;
    const language = languageSelect.value as CardLanguage;
    const url = buildJourneyUrl(publicUrl(), { ...journey, label: nameInput.value.trim() || undefined });
    const image = await qrDataUrl(url);
    if (mine !== version) return;
    card.href = url;
    card.lang = language;
    cardText.textContent = CARD_LANGUAGES[language].text;
    cardQr.src = image;
    cardQr.alt = CARD_LANGUAGES[language].alt;
    download.href = image;
    code.value = websiteSnippet(url, image, language);
    copy.textContent = t.copyCode;
  }

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    void refresh();
  });
  nameInput.addEventListener('input', () => {
    nameTyped = nameInput.value.trim() !== '';
    void refresh();
  });
  languageSelect.addEventListener('change', () => void refresh());
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      copy.textContent = t.copied;
    } catch {
      code.select();
      copy.textContent = t.selectAndCopy;
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

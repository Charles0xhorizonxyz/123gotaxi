import { publicUrl } from '../config';
import { h } from '../dom';
import {
  buildDestinationHash,
  buildDestinationUrl,
  cleanLabel,
  formatCoord,
  type Destination,
} from '../destination-url';
import { parseLocation } from '../link-parsing';
import { drawQr, pngFileName, qrPngUrl } from '../qr';
import { browserStorage, SavedPlaces, type SavedPlace } from '../saved-places';

const ERRORS = {
  empty: 'Paste a map link or type coordinates first.',
  'short-link':
    "That's a short link, which hides the coordinates. Open it, then copy the long link from your browser's address bar.",
  unrecognised:
    'We couldn\'t find coordinates in that. Try a Google Maps or Yandex link, or coordinates like "41.0342, 28.9844".',
  invalidQr: 'That QR link looks broken. Make a fresh one below.',
} as const;

export function renderCreate(root: HTMLElement, { brokenLink = false } = {}): void {
  const saved = new SavedPlaces(browserStorage());
  let current: Destination | null = null;

  const placeInput = h('input', {
    id: 'place',
    type: 'text',
    inputmode: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Paste a map link, or 41.0342, 28.9844',
    'aria-describedby': 'place-hint',
  });
  const labelInput = h('input', {
    id: 'label',
    type: 'text',
    maxlength: '60',
    autocomplete: 'off',
    placeholder: 'e.g. Home, Office, Mum',
  });
  const error = h('p', { class: 'error', role: 'alert', hidden: !brokenLink });
  if (brokenLink) error.textContent = ERRORS.invalidQr;

  const qrCanvas = h('canvas', { class: 'qr', role: 'img', 'aria-label': 'QR code for this destination' });
  const resultTitle = h('h2', { class: 'result-title' });
  const resultCoords = h('p', { class: 'coords' });
  const saveButton = h('button', { type: 'button', class: 'secondary' }, 'Save on this device');
  const downloadLink = h('a', { class: 'button secondary', href: '#', download: 'gogogo.png' }, 'Download PNG');
  const copyButton = h('button', { type: 'button', class: 'secondary' }, 'Copy link');
  const previewLink = h('a', { class: 'button secondary', href: '#' }, 'See what the driver sees');
  const result = h(
    'section',
    { class: 'result', hidden: true, 'aria-live': 'polite' },
    qrCanvas,
    resultTitle,
    resultCoords,
    h(
      'p',
      { class: 'privacy' },
      'Anyone who scans this sees this exact spot. For a home address, consider pinning the corner instead.',
    ),
    h('div', { class: 'actions' }, saveButton, downloadLink, copyButton, previewLink),
  );

  const savedList = h('ul', { class: 'saved-list' });
  const savedSection = h(
    'section',
    { class: 'saved', hidden: true },
    h('h2', {}, 'Saved on this device'),
    h(
      'p',
      { class: 'hint' },
      'Kept only in this browser. Never sent anywhere, so nobody else can see them, not even us.',
    ),
    savedList,
  );

  async function show(destination: Destination): Promise<void> {
    current = destination;
    const url = buildDestinationUrl(publicUrl(), destination);
    await drawQr(qrCanvas, url);
    resultTitle.textContent = destination.label ?? 'Your destination';
    resultCoords.textContent = `${formatCoord(destination.lat)}, ${formatCoord(destination.lon)}`;
    previewLink.href = buildDestinationHash(destination);
    downloadLink.download = pngFileName(destination.label);
    saveButton.textContent = 'Save on this device';
    saveButton.disabled = !saved.available;
    copyButton.textContent = 'Copy link';
    result.hidden = false;
    error.hidden = true;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function submit(): void {
    const parsed = parseLocation(placeInput.value);
    if (!parsed.ok) {
      error.textContent = ERRORS[parsed.reason];
      error.hidden = false;
      result.hidden = true;
      return;
    }
    const label = cleanLabel(labelInput.value) ?? parsed.destination.label;
    if (label && !labelInput.value) labelInput.value = label;
    void show({ ...parsed.destination, label });
  }

  function renderSaved(): void {
    const places = saved.list();
    savedSection.hidden = places.length === 0;
    savedList.replaceChildren(...places.map(savedItem));
  }

  function savedItem(place: SavedPlace): HTMLLIElement {
    const name = place.label ?? `${formatCoord(place.lat)}, ${formatCoord(place.lon)}`;
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: 'saved-open',
          onclick: () => {
            placeInput.value = `${formatCoord(place.lat)}, ${formatCoord(place.lon)}`;
            labelInput.value = place.label ?? '';
            void show(place);
          },
        },
        h('span', { class: 'saved-name' }, name),
        place.label ? h('span', { class: 'coords' }, `${formatCoord(place.lat)}, ${formatCoord(place.lon)}`) : null,
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'saved-delete',
          'aria-label': `Delete ${name}`,
          onclick: () => {
            saved.remove(place.id);
            renderSaved();
          },
        },
        '×',
      ),
    );
  }

  saveButton.addEventListener('click', () => {
    if (!current) return;
    saved.add(current);
    saveButton.textContent = 'Saved';
    renderSaved();
  });

  copyButton.addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(buildDestinationUrl(publicUrl(), current));
      copyButton.textContent = 'Copied';
    } catch {
      copyButton.textContent = 'Copy failed';
    }
  });

  // Build the big PNG only when asked, so the page stays fast.
  downloadLink.addEventListener('click', async (event) => {
    if (!current || downloadLink.dataset.ready) {
      delete downloadLink.dataset.ready;
      return;
    }
    event.preventDefault();
    const url = await qrPngUrl(buildDestinationUrl(publicUrl(), current));
    downloadLink.href = url;
    downloadLink.dataset.ready = '1';
    downloadLink.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadLink.href = '#';
    }, 1000);
  });

  const form = h(
    'form',
    {
      class: 'place-form',
      onsubmit: (event: Event) => {
        event.preventDefault();
        submit();
      },
    },
    h('label', { for: 'place' }, 'Where to?'),
    placeInput,
    h('p', { id: 'place-hint', class: 'hint' }, 'Google Maps, Yandex, Apple Maps or OpenStreetMap links all work.'),
    h('label', { for: 'label' }, 'Name on the card ', h('span', { class: 'optional' }, '(optional)')),
    labelInput,
    error,
    h('button', { type: 'submit', class: 'primary' }, 'Make my QR'),
  );

  // Pasting is the whole job for most people: make the QR straight away.
  placeInput.addEventListener('paste', () => setTimeout(submit, 0));

  root.replaceChildren(
    h(
      'header',
      { class: 'masthead' },
      h('h1', { class: 'wordmark' }, 'gogogo.rodeo'),
      h('p', { class: 'tagline' }, 'Paste a place. Show the QR. The driver picks their app.'),
    ),
    form,
    result,
    savedSection,
    h('footer', {}, 'For a smooth ride — or it might get rocky, but at least it started smoothly.'),
  );
  renderSaved();
}

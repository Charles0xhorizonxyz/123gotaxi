import { publicUrl } from '../config';
import { h } from '../dom';
import {
  buildJourneyHash,
  buildJourneyUrl,
  cleanLabel,
  formatPoint,
  type Journey,
  type Point,
} from '../destination-url';
import { parseLocation } from '../link-parsing';
import { drawQr, pngFileName, qrPngUrl } from '../qr';
import { browserStorage, SavedPlaces, type SavedPlace } from '../saved-places';
import { creditFooter, SHARE_RESULT_TEXT, shareLink } from './common';
import { createStopsEditor } from './stops-editor';

const ERRORS = {
  empty: 'Paste a map link or type coordinates first.',
  'short-link':
    'That link threw its rider. Short links hide the location: open it, then copy the long link from the address bar.',
  unrecognised:
    'We couldn\'t find coordinates in that. Try a Google Maps or Yandex link, or coordinates like "41.0342, 28.9844".',
  invalidQr: 'That QR link looks broken. Make a fresh one below.',
} as const;

export function renderCreate(root: HTMLElement, { brokenLink = false } = {}): void {
  const saved = new SavedPlaces(browserStorage());
  let current: Journey | null = null;

  const stops = createStopsEditor({ onPaste: () => submit({ quiet: true }) });
  const nameInput = h('input', {
    id: 'name',
    type: 'text',
    maxlength: '60',
    autocomplete: 'off',
    placeholder: 'e.g. Home, Office, Mum',
  });
  const noteInput = h('textarea', {
    id: 'note',
    rows: '2',
    maxlength: '200',
    placeholder: 'e.g. Blue door, ring twice',
  });
  const error = h('p', { class: 'error', role: 'alert', hidden: !brokenLink });
  if (brokenLink) error.textContent = ERRORS.invalidQr;

  // Result card
  const qrCanvas = h('canvas', { class: 'qr', role: 'img', 'aria-label': 'QR code for this journey' });
  const resultTitle = h('h2', { class: 'result-title' });
  const resultStops = h('p', { class: 'coords' });
  const saveMessage = h('p', { class: 'error', role: 'status', hidden: true });
  const saveButton = h('button', { type: 'button', class: 'go' }, 'Save');
  const shareButton = h('button', { type: 'button' }, 'Share');
  const downloadLink = h('a', { class: 'text-link', href: '#', download: 'gogogo.png' }, 'Download PNG');
  const previewLink = h('a', { class: 'text-link', href: '#' }, 'See what the driver sees');
  const result = h(
    'section',
    { class: 'result', hidden: true, 'aria-live': 'polite' },
    qrCanvas,
    resultTitle,
    resultStops,
    h(
      'p',
      { class: 'privacy' },
      'Anyone who scans this sees these exact spots. For a home address, consider pinning the corner instead.',
    ),
    saveMessage,
    h('div', { class: 'actions' }, saveButton, shareButton),
    h('div', { class: 'more' }, downloadLink, previewLink),
  );

  // Saved places ("corral")
  const savedList = h('ul', { class: 'saved-list' });
  const emptyNote = h('p', { class: 'hint' }, 'Nothing saved yet. Make a QR, give it a name and tap Save.');
  const importInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'import-file' });
  const exportLink = h('a', { class: 'text-link', href: '#', download: 'gogogo-places.json' }, 'Export list');
  const importLabel = h('label', { for: 'import-file', class: 'text-link' }, 'Import list');
  const corralMessage = h('p', { class: 'hint', role: 'status' });
  const savedSection = h(
    'section',
    { class: 'saved' },
    h('h2', {}, 'Your corral'),
    h('p', { class: 'hint' }, 'Kept only in this browser. Only you can see it.'),
    emptyNote,
    savedList,
    h('div', { class: 'more' }, exportLink, importLabel, importInput),
    corralMessage,
  );
  if (!saved.available) {
    savedSection.replaceChildren(
      h('h2', {}, 'Your corral'),
      h('p', { class: 'hint' }, "This browser doesn't allow saving (private mode?)."),
    );
  }

  async function show(journey: Journey): Promise<void> {
    current = journey;
    const url = buildJourneyUrl(publicUrl(), journey);
    await drawQr(qrCanvas, url);
    resultTitle.textContent = journey.label ?? (journey.stops.length > 1 ? 'Your route' : 'Your destination');
    resultStops.textContent =
      journey.stops.length > 1
        ? `${journey.stops.length} stops`
        : formatPoint(journey.stops[0]!).replace(',', ', ');
    previewLink.href = buildJourneyHash(journey);
    downloadLink.download = pngFileName(journey.label);
    saveButton.textContent = 'Save';
    shareButton.textContent = 'Share';
    saveMessage.hidden = true;
    result.hidden = false;
    error.hidden = true;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** quiet: called on paste, so stay silent if other stops still need filling in. */
  function submit({ quiet = false } = {}): void {
    const filled = stops.values().map((v, i) => ({ text: v, number: i + 1 })).filter((v) => v.text.trim());
    if (filled.length === 0) {
      if (!quiet) showError(ERRORS.empty);
      return;
    }
    const points: Point[] = [];
    let foundLabel: string | undefined;
    for (const { text, number } of filled) {
      const parsed = parseLocation(text);
      if (!parsed.ok) {
        if (!quiet || filled.length === 1) {
          showError(filled.length > 1 ? `Stop ${number}: ${ERRORS[parsed.reason]}` : ERRORS[parsed.reason]);
        }
        return;
      }
      points.push({ lat: parsed.place.lat, lon: parsed.place.lon });
      foundLabel = parsed.place.label ?? foundLabel;
    }
    if (!nameInput.value.trim() && foundLabel && points.length === 1) nameInput.value = foundLabel;
    void show({ stops: points, label: cleanLabel(nameInput.value) });
  }

  function showError(message: string): void {
    error.textContent = message;
    error.hidden = false;
    result.hidden = true;
  }

  function renderSaved(): void {
    if (!saved.available) return;
    const places = saved.list();
    emptyNote.hidden = places.length > 0;
    exportLink.hidden = places.length === 0;
    savedList.replaceChildren(...places.map(savedItem));
  }

  function savedItem(place: SavedPlace): HTMLLIElement {
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: 'saved-open',
          onclick: () => {
            stops.setValues(place.stops.map((p) => formatPoint(p).replace(',', ', ')));
            nameInput.value = place.name;
            noteInput.value = place.note ?? '';
            void show({ stops: place.stops, label: place.name });
          },
        },
        h(
          'span',
          { class: 'saved-name' },
          place.name,
          place.stops.length > 1 ? h('span', { class: 'chip' }, `${place.stops.length} stops`) : null,
        ),
        place.note ? h('span', { class: 'saved-note' }, place.note) : null,
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'saved-delete',
          'aria-label': `Delete ${place.name}`,
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
    if (!saved.available) {
      saveMessage.textContent = "This browser doesn't allow saving.";
      saveMessage.hidden = false;
      return;
    }
    const name = cleanLabel(nameInput.value);
    if (!name) {
      saveMessage.textContent = 'Add a name above to save it.';
      saveMessage.hidden = false;
      nameInput.focus();
      return;
    }
    saved.add({ ...current, name, note: noteInput.value });
    // The name may have been added after the QR was made: keep both in step.
    if (name !== current.label) void show({ ...current, label: name });
    saveButton.textContent = 'Saved';
    renderSaved();
  });

  shareButton.addEventListener('click', async () => {
    if (!current) return;
    const outcome = await shareLink(
      buildJourneyUrl(publicUrl(), current),
      current.label ? `Take me to ${current.label}` : 'gogogo.rodeo',
    );
    shareButton.textContent = SHARE_RESULT_TEXT[outcome];
  });

  // Build the big PNG only when asked, so the page stays fast.
  downloadLink.addEventListener('click', async (event) => {
    if (!current || downloadLink.dataset.ready) {
      delete downloadLink.dataset.ready;
      return;
    }
    event.preventDefault();
    const url = await qrPngUrl(buildJourneyUrl(publicUrl(), current));
    downloadLink.href = url;
    downloadLink.dataset.ready = '1';
    downloadLink.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadLink.href = '#';
    }, 1000);
  });

  exportLink.addEventListener('click', (event) => {
    if (exportLink.dataset.ready) {
      delete exportLink.dataset.ready;
      return;
    }
    event.preventDefault();
    const url = URL.createObjectURL(new Blob([saved.exportJson()], { type: 'application/json' }));
    exportLink.href = url;
    exportLink.dataset.ready = '1';
    exportLink.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      exportLink.href = '#';
    }, 1000);
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    try {
      const added = saved.importJson(await file.text());
      corralMessage.textContent =
        added === 0 ? 'Nothing new in that file.' : `Added ${added} place${added === 1 ? '' : 's'}.`;
      renderSaved();
    } catch {
      corralMessage.textContent = "That file isn't a gogogo.rodeo export.";
    }
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
    h('p', { class: 'field-label' }, 'Where to?'),
    stops.element,
    h('p', { id: 'place-hint', class: 'hint' }, 'Google Maps, Yandex, Apple Maps or OpenStreetMap links all work.'),
    h('label', { for: 'name' }, 'Name ', h('span', { class: 'optional' }, '(shown to the driver)')),
    nameInput,
    h('label', { for: 'note' }, 'Note ', h('span', { class: 'optional' }, '(optional, only for you)')),
    noteInput,
    error,
    h('button', { type: 'submit', class: 'primary' }, 'Make my QR'),
  );

  root.replaceChildren(
    h(
      'header',
      { class: 'masthead' },
      h(
        'h1',
        { class: 'wordmark' },
        h('img', { src: `${import.meta.env.BASE_URL}logo.svg`, alt: '', width: '56', height: '58' }),
        'gogogo.rodeo',
      ),
      h('p', { class: 'tagline' }, 'Hold on to your hat. Paste a place, get a QR, share it easily.'),
    ),
    form,
    result,
    savedSection,
    creditFooter(),
  );
  renderSaved();
}

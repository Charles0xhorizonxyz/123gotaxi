import { publicUrl } from '../config';
import { h } from '../dom';
import { buildJourneyHash, buildJourneyUrl, formatPoint, type Journey, type Point } from '../destination-url';
import { parseLocation } from '../link-parsing';
import { drawQr, pngFileName, qrPngUrl } from '../qr';
import { browserStorage, SavedPlaces, type SavedPlace } from '../saved-places';
import { creditFooter, SHARE_RESULT_TEXT, shareLink } from './common';
import { createStopsEditor, type StopsChange } from './stops-editor';

const ERRORS = {
  empty: 'Paste a map link or type coordinates first.',
  'short-link':
    'That link threw its rider. Short links hide the location: open it, then copy the long link from the address bar.',
  unrecognised:
    'We couldn\'t find coordinates in that. Try a Google Maps or Yandex link, or coordinates like "41.0342, 28.9844".',
  invalidQr: 'That QR link looks broken. Make a fresh one below.',
} as const;

/** Three QR corner squares, drawn faintly: the "empty QR" placeholder. Static markup, no user data. */
const EMPTY_QR_SVG = `<svg viewBox="0 0 29 29" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1">
  <rect x="1.5" y="1.5" width="6" height="6"/><rect x="3.5" y="3.5" width="2" height="2" fill="currentColor"/>
  <rect x="21.5" y="1.5" width="6" height="6"/><rect x="23.5" y="3.5" width="2" height="2" fill="currentColor"/>
  <rect x="1.5" y="21.5" width="6" height="6"/><rect x="3.5" y="23.5" width="2" height="2" fill="currentColor"/>
</svg>`;

/** Wait this long after the last keystroke before trying typed text. */
const TYPING_DELAY_MS = 500;

const pretty = (p: Point) => formatPoint(p).replace(',', ', ');

/** What a saved place is called in the list when it has no name. */
function fallbackName(place: SavedPlace): string {
  const end = place.stops[place.stops.length - 1]!;
  return place.stops.length > 1 ? `Route to ${pretty(end)}` : pretty(end);
}

export function renderCreate(root: HTMLElement, { brokenLink = false } = {}): void {
  const saved = new SavedPlaces(browserStorage());
  // The QR only carries the stops. Name and note stay on this device.
  let current: Journey | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | undefined;

  const stops = createStopsEditor({ onChange });
  const error = h('p', { class: 'error', role: 'alert', hidden: !brokenLink });
  if (brokenLink) error.textContent = ERRORS.invalidQr;

  // Result card: QR, then what you'd want to keep it under, then actions.
  const qrCanvas = h('canvas', { class: 'qr', role: 'img', 'aria-label': 'QR code for this journey' });
  const resultStops = h('p', { class: 'coords' });
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
  const saveMessage = h('p', { class: 'error', role: 'status', hidden: true });
  const saveButton = h('button', { type: 'button', class: 'go' }, 'Save');
  const shareButton = h('button', { type: 'button' }, 'Share');
  const downloadLink = h('a', { class: 'text-link', href: '#', download: '123go.png' }, 'Download PNG');
  const previewLink = h('a', { class: 'text-link', href: '#' }, 'See what the driver sees');
  // Shown until there's a place: a faded QR outline, so the page explains itself.
  const qrEmpty = h('div', { class: 'qr-empty', role: 'img', 'aria-label': 'Your QR appears here' });
  qrEmpty.innerHTML = EMPTY_QR_SVG;
  qrEmpty.append(h('span', {}, 'Your QR appears here'));
  qrCanvas.hidden = true;
  // Everything you can do with a QR, hidden while there isn't one.
  const resultDetails = h(
    'div',
    { class: 'result-details', hidden: true },
    resultStops,
    h(
      'div',
      { class: 'keep-fields' },
      h('label', { for: 'name' }, 'Name ', h('span', { class: 'optional' }, '(optional, only for you)')),
      nameInput,
      h('label', { for: 'note' }, 'Note ', h('span', { class: 'optional' }, '(optional, only for you)')),
      noteInput,
    ),
    saveMessage,
    h('div', { class: 'actions' }, saveButton, shareButton),
    h('div', { class: 'more' }, downloadLink, previewLink),
  );
  const result = h('section', { class: 'result', 'aria-live': 'polite' }, qrEmpty, qrCanvas, resultDetails);
  nameInput.addEventListener('input', resetSaveButton);
  noteInput.addEventListener('input', resetSaveButton);

  // Saved places ("corral")
  const savedList = h('ul', { class: 'saved-list' });
  const emptyNote = h('p', { class: 'hint' }, 'Nothing saved yet. Paste a place and tap Save.');
  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    id: 'import-file',
  });
  const exportLink = h('a', { class: 'text-link', href: '#', download: '123go-places.json' }, 'Export list');
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

  function resetSaveButton(): void {
    saveButton.textContent = 'Save';
    saveMessage.hidden = true;
  }

  /**
   * reveal: bring the QR into view. Only after a paste, Enter or picking a saved
   * place, never while typing. It jumps instead of gliding, so a quick tap on
   * Save can't land while the page is still moving.
   */
  async function show(journey: Journey, { reveal = false } = {}): Promise<void> {
    const changed = !current || buildJourneyHash(current) !== buildJourneyHash(journey);
    current = journey;
    if (changed) {
      await drawQr(qrCanvas, buildJourneyUrl(publicUrl(), journey));
      resetSaveButton();
      shareButton.textContent = 'Share';
    }
    resultStops.textContent =
      journey.stops.length > 1 ? `${journey.stops.length} stops` : pretty(journey.stops[0]!);
    previewLink.href = buildJourneyHash(journey);
    error.hidden = true;
    qrEmpty.hidden = true;
    qrCanvas.hidden = false;
    resultDetails.hidden = false;
    if (reveal) result.scrollIntoView({ block: 'nearest' });
  }

  function hideResult(): void {
    current = null;
    qrEmpty.hidden = false;
    qrCanvas.hidden = true;
    resultDetails.hidden = true;
  }

  function onChange(change: StopsChange): void {
    clearTimeout(typingTimer);
    if (change === 'typing') typingTimer = setTimeout(() => update(false), TYPING_DELAY_MS);
    else update(change === 'commit' || change === 'leave', change === 'commit');
  }

  /** Read the stops and show the QR. Only explain problems when `explain` is set. */
  function update(explain: boolean, reveal = false): void {
    const filled = stops
      .values()
      .map((text, i) => ({ text, number: i + 1 }))
      .filter((v) => v.text.trim());
    if (filled.length === 0) {
      hideResult();
      error.hidden = true;
      return;
    }
    const points: Point[] = [];
    let foundLabel: string | undefined;
    for (const { text, number } of filled) {
      const parsed = parseLocation(text);
      if (!parsed.ok) {
        hideResult();
        if (explain) {
          error.textContent =
            filled.length > 1 ? `Stop ${number}: ${ERRORS[parsed.reason]}` : ERRORS[parsed.reason];
          error.hidden = false;
        }
        return;
      }
      points.push({ lat: parsed.place.lat, lon: parsed.place.lon });
      foundLabel = parsed.place.label ?? foundLabel;
    }
    // A pasted place link often carries the place's name: offer it as the name to save under.
    if (!nameInput.value.trim() && foundLabel && points.length === 1) nameInput.value = foundLabel;
    void show({ stops: points }, { reveal });
  }

  function renderSaved(): void {
    if (!saved.available) return;
    const places = saved.list();
    emptyNote.hidden = places.length > 0;
    exportLink.hidden = places.length === 0;
    savedList.replaceChildren(...places.map(savedItem));
  }

  function savedItem(place: SavedPlace): HTMLLIElement {
    const title = place.name ?? fallbackName(place);
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: 'saved-open',
          onclick: () => {
            stops.setValues(place.stops.map(pretty));
            nameInput.value = place.name ?? '';
            noteInput.value = place.note ?? '';
            void show({ stops: place.stops }, { reveal: true });
          },
        },
        h(
          'span',
          { class: 'saved-name' },
          title,
          place.stops.length > 1 ? h('span', { class: 'chip' }, `${place.stops.length} stops`) : null,
        ),
        place.note ? h('span', { class: 'saved-note' }, place.note) : null,
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'saved-delete',
          'aria-label': `Delete ${title}`,
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
    saved.add({ ...current, name: nameInput.value, note: noteInput.value });
    saveButton.textContent = 'Saved';
    renderSaved();
  });

  shareButton.addEventListener('click', async () => {
    if (!current) return;
    const outcome = await shareLink(buildJourneyUrl(publicUrl(), current), '123go.taxi');
    shareButton.textContent = SHARE_RESULT_TEXT[outcome];
  });

  // Build the big PNG only when asked, so the page stays fast.
  downloadLink.addEventListener('click', async (event) => {
    if (!current || downloadLink.dataset.ready) {
      delete downloadLink.dataset.ready;
      return;
    }
    event.preventDefault();
    downloadLink.download = pngFileName(nameInput.value);
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
      corralMessage.textContent = "That file isn't a 123go.taxi export.";
    }
  });

  root.replaceChildren(
    h(
      'header',
      { class: 'masthead' },
      h(
        'h1',
        { class: 'wordmark' },
        h('img', { src: `${import.meta.env.BASE_URL}logo.svg`, alt: '', width: '56', height: '58' }),
        '123go.taxi',
      ),
      h('p', { class: 'tagline' }, 'Hold on to your hat. Paste a place, get a QR, share it easily.'),
    ),
    h('div', { class: 'place-form' }, h('p', { class: 'field-label' }, 'Where to?'), stops.element, error),
    result,
    savedSection,
    creditFooter(),
  );
  renderSaved();
}

import { EXPANDER_URL, GEOAPIFY_KEY, GEOAPIFY_URL, PHOTON_URL, publicUrl } from '../config';
import { h } from '../dom';
import {
  buildJourneyHash,
  buildJourneyUrl,
  finalStop,
  formatPoint,
  type Journey,
  parseJourney,
  type Point,
} from '../destination-url';
import { geoapifyGeocoder, photonGeocoder, withBackup, type Suggestion } from '../geocoding';
import { parseLocation, type ParseResult } from '../link-parsing';
import { expandShortLink } from '../link-parsing/expand';
import { drawQr, pngFileName, qrPngUrl } from '../qr';
import { detectPlatform } from '../navigation-links';
import { browserStorage, SavedPlaces, type SavedPlace } from '../saved-places';
import { creditFooter, sectionHead, SHARE_RESULT_TEXT, shareLink } from './common';
import { businessPanel } from './business';
import { cornerButtons, isInstalled } from './install';
import { scanButton, type ScanOutcome } from './scanner';
import { navAppSettings } from './settings';
import { createStopsEditor, type StopsChange } from './stops-editor';

const ERRORS = {
  empty: 'Paste a map link or type coordinates first.',
  'short-link':
    'That link threw its rider. Short links hide the location: open it, then copy the long link from the address bar.',
  unrecognised:
    'We couldn\'t find that place. Pick one from the list, paste a map link, or type coordinates like "29.979235, 31.134202".',
  invalidQr: 'That QR link looks broken. Make a fresh one below.',
} as const;

/** Three QR corner squares, drawn faintly: the "empty QR" placeholder. Static markup, no user data. */
const EMPTY_QR_SVG = `<svg viewBox="0 0 29 29" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1">
  <rect x="1.5" y="1.5" width="6" height="6"/><rect x="3.5" y="3.5" width="2" height="2" fill="currentColor"/>
  <rect x="21.5" y="1.5" width="6" height="6"/><rect x="23.5" y="3.5" width="2" height="2" fill="currentColor"/>
  <rect x="1.5" y="21.5" width="6" height="6"/><rect x="3.5" y="23.5" width="2" height="2" fill="currentColor"/>
</svg>`;

/** Wait this long after the last keystroke before trying typed text. */
const TYPING_DELAY_MS = 300;

const pretty = (p: Point) => formatPoint(p).replace(',', ', ');

/** Identifies the stops alone, ignoring name and address. */
const stopsKey = (journey: Journey) => journey.stops.map(formatPoint).join('~');

/** What a saved place is called in the list when it has no name: its address, else its coordinates. */
function fallbackName(place: SavedPlace): string {
  const end = place.address ?? pretty(place.stops[place.stops.length - 1]!);
  return place.stops.length > 1 ? `Route to ${end}` : end;
}

/** "Where to?" explained in plain words: three ways to say where you're going. */
function whereHelp(): HTMLElement {
  return h(
    'div',
    {},
    h('p', {}, h('strong', {}, 'Three ways to say where you’re going:')),
    h(
      'ul',
      {},
      h('li', {}, h('strong', {}, 'Type an address'), ' or the name of a place, then tap it in the list.'),
      h(
        'li',
        {},
        h('strong', {}, 'From a map app'),
        ' (Google Maps, Yandex, Waze…): open the place, tap ',
        h('em', {}, 'Share'),
        ', then ',
        h('em', {}, 'Copy'),
        ', and paste it here.',
      ),
      h('li', {}, h('strong', {}, 'Type coordinates'), ', like 29.979235, 31.134202.'),
    ),
    h('p', {}, 'Going to several places? Tap ', h('em', {}, '+ Add a stop'), '.'),
  );
}

export function renderCreate(
  root: HTMLElement,
  {
    brokenLink = false,
    openScanned,
    openNavigation,
  }: {
    brokenLink?: boolean;
    /** A scanned 123go.taxi QR: show its driver screen, as if scanned with the camera app. */
    openScanned?: (hash: string) => void;
    /** "Open in navigation": the driver screen, opening this phone's chosen app straight away. */
    openNavigation?: (hash: string) => void;
  } = {},
): void {
  const saved = new SavedPlaces(browserStorage());
  const geocoder = GEOAPIFY_KEY
    ? withBackup(geoapifyGeocoder(GEOAPIFY_URL, GEOAPIFY_KEY), photonGeocoder(PHOTON_URL))
    : photonGeocoder(PHOTON_URL);
  let addressLookup: AbortController | undefined;
  // The QR only carries the stops. Name and note stay on this device.
  let current: Journey | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | undefined;

  const stops = createStopsEditor({ onChange });
  const error = h('p', { class: 'error', role: 'alert', hidden: !brokenLink });
  const notice = h('p', { class: 'hint', role: 'status', hidden: true });
  // Typed words: places found, under "Where to?". Only a place picked here makes a QR.
  const suggestions = h('ul', { class: 'suggestions', 'aria-label': 'Places found', hidden: true });
  let searching: AbortController | undefined;
  let suggestionsFor = -1;
  // Short links already asked about: the long link, or null if it couldn't be opened.
  const expanded = new Map<string, string | null>();
  const expanding = new Set<string>();
  if (brokenLink) error.textContent = ERRORS.invalidQr;

  // Result card: address, QR, then what you'd want to keep it under, then actions.
  const addressLine = h('p', { class: 'address', hidden: true });
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
  // Your own navigation app, straight away if one is chosen; otherwise the app list.
  const previewLink = h('a', { class: 'text-link', href: '#' }, 'Open in navigation');
  const business = businessPanel(publicUrl);
  // Shown until there's a place: a faded QR outline, so the page explains itself.
  const qrEmpty = h('div', { class: 'qr-empty', role: 'img', 'aria-label': 'Your QR appears here' });
  qrEmpty.innerHTML = EMPTY_QR_SVG;
  qrEmpty.append(h('span', {}, 'Your QR appears here'));
  qrCanvas.hidden = true;
  // Always shown. Name and note can be filled in first; the actions wait for a QR.
  const resultDetails = h(
    'div',
    { class: 'result-details' },
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
    h('div', { class: 'more' }, business.toggle),
    business.panel,
  );
  const result = h(
    'section',
    { class: 'result', 'aria-live': 'polite' },
    addressLine,
    qrEmpty,
    qrCanvas,
    resultDetails,
  );
  nameInput.addEventListener('input', resetSaveButton);
  noteInput.addEventListener('input', resetSaveButton);

  // Saved places
  const savedList = h('ul', { class: 'saved-list' });
  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    id: 'import-file',
  });
  const exportLink = h('a', { class: 'text-link', href: '#', download: '123go-places.json' }, 'Export list');
  const importLabel = h('label', { for: 'import-file', class: 'text-link' }, 'Import list');
  const placesMessage = h('p', { class: 'hint', role: 'status' });
  // Only worth saying once there's something to lose. Installed, the list is
  // kept for good (iPhone's 7-day erasing only applies to Safari itself).
  const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios';
  const lossWarning = isInstalled()
    ? h(
        'p',
        { class: 'hint', hidden: true },
        'Kept on this phone. To move it to another phone, tap Export list.',
      )
    : h(
        'p',
        { class: 'warning', hidden: true },
        h('strong', {}, ios ? 'Safari erases this list after 7 days without a visit. ' : 'This list can disappear. '),
        ios
          ? 'Install 123go.taxi to keep it for good, then use Export list here and Import list in the app to move it there.'
          : 'Clearing your browser data erases it. Install 123go.taxi, or tap Export list to keep a copy.',
      );
  const placesHead = sectionHead(
    'Your places',
    'Kept only in this browser, and only you can see them. Paste a place and tap Save to keep it here.',
  );
  const savedSection = h(
    'section',
    { class: 'saved block' },
    placesHead,
    savedList,
    lossWarning,
    h('div', { class: 'more' }, exportLink, importLabel, importInput),
    placesMessage,
  );
  if (!saved.available) {
    savedSection.replaceChildren(
      placesHead,
      h('p', { class: 'hint' }, "This browser doesn't allow saving (private mode?)."),
    );
  }

  /** Turn the QR actions on or off. They stay visible either way, so the card's layout never jumps. */
  function setReady(ready: boolean): void {
    saveButton.disabled = !ready;
    shareButton.disabled = !ready;
    for (const link of [downloadLink, previewLink]) {
      link.classList.toggle('disabled', !ready);
      if (ready) link.removeAttribute('aria-disabled');
      else link.setAttribute('aria-disabled', 'true');
      link.tabIndex = ready ? 0 : -1;
    }
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
    const sameStops = current !== null && stopsKey(current) === stopsKey(journey);
    // Same stops as before: keep the address we already found.
    if (sameStops && !journey.address && current?.address) journey = { ...journey, address: current.address };
    const changed = !current || buildJourneyHash(current) !== buildJourneyHash(journey);
    current = journey;
    if (!sameStops) lookUpAddress(journey);
    showAddress(journey.address, !sameStops && !journey.address);
    if (changed) {
      await drawQr(qrCanvas, buildJourneyUrl(publicUrl(), journey));
      resetSaveButton();
      shareButton.textContent = 'Share';
    }
    resultStops.textContent =
      journey.stops.length > 1 ? `${journey.stops.length} stops` : pretty(journey.stops[0]!);
    previewLink.href = buildJourneyHash(journey);
    business.update(journey);
    error.hidden = true;
    qrEmpty.hidden = true;
    qrCanvas.hidden = false;
    setReady(true);
    if (reveal) result.scrollIntoView({ block: 'nearest' });
  }

  /** Ask for the final stop's readable address, then redraw the QR with it inside. */
  function lookUpAddress(journey: Journey): void {
    addressLookup?.abort();
    if (journey.address) return;
    const lookup = new AbortController();
    addressLookup = lookup;
    geocoder
      .reverse(finalStop(journey), lookup.signal)
      .then((address) => {
        if (lookup.signal.aborted || !current || stopsKey(current) !== stopsKey(journey)) return;
        if (address) void show({ ...current, address });
        else showAddress(undefined, false);
      })
      .catch(() => {
        if (!lookup.signal.aborted) showAddress(undefined, false);
      });
  }

  function showAddress(address: string | undefined, pending: boolean): void {
    addressLine.hidden = false;
    addressLine.classList.toggle('pending', pending || !address);
    addressLine.textContent = address ?? (pending ? 'Looking up the address…' : 'No street address found for this spot');
  }

  function hideResult(): void {
    addressLookup?.abort();
    addressLine.hidden = true;
    current = null;
    qrEmpty.hidden = false;
    qrCanvas.hidden = true;
    resultStops.textContent = 'No place yet';
    previewLink.href = '#';
    business.update(null);
    resetSaveButton();
    shareButton.textContent = 'Share';
    setReady(false);
  }

  function onChange(change: StopsChange): void {
    clearTimeout(typingTimer);
    if (change === 'typing') {
      typingTimer = setTimeout(() => {
        update(false);
        searchFor(stops.focusedIndex());
      }, TYPING_DELAY_MS);
      return;
    }
    if (change === 'commit') {
      // Enter or a paste of words: show the places found; the user picks one.
      const index = stops.focusedIndex();
      if (searchQuery(stops.values()[index] ?? '')) {
        if (suggestionsFor !== index) searchFor(index);
        return;
      }
    }
    // Leaving the field (often to tap a suggestion) keeps the list open.
    if (change !== 'leave') hideSuggestions();
    update(change === 'commit' || change === 'leave', change === 'commit');
  }

  /**
   * What to search for, or null when the text is already a place (a link we can
   * read, coordinates) or too short. A map link we can't read is never sent:
   * only the place name shared next to it, or written inside it
   * (Yandex: ".../maps/org/galata_kulesi/1087398212").
   */
  function searchQuery(text: string): string | null {
    const t = text.trim();
    const parsed = parseLocation(t);
    if (parsed.ok || parsed.reason !== 'unrecognised') return null;
    let words = t.replace(/https?:\/\/\S+/gi, ' ');
    if (!words.trim()) {
      const slug = /\/org\/([^/?#]+)\/\d+/.exec(t)?.[1];
      words = slug ? safeDecode(slug).replace(/[_-]+/g, ' ') : '';
    }
    const query = words
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(', ')
      .replace(/\s+/g, ' ');
    return query.length >= 3 && !/^[a-z]+:/i.test(query) ? query : null;
  }

  function safeDecode(text: string): string {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  function showSuggestionNote(text: string): void {
    suggestions.replaceChildren(h('li', { class: 'hint' }, text));
    openSuggestions();
  }

  /** Show the list hanging from the stop being typed in, over what's below it. */
  function openSuggestions(): void {
    const input = stops.inputAt(suggestionsFor);
    const form = suggestions.parentElement;
    if (input && form) {
      const box = input.getBoundingClientRect();
      const within = form.getBoundingClientRect();
      suggestions.style.top = `${box.bottom - within.top}px`;
      suggestions.style.left = `${box.left - within.left}px`;
      suggestions.style.width = `${box.width}px`;
    }
    suggestions.hidden = false;
    error.hidden = true;
  }

  function hideSuggestions(): void {
    searching?.abort();
    suggestions.hidden = true;
    suggestions.replaceChildren();
    suggestionsFor = -1;
  }

  function searchFor(index: number): void {
    const query = index < 0 ? null : searchQuery(stops.values()[index] ?? '');
    if (!query) return hideSuggestions();
    searching?.abort();
    const lookup = new AbortController();
    searching = lookup;
    suggestionsFor = index;
    showSuggestionNote('Searching…');
    geocoder
      .search(query, lookup.signal)
      .then((results) => {
        if (lookup.signal.aborted) return;
        suggestionsFor = index;
        suggestions.replaceChildren(
          ...(results.length
            ? results.map((s) =>
                h(
                  'li',
                  {},
                  h(
                    'button',
                    { type: 'button', class: 'suggestion', onclick: () => pick(s) },
                    h('strong', {}, s.name),
                    s.address !== s.name ? h('span', {}, s.address.slice(s.name.length + 2)) : null,
                  ),
                ),
              )
            : [h('li', { class: 'hint' }, 'No place found. Add the town, or paste a map link.')]),
        );
        openSuggestions();
        error.hidden = true;
      })
      .catch(() => {
        // Slow, offline or down: say so. Links and coordinates still work.
        if (!lookup.signal.aborted) showSuggestionNote('Search is slow right now. Try again, or paste a map link.');
      });
  }

  /** A picked place becomes that stop's coordinates; its name fills an empty Name. */
  function pick(s: Suggestion): void {
    const index = suggestionsFor;
    hideSuggestions();
    stops.setValue(index, pretty(s));
    const single = stops.values().filter((v) => v.trim()).length === 1;
    if (single && !nameInput.value.trim()) nameInput.value = s.name;
    update(true, true);
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
    notice.hidden = true;
    for (const { text, number } of filled) {
      let parsed: ParseResult = parseLocation(text);
      if (!parsed.ok && parsed.reason === 'short-link' && EXPANDER_URL) {
        const key = parsed.link;
        if (!expanded.has(key)) {
          openShortLink(key, reveal);
          hideResult();
          error.hidden = true;
          notice.textContent = 'Opening the short link…';
          notice.hidden = false;
          return;
        }
        const long = expanded.get(key);
        // Unreadable even when opened: keep the short-link advice, which still helps.
        const opened = long ? parseLocation(long) : null;
        if (opened?.ok) parsed = opened;
      }
      if (!parsed.ok) {
        hideResult();
        // Words with places listed under them aren't a mistake: the list is the answer.
        if (explain && (parsed.reason !== 'unrecognised' || suggestions.hidden)) {
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

  /** Ask the link expander once per short link, then try again with the answer. */
  function openShortLink(shortLink: string, reveal: boolean): void {
    if (expanding.has(shortLink)) return;
    expanding.add(shortLink);
    void expandShortLink(shortLink, EXPANDER_URL).then((long) => {
      expanding.delete(shortLink);
      expanded.set(shortLink, long);
      update(true, reveal);
    });
  }

  function renderSaved(): void {
    if (!saved.available) return;
    const places = saved.list();
    exportLink.hidden = places.length === 0;
    lossWarning.hidden = places.length === 0;
    savedList.replaceChildren(...places.map(savedItem));
  }

  function savedItem(place: SavedPlace): HTMLLIElement {
    const title = place.name ?? fallbackName(place);
    const keep = place.pending
      ? h(
          'button',
          {
            type: 'button',
            class: 'saved-keep',
            'aria-label': `Keep ${title}`,
            onclick: () => {
              saved.keep(place.id);
              renderSaved();
            },
          },
          '✓',
        )
      : null;
    return h(
      'li',
      { class: place.pending ? 'pending' : undefined },
      h(
        'button',
        {
          type: 'button',
          class: 'saved-open',
          onclick: () => {
            stops.setValues(place.stops.map(pretty));
            nameInput.value = place.name ?? '';
            noteInput.value = place.note ?? '';
            void show({ stops: place.stops, address: place.address }, { reveal: true });
          },
        },
        h(
          'span',
          { class: 'saved-name' },
          place.pending ? h('span', { class: 'chip new' }, 'New') : null,
          title,
          place.stops.length > 1 ? h('span', { class: 'chip' }, `${place.stops.length} stops`) : null,
        ),
        place.note ? h('span', { class: 'saved-note' }, place.note) : null,
      ),
      keep,
      h(
        'button',
        {
          type: 'button',
          class: 'saved-delete',
          'aria-label': `${place.pending ? 'Remove' : 'Delete'} ${title}`,
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
    // Ask the browser not to clear our storage when space runs low. It may say no.
    void navigator.storage?.persist?.().catch(() => false);
    saveButton.textContent = 'Saved';
    renderSaved();
  });

  shareButton.addEventListener('click', async () => {
    if (!current) return;
    const outcome = await shareLink(buildJourneyUrl(publicUrl(), current), '123go.taxi');
    shareButton.textContent = SHARE_RESULT_TEXT[outcome];
  });

  // Build the big PNG only when asked, so the page stays fast.
  previewLink.addEventListener('click', (event) => {
    event.preventDefault();
    if (current && openNavigation) openNavigation(buildJourneyHash(current));
  });

  downloadLink.addEventListener('click', async (event) => {
    if (!current) {
      event.preventDefault();
      return;
    }
    if (downloadLink.dataset.ready) {
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
      placesMessage.textContent =
        added === 0 ? 'Nothing new in that file.' : `Added ${added} place${added === 1 ? '' : 's'}.`;
      renderSaved();
    } catch {
      placesMessage.textContent = "That file isn't a 123go.taxi export.";
    }
  });

  /** 123go.taxi QR → its driver screen. Map link or coordinates → "Where to?". */
  function onScan(text: string): ScanOutcome {
    let url: URL | null = null;
    try {
      url = new URL(text);
    } catch {
      // Not a link: maybe coordinates.
    }
    if (url && (url.hostname === '123go.taxi' || url.origin === location.origin)) {
      const journey = parseJourney(url.hash || url.search);
      if (journey.kind === 'ok' && openScanned) {
        openScanned(buildJourneyHash(journey.journey));
        return { done: true };
      }
    }
    const parsed = parseLocation(text);
    if (parsed.ok || parsed.reason === 'short-link') {
      stops.setValues([text.trim()]);
      update(true, true);
      return { done: true };
    }
    return { done: false, message: "That QR isn't a place. Try a 123go.taxi or map QR." };
  }

  root.replaceChildren(
    h(
      'header',
      { class: 'masthead' },
      h(
        'div',
        { class: 'masthead-row' },
        h(
          'h1',
          { class: 'wordmark' },
          h('img', { src: `${import.meta.env.BASE_URL}logo.svg`, alt: '', width: '56', height: '58' }),
          '123go.taxi',
        ),
        scanButton(onScan),
      ),
      h('p', { class: 'tagline' }, 'Paste a place. Get a QR. Share it. Go!'),
    ),
    h(
      'section',
      { class: 'where block' },
      h(
        'div',
        { class: 'place-form' },
        sectionHead('Where to?', whereHelp(), { titleClass: 'where-title' }),
        stops.element,
        suggestions,
        notice,
        error,
      ),
      result,
    ),
    savedSection,
    cornerButtons(),
    navAppSettings(),
    creditFooter(),
  );
  renderSaved();
  hideResult();
  window.addEventListener('hashchange', () => renderSaved());
  // The list floats over the page: tapping anywhere else closes it.
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node;
    if (!suggestions.hidden && !suggestions.contains(target) && !stops.element.contains(target)) hideSuggestions();
  });
}

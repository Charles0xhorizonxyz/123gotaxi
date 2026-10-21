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
import { t } from '../i18n';

const ERRORS = t.errors;

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
  return place.stops.length > 1 ? t.routeTo(end) : end;
}

/** "Where to?" explained in plain words: three ways to say where you're going. */
function whereHelp(): HTMLElement {
  const w = t.whereHelp;
  return h(
    'div',
    {},
    h('p', {}, h('strong', {}, w.intro)),
    h(
      'ul',
      {},
      h('li', {}, h('strong', {}, w.type.strong), w.type.rest),
      h(
        'li',
        {},
        h('strong', {}, w.app.strong),
        w.app.before,
        h('em', {}, w.app.share),
        w.app.between,
        h('em', {}, w.app.copy),
        w.app.after,
      ),
      h('li', {}, h('strong', {}, w.coords.strong), w.coords.rest),
    ),
    h('p', {}, w.stops.before, h('em', {}, w.stops.addStop), w.stops.after),
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
  const suggestions = h('ul', { class: 'suggestions', 'aria-label': t.placesFound, hidden: true });
  let searching: AbortController | undefined;
  let suggestionsFor = -1;
  // Short links already asked about: the long link, or null if it couldn't be opened.
  const expanded = new Map<string, string | null>();
  const expanding = new Set<string>();
  if (brokenLink) error.textContent = ERRORS.invalidQr;

  // Result card: address, QR, then what you'd want to keep it under, then actions.
  const addressLine = h('p', { class: 'address', hidden: true });
  const qrCanvas = h('canvas', { class: 'qr', role: 'img', 'aria-label': t.qrAria });
  const resultStops = h('p', { class: 'coords' });
  const nameInput = h('input', {
    id: 'name',
    type: 'text',
    maxlength: '60',
    autocomplete: 'off',
    placeholder: t.namePlaceholder,
  });
  const noteInput = h('textarea', {
    id: 'note',
    rows: '2',
    maxlength: '200',
    placeholder: t.notePlaceholder,
  });
  const saveMessage = h('p', { class: 'error', role: 'status', hidden: true });
  const saveButton = h('button', { type: 'button', class: 'go' }, t.save);
  const shareButton = h('button', { type: 'button' }, t.share);
  const downloadLink = h('a', { class: 'text-link', href: '#', download: '123go.png' }, t.downloadPng);
  // Your own navigation app, straight away if one is chosen; otherwise the app list.
  const previewLink = h('a', { class: 'text-link', href: '#' }, t.openInNavigation);
  const business = businessPanel(publicUrl, () => nameInput.value.trim() || current?.label || '');
  // Shown until there's a place: a faded QR outline, so the page explains itself.
  const qrEmpty = h('div', { class: 'qr-empty', role: 'img', 'aria-label': t.qrAppears });
  qrEmpty.innerHTML = EMPTY_QR_SVG;
  qrEmpty.append(h('span', {}, t.qrAppears));
  qrCanvas.hidden = true;
  // Always shown. Name and note can be filled in first; the actions wait for a QR.
  const resultDetails = h(
    'div',
    { class: 'result-details' },
    resultStops,
    h(
      'div',
      { class: 'keep-fields' },
      h('label', { for: 'name' }, `${t.name} `, h('span', { class: 'optional' }, t.optionalPrivate)),
      nameInput,
      h('label', { for: 'note' }, `${t.note} `, h('span', { class: 'optional' }, t.optionalPrivate)),
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
  const exportLink = h('a', { class: 'text-link', href: '#', download: '123go-places.json' }, t.exportList);
  const importLabel = h('label', { for: 'import-file', class: 'text-link' }, t.importList);
  const placesMessage = h('p', { class: 'hint', role: 'status' });
  // Only worth saying once there's something to lose. Installed, iPhone's 7-day
  // erasing no longer applies, but the list still lives on this phone only.
  const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios';
  const lossWarning = isInstalled()
    ? h('p', { class: 'warning', hidden: true }, h('strong', {}, t.keptInstalledStrong), t.keptInstalled)
    : h(
        'p',
        { class: 'warning', hidden: true },
        h('strong', {}, ios ? t.lossIosStrong : t.lossStrong),
        ios ? t.lossIos : t.loss,
      );
  const placesHead = sectionHead(t.yourPlaces, t.placesHelp, { id: 'help-places' });
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
      h('p', { class: 'hint' }, t.savingBlockedPrivate),
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
    saveButton.textContent = t.save;
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
      shareButton.textContent = t.share;
    }
    resultStops.textContent =
      journey.stops.length > 1 ? t.nStops(journey.stops.length) : pretty(journey.stops[0]!);
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
    addressLine.textContent = address ?? (pending ? t.lookingUp : t.noAddress);
  }

  function hideResult(): void {
    addressLookup?.abort();
    addressLine.hidden = true;
    current = null;
    qrEmpty.hidden = false;
    qrCanvas.hidden = true;
    resultStops.textContent = t.noPlaceYet;
    previewLink.href = '#';
    business.update(null);
    resetSaveButton();
    shareButton.textContent = t.share;
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
    showSuggestionNote(t.searching);
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
            : [h('li', { class: 'hint' }, t.noPlaceFound)]),
        );
        openSuggestions();
        error.hidden = true;
      })
      .catch(() => {
        // Slow, offline or down: say so. Links and coordinates still work.
        if (!lookup.signal.aborted) showSuggestionNote(t.searchSlow);
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
          notice.textContent = t.openingShortLink;
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
            filled.length > 1 ? t.stopError(number, ERRORS[parsed.reason]) : ERRORS[parsed.reason];
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
            'aria-label': t.keep(title),
            onclick: () => {
              saved.keep(place.id);
              renderSaved();
            },
          },
          '✓',
        )
      : null;
    const open = h(
      'button',
      {
        type: 'button',
        class: 'saved-open',
        // Screen readers and keyboards: Alt + arrow keys move the place.
        'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown',
        'aria-description': t.movePlace(title),
        onclick: () => {
          // The end of a press-and-hold move is not a tap.
          if (open.dataset.moved) return void delete open.dataset.moved;
          stops.setValues(place.stops.map(pretty));
            nameInput.value = place.name ?? '';
            noteInput.value = place.note ?? '';
          void show({ stops: place.stops, address: place.address }, { reveal: true });
        },
      },
      h(
        'span',
        { class: 'saved-name' },
        place.pending ? h('span', { class: 'chip new' }, t.newChip) : null,
        title,
        place.stops.length > 1 ? h('span', { class: 'chip' }, t.nStops(place.stops.length)) : null,
      ),
      place.note ? h('span', { class: 'saved-note' }, place.note) : null,
    );
    const row = h(
      'li',
      { class: place.pending ? 'pending' : undefined, 'data-id': place.id },
      open,
      keep,
      h(
        'button',
        {
          type: 'button',
          class: 'saved-delete',
          'aria-label': place.pending ? t.remove(title) : t.delete(title),
          onclick: () => {
            saved.remove(place.id);
            renderSaved();
          },
        },
        '×',
      ),
    );
    open.addEventListener('pointerdown', (event) => holdToMove(row, open, event));
    open.addEventListener('keydown', (event) => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      const sibling = event.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      savedList.insertBefore(row, event.key === 'ArrowUp' ? sibling : sibling.nextElementSibling);
      keepOrder();
      open.focus();
    });
    return row;
  }

  /** Save the order the list now shows. */
  function keepOrder(): void {
    saved.reorder([...savedList.children].map((li) => (li as HTMLElement).dataset.id ?? ''));
  }

  /** While a place is being moved, the page must not scroll under the finger (Safari on iPhone). */
  let moving = false;
  document.addEventListener(
    'touchmove',
    (event) => {
      if (moving) event.preventDefault();
    },
    { passive: false },
  );

  /**
   * Press and hold a place (about half a second, without moving) to pick it up,
   * then slide it up or down; let go to drop it. A quick tap still opens it, and
   * moving before the hold lets the page scroll as usual.
   */
  function holdToMove(row: HTMLLIElement, open: HTMLButtonElement, down: PointerEvent): void {
    if (down.button !== 0) return;
    const startY = down.clientY;
    const startScroll = window.scrollY;
    let pointerY = down.clientY;
    let held = false;
    let rows: HTMLElement[] = [];
    let tops: number[] = [];
    let from = 0;
    let to = 0;
    let step = 0;
    let scrollTimer: ReturnType<typeof setInterval> | undefined;

    const timer = setTimeout(() => {
      held = true;
      moving = true;
      open.dataset.moved = '1';
      navigator.vibrate?.(15);
      // Where every card sits now (page coordinates), to know which ones to slide aside.
      rows = [...savedList.children] as HTMLElement[];
      tops = rows.map((r) => r.getBoundingClientRect().top + window.scrollY);
      from = to = rows.indexOf(row);
      const box = row.getBoundingClientRect();
      const next = rows[from + 1] ?? rows[from - 1];
      step = next ? Math.abs(next.getBoundingClientRect().top - box.top) : box.height;
      row.classList.add('dragging');
      for (const r of rows) if (r !== row) r.classList.add('making-room');
      // Near the top or bottom of the screen, the page scrolls along.
      scrollTimer = setInterval(() => {
        const edge = 70;
        const speed = pointerY < edge ? -12 : pointerY > window.innerHeight - edge ? 12 : 0;
        if (speed) {
          window.scrollBy(0, speed);
          follow();
        }
      }, 16);
    }, 450);

    /** The card under the finger; the others slide out of its way. */
    function follow(): void {
      const dy = pointerY - startY + (window.scrollY - startScroll);
      row.style.transform = `translateY(${dy}px) scale(1.02)`;
      const centre = tops[from]! + dy + row.offsetHeight / 2;
      to = from;
      while (to < rows.length - 1 && centre > tops[to + 1]! + rows[to + 1]!.offsetHeight / 2) to++;
      while (to > 0 && centre < tops[to - 1]! + rows[to - 1]!.offsetHeight / 2) to--;
      for (const [i, r] of rows.entries()) {
        if (r === row) continue;
        const shift = from < to && i > from && i <= to ? -step : from > to && i < from && i >= to ? step : 0;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      }
    }

    // Follow this finger or mouse over the whole page: Safari won't let a card
    // keep the pointer once it has left it.
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== down.pointerId) return;
      pointerY = move.clientY;
      if (!held) {
        if (Math.abs(move.clientY - startY) > 8) finish();
        return;
      }
      follow();
    };

    const finish = () => {
      clearTimeout(timer);
      clearInterval(scrollTimer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      if (!held) return;
      moving = false;
      // Drop it into the gap: move it in the list, and let every card sit still again.
      for (const r of rows) {
        r.classList.remove('making-room', 'dragging');
        r.style.transform = '';
      }
      if (to !== from) savedList.insertBefore(row, to > from ? rows[to]!.nextElementSibling : rows[to]!);
      keepOrder();
      // The tap that may follow the release is ignored; after that, taps open the place again.
      setTimeout(() => delete open.dataset.moved, 400);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  }


  saveButton.addEventListener('click', () => {
    if (!current) return;
    if (!saved.available) {
      saveMessage.textContent = t.savingBlocked;
      saveMessage.hidden = false;
      return;
    }
    saved.add({ ...current, name: nameInput.value, note: noteInput.value });
    // Ask the browser not to clear our storage when space runs low. It may say no.
    void navigator.storage?.persist?.().catch(() => false);
    saveButton.textContent = t.saved;
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
        added === 0 ? t.nothingNew : t.addedPlaces(added);
      renderSaved();
    } catch {
      placesMessage.textContent = t.notAnExport;
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
    return { done: false, message: t.notAPlace };
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
      h('p', { class: 'tagline' }, t.tagline),
    ),
    h(
      'section',
      { class: 'where block' },
      h(
        'div',
        { class: 'place-form' },
        sectionHead(t.whereTo, whereHelp(), { titleClass: 'where-title', id: 'help-where' }),
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

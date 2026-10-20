import { h } from '../dom';
import { MAX_STOPS } from '../destination-url';
import { t } from '../i18n';

export interface StopsEditor {
  element: HTMLElement;
  /** Input values in driving order. */
  values(): string[];
  setValues(values: string[]): void;
  /** Change one stop's text, keeping the others as they are. */
  setValue(index: number, value: string): void;
  /** The stop being typed in, or -1. */
  focusedIndex(): number;
  /** The input of a stop, e.g. to show suggestions under it. */
  inputAt(index: number): HTMLInputElement | undefined;
}

/**
 * What just happened, so the page can decide how eager to be:
 * - "commit": a paste or Enter. Make the QR and bring it into view, or explain what's wrong.
 * - "leave": the field lost focus. Same, but don't move the page: the user is tapping something else.
 * - "typing": a keystroke. Make the QR once the text reads as a place; stay quiet otherwise.
 * - "reorder": stops moved or removed. Rebuild the QR.
 */
export type StopsChange = 'commit' | 'leave' | 'typing' | 'reorder';

/**
 * The "Where to?" list: one input per stop, reorderable by dragging the handle
 * (mouse or finger) or with the arrow keys when the handle has focus.
 */
export function createStopsEditor({ onChange }: { onChange: (change: StopsChange) => void }): StopsEditor {
  const list = h('ol', { class: 'stops' });
  const addButton = h('button', { type: 'button', class: 'text-link add-stop' }, t.addStop);

  function rows(): HTMLLIElement[] {
    return [...list.children] as HTMLLIElement[];
  }

  function refresh(): void {
    const all = rows();
    list.classList.toggle('single', all.length === 1);
    all.forEach((row, i) => {
      const input = row.querySelector('input')!;
      const handle = row.querySelector<HTMLButtonElement>('.drag-handle')!;
      const remove = row.querySelector<HTMLButtonElement>('.remove-stop')!;
      const name = all.length === 1 ? t.whereTo : i === all.length - 1 ? t.finalStop : t.stopN(i + 1);
      input.setAttribute('aria-label', name);
      input.placeholder =
        i === 0 ? t.placeholderFirst : t.placeholderOther;
      row.querySelector('.stop-number')!.textContent = String(i + 1);
      handle.setAttribute('aria-label', t.moveStop(i + 1));
      remove.setAttribute('aria-label', t.removeStop(i + 1));
    });
    addButton.hidden = all.length >= MAX_STOPS;
  }

  function moveRow(row: HTMLLIElement, offset: -1 | 1): void {
    const sibling = offset < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    list.insertBefore(row, offset < 0 ? sibling : sibling.nextElementSibling);
    refresh();
    onChange('reorder');
  }

  function startDrag(row: HTMLLIElement, handle: HTMLButtonElement, event: PointerEvent): void {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    row.classList.add('dragging');

    const onMove = (move: PointerEvent) => {
      const all = rows();
      const mine = all.indexOf(row);
      for (const [index, other] of all.entries()) {
        if (other === row) continue;
        const box = other.getBoundingClientRect();
        const middle = box.top + box.height / 2;
        if (index < mine && move.clientY < middle) {
          list.insertBefore(row, other);
          refresh();
          return;
        }
        if (index > mine && move.clientY > middle) {
          list.insertBefore(row, other.nextElementSibling);
          refresh();
          return;
        }
      }
    };
    const before = rows();
    const onEnd = () => {
      row.classList.remove('dragging');
      if (rows().some((r, i) => r !== before[i])) onChange('reorder');
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  function addRow(value = ''): HTMLInputElement {
    // The normal keyboard: a space bar for typing addresses, and links still paste fine.
    const input = h('input', {
      type: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      enterkeyhint: 'go',
    });
    input.value = value;
    input.addEventListener('paste', (event) => {
      // Map apps share "Name / address / link" on separate lines, which a one-line
      // field would squash together ("Galata TowerIstanbul"). Keep them apart.
      const text = event.clipboardData?.getData('text') ?? '';
      if (/[\r\n]/.test(text)) {
        event.preventDefault();
        const joined = text
          .split(/[\r\n]+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join(', ');
        const end = input.value.length;
        input.setRangeText(joined, input.selectionStart ?? end, input.selectionEnd ?? end, 'end');
      }
      setTimeout(() => onChange('commit'), 0);
    });
    input.addEventListener('input', (event) => {
      if ((event as InputEvent).inputType !== 'insertFromPaste') onChange('typing');
    });
    input.addEventListener('change', () => onChange('leave'));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onChange('commit');
      }
    });

    const row = h('li', { class: 'stop-row' });
    const handle = h('button', { type: 'button', class: 'drag-handle' }, '⠿');
    handle.addEventListener('pointerdown', (event) => startDrag(row, handle, event));
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      moveRow(row, event.key === 'ArrowUp' ? -1 : 1);
      handle.focus();
    });
    const remove = h(
      'button',
      {
        type: 'button',
        class: 'remove-stop',
        onclick: () => {
          row.remove();
          refresh();
          onChange('reorder');
          rows()[0]?.querySelector('input')?.focus();
        },
      },
      '×',
    );
    row.append(handle, h('span', { class: 'stop-number', 'aria-hidden': 'true' }), input, remove);
    list.append(row);
    refresh();
    return input;
  }

  addButton.addEventListener('click', () => addRow().focus());
  addRow();

  return {
    element: h('div', { class: 'stops-editor' }, list, addButton),
    values: () => rows().map((row) => row.querySelector('input')!.value),
    setValues(values) {
      list.replaceChildren();
      (values.length ? values : ['']).slice(0, MAX_STOPS).forEach((v) => addRow(v));
    },
    setValue(index, value) {
      const input = rows()[index]?.querySelector('input');
      if (input) input.value = value;
    },
    focusedIndex: () => rows().findIndex((row) => row.contains(document.activeElement)),
    inputAt: (index) => rows()[index]?.querySelector('input') ?? undefined,
  };
}

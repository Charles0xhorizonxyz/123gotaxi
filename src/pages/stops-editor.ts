import { h } from '../dom';
import { MAX_STOPS } from '../destination-url';

export interface StopsEditor {
  element: HTMLElement;
  /** Input values in driving order. */
  values(): string[];
  setValues(values: string[]): void;
}

/**
 * The "Where to?" list: one input per stop, reorderable by dragging the handle
 * (mouse or finger) or with the arrow keys when the handle has focus.
 */
export function createStopsEditor({ onPaste }: { onPaste: () => void }): StopsEditor {
  const list = h('ol', { class: 'stops' });
  const addButton = h('button', { type: 'button', class: 'text-link add-stop' }, '+ Add a stop');

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
      const name = all.length === 1 ? 'Where to?' : i === all.length - 1 ? 'Final stop' : `Stop ${i + 1}`;
      input.setAttribute('aria-label', name);
      input.placeholder =
        i === 0 ? 'Paste a map link, or 41.0342, 28.9844' : 'Paste a link or coordinates';
      row.querySelector('.stop-number')!.textContent = String(i + 1);
      handle.setAttribute('aria-label', `Move stop ${i + 1}. Use the arrow keys.`);
      remove.setAttribute('aria-label', `Remove stop ${i + 1}`);
    });
    addButton.hidden = all.length >= MAX_STOPS;
  }

  function moveRow(row: HTMLLIElement, offset: -1 | 1): void {
    const sibling = offset < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    list.insertBefore(row, offset < 0 ? sibling : sibling.nextElementSibling);
    refresh();
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
    const onEnd = () => {
      row.classList.remove('dragging');
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  function addRow(value = ''): HTMLInputElement {
    const input = h('input', {
      type: 'text',
      inputmode: 'url',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-describedby': 'place-hint',
    });
    input.value = value;
    input.addEventListener('paste', () => setTimeout(onPaste, 0));

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
  };
}

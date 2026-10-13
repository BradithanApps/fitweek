// Hoja inferior modal + confirmación. Cierra con el fondo, con Escape o desde el contenido.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';

let openCount = 0;

/**
 * openSheet({ title, content: (close) => Node | Node[] , onClose })
 * Devuelve { close }.
 */
export function openSheet({ title, content, onClose, labelledBy } = {}) {
  const root = document.getElementById('overlay-root');
  const prevFocus = document.activeElement;
  const titleId = labelledBy || `sheet-title-${Date.now()}`;
  let closed = false;

  const close = (value) => {
    if (closed) return;
    closed = true;
    wrap.dataset.open = 'false';
    document.removeEventListener('keydown', onKey);
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.body.style.overflow = '';
    setTimeout(() => wrap.remove(), 260);
    prevFocus?.focus?.({ preventScroll: true });
    onClose?.(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  const panel = h(
    'div',
    { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title ? titleId : null, tabindex: '-1' },
    h('div', { class: 'mx-auto mb-2 h-1.5 w-10 rounded-full bg-line-strong', 'aria-hidden': 'true' }),
    title &&
      h(
        'div',
        { class: 'mb-3 flex items-center justify-between gap-2' },
        h('h2', { id: titleId, class: 'text-xl font-bold' }, title),
        h('button', { class: 'icon-btn -mr-2 text-muted', type: 'button', 'aria-label': t('common.close'), onClick: () => close() }, icon('x')),
      ),
    content(close),
  );
  const wrap = h('div', { dataset: { open: 'false' } }, h('div', { class: 'sheet-backdrop', onClick: () => close() }), panel);

  root.append(wrap);
  openCount++;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      wrap.dataset.open = 'true';
      const first = panel.querySelector('[autofocus]');
      (first || panel).focus({ preventScroll: true });
    }),
  );
  return { close };
}

/** confirmSheet({ title, message, confirm, danger }) → Promise<boolean> */
export function confirmSheet({ title, message, confirm = t('common.confirm'), cancel = t('common.cancel'), danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    openSheet({
      title,
      onClose: () => resolve(answer),
      content: (close) => [
        message && h('p', { class: 'mb-5 text-muted' }, message),
        h(
          'div',
          { class: 'grid gap-2' },
          h(
            'button',
            {
              type: 'button',
              class: `btn ${danger ? 'btn-danger' : 'btn-primary'} min-h-14`,
              onClick: () => {
                answer = true;
                close();
              },
            },
            confirm,
          ),
          h('button', { type: 'button', class: 'btn btn-secondary min-h-14', onClick: () => close() }, cancel),
        ),
      ],
    });
  });
}

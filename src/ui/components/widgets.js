// Piezas visuales reutilizables: encabezados, anillo, stepper, segmentado, estado vacío.

import { h, s } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';

/** Encabezado de pantalla. back: ruta a la que vuelve (muestra flecha). */
export function header({ title, subtitle, back, actions } = {}) {
  return h(
    'header',
    { class: 'flex items-start gap-2 pt-3 pb-4' },
    back &&
      h('a', { href: `#${back}`, class: 'icon-btn -ml-2 mt-0.5 shrink-0 text-lime', 'aria-label': t('common.back') }, icon('arrowLeft', 'size-6')),
    h(
      'div',
      { class: 'min-w-0 flex-1' },
      h('h1', { class: 'text-[28px] leading-tight font-bold tracking-tight break-words' }, title),
      subtitle && h('p', { class: 'mt-1 text-[15px] text-muted' }, subtitle),
    ),
    actions && h('div', { class: 'flex shrink-0 items-center gap-1' }, actions),
  );
}

export function sectionTitle(text, extra) {
  return h('div', { class: 'mt-6 mb-2 flex items-center justify-between px-1' }, h('h2', { class: 'text-[15px] font-semibold text-muted' }, text), extra);
}

/** Anillo de progreso SVG (value 0..1) con contenido centrado. */
export function ring({ value = 0, size = 112, stroke = 10, children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const valueCircle = s('circle', {
    class: 'ring-value',
    cx: size / 2,
    cy: size / 2,
    r,
    fill: 'none',
    'stroke-width': stroke,
    'stroke-linecap': 'round',
    'stroke-dasharray': c,
    'stroke-dashoffset': c,
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
  });
  // Animación de entrada: arranca vacío y se llena.
  requestAnimationFrame(() => requestAnimationFrame(() => valueCircle.setAttribute('stroke-dashoffset', String(c * (1 - v)))));
  return h(
    'div',
    { class: 'relative grid shrink-0 place-items-center', style: { width: `${size}px`, height: `${size}px` }, role: label ? 'img' : null, 'aria-label': label },
    s(
      'svg',
      { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'absolute inset-0', 'aria-hidden': 'true' },
      s('circle', { class: 'ring-track', cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke }),
      v > 0 ? valueCircle : null,
    ),
    h('div', { class: 'relative text-center' }, children),
  );
}

/** Actualiza un anillo existente sin recrearlo. */
export function setRing(ringEl, value) {
  const c = ringEl.querySelector('.ring-value');
  if (!c) return;
  const len = Number(c.getAttribute('stroke-dasharray'));
  c.setAttribute('stroke-dashoffset', String(len * (1 - Math.max(0, Math.min(1, value)))));
}

/**
 * Control grande −/número/+. El número es editable con teclado numérico.
 * Devuelve { el, get, set }.
 */
export function bigStepper({ value, step = 1, min = 0, max = 9999, decimals = false, label, unit, onChange }) {
  let current = value;
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const round = (n) => (decimals ? Math.round(n * 100) / 100 : Math.round(n));
  const input = h('input', {
    type: 'text',
    inputmode: decimals ? 'decimal' : 'numeric',
    enterkeyhint: 'done',
    autocomplete: 'off',
    class: 'min-w-[2ch] bg-transparent text-center text-[64px] leading-none font-bold tabular outline-none',
    'aria-label': label,
    value: format(current),
    onFocus: (e) => e.target.select(),
    onInput: () => fit(),
    onBlur: () => commit(input.value),
    onKeydown: (e) => {
      if (e.key === 'Enter') input.blur();
    },
  });
  function fit() {
    input.style.width = `${Math.max(2, input.value.length) + 0.4}ch`;
  }
  function format(n) {
    return String(n).replace('.', decimalSep());
  }
  function commit(raw) {
    const n = parseFloat(String(raw).replace(',', '.'));
    set(Number.isFinite(n) ? clamp(round(n)) : current);
  }
  function set(n) {
    current = n;
    input.value = format(n);
    fit();
    onChange?.(n);
  }
  fit();
  const btn = (name, delta, aria) =>
    h(
      'button',
      {
        type: 'button',
        class: `icon-btn size-16 shrink-0 border border-line-strong ${delta > 0 ? 'text-lime' : 'text-ink'}`,
        'aria-label': aria,
        onClick: () => set(clamp(round(current + delta))),
      },
      icon(name, 'size-7'),
    );
  const el = h(
    'div',
    { class: 'flex flex-col items-center' },
    h(
      'div',
      { class: 'flex w-full items-center gap-3' },
      btn('minus', -step, t('common.decrease', { what: label })),
      h('div', { class: 'flex min-w-0 flex-1 items-baseline justify-center' }, input, unit && h('span', { class: 'ml-1 text-2xl font-semibold text-muted' }, unit)),
      btn('plus', step, t('common.increase', { what: label })),
    ),
    h('span', { class: 'mt-1 text-[15px] text-muted' }, label),
  );
  return { el, get: () => current, set };
}

function decimalSep() {
  return (1.5).toLocaleString(document.documentElement.lang || 'es').charAt(1) === ',' ? ',' : '.';
}

/** Stepper compacto para formularios. */
export function miniStepper({ value, min = 1, max = 99, step = 1, label, onChange }) {
  let current = value;
  const out = h('output', { class: 'w-10 text-center text-xl font-bold tabular' }, String(current));
  const set = (n) => {
    current = Math.min(max, Math.max(min, n));
    out.textContent = String(current);
    onChange?.(current);
  };
  return {
    el: h(
      'div',
      { class: 'flex items-center justify-between gap-2 rounded-[14px] border border-line bg-surface-2 p-1' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.decrease', { what: label }), onClick: () => set(current - step) }, icon('minus')),
      out,
      h('button', { type: 'button', class: 'icon-btn text-lime', 'aria-label': t('common.increase', { what: label }), onClick: () => set(current + step) }, icon('plus')),
    ),
    get: () => current,
  };
}

/** Control segmentado. options: [{ value, label }] */
export function segmented({ options, value, onChange, label }) {
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  const render = () => {
    el.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(o.value === value),
            onClick: () => {
              value = o.value;
              render();
              onChange(o.value);
            },
          },
          o.label,
        ),
      ),
    );
  };
  render();
  return el;
}

export function toggle({ checked, onChange, label }) {
  const el = h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': String(!!checked),
    'aria-label': label,
    class: 'relative h-8 w-13 shrink-0 rounded-full border border-line transition-colors',
    onClick: () => {
      checked = !checked;
      paint();
      onChange(checked);
    },
  });
  const knob = h('span', { class: 'absolute top-0.5 left-0.5 size-6.5 rounded-full bg-ink transition-transform' });
  el.append(knob);
  const paint = () => {
    el.setAttribute('aria-checked', String(!!checked));
    el.style.background = checked ? 'var(--color-lime)' : 'var(--color-surface-2)';
    knob.style.transform = checked ? 'translateX(20px)' : 'none';
    knob.style.background = checked ? 'var(--color-lime-ink)' : 'var(--color-ink)';
  };
  paint();
  return el;
}

export function emptyState({ iconName = 'dumbbell', title, text, action }) {
  return h(
    'div',
    { class: 'card flex flex-col items-center px-6 py-10 text-center' },
    h('div', { class: 'mb-4 grid size-14 place-items-center rounded-2xl bg-lime-soft text-lime' }, icon(iconName, 'size-7')),
    h('h2', { class: 'text-lg font-semibold' }, title),
    text && h('p', { class: 'mt-1 text-muted' }, text),
    action && h('div', { class: 'mt-5 w-full' }, action),
  );
}

/** Fila de lista tocable dentro de una tarjeta. */
export function rowLink({ href, onClick, leading, title, subtitle, trailing, chevron = true }) {
  const tag = href ? 'a' : 'button';
  return h(
    tag,
    {
      href,
      type: href ? null : 'button',
      onClick,
      class: 'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2',
    },
    leading,
    h('div', { class: 'min-w-0 flex-1' }, h('div', { class: 'truncate font-semibold' }, title), subtitle && h('div', { class: 'mt-0.5 truncate text-sm text-muted' }, subtitle)),
    trailing,
    chevron && h('span', { class: 'text-faint' }, icon('chevronRight')),
  );
}

export function iconBadge(name, { active = false } = {}) {
  return h(
    'div',
    { class: `grid size-11 shrink-0 place-items-center rounded-[14px] ${active ? 'bg-lime text-lime-ink' : 'bg-surface-2 text-lime'}` },
    icon(name, 'size-5'),
  );
}

export function numberBadge(n, { active = false, done = false } = {}) {
  return h(
    'div',
    {
      class: `grid size-11 shrink-0 place-items-center rounded-[14px] text-lg font-bold tabular ${
        active ? 'bg-lime text-lime-ink' : done ? 'border border-lime/40 text-lime' : 'bg-surface-2 text-ink'
      }`,
    },
    String(n),
  );
}

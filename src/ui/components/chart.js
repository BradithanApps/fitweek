// Gráfico de línea SVG sin librerías. points: [{ label, value }]

import { h, s } from '../dom.js';

export function lineChart({ points, formatY = String, height = 180, ariaLabel }) {
  const W = 340;
  const H = height;
  const pad = { l: 40, r: 22, t: 12, b: 26 };
  const max = Math.max(...points.map((p) => p.value), 0);
  const niceMax = nice(max || 1);
  const ticks = [0, niceMax / 2, niceMax];
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const svg = s(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, class: 'block h-auto w-full', role: 'img', 'aria-label': ariaLabel },
    s(
      'defs',
      null,
      s(
        'linearGradient',
        { id: 'fw-area', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': 'var(--color-lime)', 'stop-opacity': 0.22 }),
        s('stop', { offset: '100%', 'stop-color': 'var(--color-lime)', 'stop-opacity': 0 }),
      ),
    ),
    ticks.map((tv) =>
      s(
        'g',
        null,
        s('line', { x1: pad.l, x2: W - pad.r, y1: y(tv), y2: y(tv), stroke: 'rgb(255 255 255 / 0.07)', 'stroke-width': 1 }),
        s('text', { x: pad.l - 8, y: y(tv) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--color-muted)' }, formatY(tv)),
      ),
    ),
    s('path', { d: area, fill: 'url(#fw-area)' }),
    s('path', { d: line, fill: 'none', stroke: 'var(--color-lime)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    points.map((p, i) => s('circle', { cx: x(i), cy: y(p.value), r: 3.5, fill: 'var(--color-lime)' })),
    points.map((p, i) =>
      s('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--color-muted)' }, p.label),
    ),
  );
  return h('div', { class: 'w-full' }, svg);
}

function nice(v) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}

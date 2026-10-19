import { s } from './dom.js';

// Iconos de trazo en una grilla de 24×24. Cada entrada es una lista de primitivas SVG.
const P = (d) => ['path', { d }];
const C = (cx, cy, r) => ['circle', { cx, cy, r }];

const ICONS = {
  home: [P('M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1z')],
  plan: [P('M9 3.5h6v3H9z'), P('M7.5 5H5.5v16h13V5h-2'), P('M8.5 11.5h7'), P('M8.5 15.5h4.5')],
  chart: [P('M5 20v-6'), P('M12 20V8'), P('M19 20V4')],
  settings: [P('M4 6.5h9'), P('M17 6.5h3'), P('M4 12h3'), P('M11 12h9'), P('M4 17.5h11'), P('M19 17.5h1'), C(15, 6.5, 2), C(9, 12, 2), C(17, 17.5, 2)],
  dumbbell: [P('M6.5 7v10'), P('M3.5 9.5v5'), P('M17.5 7v10'), P('M20.5 9.5v5'), P('M6.5 12h11')],
  check: [P('M5 12.5 9.5 17 19 7.5')],
  plus: [P('M12 5v14'), P('M5 12h14')],
  minus: [P('M5 12h14')],
  chevronRight: [P('m9 6 6 6-6 6')],
  chevronLeft: [P('m15 6-6 6 6 6')],
  arrowLeft: [P('M19 12H5'), P('m11 6-6 6 6 6')],
  arrowRight: [P('M5 12h14'), P('m13 6 6 6-6 6')],
  clock: [C(12, 12, 8.5), P('M12 7.5V12l3 2')],
  flame: [P('M12 3c.8 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 .9-3.4 2-4.5.2 1.8 1 2.8 2 3.2-.4-3 .2-5.6.5-8.2z')],
  weight: [P('M9 8.5a3 3 0 1 1 6 0'), P('M6.5 10.5h11l2 9.5h-15z')],
  trash: [P('M4 7h16'), P('M10 11v6'), P('M14 11v6'), P('m6 7 1 13h10l1-13'), P('M9 7V4h6v3')],
  pencil: [P('M4 20h4L19 9l-4-4L4 16z'), P('m13.5 6.5 4 4')],
  up: [P('M12 19V5'), P('m6 11 6-6 6 6')],
  down: [P('M12 5v14'), P('m6 13 6 6 6-6')],
  x: [P('m6 6 12 12'), P('M18 6 6 18')],
  swap: [P('M4 8h15'), P('m15 4 4 4-4 4'), P('M20 16H5'), P('m9 12-4 4 4 4')],
  download: [P('M12 4v11'), P('m7 10 5 5 5-5'), P('M5 20h14')],
  upload: [P('M12 20V9'), P('m7 14 5-5 5 5'), P('M5 4h14')],
  trophy: [P('M8 4h8v5a4 4 0 0 1-8 0z'), P('M8 6H5a3 3 0 0 0 3 4'), P('M16 6h3a3 3 0 0 1-3 4'), P('M12 13v4'), P('M8.5 20h7')],
  calendar: [['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }], P('M3.5 10h17'), P('M8 3v4'), P('M16 3v4')],
  skip: [P('m6 6 8 6-8 6z'), P('M18 6v12')],
  play: [P('M7.5 5.5 18.5 12l-11 6.5z')],
  rest: [P('M3.5 18V8'), P('M3.5 14.5h17v3.5'), P('M20.5 14.5V13a3 3 0 0 0-3-3H11v4.5'), C(7.3, 11.3, 1.8)],
  list: [P('M9 6h11'), P('M9 12h11'), P('M9 18h11'), P('M4.5 6h.01'), P('M4.5 12h.01'), P('M4.5 18h.01')],
  sound: [P('M4.5 9.5v5h3.5l5 4v-13l-5 4z'), P('M16 9a4 4 0 0 1 0 6'), P('M18.5 6.5a7.5 7.5 0 0 1 0 11')],
  wifiOff: [P('M3 3l18 18'), P('M8.5 16.5a5 5 0 0 1 7 0'), P('M5 13a10 10 0 0 1 5-2.7'), P('M19 13a10 10 0 0 0-2.4-1.7'), P('M12 20h.01')],
  info: [C(12, 12, 8.5), P('M12 11v5'), P('M12 8h.01')],
  grip: [P('M5 8h14'), P('M5 12h14'), P('M5 16h14')],
};

export function icon(name, cls = 'size-5') {
  const parts = ICONS[name] || ICONS.info;
  return s(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: cls,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    parts.map(([tag, attrs]) => s(tag, attrs)),
  );
}

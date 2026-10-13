// Traducciones y formatos según idioma. Los textos del usuario nunca pasan por aquí.

import es from './es.js';
import pt from './pt.js';
import en from './en.js';

const DICTS = { es, pt, en };
const LOCALES = { es: 'es-UY', pt: 'pt-BR', en: 'en-US' };

export const LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
];

let lang = 'es';
let fmt = {};

function buildFormatters() {
  const loc = LOCALES[lang];
  fmt = {
    num1: new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }),
    int: new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }),
    compact: new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }),
    weekday: new Intl.DateTimeFormat(loc, { weekday: 'short' }),
    weekdayLong: new Intl.DateTimeFormat(loc, { weekday: 'long' }),
    dayMonth: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }),
    month: new Intl.DateTimeFormat(loc, { month: 'short' }),
    long: new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }),
    full: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }),
    time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }),
    rel: new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }),
  };
}
buildFormatters();

/** Idioma inicial: el guardado o, en el primer uso, el del teléfono si es pt/en (si no, español). */
export function detectLang() {
  const nav = (globalThis.navigator?.language || 'es').slice(0, 2).toLowerCase();
  return DICTS[nav] ? nav : 'es';
}

export function setLang(code) {
  lang = DICTS[code] ? code : 'es';
  buildFormatters();
  if (globalThis.document) document.documentElement.lang = lang;
}

export const getLang = () => lang;

/**
 * t('home.today', { day: 'Día 2' }) → texto con {day} reemplazado.
 * Con { count } usa la clave `_one` cuando count === 1 y `_other` en el resto.
 */
export function t(key, params = {}) {
  const dict = DICTS[lang];
  let k = key;
  if (typeof params.count === 'number') k = `${key}_${params.count === 1 ? 'one' : 'other'}`;
  let str = dict[k] ?? DICTS.es[k] ?? dict[key] ?? DICTS.es[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, p) => (p in params ? String(params[p]) : `{${p}}`));
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const keyDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtNum = (n) => fmt.num1.format(Number(n) || 0);
export const fmtInt = (n) => fmt.int.format(Math.round(Number(n) || 0));
export const fmtCompact = (n) => fmt.compact.format(Number(n) || 0);
export const fmtWeekday = (key) => cap(fmt.weekday.format(keyDate(key)).replace('.', ''));
export const fmtWeekdayLong = (key) => cap(fmt.weekdayLong.format(keyDate(key)));
export const fmtDayMonth = (key) => fmt.dayMonth.format(keyDate(key)).replace('.', '');
export const fmtMonth = (key) => fmt.month.format(keyDate(key)).replace('.', '');
export const fmtDateLong = (key) => cap(fmt.long.format(keyDate(key)));
export const fmtDateFull = (key) => fmt.full.format(keyDate(key)).replace('.', '');
export const fmtTime = (ms) => fmt.time.format(new Date(ms));
export const fmtRelDays = (n) => fmt.rel.format(-n, 'day');

export function fmtDuration(ms) {
  const total = Math.max(0, Math.round(ms / 60000));
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh ? `${hh} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
}

/** 00:00 / 1:05:09 para cronómetros */
export function fmtClock(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

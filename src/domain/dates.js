// Fechas como claves locales 'YYYY-MM-DD'. Nunca toISOString(): en UTC-3 un entreno
// a las 22:00 quedaría registrado al día siguiente.

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** 0 = lunes … 6 = domingo */
export function weekdayIndex(key) {
  return (fromKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key) {
  return addDays(key, -weekdayIndex(key));
}

export function weekKeys(key) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Días enteros de a → b (positivo si b es posterior). Redondeo para tolerar cambios de horario. */
export function diffDays(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86_400_000);
}

export function isValidKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && toKey(fromKey(key)) === key;
}

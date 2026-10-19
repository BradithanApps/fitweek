// Formato de respaldo, validación y fusión. Puro: recibe y devuelve objetos.

import { isValidKey } from './dates.js';
import { cleanName, nameKey } from './text.js';

export const BACKUP_SCHEMA = 1;
const SETTINGS_KEYS = ['lang', 'name', 'unit', 'weightStep', 'defaultRest', 'restWeekdays', 'sound', 'soundInSilent'];

export function buildBackup({ settings, exercises, cycleDays, sessions }, now = new Date()) {
  const s = {};
  for (const k of SETTINGS_KEYS) if (k in settings) s[k] = settings[k];
  return { app: 'fitweek', schema: BACKUP_SCHEMA, exportedAt: now.toISOString(), data: { settings: s, exercises, cycleDays, sessions } };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const num = (v, min = 0, max = 100000) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

/**
 * Valida y limpia un respaldo. Devuelve { ok: true, data, counts } o { ok: false, error }.
 * error es una clave de i18n.
 */
export function parseBackup(raw) {
  let json = raw;
  if (typeof raw === 'string') {
    try {
      json = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'backup.errNotJson' };
    }
  }
  if (!isObj(json) || json.app !== 'fitweek' || !isObj(json.data)) return { ok: false, error: 'backup.errNotFitweek' };
  if (typeof json.schema !== 'number' || json.schema > BACKUP_SCHEMA) return { ok: false, error: 'backup.errNewer' };

  const d = json.data;
  const exercises = [];
  const exIds = new Set();
  for (const e of Array.isArray(d.exercises) ? d.exercises : []) {
    if (!isObj(e) || !isStr(e.id) || exIds.has(e.id)) continue;
    const name = cleanName(e.name);
    if (!name) continue;
    exIds.add(e.id);
    exercises.push({ id: e.id, name, nameKey: nameKey(name), currentWeight: num(e.currentWeight) ?? 0, mode: e.mode === 'max' ? 'max' : 'reps', archived: !!e.archived });
  }

  const cycleDays = [];
  const dayIds = new Set();
  for (const day of Array.isArray(d.cycleDays) ? d.cycleDays : []) {
    if (!isObj(day) || !isStr(day.id) || dayIds.has(day.id)) continue;
    dayIds.add(day.id);
    const items = (Array.isArray(day.items) ? day.items : [])
      .filter((it) => isObj(it) && exIds.has(it.exerciseId))
      .map((it) => ({ exerciseId: it.exerciseId, sets: Math.round(num(it.sets, 1, 20) ?? 3), reps: Math.round(num(it.reps, 1, 200) ?? 10), rest: num(it.rest, 0, 3600) }));
    cycleDays.push({ id: day.id, order: num(day.order, 0, 1000) ?? cycleDays.length, name: cleanName(day.name) || '—', items });
  }

  const sessions = [];
  const sesIds = new Set();
  for (const s of Array.isArray(d.sessions) ? d.sessions : []) {
    if (!isObj(s) || !isStr(s.id) || sesIds.has(s.id) || !isValidKey(s.date)) continue;
    if (!['done', 'abandoned', 'active'].includes(s.status)) continue;
    sesIds.add(s.id);
    const entries = (Array.isArray(s.entries) ? s.entries : [])
      .filter((e) => isObj(e) && isStr(e.exerciseId))
      .map((e) => ({
        exerciseId: e.exerciseId,
        name: cleanName(e.name) || '—',
        mode: e.mode === 'max' ? 'max' : 'reps',
        target: { sets: Math.round(num(e.target?.sets, 1, 20) ?? 3), reps: e.target?.reps == null ? null : Math.round(num(e.target.reps, 1, 200) ?? 10) },
        rest: num(e.rest, 0, 3600) ?? 90,
        skipped: !!e.skipped,
        sets: (Array.isArray(e.sets) ? e.sets : [])
          .filter((st) => isObj(st) && num(st.weight) !== null && num(st.reps, 0, 1000) !== null)
          .map((st) => ({ weight: st.weight, reps: st.reps, doneAt: num(st.doneAt, 0, 1e14) ?? 0 })),
      }));
    sessions.push({
      id: s.id,
      date: s.date,
      cycleDayId: isStr(s.cycleDayId) ? s.cycleDayId : '',
      dayName: cleanName(s.dayName) || '—',
      dayNumber: num(s.dayNumber, 1, 1000),
      // Una sesión activa importada se considera abandonada para no bloquear la app.
      status: s.status === 'active' ? 'abandoned' : s.status,
      startedAt: num(s.startedAt, 0, 1e14) ?? 0,
      endedAt: num(s.endedAt, 0, 1e14),
      restEndsAt: null,
      entries,
    });
  }

  const settings = {};
  const st = isObj(d.settings) ? d.settings : {};
  if (['es', 'pt', 'en'].includes(st.lang)) settings.lang = st.lang;
  if (typeof st.name === 'string') settings.name = cleanName(st.name, 40);
  if (['kg', 'lb'].includes(st.unit)) settings.unit = st.unit;
  if (num(st.weightStep, 0.25, 50) !== null) settings.weightStep = st.weightStep;
  if (num(st.defaultRest, 0, 3600) !== null) settings.defaultRest = st.defaultRest;
  if (Array.isArray(st.restWeekdays)) settings.restWeekdays = [...new Set(st.restWeekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  if (typeof st.sound === 'boolean') settings.sound = st.sound;
  if (typeof st.soundInSilent === 'boolean') settings.soundInSilent = st.soundInSilent;

  const data = { settings, exercises, cycleDays, sessions };
  return { ok: true, data, counts: { days: cycleDays.length, exercises: exercises.length, sessions: sessions.length } };
}

/**
 * Fusiona un respaldo en los datos actuales: agrega lo que falta y no pisa nada existente.
 * Ejercicios con el mismo nombre se unifican (se reasignan sus ids en Días y sesiones).
 */
export function mergeData(current, incoming) {
  const exercises = current.exercises.map((e) => ({ ...e }));
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const byKey = new Map(exercises.map((e) => [e.nameKey, e]));
  const remap = new Map();
  for (const e of incoming.exercises) {
    if (byId.has(e.id)) continue;
    const same = byKey.get(e.nameKey);
    if (same) {
      remap.set(e.id, same.id);
      same.currentWeight = Math.max(same.currentWeight || 0, e.currentWeight || 0);
      continue;
    }
    exercises.push(e);
    byId.set(e.id, e);
    byKey.set(e.nameKey, e);
  }
  const mapId = (id) => remap.get(id) ?? id;

  const dayIds = new Set(current.cycleDays.map((d) => d.id));
  let order = current.cycleDays.reduce((m, d) => Math.max(m, d.order), -1);
  const cycleDays = [
    ...current.cycleDays,
    ...incoming.cycleDays
      .filter((d) => !dayIds.has(d.id))
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, order: ++order, items: d.items.map((it) => ({ ...it, exerciseId: mapId(it.exerciseId) })) })),
  ];

  const sesIds = new Set(current.sessions.map((s) => s.id));
  const sessions = [
    ...current.sessions,
    ...incoming.sessions.filter((s) => !sesIds.has(s.id)).map((s) => ({ ...s, entries: s.entries.map((e) => ({ ...e, exerciseId: mapId(e.exerciseId) })) })),
  ];

  return { exercises, cycleDays, sessions };
}

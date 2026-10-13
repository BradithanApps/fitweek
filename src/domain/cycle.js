// Lógica del ciclo rotativo. Funciones puras: no tocan DOM ni base de datos.
//
// Reglas:
// 1. Sugerencia de hoy = el Día que sigue al último COMPLETADO (vuelve al Día 1 tras el último).
// 2. Un día sin entreno es descanso y no hace avanzar el ciclo.
// 3. Se puede elegir cualquier Día; el ciclo continúa desde lo que se hizo.

import { weekKeys, weekdayIndex } from './dates.js';

export function sortDays(days) {
  return [...days].sort((a, b) => a.order - b.order);
}

export function dayNumber(days, dayId) {
  const i = sortDays(days).findIndex((d) => d.id === dayId);
  return i < 0 ? null : i + 1;
}

export function lastDoneSession(sessions) {
  let best = null;
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    if (!best || (s.endedAt ?? 0) > (best.endedAt ?? 0)) best = s;
  }
  return best;
}

export function nextAfter(days, dayId) {
  const sorted = sortDays(days);
  if (!sorted.length) return null;
  const i = sorted.findIndex((d) => d.id === dayId);
  return i < 0 ? sorted[0] : sorted[(i + 1) % sorted.length];
}

/** Día sugerido según el historial (sin tener en cuenta elecciones manuales). */
export function suggestedDay(days, sessions) {
  const last = lastDoneSession(sessions);
  return last ? nextAfter(days, last.cycleDayId) : (sortDays(days)[0] ?? null);
}

/** Día que toca hoy, respetando la elección manual de hoy si existe y sigue siendo válida. */
export function todayDay(days, sessions, todayKey, todayPick) {
  if (todayPick && todayPick.date === todayKey) {
    const picked = days.find((d) => d.id === todayPick.dayId);
    if (picked) return picked;
  }
  return suggestedDay(days, sessions);
}

/** Último completado (fecha) de cada Día: { [dayId]: 'YYYY-MM-DD' } */
export function lastDoneByDay(sessions) {
  const out = {};
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    if (!out[s.cycleDayId] || s.date > out[s.cycleDayId]) out[s.cycleDayId] = s.date;
  }
  return out;
}

/**
 * Franja de la semana (lunes a domingo) con lo hecho, hoy y la proyección.
 * Cada elemento: { date, state, dayId, number }
 * state: 'done' | 'rest' | 'active' | 'today' | 'planned' | 'planned-rest'
 */
export function projectWeek({ todayKey, days, sessions, restWeekdays = [], todayPick = null }) {
  const sorted = sortDays(days);
  const num = (id) => dayNumber(sorted, id);
  const byDate = new Map();
  for (const s of sessions) {
    if (s.status === 'abandoned') continue;
    const prev = byDate.get(s.date);
    // En un mismo día priorizamos el último terminado; una sesión activa se ve si no hay terminada.
    if (!prev || (s.status === 'done' && (prev.status !== 'done' || s.endedAt > prev.endedAt))) byDate.set(s.date, s);
  }

  const out = [];
  let cursor = null; // Próximo Día proyectado para los días futuros
  for (const date of weekKeys(todayKey)) {
    const s = byDate.get(date);
    if (date < todayKey) {
      out.push(s && s.status === 'done' ? { date, state: 'done', dayId: s.cycleDayId, number: num(s.cycleDayId) } : { date, state: 'rest', dayId: null, number: null });
      continue;
    }
    if (date === todayKey) {
      if (s && s.status === 'done') {
        out.push({ date, state: 'done', dayId: s.cycleDayId, number: num(s.cycleDayId) });
        cursor = nextAfter(sorted, s.cycleDayId);
      } else if (s && s.status === 'active') {
        out.push({ date, state: 'active', dayId: s.cycleDayId, number: num(s.cycleDayId) });
        cursor = nextAfter(sorted, s.cycleDayId);
      } else {
        const d = todayDay(sorted, sessions, todayKey, todayPick);
        out.push({ date, state: 'today', dayId: d?.id ?? null, number: d ? num(d.id) : null });
        const isRestDay = restWeekdays.includes(weekdayIndex(date));
        cursor = d ? (isRestDay ? d : nextAfter(sorted, d.id)) : null;
      }
      continue;
    }
    // Futuro: proyección
    if (restWeekdays.includes(weekdayIndex(date)) || !cursor) {
      out.push({ date, state: 'planned-rest', dayId: null, number: null });
    } else {
      out.push({ date, state: 'planned', dayId: cursor.id, number: num(cursor.id) });
      cursor = nextAfter(sorted, cursor.id);
    }
  }
  return out;
}

/** Minutos estimados de un Día: ~40 s por serie más el descanso entre series. */
export function estimateMinutes(day, defaultRest = 90) {
  let seconds = 0;
  for (const it of day.items || []) {
    const rest = it.rest ?? defaultRest;
    seconds += it.sets * 40 + Math.max(0, it.sets - 1) * rest + 60; // +60 s de cambio de ejercicio
  }
  if (!seconds) return 0;
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

// Métricas derivadas del historial. Nada de esto se guarda: se calcula desde las sesiones.

import { addDays, startOfWeek, weekKeys } from './dates.js';

export function weeklyGoal(restWeekdays = []) {
  return Math.max(1, 7 - restWeekdays.length);
}

export function doneSessions(sessions) {
  return sessions.filter((s) => s.status === 'done');
}

export function sessionVolume(session) {
  let v = 0;
  for (const e of session.entries || []) for (const set of e.sets || []) v += (Number(set.weight) || 0) * (Number(set.reps) || 0);
  return v;
}

export function sessionSetCount(session) {
  return (session.entries || []).reduce((n, e) => n + (e.sets?.length || 0), 0);
}

/** Días distintos con entreno completado en la semana de `key`. */
export function trainedDaysInWeek(sessions, key) {
  const keys = new Set(weekKeys(key));
  return new Set(doneSessions(sessions).filter((s) => keys.has(s.date)).map((s) => s.date)).size;
}

export function weekVolume(sessions, key) {
  const keys = new Set(weekKeys(key));
  return doneSessions(sessions)
    .filter((s) => keys.has(s.date))
    .reduce((v, s) => v + sessionVolume(s), 0);
}

/** Volumen por semana, de la más antigua a la actual. */
export function weeklyVolumes(sessions, todayKey, weeks = 8) {
  const start = startOfWeek(todayKey);
  return Array.from({ length: weeks }, (_, i) => {
    const wk = addDays(start, -7 * (weeks - 1 - i));
    return { week: wk, volume: weekVolume(sessions, wk) };
  });
}

/**
 * Racha en semanas seguidas cumpliendo el objetivo. La semana en curso suma solo si ya se cumplió;
 * si todavía no, no corta la racha.
 */
export function streakWeeks(sessions, todayKey, goal) {
  let wk = startOfWeek(todayKey);
  let streak = 0;
  if (trainedDaysInWeek(sessions, wk) >= goal) streak++;
  wk = addDays(wk, -7);
  while (trainedDaysInWeek(sessions, wk) >= goal) {
    streak++;
    wk = addDays(wk, -7);
  }
  return streak;
}

export function bestStreakWeeks(sessions, todayKey, goal) {
  const done = doneSessions(sessions);
  if (!done.length) return 0;
  const first = done.reduce((m, s) => (s.date < m ? s.date : m), done[0].date);
  let wk = startOfWeek(first);
  const end = startOfWeek(todayKey);
  let best = 0;
  let cur = 0;
  while (wk <= end) {
    if (trainedDaysInWeek(sessions, wk) >= goal) best = Math.max(best, ++cur);
    else if (wk !== end) cur = 0;
    wk = addDays(wk, 7);
  }
  return best;
}

/**
 * Récords por ejercicio: el mayor peso completado (y sus reps). Para ejercicios "al fallo"
 * sin peso, el récord son las reps.
 * Devuelve [{ exerciseId, name, weight, reps, date }] ordenado por nombre.
 */
export function personalRecords(sessions) {
  const map = new Map();
  for (const s of doneSessions(sessions)) {
    for (const e of s.entries || []) {
      for (const set of e.sets || []) {
        const cur = map.get(e.exerciseId);
        const better =
          !cur || set.weight > cur.weight || (set.weight === cur.weight && set.reps > cur.reps);
        if (better) map.set(e.exerciseId, { exerciseId: e.exerciseId, name: e.name, weight: set.weight, reps: set.reps, date: s.date });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Historial de un ejercicio: [{ date, sessionId, topWeight, topReps, sets }] cronológico. */
export function exerciseHistory(sessions, exerciseId) {
  const out = [];
  for (const s of doneSessions(sessions)) {
    const sets = (s.entries || []).filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets || []);
    if (!sets.length) continue;
    const top = sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
    out.push({ date: s.date, sessionId: s.id, topWeight: top.weight, topReps: top.reps, sets });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

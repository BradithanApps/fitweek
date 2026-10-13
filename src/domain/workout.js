// Operaciones puras sobre una sesión de entrenamiento. Cada función devuelve una sesión nueva.

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Crea una sesión a partir de un Día del ciclo. exercises: Map id → ejercicio */
export function createSession({ day, dayNumber, exercises, dateKey, now = Date.now(), defaultRest = 90 }) {
  return {
    id: newId(),
    date: dateKey,
    cycleDayId: day.id,
    dayName: day.name,
    dayNumber,
    status: 'active',
    startedAt: now,
    endedAt: null,
    restEndsAt: null,
    entries: (day.items || [])
      .map((it) => {
        const ex = exercises.get(it.exerciseId);
        if (!ex) return null;
        return makeEntry(ex, it, defaultRest);
      })
      .filter(Boolean),
  };
}

export function makeEntry(exercise, item, defaultRest = 90) {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    mode: exercise.mode === 'max' ? 'max' : 'reps',
    target: { sets: item.sets, reps: exercise.mode === 'max' ? null : item.reps },
    rest: item.rest ?? defaultRest,
    skipped: false,
    sets: [],
  };
}

export function entryDone(entry) {
  return entry.skipped || entry.sets.length >= entry.target.sets;
}

export function nextPendingIndex(session, from = 0) {
  const n = session.entries.length;
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n;
    if (!entryDone(session.entries[i])) return i;
  }
  return -1;
}

export function allDone(session) {
  return session.entries.length > 0 && session.entries.every(entryDone);
}

export function hasAnySet(session) {
  return session.entries.some((e) => e.sets.length > 0);
}

function withEntry(session, index, fn) {
  return { ...session, entries: session.entries.map((e, i) => (i === index ? fn(e) : e)) };
}

export function completeSet(session, index, { weight, reps }, now = Date.now()) {
  const entry = session.entries[index];
  const next = withEntry(session, index, (e) => ({ ...e, skipped: false, sets: [...e.sets, { weight, reps, doneAt: now }] }));
  next.restEndsAt = now + entry.rest * 1000;
  return next;
}

export function updateSet(session, index, setIndex, patch) {
  return withEntry(session, index, (e) => ({ ...e, sets: e.sets.map((st, i) => (i === setIndex ? { ...st, ...patch } : st)) }));
}

export function removeSet(session, index, setIndex) {
  return withEntry(session, index, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIndex) }));
}

export function setSkipped(session, index, skipped) {
  return withEntry(session, index, (e) => ({ ...e, skipped }));
}

export function addEntry(session, entry) {
  return { ...session, entries: [...session.entries, entry] };
}

/** Valores iniciales de la próxima serie: lo último que hiciste en esta sesión, o el peso de trabajo. */
export function nextSetDefaults(entry, exercise) {
  const last = entry.sets[entry.sets.length - 1];
  return {
    weight: last ? last.weight : (exercise?.currentWeight ?? 0),
    reps: last && entry.mode === 'max' ? last.reps : (entry.target.reps ?? last?.reps ?? 10),
  };
}

/** Peso de trabajo tras completar una serie: solo sube, nunca baja automáticamente. */
export function nextWorkingWeight(current, completedWeight) {
  const c = Number(current) || 0;
  const w = Number(completedWeight) || 0;
  return w > c ? w : c;
}

export function finish(session, now = Date.now()) {
  return { ...session, status: 'done', endedAt: now, restEndsAt: null };
}

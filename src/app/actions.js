// Acciones que combinan dominio + persistencia. Las vistas llaman a estas funciones.

import { app, updateSettings } from './state.js';
import { navigate } from './router.js';
import { toKey } from '../domain/dates.js';
import { dayNumber } from '../domain/cycle.js';
import * as W from '../domain/workout.js';
import { listDays, getDay } from '../db/repos/cycle.js';
import { exercisesMap, bumpWorkingWeight, upsertExerciseByName } from '../db/repos/exercises.js';
import { getActiveSession, saveSession } from '../db/repos/sessions.js';

export async function startWorkout(dayId) {
  const active = await getActiveSession();
  if (active) return navigate('/workout');
  const [day, days, exercises] = await Promise.all([getDay(dayId), listDays(), exercisesMap()]);
  if (!day) return;
  const session = W.createSession({
    day,
    dayNumber: dayNumber(days, day.id),
    exercises,
    dateKey: toKey(),
    defaultRest: app.settings.defaultRest,
  });
  await saveSession(session);
  if (app.settings.todayPick) await updateSettings({ todayPick: null });
  navigate(session.entries.length ? '/workout/0' : '/workout');
}

export async function pickToday(dayId) {
  await updateSettings({ todayPick: { date: toKey(), dayId } });
}

/** Completa una serie, guarda al instante y sube el peso de trabajo si corresponde. */
export async function completeSet(session, index, values) {
  const next = W.completeSet(session, index, values);
  await saveSession(next);
  await bumpWorkingWeight(session.entries[index].exerciseId, values.weight);
  return next;
}

export async function persist(session) {
  await saveSession(session);
  return session;
}

export async function addExerciseToSession(session, { name, sets, reps, mode, weight }) {
  const ex = await upsertExerciseByName(name, { mode, weight });
  const entry = W.makeEntry(ex, { sets, reps, rest: null }, app.settings.defaultRest);
  const next = W.addEntry(session, entry);
  await saveSession(next);
  return next;
}

export async function finishWorkout(session) {
  const done = W.finish(session);
  await saveSession(done);
  navigate(`/summary/${done.id}`, { replace: true });
}

export async function abandonWorkout(session) {
  await saveSession({ ...session, status: 'abandoned', endedAt: Date.now(), restEndsAt: null });
  navigate('/', { replace: true });
}

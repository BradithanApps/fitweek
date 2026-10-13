import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakWeeks, bestStreakWeeks, trainedDaysInWeek, personalRecords, sessionVolume, weeklyVolumes } from '../src/domain/stats.js';
import { addDays } from '../src/domain/dates.js';
import { completeSet, createSession, finish, nextSetDefaults, nextWorkingWeight, nextPendingIndex } from '../src/domain/workout.js';

const MON = '2026-10-12';
const s = (date, sets = [[80, 10]]) => ({
  id: date + Math.random(),
  date,
  status: 'done',
  endedAt: 1,
  cycleDayId: 'd1',
  entries: [{ exerciseId: 'e1', name: 'Press plano', sets: sets.map(([weight, reps]) => ({ weight, reps })) }],
});

test('volumen de sesión', () => {
  assert.equal(sessionVolume(s(MON, [[80, 10], [80, 8]])), 1440);
});

test('días entrenados cuenta días distintos', () => {
  assert.equal(trainedDaysInWeek([s(MON), s(MON), s(addDays(MON, 2))], MON), 2);
});

test('racha en semanas: la semana en curso no corta la racha', () => {
  const prev = addDays(MON, -7);
  const prev2 = addDays(MON, -14);
  const sessions = [...[0, 1, 2].map((i) => s(addDays(prev, i))), ...[0, 1, 2].map((i) => s(addDays(prev2, i))), s(MON)];
  assert.equal(streakWeeks(sessions, addDays(MON, 1), 3), 2);
  sessions.push(s(addDays(MON, 1)), s(addDays(MON, 2)));
  assert.equal(streakWeeks(sessions, addDays(MON, 2), 3), 3);
  assert.equal(bestStreakWeeks(sessions, addDays(MON, 2), 3), 3);
});

test('récords: mayor peso, a igual peso más reps', () => {
  const r = personalRecords([s(MON, [[80, 10]]), s(addDays(MON, 2), [[85, 6], [85, 8]])]);
  assert.equal(r[0].weight, 85);
  assert.equal(r[0].reps, 8);
});

test('volúmenes semanales: 8 semanas, la última es la actual', () => {
  const v = weeklyVolumes([s(MON, [[100, 10]])], addDays(MON, 3), 8);
  assert.equal(v.length, 8);
  assert.equal(v[7].volume, 1000);
  assert.equal(v[6].volume, 0);
});

test('flujo de sesión: el peso sube y se arrastra; bajar no cambia el peso de trabajo', () => {
  const ex = { id: 'e1', name: 'Press plano', currentWeight: 80, mode: 'reps' };
  const day = { id: 'd2', name: 'Pecho', items: [{ exerciseId: 'e1', sets: 3, reps: 10, rest: 60 }] };
  let ses = createSession({ day, dayNumber: 2, exercises: new Map([['e1', ex]]), dateKey: MON, now: 0 });
  assert.deepEqual(nextSetDefaults(ses.entries[0], ex), { weight: 80, reps: 10 });

  ses = completeSet(ses, 0, { weight: 85, reps: 10 }, 1000);
  assert.equal(ses.restEndsAt, 61000);
  ex.currentWeight = nextWorkingWeight(ex.currentWeight, 85);
  assert.equal(ex.currentWeight, 85);
  // La siguiente serie arranca con 85
  assert.equal(nextSetDefaults(ses.entries[0], ex).weight, 85);

  ses = completeSet(ses, 0, { weight: 75, reps: 10 }, 2000);
  ex.currentWeight = nextWorkingWeight(ex.currentWeight, 75);
  assert.equal(ex.currentWeight, 85, 'bajar por cansancio no baja el peso de trabajo');

  ses = completeSet(ses, 0, { weight: 75, reps: 9 }, 3000);
  assert.equal(nextPendingIndex(ses), -1);
  ses = finish(ses, 4000);
  assert.equal(ses.status, 'done');
});

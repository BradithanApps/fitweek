import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, mergeData } from '../src/domain/backup.js';
import { exampleCycle } from '../src/domain/seed.js';

const sample = () => {
  const { exercises, cycleDays } = exampleCycle('es');
  const sessions = [
    {
      id: 's1',
      date: '2026-10-12',
      cycleDayId: cycleDays[0].id,
      dayName: 'Piernas',
      dayNumber: 1,
      status: 'done',
      startedAt: 1,
      endedAt: 2,
      restEndsAt: null,
      entries: [{ exerciseId: exercises[0].id, name: 'Prensa', mode: 'reps', target: { sets: 4, reps: 10 }, rest: 90, skipped: false, sets: [{ weight: 120, reps: 10, doneAt: 3 }] }],
    },
  ];
  return { settings: { lang: 'es', name: 'Braien', unit: 'kg', onboarded: true }, exercises, cycleDays, sessions };
};

test('el ejemplo tiene 5 días y ejercicios compartidos', () => {
  const { exercises, cycleDays } = exampleCycle('es');
  assert.equal(cycleDays.length, 5);
  assert.equal(cycleDays[0].name, 'Piernas');
  assert.deepEqual(cycleDays[3].items.map((i) => [i.sets, i.reps])[2], [4, 8]); // Hack péndulo 4×8
  const triceps = exercises.find((e) => e.name === 'Tríceps cuerda');
  assert.ok(cycleDays[1].items.some((i) => i.exerciseId === triceps.id));
  assert.ok(cycleDays[4].items.some((i) => i.exerciseId === triceps.id));
  assert.equal(exampleCycle('pt').cycleDays[1].name, 'Peito');
});

test('ida y vuelta: exportar y volver a importar conserva los datos', () => {
  const data = sample();
  const json = JSON.stringify(buildBackup(data));
  const parsed = parseBackup(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.exercises.length, data.exercises.length);
  assert.equal(parsed.data.cycleDays.length, 5);
  assert.equal(parsed.data.sessions[0].entries[0].sets[0].weight, 120);
  assert.equal(parsed.data.settings.name, 'Braien');
  assert.equal('onboarded' in parsed.data.settings, false);
});

test('rechaza archivos que no son de FitWeek o son de una versión futura', () => {
  assert.equal(parseBackup('no json').error, 'backup.errNotJson');
  assert.equal(parseBackup({ app: 'otra', data: {} }).error, 'backup.errNotFitweek');
  assert.equal(parseBackup({ app: 'fitweek', schema: 99, data: {} }).error, 'backup.errNewer');
});

test('limpia datos inválidos sin romper', () => {
  const r = parseBackup({
    app: 'fitweek',
    schema: 1,
    data: { exercises: [{ id: 'x', name: '  Press   plano ' }, { id: 'x', name: 'dup' }, { name: 'sin id' }], cycleDays: [{ id: 'd', items: [{ exerciseId: 'nope' }, { exerciseId: 'x', sets: 3, reps: 10 }] }], sessions: [{ id: 's', date: '2026-13-40', status: 'done' }] },
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.exercises.length, 1);
  assert.equal(r.data.exercises[0].name, 'Press plano');
  assert.equal(r.data.cycleDays[0].items.length, 1);
  assert.equal(r.data.sessions.length, 0);
});

test('fusionar unifica ejercicios por nombre y no duplica', () => {
  const cur = sample();
  const inc = parseBackup(JSON.stringify(buildBackup(sample()))).data; // ids nuevos, mismos nombres
  const merged = mergeData(cur, inc);
  assert.equal(merged.exercises.length, cur.exercises.length);
  assert.equal(merged.cycleDays.length, 10);
  const ids = new Set(merged.exercises.map((e) => e.id));
  assert.ok(merged.cycleDays.every((d) => d.items.every((i) => ids.has(i.exerciseId))));
  // Fusionar consigo mismo no agrega nada
  const self = mergeData(cur, parseBackup(JSON.stringify(buildBackup(cur))).data);
  assert.equal(self.cycleDays.length, 5);
  assert.equal(self.sessions.length, 1);
});

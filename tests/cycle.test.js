import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestedDay, todayDay, projectWeek, nextAfter, estimateMinutes } from '../src/domain/cycle.js';
import { addDays, toKey, fromKey, weekdayIndex, startOfWeek, diffDays } from '../src/domain/dates.js';

const days = [1, 2, 3, 4, 5].map((n) => ({ id: `d${n}`, order: n - 1, name: `Día ${n}`, items: [] }));
const done = (date, dayId, endedAt) => ({ id: `${date}-${dayId}`, date, cycleDayId: dayId, status: 'done', endedAt, entries: [] });

// Semana del ejemplo: lunes 2026-10-12
const MON = '2026-10-12';

test('sin historial se sugiere el Día 1', () => {
  assert.equal(suggestedDay(days, []).id, 'd1');
});

test('ejemplo del usuario: lunes D1, martes falta, miércoles D2, jueves elige D5, viernes sugiere D1', () => {
  const s = [];
  s.push(done(MON, 'd1', 1));
  // Martes: no va. La sugerencia sigue siendo D2.
  assert.equal(suggestedDay(days, s).id, 'd2');
  // Miércoles hace D2
  s.push(done(addDays(MON, 2), 'd2', 2));
  assert.equal(suggestedDay(days, s).id, 'd3');
  // Jueves elige D5 en vez de D3
  s.push(done(addDays(MON, 3), 'd5', 3));
  // Viernes: se sugiere D1 (vuelve al inicio)
  assert.equal(suggestedDay(days, s).id, 'd1');
  // ...y puede cambiarlo a D3 para hoy
  const fri = addDays(MON, 4);
  assert.equal(todayDay(days, s, fri, { date: fri, dayId: 'd3' }).id, 'd3');
  // Si hace D3, el sábado se sugiere D4
  s.push(done(fri, 'd3', 4));
  assert.equal(suggestedDay(days, s).id, 'd4');
});

test('si hoy toca D2 y hace D4, mañana toca D5', () => {
  const s = [done(MON, 'd1', 1), done(addDays(MON, 1), 'd4', 2)];
  assert.equal(suggestedDay(days, s).id, 'd5');
});

test('la elección manual de otro día no aplica', () => {
  const s = [done(MON, 'd1', 1)];
  assert.equal(todayDay(days, s, addDays(MON, 1), { date: MON, dayId: 'd4' }).id, 'd2');
});

test('si el último Día hecho se borró, se vuelve al Día 1', () => {
  assert.equal(nextAfter(days, 'borrado').id, 'd1');
});

test('el orden manda: reordenar cambia la rotación', () => {
  const reordered = days.map((d) => ({ ...d, order: d.id === 'd3' ? 1 : d.id === 'd2' ? 2 : d.order }));
  assert.equal(nextAfter(reordered, 'd1').id, 'd3');
});

test('proyección de la semana con descansos sábado y domingo', () => {
  const wed = addDays(MON, 2);
  const s = [done(MON, 'd1', 1)];
  const week = projectWeek({ todayKey: wed, days, sessions: s, restWeekdays: [5, 6] });
  assert.deepEqual(
    week.map((w) => [w.state, w.number]),
    [
      ['done', 1],
      ['rest', null],
      ['today', 2],
      ['planned', 3],
      ['planned', 4],
      ['planned-rest', null],
      ['planned-rest', null],
    ],
  );
});

test('proyección cuando hoy ya está hecho', () => {
  const s = [done(MON, 'd5', 1)];
  const week = projectWeek({ todayKey: MON, days, sessions: s, restWeekdays: [] });
  assert.deepEqual(week.slice(0, 3).map((w) => w.number), [5, 1, 2]);
});

test('fechas locales: semana empieza el lunes y diffDays', () => {
  assert.equal(weekdayIndex(MON), 0);
  assert.equal(startOfWeek('2026-10-18'), MON);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDays('2026-10-12', '2026-10-18'), 6);
  assert.equal(toKey(fromKey('2026-02-28')), '2026-02-28');
  // Un entreno a las 22:30 sigue siendo el mismo día
  assert.equal(toKey(new Date(2026, 9, 13, 22, 30)), '2026-10-13');
});

test('estimación de minutos', () => {
  assert.equal(estimateMinutes({ items: [] }), 0);
  const m = estimateMinutes({ items: [{ sets: 4, rest: 90 }, { sets: 3, rest: 90 }] }, 90);
  assert.ok(m >= 15 && m <= 25, `estimado ${m}`);
});

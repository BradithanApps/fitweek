import { tx, req, getAll, getOne, putOne } from '../db.js';
import { sortDays } from '../../domain/cycle.js';
import { newId } from '../../domain/workout.js';
import { cleanName } from '../../domain/text.js';

export async function listDays() {
  return sortDays(await getAll('cycleDays'));
}

export const getDay = (id) => getOne('cycleDays', id);
export const saveDay = (day) => putOne('cycleDays', day);

export async function addDay(name) {
  const days = await listDays();
  const day = { id: newId(), order: days.length ? days[days.length - 1].order + 1 : 0, name: cleanName(name), items: [] };
  await saveDay(day);
  return day;
}

/** Elimina un Día y renumera el orden. El historial conserva su copia del nombre. */
export function deleteDay(id) {
  return tx(['cycleDays'], 'readwrite', async (t) => {
    const store = t.objectStore('cycleDays');
    await req(store.delete(id));
    const rest = sortDays(await req(store.getAll()));
    await Promise.all(rest.map((d, i) => req(store.put({ ...d, order: i }))));
  });
}

/** Mueve un Día una posición (dir = -1 sube, +1 baja). */
export function moveDay(id, dir) {
  return tx(['cycleDays'], 'readwrite', async (t) => {
    const store = t.objectStore('cycleDays');
    const days = sortDays(await req(store.getAll()));
    const i = days.findIndex((d) => d.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    await Promise.all(days.map((d, k) => req(store.put({ ...d, order: k }))));
  });
}

export async function duplicateDay(id, suffix) {
  const day = await getDay(id);
  if (!day) return null;
  const days = await listDays();
  const copy = { ...day, id: newId(), order: days[days.length - 1].order + 1, name: cleanName(`${day.name} ${suffix}`), items: day.items.map((it) => ({ ...it })) };
  await saveDay(copy);
  return copy;
}

/** Guarda un orden nuevo completo: orderedIds es la lista de ids en la posición deseada. */
export function reorderDays(orderedIds) {
  return tx(['cycleDays'], 'readwrite', async (t) => {
    const store = t.objectStore('cycleDays');
    const days = await req(store.getAll());
    const pos = new Map(orderedIds.map((id, i) => [id, i]));
    // Los Días que no vinieron en la lista (no debería pasar) quedan al final, en su orden.
    const rest = sortDays(days.filter((d) => !pos.has(d.id)));
    rest.forEach((d, i) => pos.set(d.id, orderedIds.length + i));
    await Promise.all(days.map((d) => req(store.put({ ...d, order: pos.get(d.id) }))));
  });
}

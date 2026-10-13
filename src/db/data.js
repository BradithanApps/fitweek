// Operaciones que tocan varios almacenes a la vez (respaldo, borrado total, ejemplo inicial).

import { tx, req } from './db.js';

const STORES = ['settings', 'exercises', 'cycleDays', 'sessions'];

export async function readAll() {
  return tx(STORES, 'readonly', async (t) => {
    const [keys, values, exercises, cycleDays, sessions] = await Promise.all([
      req(t.objectStore('settings').getAllKeys()),
      req(t.objectStore('settings').getAll()),
      req(t.objectStore('exercises').getAll()),
      req(t.objectStore('cycleDays').getAll()),
      req(t.objectStore('sessions').getAll()),
    ]);
    const settings = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
    return { settings, exercises, cycleDays, sessions };
  });
}

/** Reemplaza ejercicios, Días y sesiones (y fusiona ajustes) en una sola transacción. */
export async function writeAll({ exercises, cycleDays, sessions, settings = {} }) {
  return tx(STORES, 'readwrite', async (t) => {
    const ex = t.objectStore('exercises');
    const cd = t.objectStore('cycleDays');
    const ss = t.objectStore('sessions');
    const st = t.objectStore('settings');
    await Promise.all([req(ex.clear()), req(cd.clear()), req(ss.clear())]);
    await Promise.all([
      ...exercises.map((e) => req(ex.put(e))),
      ...cycleDays.map((d) => req(cd.put(d))),
      ...sessions.map((s) => req(ss.put(s))),
      ...Object.entries(settings).map(([k, v]) => req(st.put(v, k))),
    ]);
  });
}

/** Agrega ejercicios y Días (ejemplo inicial). */
export async function addCycle({ exercises, cycleDays }) {
  return tx(['exercises', 'cycleDays'], 'readwrite', async (t) => {
    const ex = t.objectStore('exercises');
    const cd = t.objectStore('cycleDays');
    await Promise.all([...exercises.map((e) => req(ex.put(e))), ...cycleDays.map((d) => req(cd.put(d)))]);
  });
}

export async function eraseAll() {
  return tx(STORES, 'readwrite', (t) => Promise.all(STORES.map((s) => req(t.objectStore(s).clear()))));
}

import { tx, req, getAll, getOne, putOne } from '../db.js';
import { nameKey, cleanName } from '../../domain/text.js';
import { newId, nextWorkingWeight } from '../../domain/workout.js';

export const listExercises = () => getAll('exercises');
export const getExercise = (id) => getOne('exercises', id);
export const saveExercise = (ex) => putOne('exercises', ex);

export async function exercisesMap() {
  return new Map((await listExercises()).map((e) => [e.id, e]));
}

/**
 * Busca un ejercicio por nombre (sin distinguir tildes ni mayúsculas) o lo crea.
 * Si ya existe, actualiza su modo y, si se indicó, su peso.
 */
export function upsertExerciseByName(name, { weight = null, mode = 'reps' } = {}) {
  const clean = cleanName(name);
  const key = nameKey(clean);
  return tx(['exercises'], 'readwrite', async (t) => {
    const store = t.objectStore('exercises');
    const existing = await req(store.index('nameKey').get(key));
    if (existing) {
      const updated = { ...existing, mode, archived: false, ...(weight != null ? { currentWeight: weight } : {}) };
      await req(store.put(updated));
      return updated;
    }
    const ex = { id: newId(), name: clean, nameKey: key, currentWeight: weight ?? 0, mode, archived: false };
    await req(store.add(ex));
    return ex;
  });
}

/** Renombra un ejercicio. Devuelve false si ya existe otro con ese nombre. */
export function renameExercise(id, name) {
  const clean = cleanName(name);
  const key = nameKey(clean);
  return tx(['exercises'], 'readwrite', async (t) => {
    const store = t.objectStore('exercises');
    const other = await req(store.index('nameKey').get(key));
    if (other && other.id !== id) return false;
    const ex = await req(store.get(id));
    if (!ex) return false;
    await req(store.put({ ...ex, name: clean, nameKey: key }));
    return true;
  });
}

/** Sube el peso de trabajo si el peso completado es mayor. Devuelve el ejercicio actualizado. */
export function bumpWorkingWeight(id, completedWeight) {
  return tx(['exercises'], 'readwrite', async (t) => {
    const store = t.objectStore('exercises');
    const ex = await req(store.get(id));
    if (!ex) return null;
    const w = nextWorkingWeight(ex.currentWeight, completedWeight);
    if (w === ex.currentWeight) return ex;
    const updated = { ...ex, currentWeight: w };
    await req(store.put(updated));
    return updated;
  });
}

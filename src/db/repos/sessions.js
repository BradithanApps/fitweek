import { tx, req, getAll, getOne, putOne, deleteOne } from '../db.js';

export const listSessions = () => getAll('sessions');
export const getSession = (id) => getOne('sessions', id);
export const saveSession = (s) => putOne('sessions', s);
export const deleteSession = (id) => deleteOne('sessions', id);

export async function getActiveSession() {
  const active = await tx(['sessions'], 'readonly', (t) => req(t.objectStore('sessions').index('status').getAll('active')));
  // Si por algún motivo hay más de una, la más reciente manda.
  return active.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}

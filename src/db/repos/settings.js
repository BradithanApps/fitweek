import { tx, req, putOne } from '../db.js';

export const DEFAULT_SETTINGS = Object.freeze({
  lang: 'es',
  name: '',
  unit: 'kg',
  weightStep: 2.5,
  defaultRest: 90,
  restWeekdays: [5, 6],
  sound: true,
  soundInSilent: false,
  lastBackupAt: null,
  onboarded: false,
  todayPick: null, // { date, dayId } elección manual del Día de hoy
});

export async function loadSettings() {
  const out = { ...DEFAULT_SETTINGS, restWeekdays: [...DEFAULT_SETTINGS.restWeekdays] };
  await tx(['settings'], 'readonly', async (t) => {
    const store = t.objectStore('settings');
    const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
    keys.forEach((k, i) => {
      if (k in DEFAULT_SETTINGS) out[k] = values[i];
    });
  });
  return out;
}

export function saveSetting(key, value) {
  return putOne('settings', value, key);
}

export function saveSettings(obj) {
  return tx(['settings'], 'readwrite', async (t) => {
    const store = t.objectStore('settings');
    await Promise.all(Object.entries(obj).map(([k, v]) => req(store.put(v, k))));
  });
}

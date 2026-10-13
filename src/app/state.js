// Estado global mínimo: ajustes en memoria + bus de eventos.

import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../db/repos/settings.js';
import { setLang } from '../i18n/index.js';

export const app = {
  settings: { ...DEFAULT_SETTINGS },
  updatePending: null, // función que aplica una actualización de la app
};

const listeners = new Map();
export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type)?.delete(fn);
}
export function emit(type, payload) {
  listeners.get(type)?.forEach((fn) => fn(payload));
}

export async function initSettings() {
  app.settings = await loadSettings();
  setLang(app.settings.lang);
  return app.settings;
}

export async function updateSettings(patch) {
  await saveSettings(patch);
  Object.assign(app.settings, patch);
  if ('lang' in patch) {
    setLang(patch.lang);
    emit('lang');
  }
  emit('settings', patch);
}

export function unit() {
  return app.settings.unit === 'lb' ? 'lb' : 'kg';
}

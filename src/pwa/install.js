// Instalación de la app desde la web.
//
// - Android / Chrome / Edge: el navegador dispara `beforeinstallprompt`. Lo guardamos y, cuando el
//   usuario toca «Instalar», abrimos el diálogo nativo de instalación.
// - iPhone / iPad: Safari no permite instalar desde código (no existe `beforeinstallprompt`).
//   Mostramos una guía paso a paso del camino Compartir → «Añadir a pantalla de inicio».
//
// Este módulo se importa primero en main.js para no perder el evento si llega temprano.

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Evita la mini barra automática: usamos nuestro propio botón.
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** ¿Se está ejecutando como app instalada (pantalla completa, sin barra del navegador)? */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

/** iPhone, iPod o iPad (iPadOS se presenta como Mac con pantalla táctil). */
export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** En iOS, ¿es Safari? (Chrome, Firefox y Edge de iOS tienen su propio menú Compartir). */
export function isIOSSafari() {
  return isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent || '');
}

export const isMobile = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

/**
 * Cómo se puede instalar en este dispositivo:
 * 'installed' | 'prompt' (diálogo nativo disponible) | 'ios' (guía manual) | null (no se puede ofrecer)
 */
export function installMode() {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return null;
}

/** Abre el diálogo nativo. Devuelve 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null; // El evento solo se puede usar una vez.
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    notify();
    return outcome;
  } catch {
    notify();
    return 'unavailable';
  }
}

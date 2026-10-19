// Sonido de fin de descanso (Web Audio, sin archivos) y pantalla encendida (Wake Lock).

let ctx = null;
let playInSilent = false;

/**
 * iPhone: por defecto los sonidos web respetan el interruptor de silencio. Con la Audio Session API
 * (Safari 16.4+) se puede pedir el canal de reproducción, que suena igual en silencio pero puede
 * pausar la música de otras apps. Solo se activa si el usuario lo elige en Ajustes.
 */
export const canPlayInSilent = () => typeof navigator !== 'undefined' && 'audioSession' in navigator;

export function setPlayInSilent(on) {
  playInSilent = !!on;
  try {
    if (canPlayInSilent()) navigator.audioSession.type = playInSilent ? 'playback' : 'auto';
  } catch {
    /* no soportado */
  }
}

/** Debe llamarse durante un toque del usuario: iOS solo habilita el audio así. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    // Un sonido vacío dentro del toque termina de "despertar" la salida de audio en iOS.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    ctx = null;
  }
}

// iOS suspende el audio al bloquear la pantalla, con una llamada o al usar otra app:
// cualquier toque posterior lo reactiva.
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    },
    { capture: true, passive: true },
  );
}

/** Campanita de tres notas ascendentes, repetida dos veces. */
export function restDoneSound() {
  navigator.vibrate?.([200, 100, 200]);
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const now = ctx.currentTime + 0.02;
    const notes = [1046.5, 1318.5, 1568]; // Do6, Mi6, Sol6
    [0, 0.75].forEach((rep) =>
      notes.forEach((freq, i) => {
        const t0 = now + rep + i * 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === notes.length - 1 ? 0.45 : 0.2));
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.5);
      }),
    );
  } catch {
    /* sin sonido */
  }
}

/** Para el botón «Probar sonido» de Ajustes (se llama dentro del toque). */
export function testSound() {
  unlockAudio();
  restDoneSound();
}

let lock = null;
let wanted = false;

async function request() {
  try {
    if (wanted && 'wakeLock' in navigator && document.visibilityState === 'visible' && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    }
  } catch {
    lock = null; // No disponible: se ignora.
  }
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', request);

export function keepScreenOn(on) {
  wanted = on;
  if (on) request();
  else {
    lock?.release?.().catch(() => {});
    lock = null;
  }
}

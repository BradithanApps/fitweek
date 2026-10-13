// Sonido de fin de descanso (Web Audio, sin archivos) y pantalla encendida (Wake Lock).

let ctx = null;

/** iOS solo permite sonido si el contexto se crea/reanuda durante un toque del usuario. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep() {
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch {
    /* sin sonido */
  }
  navigator.vibrate?.(200);
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

document.addEventListener('visibilitychange', request);

export function keepScreenOn(on) {
  wanted = on;
  if (on) request();
  else {
    lock?.release?.().catch(() => {});
    lock = null;
  }
}

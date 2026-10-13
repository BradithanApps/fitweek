// Registro del Service Worker y flujo de actualización.
// Una versión nueva queda "en espera" hasta que el usuario toca Actualizar.

export function registerServiceWorker({ onUpdateReady }) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const start = async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (err) {
      console.warn('No se pudo registrar el Service Worker', err);
      return;
    }

    let userAccepted = false;
    const apply = (worker) => () => {
      userAccepted = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    };

    // Solo recargamos cuando el usuario aceptó la actualización (no en la primera instalación).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (userAccepted) window.location.reload();
    });

    if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(apply(reg.waiting));

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(apply(worker));
      });
    });

    // Al volver a la app, buscar una versión nueva (si hay conexión).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  };

  // boot() es asíncrono: el evento load puede haber ocurrido ya.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

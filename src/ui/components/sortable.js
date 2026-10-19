// Reordenar una lista arrastrando desde un asa (dedo o mouse, con Pointer Events).
// También funciona con teclado: con el asa enfocada, flecha arriba/abajo mueve el elemento.
//
// Marcado esperado:
//   <div data-sort-list>
//     <div data-sort-item> … <button data-drag-handle> … [data-sort-number] … </div>
//   </div>
// Si un elemento tiene [data-sort-number], su número se actualiza en vivo mientras se arrastra.

const EDGE = 90; // px desde el borde de la pantalla para el desplazamiento automático

export function makeSortable(list, { onMove }) {
  const items = () => [...list.querySelectorAll(':scope > [data-sort-item]')];

  const renumber = (order) => {
    order.forEach((el, i) => {
      const n = el.querySelector('[data-sort-number]');
      if (n) n.textContent = String(i + 1);
    });
  };

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle || !list.contains(handle) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const item = handle.closest('[data-sort-item]');
    const all = items();
    const from = all.indexOf(item);
    if (from < 0 || all.length < 2) return;
    e.preventDefault();

    const startScroll = window.scrollY;
    const rects = all.map((el) => el.getBoundingClientRect());
    const mids = rects.map((r) => r.top + startScroll + r.height / 2); // coordenadas de documento
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    const shift = rects[from].height + gap;
    const startY = e.clientY + startScroll;
    let lastClientY = e.clientY;
    let to = from;
    let raf = 0;

    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten */
    }
    item.classList.add('is-dragging');
    all.forEach((el) => el !== item && el.classList.add('sort-shift'));
    navigator.vibrate?.(10);

    const update = () => {
      const dy = lastClientY + window.scrollY - startY;
      // Limitar el arrastre al alto de la lista
      const minDy = rects[0].top - rects[from].top;
      const maxDy = rects[rects.length - 1].bottom - rects[from].bottom;
      const clamped = Math.max(minDy, Math.min(maxDy, dy));
      item.style.transform = `translateY(${clamped}px)`;

      const center = mids[from] + clamped;
      let next = 0;
      mids.forEach((m, i) => {
        if (i !== from && center > m) next++;
      });
      if (next !== to) {
        to = next;
        all.forEach((el, i) => {
          if (i === from) return;
          let y = 0;
          if (from < to && i > from && i <= to) y = -shift;
          if (from > to && i >= to && i < from) y = shift;
          el.style.transform = y ? `translateY(${y}px)` : '';
        });
        const order = all.filter((_, i) => i !== from);
        order.splice(to, 0, item);
        renumber(order);
      }
    };

    const autoScroll = () => {
      const vh = window.innerHeight;
      const bottomEdge = vh - EDGE - 70; // la barra de pestañas tapa ~70 px
      let delta = 0;
      if (lastClientY < EDGE) delta = -Math.ceil((EDGE - lastClientY) / 6);
      else if (lastClientY > bottomEdge) delta = Math.ceil((lastClientY - bottomEdge) / 6);
      if (delta) {
        window.scrollBy(0, delta);
        update();
      }
      raf = requestAnimationFrame(autoScroll);
    };
    raf = requestAnimationFrame(autoScroll);

    const onMoveEvt = (ev) => {
      lastClientY = ev.clientY;
      update();
    };
    const end = () => {
      cancelAnimationFrame(raf);
      handle.removeEventListener('pointermove', onMoveEvt);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      item.classList.remove('is-dragging');
      all.forEach((el) => {
        el.classList.remove('sort-shift');
        el.style.transform = '';
      });
      if (to !== from) {
        // Reordenar el DOM ya, para que no haya un salto mientras se guarda.
        const order = all.filter((_, i) => i !== from);
        order.splice(to, 0, item);
        list.append(...order);
        renumber(order);
        onMove(from, to);
      } else renumber(all);
    };
    handle.addEventListener('pointermove', onMoveEvt);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });

  // Teclado: flechas sobre el asa.
  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest?.('[data-drag-handle]');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const all = items();
    const from = all.indexOf(handle.closest('[data-sort-item]'));
    const to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (from < 0 || to < 0 || to >= all.length) return;
    e.preventDefault();
    const order = [...all];
    const [it] = order.splice(from, 1);
    order.splice(to, 0, it);
    list.append(...order);
    renumber(order);
    handle.focus();
    onMove(from, to);
  });
}

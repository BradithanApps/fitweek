import { h } from '../dom.js';

/** toast('Guardado') o toast('Nueva versión', { action: { label, onClick }, duration: 0 }) */
export function toast(message, { action, duration = 3200 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return () => {};
  const el = h(
    'div',
    { class: 'toast', role: 'status' },
    h('span', { class: 'flex-1 text-[15px]' }, message),
    action &&
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary min-h-10 px-4 text-sm',
          onClick: () => {
            remove();
            action.onClick();
          },
        },
        action.label,
      ),
  );
  const remove = () => el.remove();
  root.append(el);
  if (duration) setTimeout(remove, duration);
  return remove;
}

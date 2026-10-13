// Router por hash (#/plan, #/day/abc). Funciona en cualquier hosting estático y sin conexión.

import { mount } from '../ui/dom.js';

const routes = [];
let notFound = null;
let current = null; // { path, destroy }
let token = 0;
let viewEl = null;
let afterRender = () => {};
let beforeRender = () => null;

export function route(pattern, view, opts = {}) {
  const keys = [];
  const re = new RegExp(
    '^' +
      pattern.replace(/:(\w+)/g, (_, k) => {
        keys.push(k);
        return '([^/]+)';
      }) +
      '$',
  );
  routes.push({ re, keys, view, opts });
}

export function setNotFound(view) {
  notFound = view;
}

export const currentPath = () => decodeURI(location.hash.slice(1)) || '/';

export function navigate(path, { replace = false } = {}) {
  const hash = '#' + path;
  if (location.hash === hash) return refresh();
  if (replace) {
    history.replaceState(null, '', hash);
    render();
  } else location.hash = hash;
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { ...r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return { view: notFound, params: {}, opts: {} };
}

export async function render() {
  const path = currentPath();
  const redirect = beforeRender(path);
  if (redirect && redirect !== path) return navigate(redirect, { replace: true });

  const same = current?.path === path;
  const my = ++token;
  const m = match(path);
  let result;
  try {
    result = await m.view({ params: m.params, path, refresh });
  } catch (err) {
    console.error(err);
    result = m.opts.onError ? m.opts.onError(err) : null;
  }
  if (my !== token) {
    result?.destroy?.();
    return;
  }
  current?.destroy?.();
  const el = result instanceof Node ? result : result?.el;
  current = { path, destroy: result instanceof Node ? null : result?.destroy };
  const scroll = window.scrollY;
  if (el) {
    if (!same) el.classList.add('animate-enter');
    mount(viewEl, el);
  }
  if (same) window.scrollTo(0, scroll);
  else {
    window.scrollTo(0, 0);
    viewEl.focus({ preventScroll: true });
  }
  afterRender(path, m.opts);
}

export const refresh = () => render();

export function startRouter({ el, before, after }) {
  viewEl = el;
  beforeRender = before || beforeRender;
  afterRender = after || afterRender;
  window.addEventListener('hashchange', render);
  render();
}

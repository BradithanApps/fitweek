import { h, mount } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/components/toast.js';
import { t, setLang, detectLang } from './i18n/index.js';
import { app, initSettings, on } from './app/state.js';
import { route, setNotFound, startRouter, refresh, navigate } from './app/router.js';
import { keepScreenOn } from './app/device.js';
import { onDbEvent, StorageError } from './db/db.js';
import { getActiveSession } from './db/repos/sessions.js';
import { registerServiceWorker } from './pwa/register.js';

import HomeView from './views/home.js';
import PlanView from './views/plan.js';
import DayView from './views/day.js';
import { WorkoutOverview, WorkoutExercise } from './views/workout.js';
import SummaryView from './views/summary.js';
import ProgressView from './views/progress.js';
import { SessionDetail, ExerciseDetail } from './views/history.js';
import SettingsView from './views/settings.js';
import OnboardingView from './views/onboarding.js';

const TABS = [
  { path: '/', key: 'home', icon: 'home', label: 'tabs.home' },
  { path: '/plan', key: 'plan', icon: 'plan', label: 'tabs.plan' },
  { path: '/progress', key: 'progress', icon: 'chart', label: 'tabs.progress' },
  { path: '/settings', key: 'settings', icon: 'settings', label: 'tabs.settings' },
];

const errorView = (err) => fatal(err instanceof StorageError ? `errors.${err.code}` : 'errors.generic');

route('/', HomeView, { tab: 'home', onError: errorView });
route('/plan', PlanView, { tab: 'plan', onError: errorView });
route('/day/:id', DayView, { tab: 'plan', onError: errorView });
route('/workout', WorkoutOverview, { hideTabs: true, workout: true, onError: errorView });
route('/workout/:index', WorkoutExercise, { hideTabs: true, workout: true, onError: errorView });
route('/summary/:id', SummaryView, { hideTabs: true, onError: errorView });
route('/progress', ProgressView, { tab: 'progress', onError: errorView });
route('/history/:id', SessionDetail, { tab: 'progress', onError: errorView });
route('/exercise/:id', ExerciseDetail, { tab: 'progress', onError: errorView });
route('/settings', SettingsView, { tab: 'settings', onError: errorView });
route('/welcome', OnboardingView, { hideTabs: true, onError: errorView });
setNotFound(() => {
  navigate('/', { replace: true });
  return h('div');
});

const tabbar = document.getElementById('tabbar');
let activeTab = null;

function renderTabbar() {
  tabbar.setAttribute('aria-label', t('tabs.label'));
  mount(
    tabbar,
    h(
      'div',
      { class: 'mx-auto grid max-w-lg grid-cols-4' },
      TABS.map((tab) => {
        const active = tab.key === activeTab;
        return h(
          'a',
          {
            href: `#${tab.path}`,
            'aria-current': active ? 'page' : null,
            class: `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${active ? 'text-lime' : 'text-muted'}`,
          },
          icon(tab.icon, 'size-6'),
          t(tab.label),
        );
      }),
    ),
  );
}

function fatal(key) {
  return h(
    'div',
    { class: 'flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center' },
    h('div', { class: 'mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-danger' }, icon('info', 'size-7')),
    h('h1', { class: 'text-xl font-bold' }, t('errors.title')),
    h('p', { class: 'mt-2 text-muted' }, t(key)),
    h('button', { type: 'button', class: 'btn btn-secondary mt-6 min-h-12', onClick: () => location.reload() }, t('errors.retry')),
  );
}

async function boot() {
  const viewEl = document.getElementById('view');
  try {
    await initSettings();
    if (!app.settings.onboarded) setLang(detectLang());
  } catch (err) {
    console.error(err);
    setLang(detectLang());
    mount(viewEl, fatal(err instanceof StorageError ? `errors.${err.code}` : 'errors.generic'));
    return;
  }

  renderTabbar();
  on('lang', () => {
    renderTabbar();
    refresh();
  });

  onDbEvent((type) => {
    if (type === 'versionchange') toast(t('errors.versionchange'), { action: { label: t('errors.retry'), onClick: () => location.reload() }, duration: 0 });
    if (type === 'blocked') toast(t('errors.blocked'));
  });

  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason;
    if (err instanceof StorageError) toast(t(`errors.${err.code}`));
  });

  startRouter({
    el: viewEl,
    before: (path) => (!app.settings.onboarded && path !== '/welcome' ? '/welcome' : null),
    after: (path, opts) => {
      activeTab = opts.tab ?? null;
      tabbar.hidden = !!opts.hideTabs;
      renderTabbar();
      if (!opts.workout) keepScreenOn(false);
      document.title = activeTab ? `FitWeek · ${t(`tabs.${activeTab}`)}` : 'FitWeek';
    },
  });

  registerServiceWorker({
    onUpdateReady: async (apply) => {
      app.updatePending = apply;
      // Nunca interrumpimos un entreno: si hay uno activo, el aviso aparece al terminar.
      if (await getActiveSession().catch(() => null)) return;
      toast(t('pwa.updateReady'), { action: { label: t('pwa.update'), onClick: apply }, duration: 0 });
    },
  });
}

boot();

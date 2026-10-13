import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { header, emptyState } from '../ui/components/widgets.js';
import { lineChart } from '../ui/components/chart.js';
import { confirmSheet } from '../ui/components/sheet.js';
import { t, fmtDateLong, fmtDuration, fmtCompact, fmtNum, fmtDayMonth, fmtDateFull, fmtTime } from '../i18n/index.js';
import { unit } from '../app/state.js';
import { navigate } from '../app/router.js';
import { sessionVolume, sessionSetCount, exerciseHistory } from '../domain/stats.js';
import { getSession, deleteSession, listSessions } from '../db/repos/sessions.js';
import { getExercise } from '../db/repos/exercises.js';
import { fmtWeight, dayLabel } from './shared.js';

/** Detalle de una sesión pasada. */
export async function SessionDetail({ params }) {
  const s = await getSession(params.id);
  if (!s || s.status !== 'done') {
    navigate('/progress', { replace: true });
    return h('div');
  }
  const del = h(
    'button',
    {
      type: 'button',
      class: 'icon-btn text-danger',
      'aria-label': t('history.delete'),
      onClick: async () => {
        if (await confirmSheet({ title: t('history.deleteTitle'), message: t('history.deleteText'), confirm: t('common.delete'), danger: true })) {
          await deleteSession(s.id);
          navigate('/progress', { replace: true });
        }
      },
    },
    icon('trash'),
  );

  return h(
    'div',
    { class: 'pb-4' },
    header({ title: s.dayName, subtitle: `${dayLabel(s.dayNumber)} · ${fmtDateLong(s.date)}`, back: '/progress', actions: del }),
    h(
      'div',
      { class: 'card mb-4 grid grid-cols-3 divide-x divide-line py-3 text-center' },
      [
        [t('summary.duration'), fmtDuration((s.endedAt ?? s.startedAt) - s.startedAt)],
        [t('summary.volume'), `${fmtCompact(sessionVolume(s))} ${unit()}`],
        [t('summary.sets'), String(sessionSetCount(s))],
      ].map(([l, v]) => h('div', null, h('div', { class: 'text-xl font-bold tabular' }, v), h('div', { class: 'text-xs text-muted' }, l))),
    ),
    h(
      'section',
      { class: 'grid gap-2' },
      s.entries
        .filter((e) => e.sets.length || e.skipped)
        .map((e) =>
          h(
            'div',
            { class: 'card p-4' },
            h('a', { href: `#/exercise/${e.exerciseId}`, class: 'flex items-center justify-between gap-2 font-semibold' }, h('span', { class: 'truncate' }, e.name), h('span', { class: 'text-faint' }, icon('chevronRight'))),
            e.skipped && !e.sets.length
              ? h('p', { class: 'mt-1 text-sm text-muted' }, t('workout.skipped'))
              : h(
                  'ol',
                  { class: 'mt-2 grid gap-1 text-[15px]' },
                  e.sets.map((st, i) =>
                    h('li', { class: 'flex justify-between text-muted tabular' }, h('span', null, `${t('workout.setN', { n: i + 1 })}`), h('span', { class: 'text-ink' }, `${fmtNum(st.weight)} ${unit()} × ${st.reps}`), h('span', null, st.doneAt ? fmtTime(st.doneAt) : '')),
                  ),
                ),
          ),
        ),
    ),
  );
}

/** Evolución de un ejercicio. */
export async function ExerciseDetail({ params }) {
  const [ex, sessions] = await Promise.all([getExercise(params.id), listSessions()]);
  const hist = exerciseHistory(sessions, params.id);
  const name = ex?.name ?? hist[hist.length - 1]?.sets?.[0]?.name ?? '—';
  const head = header({ title: ex?.name ?? name, subtitle: ex?.currentWeight ? t('exercise.working', { w: fmtWeight(ex.currentWeight) }) : null, back: '/progress' });
  if (!hist.length) return h('div', null, head, emptyState({ iconName: 'chart', title: t('exercise.emptyTitle'), text: t('exercise.emptyText') }));

  const last = hist.slice(-12);
  return h(
    'div',
    { class: 'pb-4' },
    head,
    h(
      'section',
      { class: 'card p-4' },
      h('h2', { class: 'mb-3 font-semibold' }, t('exercise.chartTitle', { unit: unit() })),
      lineChart({ points: last.map((p) => ({ label: fmtDayMonth(p.date), value: p.topWeight })), formatY: (n) => fmtNum(n), ariaLabel: t('exercise.chartTitle', { unit: unit() }) }),
    ),
    h(
      'section',
      { class: 'card mt-3 divide-y divide-line overflow-hidden' },
      [...hist].reverse().map((p) =>
        h(
          'a',
          { href: `#/history/${p.sessionId}`, class: 'flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface-2' },
          h('div', { class: 'flex-1' }, h('div', { class: 'font-semibold' }, fmtDateFull(p.date)), h('div', { class: 'text-sm text-muted tabular' }, p.sets.map((s) => `${fmtNum(s.weight)}×${s.reps}`).join('  '))),
          h('div', { class: 'text-right text-lg font-bold tabular' }, fmtWeight(p.topWeight)),
        ),
      ),
    ),
  );
}

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { header, emptyState, sectionTitle } from '../ui/components/widgets.js';
import { lineChart } from '../ui/components/chart.js';
import { t, fmtCompact, fmtDayMonth, fmtDateFull, fmtDuration, fmtMonth } from '../i18n/index.js';
import { app, unit } from '../app/state.js';
import { toKey } from '../domain/dates.js';
import { weeklyGoal, trainedDaysInWeek, weekVolume, streakWeeks, bestStreakWeeks, weeklyVolumes, personalRecords, doneSessions, sessionVolume } from '../domain/stats.js';
import { listSessions } from '../db/repos/sessions.js';
import { listDays } from '../db/repos/cycle.js';
import { sessionDayNumber } from '../domain/cycle.js';
import { fmtWeight, dayLabel } from './shared.js';

let showAll = false;

export default async function ProgressView({ refresh }) {
  const [sessions, days] = await Promise.all([listSessions(), listDays()]);
  const done = doneSessions(sessions).sort((a, b) => b.endedAt - a.endedAt);
  const today = toKey();
  const goal = weeklyGoal(app.settings.restWeekdays);
  const head = header({ title: t('progress.title') });

  if (!done.length) {
    return h('div', null, head, emptyState({ iconName: 'chart', title: t('progress.emptyTitle'), text: t('progress.emptyText') }));
  }

  const weekDone = trainedDaysInWeek(sessions, today);
  const streak = streakWeeks(sessions, today, goal);
  const best = bestStreakWeeks(sessions, today, goal);

  const tile = (iconName, label, value, suffix, foot) =>
    h(
      'div',
      { class: 'card flex min-w-0 flex-col p-3' },
      h('span', { class: 'grid size-9 place-items-center rounded-full bg-lime text-lime-ink' }, icon(iconName, 'size-5')),
      h('span', { class: 'mt-3 text-[13px] text-muted' }, label),
      h('span', { class: 'mt-0.5 flex items-baseline gap-1' }, h('span', { class: 'text-[30px] leading-none font-bold text-lime tabular' }, value), suffix && h('span', { class: 'truncate text-sm text-muted' }, suffix)),
      h('div', { class: 'mt-2 text-xs text-muted' }, foot),
    );

  const bar = h('div', { class: 'h-2 overflow-hidden rounded-full bg-surface-2' }, h('div', { class: 'h-full rounded-full bg-lime', style: { width: `${Math.min(100, (weekDone / goal) * 100)}%` } }));

  const tiles = h(
    'section',
    { class: 'grid grid-cols-3 gap-2' },
    tile('flame', t('progress.streak'), String(streak), t('progress.weeksShort', { count: streak }), t('progress.best', { n: best })),
    tile('dumbbell', t('progress.thisWeek'), `${weekDone}/${goal}`, null, bar),
    tile('weight', t('progress.volume'), fmtCompact(weekVolume(sessions, today)), null, `${unit()} · ${t('progress.thisWeekLower')}`),
  );

  const vols = weeklyVolumes(sessions, today, 8);
  const chart = h(
    'section',
    { class: 'card mt-3 p-4' },
    h('h2', { class: 'font-semibold' }, t('progress.chartTitle')),
    h('p', { class: 'mb-3 text-sm text-muted' }, t('progress.chartSub', { unit: unit() })),
    lineChart({
      points: vols.map((v) => ({ label: fmtDayMonth(v.week), value: v.volume })),
      formatY: (n) => fmtCompact(n),
      ariaLabel: t('progress.chartTitle'),
    }),
  );

  const records = personalRecords(sessions).filter((r) => r.weight > 0 || r.reps > 0);
  const recordsCard =
    records.length > 0 &&
    h(
      'section',
      { class: 'card divide-y divide-line overflow-hidden' },
      records.map((r) =>
        h(
          'a',
          { href: `#/exercise/${r.exerciseId}`, class: 'flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-2' },
          h('span', { class: 'grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-lime' }, icon('trophy', 'size-5')),
          h('div', { class: 'min-w-0 flex-1' }, h('div', { class: 'truncate font-semibold' }, r.name), h('div', { class: 'text-sm text-muted' }, fmtDateFull(r.date))),
          h('div', { class: 'text-right tabular' }, h('div', { class: 'text-xl font-bold' }, r.weight > 0 ? fmtWeight(r.weight) : `${r.reps} ${t('ex.repsShort')}`), r.weight > 0 && h('div', { class: 'text-xs text-muted' }, `× ${r.reps}`)),
        ),
      ),
    );

  const list = showAll ? done : done.slice(0, 10);
  const history = h(
    'section',
    { class: 'card divide-y divide-line overflow-hidden' },
    list.map((s) =>
      h(
        'a',
        { href: `#/history/${s.id}`, class: 'flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-2' },
        h('div', { class: 'w-12 shrink-0 text-center' }, h('div', { class: 'text-lg font-bold tabular' }, s.date.slice(8)), h('div', { class: 'text-xs text-muted uppercase' }, fmtMonth(s.date))),
        h('div', { class: 'min-w-0 flex-1' }, h('div', { class: 'truncate font-semibold' }, s.dayName), h('div', { class: 'text-sm text-muted' }, [dayLabel(sessionDayNumber(days, s)), fmtDuration(s.endedAt - s.startedAt), `${fmtCompact(sessionVolume(s))} ${unit()}`].filter(Boolean).join(' · '))),
        h('span', { class: 'text-faint' }, icon('chevronRight')),
      ),
    ),
  );
  const more =
    done.length > 10 &&
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost mt-2 min-h-12 w-full',
        onClick: () => {
          showAll = !showAll;
          refresh();
        },
      },
      showAll ? t('progress.showLess') : t('progress.showAll', { n: done.length }),
    );

  return h('div', { class: 'pb-4' }, head, tiles, chart, recordsCard && sectionTitle(t('progress.records')), recordsCard, sectionTitle(t('progress.history')), history, more);
}

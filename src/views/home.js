import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { ring, emptyState, rowLink, numberBadge } from '../ui/components/widgets.js';
import { openSheet } from '../ui/components/sheet.js';
import { t, fmtWeekday, fmtDateLong, fmtCompact, fmtRelDays, fmtDuration } from '../i18n/index.js';
import { app, unit } from '../app/state.js';
import { navigate } from '../app/router.js';
import { startWorkout, pickToday } from '../app/actions.js';
import { toKey, diffDays, weekdayIndex } from '../domain/dates.js';
import { projectWeek, todayDay, nextAfter, estimateMinutes, dayNumber, lastDoneByDay } from '../domain/cycle.js';
import { weeklyGoal, trainedDaysInWeek, weekVolume, streakWeeks, sessionVolume, sessionSetCount, doneSessions } from '../domain/stats.js';
import { listDays } from '../db/repos/cycle.js';
import { listSessions, getActiveSession } from '../db/repos/sessions.js';
import { greetingKey, dayLabel } from './shared.js';

export default async function HomeView() {
  const [days, sessions, active] = await Promise.all([listDays(), listSessions(), getActiveSession()]);
  const st = app.settings;
  const today = toKey();
  const goal = weeklyGoal(st.restWeekdays);
  const weekDone = trainedDaysInWeek(sessions, today);
  const week = projectWeek({ todayKey: today, days, sessions, restWeekdays: st.restWeekdays, todayPick: st.todayPick });
  const doneToday = doneSessions(sessions)
    .filter((s) => s.date === today)
    .sort((a, b) => b.endedAt - a.endedAt)[0];
  const dToday = todayDay(days, sessions, today, st.todayPick);
  const num = (id) => dayNumber(days, id);

  // ——— Encabezado ———
  const greet = t(greetingKey(), { name: st.name });
  const head = h(
    'section',
    { class: 'flex items-start justify-between gap-3 pt-4' },
    h(
      'div',
      { class: 'min-w-0' },
      logo(),
      h('h1', { class: 'mt-4 text-[26px] leading-tight font-bold' }, st.name ? `${greet}, ${st.name}` : greet),
      h('p', { class: 'mt-1 text-[15px] text-muted' }, fmtDateLong(today)),
    ),
    ring({
      value: weekDone / goal,
      size: 104,
      stroke: 9,
      label: t('home.weekRingLabel', { done: weekDone, goal }),
      children: [h('div', { class: 'text-[26px] leading-none font-bold tabular' }, `${weekDone}/${goal}`), h('div', { class: 'mt-1 text-[11px] text-muted' }, t('home.workouts'))],
    }),
  );

  // ——— Franja de la semana ———
  const strip = h(
    'section',
    { class: 'mt-5 grid grid-cols-7 gap-1 border-b border-line pb-4', 'aria-label': t('home.thisWeek') },
    week.map((w) => weekCell(w, today)),
  );

  // ——— Tarjeta principal ———
  let main;
  if (active) main = activeCard(active);
  else if (!days.length)
    main = emptyState({
      iconName: 'plan',
      title: t('home.noCycleTitle'),
      text: t('home.noCycleText'),
      action: h('a', { href: '#/plan', class: 'btn btn-primary min-h-14 w-full' }, t('home.goPlan')),
    });
  else if (doneToday) main = doneCard(doneToday);
  else main = todayCard(dToday, days, sessions, today);

  // ——— Progreso semanal ———
  const stats = h(
    'section',
    { class: 'card mt-3 p-4' },
    h('div', { class: 'mb-3 flex items-center gap-2 font-semibold' }, h('span', { class: 'text-lime' }, icon('chart')), t('home.weekProgress')),
    h(
      'div',
      { class: 'grid grid-cols-3 divide-x divide-line text-center' },
      stat('dumbbell', String(weekDone), t('home.statWorkouts', { count: weekDone })),
      stat('weight', `${fmtCompact(weekVolume(sessions, today))}`, t('home.statVolume', { unit: unit() })),
      stat('flame', String(streakWeeks(sessions, today, goal)), t('home.statStreak', { count: streakWeeks(sessions, today, goal) })),
    ),
  );

  // ——— Después ———
  const base = active?.cycleDayId ?? doneToday?.cycleDayId ?? dToday?.id;
  const after = base && days.length > 1 ? nextAfter(days, base) : null;
  const next =
    after &&
    h(
      'section',
      { class: 'card mt-3 overflow-hidden' },
      h('div', { class: 'flex items-center gap-2 px-4 pt-4 text-[15px] font-semibold' }, h('span', { class: 'text-lime' }, icon('calendar')), t('home.nextUp')),
      rowLink({
        href: `#/day/${after.id}`,
        leading: numberBadge(num(after.id)),
        title: after.name,
        subtitle: metaText(after),
      }),
    );

  // ——— Recordatorio de respaldo ———
  const doneCount = doneSessions(sessions).length;
  const lastBackupDays = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 86_400_000) : null;
  const backup =
    doneCount >= 3 && (lastBackupDays === null || lastBackupDays >= 14)
      ? h(
          'a',
          { href: '#/settings', class: 'card mt-3 flex items-center gap-3 p-4 active:bg-surface-2' },
          h('span', { class: 'text-lime' }, icon('download')),
          h('span', { class: 'flex-1 text-sm' }, lastBackupDays === null ? t('home.backupNever') : t('home.backupOld', { count: lastBackupDays })),
          h('span', { class: 'text-faint' }, icon('chevronRight')),
        )
      : null;

  return h('div', { class: 'pb-4' }, head, strip, h('div', { class: 'mt-4' }, main), stats, next, backup);
}

function logo() {
  return h(
    'div',
    { class: 'flex items-center gap-2 text-[30px] leading-none font-extrabold tracking-tight', 'aria-label': 'FitWeek' },
    h('span', null, 'Fit'),
    h('span', { class: '-ml-2 text-lime' }, 'week'),
    h('span', { class: 'text-lime' }, icon('dumbbell', 'size-7')),
  );
}

function weekCell(w, today) {
  const isToday = w.date === today;
  const n = w.number;
  let circle;
  let caption = '';
  const base = 'grid size-10 place-items-center rounded-full text-sm font-bold tabular';
  switch (w.state) {
    case 'done':
      circle = h('span', { class: `${base} bg-lime text-lime-ink` }, icon('check', 'size-5'));
      caption = dayLabel(n);
      break;
    case 'active':
      circle = h('span', { class: `${base} border-2 border-lime text-lime` }, icon('play', 'size-4'));
      caption = t('home.today');
      break;
    case 'today':
      circle = h('span', { class: `${base} border-2 border-lime text-lime` }, n ? `D${n}` : '–');
      caption = t('home.today');
      break;
    case 'planned':
      circle = h('span', { class: `${base} border border-line-strong text-muted` }, `D${n}`);
      break;
    default:
      circle = h('span', { class: `${base} border border-line ${w.state === 'rest' ? 'text-faint' : 'text-faint/60'}` }, icon('minus', 'size-4'));
      caption = w.state === 'rest' ? t('home.rest') : '';
  }
  return h(
    'div',
    { class: 'flex flex-col items-center gap-1.5' },
    h('span', { class: `text-xs ${isToday ? 'font-semibold text-lime' : 'text-muted'}` }, fmtWeekday(w.date)),
    circle,
    h('span', { class: `h-4 text-[11px] leading-4 ${isToday ? 'text-lime' : 'text-muted'}` }, caption),
  );
}

function metaText(day) {
  const n = day.items.length;
  const min = estimateMinutes(day, app.settings.defaultRest);
  return [t('common.exercises', { count: n }), min ? `~${min} min` : null].filter(Boolean).join(' · ');
}

function todayCard(day, days, sessions, today) {
  const isRestDay = app.settings.restWeekdays.includes(weekdayIndex(today));
  const n = dayNumber(days, day.id);
  const lastByDay = lastDoneByDay(sessions);
  return h(
    'section',
    { class: 'card p-4' },
    h(
      'div',
      { class: 'mb-3 flex items-center gap-2 text-[15px] font-semibold' },
      h('span', { class: 'text-lime' }, icon('dumbbell')),
      t('home.todayTitle'),
    ),
    isRestDay && h('p', { class: 'mb-3 text-sm text-muted' }, t('home.restDayHint')),
    h(
      'a',
      { href: `#/day/${day.id}`, class: 'flex items-center gap-3 rounded-2xl active:bg-surface-2' },
      h('div', { class: 'grid size-16 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 text-2xl font-extrabold text-lime tabular' }, `D${n}`),
      h(
        'div',
        { class: 'min-w-0 flex-1' },
        h('div', { class: 'truncate text-2xl font-bold' }, day.name),
        h(
          'div',
          { class: 'mt-1 flex flex-wrap items-center gap-x-3 text-[15px] text-muted' },
          h('span', { class: 'inline-flex items-center gap-1' }, icon('clock', 'size-4'), `~${estimateMinutes(day, app.settings.defaultRest)} min`),
          h('span', { class: 'inline-flex items-center gap-1' }, icon('list', 'size-4'), t('common.exercises', { count: day.items.length })),
        ),
      ),
    ),
    h(
      'div',
      { class: 'mt-4 grid grid-cols-[1fr_auto] gap-2' },
      h(
        'button',
        { type: 'button', class: 'btn btn-primary min-h-14 text-lg', disabled: !day.items.length, onClick: () => startWorkout(day.id) },
        t('home.start'),
        icon('arrowRight'),
      ),
      h('button', { type: 'button', class: 'btn btn-secondary min-h-14', onClick: () => changeSheet(days, day.id, lastByDay, today) }, icon('swap'), t('home.change')),
    ),
    !day.items.length && h('p', { class: 'mt-2 text-sm text-muted' }, t('home.dayEmpty')),
  );
}

function changeSheet(days, currentId, lastByDay, today) {
  openSheet({
    title: t('home.changeTitle'),
    content: (close) =>
      h(
        'div',
        null,
        h('p', { class: 'mb-3 text-sm text-muted' }, t('home.changeHint')),
        h(
          'div',
          { class: 'card divide-y divide-line overflow-hidden' },
          days.map((d, i) => {
            const last = lastByDay[d.id];
            const ago = last ? fmtRelDays(diffDays(last, today)) : t('home.never');
            const isCur = d.id === currentId;
            return rowLink({
              onClick: async () => {
                close();
                await pickToday(d.id);
                navigate('/');
              },
              leading: numberBadge(i + 1, { active: isCur }),
              title: d.name,
              subtitle: `${t('common.exercises', { count: d.items.length })} · ${t('home.lastTime')}: ${ago}`,
              trailing: isCur ? h('span', { class: 'chip' }, t('home.selected')) : null,
              chevron: false,
            });
          }),
        ),
      ),
  });
}

function activeCard(s) {
  const total = s.entries.reduce((n, e) => n + e.target.sets, 0);
  const done = sessionSetCount(s);
  return h(
    'section',
    { class: 'card border-lime/50 p-4' },
    h('div', { class: 'mb-2 flex items-center gap-2 text-[15px] font-semibold text-lime' }, icon('play', 'size-4'), t('home.inProgress')),
    h('div', { class: 'text-2xl font-bold' }, s.dayName),
    h('p', { class: 'mt-1 text-muted' }, `${dayLabel(s.dayNumber)} · ${t('home.setsProgress', { done, total })} · ${fmtDuration(Date.now() - s.startedAt)}`),
    h('a', { href: '#/workout', class: 'btn btn-primary mt-4 min-h-14 w-full text-lg' }, t('home.continue'), icon('arrowRight')),
  );
}

function doneCard(s) {
  return h(
    'section',
    { class: 'card p-4' },
    h('div', { class: 'mb-2 flex items-center gap-2 text-[15px] font-semibold text-lime' }, icon('check'), t('home.doneToday')),
    h('a', { href: `#/history/${s.id}`, class: 'block' }, h('div', { class: 'text-2xl font-bold' }, s.dayName), h('p', { class: 'mt-1 text-muted' }, `${dayLabel(s.dayNumber)} · ${fmtDuration((s.endedAt ?? s.startedAt) - s.startedAt)} · ${fmtCompact(sessionVolume(s))} ${unit()}`)),
  );
}

function stat(iconName, value, label) {
  return h(
    'div',
    { class: 'flex flex-col items-center px-1' },
    h('span', { class: 'text-lime' }, icon(iconName, 'size-6')),
    h('span', { class: 'mt-2 text-[26px] leading-none font-bold tabular' }, value),
    h('span', { class: 'mt-1.5 text-xs leading-tight text-muted' }, label),
  );
}

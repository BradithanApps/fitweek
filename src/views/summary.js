import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { ring } from '../ui/components/widgets.js';
import { toast } from '../ui/components/toast.js';
import { t, fmtDuration, fmtCompact } from '../i18n/index.js';
import { app, unit } from '../app/state.js';
import { navigate } from '../app/router.js';
import { sessionVolume, sessionSetCount, personalRecords } from '../domain/stats.js';
import { getSession, listSessions } from '../db/repos/sessions.js';
import { fmtWeight, dayLabel } from './shared.js';
import { listDays } from '../db/repos/cycle.js';
import { sessionDayNumber } from '../domain/cycle.js';

export default async function SummaryView({ params }) {
  const [session, all, days] = await Promise.all([getSession(params.id), listSessions(), listDays()]);
  if (!session) {
    navigate('/', { replace: true });
    return h('div');
  }
  const before = personalRecords(all.filter((s) => s.id !== session.id && (s.endedAt ?? 0) < (session.endedAt ?? 0)));
  const prevBest = new Map(before.map((r) => [r.exerciseId, r]));
  const improvements = [];
  for (const e of session.entries) {
    if (!e.sets.length) continue;
    const top = e.sets.reduce((a, b) => (b.weight > a.weight ? b : a));
    const prev = prevBest.get(e.exerciseId);
    if (prev && top.weight > prev.weight) improvements.push({ name: e.name, from: prev.weight, to: top.weight });
  }

  const stat = (label, value) =>
    h('div', { class: 'card p-4' }, h('div', { class: 'text-sm text-muted' }, label), h('div', { class: 'mt-1 text-[26px] font-bold tabular' }, value));

  // Si hay una actualización de la app esperando, este es buen momento para aplicarla.
  if (app.updatePending) setTimeout(() => toast(t('pwa.updateReady'), { action: { label: t('pwa.update'), onClick: app.updatePending }, duration: 0 }), 600);

  return h(
    'div',
    { class: 'pt-8 pb-4' },
    h(
      'div',
      { class: 'flex flex-col items-center text-center' },
      ring({ value: 1, size: 120, stroke: 10, children: h('span', { class: 'text-lime' }, icon('check', 'size-12')) }),
      h('h1', { class: 'mt-5 text-[28px] font-bold' }, t('summary.title')),
      h('p', { class: 'mt-1 text-muted' }, `${dayLabel(sessionDayNumber(days, session))} · ${session.dayName}`),
    ),
    h(
      'section',
      { class: 'mt-6 grid grid-cols-2 gap-3' },
      stat(t('summary.duration'), fmtDuration((session.endedAt ?? Date.now()) - session.startedAt)),
      stat(t('summary.volume'), `${fmtCompact(sessionVolume(session))} ${unit()}`),
      stat(t('summary.sets'), String(sessionSetCount(session))),
      stat(t('summary.exercises'), String(session.entries.filter((e) => e.sets.length).length)),
    ),
    improvements.length > 0 &&
      h(
        'section',
        { class: 'card mt-3 p-4' },
        h('div', { class: 'mb-2 flex items-center gap-2 font-semibold' }, h('span', { class: 'text-lime' }, icon('trophy')), t('summary.records')),
        h(
          'ul',
          { class: 'grid gap-2' },
          improvements.map((r) =>
            h('li', { class: 'flex items-center justify-between gap-3' }, h('span', { class: 'truncate' }, r.name), h('span', { class: 'shrink-0 text-muted tabular' }, `${fmtWeight(r.from)} → `, h('b', { class: 'text-lime' }, fmtWeight(r.to)))),
          ),
        ),
      ),
    h('a', { href: '#/', class: 'btn btn-primary mt-6 min-h-14 w-full text-lg' }, t('summary.done')),
    h('a', { href: `#/history/${session.id}`, class: 'btn btn-ghost mt-1 min-h-12 w-full' }, t('summary.seeDetail')),
  );
}

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { header, emptyState, numberBadge } from '../ui/components/widgets.js';
import { confirmSheet } from '../ui/components/sheet.js';
import { toast } from '../ui/components/toast.js';
import { t, fmtRelDays } from '../i18n/index.js';
import { app } from '../app/state.js';
import { navigate } from '../app/router.js';
import { toKey, diffDays } from '../domain/dates.js';
import { estimateMinutes, lastDoneByDay, todayDay } from '../domain/cycle.js';
import { exampleCycle } from '../domain/seed.js';
import { listDays, addDay, moveDay, deleteDay } from '../db/repos/cycle.js';
import { listSessions } from '../db/repos/sessions.js';
import { listExercises } from '../db/repos/exercises.js';
import { addCycle } from '../db/data.js';
import { textSheet } from './shared.js';

let editing = false;

export default async function PlanView({ refresh }) {
  const [days, sessions] = await Promise.all([listDays(), listSessions()]);
  const today = toKey();
  const lastByDay = lastDoneByDay(sessions);
  const next = todayDay(days, sessions, today, app.settings.todayPick);

  const newDay = () =>
    textSheet({
      title: t('plan.addDay'),
      placeholder: t('plan.dayNamePlaceholder'),
      saveLabel: t('plan.addDay'),
      onSave: async (name) => {
        const d = await addDay(name);
        navigate(`/day/${d.id}`);
      },
    });

  const editBtn =
    days.length > 0 &&
    h(
      'button',
      {
        type: 'button',
        class: `icon-btn ${editing ? 'bg-lime text-lime-ink' : 'text-muted'}`,
        'aria-label': editing ? t('common.done') : t('plan.edit'),
        'aria-pressed': String(editing),
        onClick: () => {
          editing = !editing;
          refresh();
        },
      },
      icon(editing ? 'check' : 'pencil'),
    );

  const head = header({ title: t('plan.title'), subtitle: days.length ? t('plan.subtitle', { count: days.length }) : null, actions: editBtn });

  if (!days.length) {
    editing = false;
    return h(
      'div',
      null,
      head,
      emptyState({
        iconName: 'plan',
        title: t('plan.emptyTitle'),
        text: t('plan.emptyText'),
        action: h(
          'div',
          { class: 'grid gap-2' },
          h('button', { type: 'button', class: 'btn btn-primary min-h-14', onClick: newDay }, icon('plus'), t('plan.addDay')),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondary min-h-14',
              onClick: async () => {
                const existing = await listExercises();
                if (existing.length) {
                  // Evita duplicar nombres: reutiliza ejercicios existentes.
                  const ex = exampleCycle(app.settings.lang);
                  const byKey = new Map(existing.map((e) => [e.nameKey, e.id]));
                  const remap = new Map();
                  ex.exercises = ex.exercises.filter((e) => (byKey.has(e.nameKey) ? (remap.set(e.id, byKey.get(e.nameKey)), false) : true));
                  ex.cycleDays.forEach((d) => d.items.forEach((it) => (it.exerciseId = remap.get(it.exerciseId) ?? it.exerciseId)));
                  await addCycle(ex);
                } else await addCycle(exampleCycle(app.settings.lang));
                toast(t('plan.exampleLoaded'));
                refresh();
              },
            },
            t('plan.loadExample'),
          ),
        ),
      }),
      howItWorks(),
    );
  }

  const list = h(
    'section',
    { class: 'card divide-y divide-line overflow-hidden' },
    days.map((d, i) => {
      const isNext = d.id === next?.id;
      const last = lastByDay[d.id];
      const min = estimateMinutes(d, app.settings.defaultRest);
      const meta = [t('common.exercises', { count: d.items.length }), min ? `~${min} min` : null].filter(Boolean).join(' · ');
      const lastText = last ? `${t('home.lastTime')}: ${fmtRelDays(diffDays(last, today))}` : t('plan.notYet');
      const body = h(
        'div',
        { class: 'min-w-0 flex-1' },
        h('div', { class: 'flex items-center gap-2' }, h('span', { class: 'truncate text-[17px] font-semibold' }, d.name), isNext && !editing && h('span', { class: 'chip shrink-0' }, t('plan.next'))),
        h('div', { class: 'mt-0.5 truncate text-sm text-muted' }, meta),
        h('div', { class: 'truncate text-xs text-faint' }, lastText),
      );
      if (editing) {
        return h(
          'div',
          { class: 'flex min-h-18 items-center gap-2 px-3 py-2' },
          numberBadge(i + 1),
          body,
          h('button', { type: 'button', class: 'icon-btn text-muted', disabled: i === 0, 'aria-label': t('common.moveUp'), onClick: async () => (await moveDay(d.id, -1), refresh()) }, icon('up')),
          h('button', { type: 'button', class: 'icon-btn text-muted', disabled: i === days.length - 1, 'aria-label': t('common.moveDown'), onClick: async () => (await moveDay(d.id, 1), refresh()) }, icon('down')),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn text-danger',
              'aria-label': t('plan.deleteDay'),
              onClick: async () => {
                if (await confirmSheet({ title: t('plan.deleteDayTitle', { name: d.name }), message: t('plan.deleteDayText'), confirm: t('common.delete'), danger: true })) {
                  await deleteDay(d.id);
                  refresh();
                }
              },
            },
            icon('trash'),
          ),
        );
      }
      return h(
        'a',
        { href: `#/day/${d.id}`, class: 'flex min-h-18 items-center gap-3 px-4 py-3 active:bg-surface-2' },
        numberBadge(i + 1, { active: isNext }),
        body,
        h('span', { class: 'text-faint' }, icon('chevronRight')),
      );
    }),
  );

  return h(
    'div',
    null,
    head,
    list,
    h('button', { type: 'button', class: 'btn btn-secondary mt-3 min-h-14 w-full', onClick: newDay }, icon('plus'), t('plan.addDay')),
    editing && h('p', { class: 'mt-3 px-1 text-sm text-muted' }, t('plan.reorderHint')),
    howItWorks(),
  );
}

function howItWorks() {
  return h(
    'details',
    { class: 'card mt-6 p-4 text-sm text-muted' },
    h('summary', { class: 'cursor-pointer font-semibold text-ink' }, t('plan.howTitle')),
    h('ul', { class: 'mt-3 grid list-disc gap-2 pl-5' }, ['plan.how1', 'plan.how2', 'plan.how3', 'plan.how4'].map((k) => h('li', null, t(k)))),
  );
}

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { header, emptyState, iconBadge } from '../ui/components/widgets.js';
import { openSheet, confirmSheet } from '../ui/components/sheet.js';
import { toast } from '../ui/components/toast.js';
import { t } from '../i18n/index.js';
import { app } from '../app/state.js';
import { navigate } from '../app/router.js';
import { startWorkout } from '../app/actions.js';
import { estimateMinutes, dayNumber } from '../domain/cycle.js';
import { nameKey } from '../domain/text.js';
import { listDays, getDay, saveDay, deleteDay, duplicateDay } from '../db/repos/cycle.js';
import { listExercises, upsertExerciseByName, renameExercise, saveExercise, getExercise } from '../db/repos/exercises.js';
import { getActiveSession } from '../db/repos/sessions.js';
import { exerciseSheet, textSheet, fmtTarget, fmtWeight, dayLabel } from './shared.js';

let reorder = false;

export default async function DayView({ params, refresh }) {
  const [day, days, catalog, active] = await Promise.all([getDay(params.id), listDays(), listExercises(), getActiveSession()]);
  if (!day) {
    navigate('/plan', { replace: true });
    return h('div');
  }
  const exById = new Map(catalog.map((e) => [e.id, e]));
  const n = dayNumber(days, day.id);
  const min = estimateMinutes(day, app.settings.defaultRest);

  const saveItems = async (items) => {
    await saveDay({ ...day, items });
    refresh();
  };

  const addExercise = () =>
    exerciseSheet({
      title: t('day.addExercise'),
      catalog,
      excludeIds: new Set(day.items.map((i) => i.exerciseId)),
      saveLabel: t('common.add'),
      onSave: async (v) => {
        const ex = await upsertExerciseByName(v.name, { weight: v.weight || null, mode: v.mode });
        if (day.items.some((i) => i.exerciseId === ex.id)) return t('day.alreadyInDay');
        await saveItems([...day.items, { exerciseId: ex.id, sets: v.sets, reps: v.reps, rest: v.rest }]);
      },
    });

  const editExercise = (idx) => {
    const item = day.items[idx];
    const ex = exById.get(item.exerciseId);
    exerciseSheet({
      title: t('day.editExercise'),
      catalog,
      excludeIds: new Set(day.items.filter((_, i) => i !== idx).map((i) => i.exerciseId)),
      initial: { name: ex?.name ?? '', sets: item.sets, reps: item.reps, mode: ex?.mode, weight: ex?.currentWeight, rest: item.rest },
      onSave: async (v) => {
        let exerciseId = item.exerciseId;
        if (!ex || nameKey(v.name) !== ex.nameKey) {
          const other = catalog.find((e) => e.nameKey === nameKey(v.name));
          if (other) {
            if (day.items.some((i, k) => k !== idx && i.exerciseId === other.id)) return t('day.alreadyInDay');
            exerciseId = other.id;
          } else if (ex) {
            await renameExercise(ex.id, v.name);
          } else {
            exerciseId = (await upsertExerciseByName(v.name)).id;
          }
        }
        const current = await getExercise(exerciseId);
        await saveExercise({ ...current, mode: v.mode, currentWeight: v.weight });
        const items = day.items.map((it, i) => (i === idx ? { exerciseId, sets: v.sets, reps: v.reps, rest: v.rest } : it));
        await saveItems(items);
      },
      onDelete: async () => {
        await saveItems(day.items.filter((_, i) => i !== idx));
        toast(t('day.removed', { name: ex?.name ?? '' }));
      },
    });
  };

  const move = (idx, dir) => {
    const items = [...day.items];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    saveItems(items);
  };

  const menu = () =>
    openSheet({
      title: day.name,
      content: (close) =>
        h(
          'div',
          { class: 'grid gap-2' },
          menuBtn('pencil', t('day.rename'), () => {
            close();
            textSheet({
              title: t('day.rename'),
              value: day.name,
              onSave: async (name) => {
                await saveDay({ ...day, name });
                refresh();
              },
            });
          }),
          menuBtn('list', t('day.duplicate'), async () => {
            close();
            const copy = await duplicateDay(day.id, t('day.copySuffix'));
            if (copy) navigate(`/day/${copy.id}`);
          }),
          menuBtn(
            'trash',
            t('plan.deleteDay'),
            async () => {
              close();
              if (await confirmSheet({ title: t('plan.deleteDayTitle', { name: day.name }), message: t('plan.deleteDayText'), confirm: t('common.delete'), danger: true })) {
                await deleteDay(day.id);
                navigate('/plan', { replace: true });
              }
            },
            true,
          ),
        ),
    });

  const actions = [
    day.items.length > 1 &&
      h(
        'button',
        {
          type: 'button',
          class: `icon-btn ${reorder ? 'bg-lime text-lime-ink' : 'text-muted'}`,
          'aria-label': reorder ? t('common.done') : t('day.reorder'),
          'aria-pressed': String(reorder),
          onClick: () => {
            reorder = !reorder;
            refresh();
          },
        },
        icon(reorder ? 'check' : 'swap'),
      ),
    h('button', { type: 'button', class: 'icon-btn text-muted', 'aria-label': t('day.menu'), onClick: menu }, icon('pencil')),
  ];

  const subtitle = [dayLabel(n), t('common.exercises', { count: day.items.length }), min ? `~${min} min` : null].filter(Boolean).join(' · ');

  let startBtn;
  if (active)
    startBtn = h(
      'a',
      { href: '#/workout', class: 'btn btn-secondary min-h-14 w-full' },
      icon('play', 'size-4'),
      active.cycleDayId === day.id ? t('home.continue') : t('day.activeOther', { name: active.dayName }),
    );
  else
    startBtn = h(
      'button',
      { type: 'button', class: 'btn btn-primary min-h-14 w-full text-lg', disabled: !day.items.length, onClick: () => startWorkout(day.id) },
      t('day.start'),
    );

  const list = day.items.length
    ? h(
        'section',
        { class: 'mt-4 grid gap-2' },
        day.items.map((item, i) => {
          const ex = exById.get(item.exerciseId);
          const target = fmtTarget({ sets: item.sets, reps: item.reps, mode: ex?.mode });
          const parts = [target, ex?.currentWeight ? fmtWeight(ex.currentWeight) : null, item.rest != null ? t('day.restShort', { s: item.rest }) : null];
          const body = h(
            'div',
            { class: 'min-w-0 flex-1' },
            h('div', { class: 'truncate text-[17px] font-semibold' }, ex?.name ?? '—'),
            h('div', { class: 'mt-0.5 truncate text-[15px] text-muted' }, parts.filter(Boolean).join(' · ')),
          );
          if (reorder)
            return h(
              'div',
              { class: 'card flex min-h-18 items-center gap-2 px-3 py-2' },
              iconBadge('dumbbell'),
              body,
              h('button', { type: 'button', class: 'icon-btn text-muted', disabled: i === 0, 'aria-label': t('common.moveUp'), onClick: () => move(i, -1) }, icon('up')),
              h('button', { type: 'button', class: 'icon-btn text-muted', disabled: i === day.items.length - 1, 'aria-label': t('common.moveDown'), onClick: () => move(i, 1) }, icon('down')),
            );
          return h(
            'button',
            { type: 'button', class: 'card flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2', onClick: () => editExercise(i) },
            iconBadge('dumbbell'),
            body,
            h('span', { class: 'text-faint' }, icon('chevronRight')),
          );
        }),
      )
    : h('div', { class: 'mt-4' }, emptyState({ title: t('day.emptyTitle'), text: t('day.emptyText') }));

  if (!day.items.length) reorder = false;

  return h(
    'div',
    null,
    header({ title: day.name, subtitle, back: '/plan', actions }),
    startBtn,
    list,
    h('button', { type: 'button', class: 'btn btn-secondary mt-3 min-h-14 w-full text-lime', onClick: addExercise }, icon('plus'), t('day.addExercise')),
  );
}

function menuBtn(iconName, label, onClick, danger = false) {
  return h(
    'button',
    { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-secondary'} min-h-14 w-full justify-start`, onClick },
    icon(iconName),
    label,
  );
}

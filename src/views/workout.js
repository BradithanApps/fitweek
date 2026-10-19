import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { header, ring, setRing, bigStepper } from '../ui/components/widgets.js';
import { openSheet, confirmSheet } from '../ui/components/sheet.js';
import { t, fmtTime, fmtClock, fmtNum } from '../i18n/index.js';
import { app, unit } from '../app/state.js';
import { navigate } from '../app/router.js';
import { completeSet, persist, finishWorkout, abandonWorkout, addExerciseToSession } from '../app/actions.js';
import { unlockAudio, restDoneSound, keepScreenOn } from '../app/device.js';
import * as W from '../domain/workout.js';
import { getActiveSession } from '../db/repos/sessions.js';
import { exercisesMap, listExercises } from '../db/repos/exercises.js';
import { listDays } from '../db/repos/cycle.js';
import { sessionDayNumber } from '../domain/cycle.js';
import { exerciseSheet, fmtTarget, fmtWeight, dayLabel, parseWeight } from './shared.js';

let chimedFor = 0;

async function loadActive() {
  const session = await getActiveSession();
  if (!session) navigate('/', { replace: true });
  return session;
}

// ——————————————————— Vista general de la sesión ———————————————————

export async function WorkoutOverview({ refresh }) {
  const session = await loadActive();
  if (!session) return h('div');
  keepScreenOn(true);
  const [exMap, days] = await Promise.all([exercisesMap(), listDays()]);
  const doneCount = session.entries.filter(W.entryDone).length;
  const nextIdx = W.nextPendingIndex(session);

  const clock = h('span', { class: 'tabular' }, fmtClock(Date.now() - session.startedAt));
  const timer = setInterval(() => (clock.textContent = fmtClock(Date.now() - session.startedAt)), 1000);

  const rows = session.entries.map((e, i) => {
    const done = W.entryDone(e);
    const ex = exMap.get(e.exerciseId);
    const status = e.skipped
      ? h('span', { class: 'grid size-9 place-items-center rounded-full border border-line text-faint' }, icon('skip', 'size-4'))
      : done
        ? h('span', { class: 'grid size-9 place-items-center rounded-full bg-lime text-lime-ink' }, icon('check', 'size-5'))
        : h('span', { class: `grid size-9 place-items-center rounded-full border text-xs font-bold tabular ${e.sets.length ? 'border-lime text-lime' : 'border-line-strong text-muted'}` }, `${e.sets.length}/${e.target.sets}`);
    const weightNow = e.sets.length ? e.sets[e.sets.length - 1].weight : ex?.currentWeight;
    return h(
      'a',
      { href: `#/workout/${i}`, class: `card flex min-h-18 items-center gap-3 px-4 py-3 active:bg-surface-2 ${done ? 'opacity-70' : ''}` },
      h(
        'div',
        { class: 'min-w-0 flex-1' },
        h('div', { class: 'truncate text-[17px] font-semibold' }, e.name),
        h('div', { class: 'mt-0.5 text-[15px] text-muted' }, [fmtTarget({ sets: e.target.sets, reps: e.target.reps, mode: e.mode }), weightNow ? fmtWeight(weightNow) : null].filter(Boolean).join(' · ')),
      ),
      status,
    );
  });

  const addBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary min-h-14 w-full text-lime',
      onClick: async () => {
        const catalog = await listExercises();
        exerciseSheet({
          title: t('workout.addToSession'),
          catalog,
          excludeIds: new Set(session.entries.map((e) => e.exerciseId)),
          showRest: false,
          saveLabel: t('common.add'),
          onSave: async (v) => {
            const next = await addExerciseToSession(session, v);
            navigate(`/workout/${next.entries.length - 1}`);
          },
        });
      },
    },
    icon('plus'),
    t('workout.addExercise'),
  );

  const finishBtn = h(
    'button',
    {
      type: 'button',
      class: `btn ${W.allDone(session) ? 'btn-primary' : 'btn-secondary'} min-h-14 w-full`,
      onClick: () => tryFinish(session),
    },
    icon('check'),
    t('workout.finish'),
  );

  const discardBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn mt-1 min-h-12 w-full text-danger',
      onClick: async () => {
        if (await confirmSheet({ title: t('workout.discardTitle'), message: t('workout.discardText'), confirm: t('workout.discard'), danger: true })) {
          keepScreenOn(false);
          abandonWorkout(session);
        }
      },
    },
    t('workout.discard'),
  );

  return {
    el: h(
      'div',
      null,
      header({
        title: session.dayName,
        subtitle: `${dayLabel(sessionDayNumber(days, session))} · ${t('workout.exercisesDone', { done: doneCount, total: session.entries.length })}`,
        back: '/',
      }),
      h(
        'div',
        { class: 'card mb-4 flex items-center gap-3 px-4 py-3' },
        h('span', { class: 'text-lime' }, icon('clock', 'size-7')),
        h('div', { class: 'flex-1' }, h('div', { class: 'text-sm text-muted' }, t('workout.elapsed')), h('div', { class: 'text-2xl font-bold' }, clock)),
      ),
      nextIdx >= 0 &&
        h(
          'a',
          { href: `#/workout/${nextIdx}`, class: 'btn btn-primary mb-4 min-h-14 w-full text-lg' },
          h('span', { class: 'truncate' }, t('workout.continueWith', { name: session.entries[nextIdx].name })),
          icon('arrowRight'),
        ),
      h('section', { class: 'grid gap-2' }, rows),
      h('div', { class: 'mt-4 grid gap-2' }, addBtn, finishBtn, discardBtn),
    ),
    destroy: () => clearInterval(timer),
  };
}

async function tryFinish(session) {
  if (!W.hasAnySet(session)) {
    if (await confirmSheet({ title: t('workout.emptyFinishTitle'), message: t('workout.emptyFinishText'), confirm: t('workout.discard'), danger: true })) {
      keepScreenOn(false);
      abandonWorkout(session);
    }
    return;
  }
  if (!W.allDone(session) && !(await confirmSheet({ title: t('workout.finishEarlyTitle'), message: t('workout.finishEarlyText'), confirm: t('workout.finish') }))) return;
  keepScreenOn(false);
  finishWorkout(session);
}

// ——————————————————— Serie activa (un ejercicio) ———————————————————

export async function WorkoutExercise({ params, refresh }) {
  let session = await loadActive();
  if (!session) return h('div');
  keepScreenOn(true);
  const idx = Number(params.index);
  const entry = session.entries[idx];
  if (!entry) {
    navigate('/workout', { replace: true });
    return h('div');
  }
  const exMap = await exercisesMap();
  const ex = exMap.get(entry.exerciseId);
  const st = app.settings;
  const defaults = W.nextSetDefaults(entry, ex);
  const done = W.entryDone(entry);
  const setNo = entry.sets.length + 1;

  const subtitle = done
    ? entry.skipped
      ? t('workout.skipped')
      : t('workout.allSetsDone')
    : t('workout.setOf', { n: setNo, total: entry.target.sets });

  const weight = bigStepper({ value: defaults.weight, step: st.weightStep, min: 0, max: 2000, decimals: true, label: t('ex.weight'), unit: unit() });
  const reps = bigStepper({ value: defaults.reps, step: 1, min: 0, max: 500, label: t('ex.reps') });

  const completeBtn = h(
    'button',
    {
      type: 'button',
      class: `btn ${done ? 'btn-secondary' : 'btn-primary'} min-h-14 w-full text-lg`,
      onClick: async () => {
        unlockAudio();
        document.activeElement?.blur?.();
        completeBtn.disabled = true;
        session = await completeSet(session, idx, { weight: weight.get(), reps: reps.get() });
        refresh();
      },
    },
    done ? t('workout.extraSet') : t('workout.completeSet'),
  );

  // ——— Descanso ———
  const restText = h('div', { class: 'text-[28px] leading-none font-bold tabular' }, '');
  const restRing = ring({ value: 1, size: 72, stroke: 7, children: icon('clock', 'size-6 text-lime') });
  const restCard = h(
    'section',
    { class: 'card mt-4 flex items-center gap-4 p-4', hidden: true, 'aria-live': 'polite' },
    restRing,
    h('div', { class: 'flex-1' }, h('div', { class: 'text-sm text-muted' }, t('workout.rest')), restText),
    h(
      'div',
      { class: 'grid gap-1' },
      h('button', { type: 'button', class: 'btn btn-secondary min-h-10 px-3 text-sm', onClick: () => adjustRest(15) }, '+15 s'),
      h('button', { type: 'button', class: 'btn btn-ghost min-h-10 px-3 text-sm', onClick: () => adjustRest(null) }, t('workout.skipRest')),
    ),
  );
  const tick = () => {
    const end = session.restEndsAt;
    if (!end) {
      restCard.hidden = true;
      return;
    }
    const left = end - Date.now();
    const total = entry.rest * 1000 || 1;
    restCard.hidden = false;
    if (left <= 0) {
      restText.textContent = t('workout.restDone');
      restText.classList.add('text-lime');
      setRing(restRing, 0);
      if (chimedFor !== end && Date.now() - end < 5000) {
        chimedFor = end; // una sola vez por descanso, aunque la pantalla se redibuje
        if (st.sound) restDoneSound();
        restCard.classList.add('rest-done');
      }
      if (Date.now() - end > 20000) {
        restCard.hidden = true;
      }
      return;
    }
    restText.classList.remove('text-lime');
    restCard.classList.remove('rest-done');
    restText.textContent = fmtClock(left + 999);
    setRing(restRing, left / total);
  };
  async function adjustRest(delta) {
    session = { ...session, restEndsAt: delta == null ? null : Math.max(Date.now(), session.restEndsAt ?? Date.now()) + delta * 1000 };
    await persist(session);
    tick();
  }
  const timer = setInterval(tick, 250);
  tick();

  // ——— Lista de series ———
  const totalRows = Math.max(entry.target.sets, entry.sets.length);
  const setRows = Array.from({ length: totalRows }, (_, i) => {
    const s = entry.sets[i];
    if (s)
      return h(
        'button',
        { type: 'button', class: 'flex min-h-15 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2', onClick: () => editSet(i) },
        h('span', { class: 'grid size-8 place-items-center rounded-full border-2 border-lime text-lime' }, icon('check', 'size-4')),
        h('div', { class: 'flex-1' }, h('div', { class: 'font-semibold' }, t('workout.setN', { n: i + 1 })), h('div', { class: 'text-sm text-muted tabular' }, `${fmtNum(s.weight)} ${unit()} × ${s.reps}`)),
        h('span', { class: 'text-sm text-muted tabular' }, fmtTime(s.doneAt)),
      );
    return h(
      'div',
      { class: `flex min-h-15 items-center gap-3 px-4 py-2 ${i === entry.sets.length ? '' : 'opacity-50'}` },
      h('span', { class: `size-8 rounded-full border-2 ${i === entry.sets.length ? 'border-lime/60' : 'border-line-strong'}` }),
      h('div', { class: 'flex-1' }, h('div', { class: 'font-semibold' }, t('workout.setN', { n: i + 1 })), h('div', { class: 'text-sm text-muted' }, entry.mode === 'max' ? t('ex.toFailure') : t('workout.targetReps', { n: entry.target.reps }))),
    );
  });

  function editSet(i) {
    const s = entry.sets[i];
    openSheet({
      title: t('workout.editSetTitle', { n: i + 1 }),
      content: (close) => {
        const w = h('input', { class: 'field text-lg tabular', inputmode: 'decimal', value: String(s.weight), 'aria-label': t('ex.weight') });
        const r = h('input', { class: 'field text-lg tabular', inputmode: 'numeric', value: String(s.reps), 'aria-label': t('ex.reps') });
        return h(
          'div',
          { class: 'grid gap-3' },
          h('div', { class: 'grid grid-cols-2 gap-3' }, h('label', null, h('span', { class: 'mb-1 block text-sm text-muted' }, `${t('ex.weight')} (${unit()})`), w), h('label', null, h('span', { class: 'mb-1 block text-sm text-muted' }, t('ex.reps')), r)),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-primary min-h-14',
              onClick: async () => {
                const nw = parseWeight(w.value);
                const nr = parseInt(r.value, 10);
                if (nw === null || !Number.isFinite(nr) || nr < 0) return;
                session = W.updateSet(session, idx, i, { weight: nw, reps: nr });
                await persist(session);
                close();
                refresh();
              },
            },
            t('common.save'),
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-danger min-h-12',
              onClick: async () => {
                session = W.removeSet(session, idx, i);
                await persist(session);
                close();
                refresh();
              },
            },
            icon('trash'),
            t('workout.deleteSet'),
          ),
        );
      },
    });
  }

  // ——— Navegación entre ejercicios ———
  const nextIdx = W.nextPendingIndex(session, idx + 1);
  const finishAll = W.allDone(session);
  let nextAction = null;
  if (done) {
    nextAction = finishAll
      ? h('button', { type: 'button', class: 'btn btn-primary min-h-14 w-full text-lg', onClick: () => tryFinish(session) }, icon('check'), t('workout.finish'))
      : nextIdx >= 0 &&
        h('a', { href: `#/workout/${nextIdx}`, class: 'btn btn-primary min-h-14 w-full text-lg' }, h('span', { class: 'truncate' }, t('workout.nextExercise', { name: session.entries[nextIdx].name })), icon('arrowRight'));
  }

  const skipBtn =
    !done &&
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost min-h-12 w-full text-muted',
        onClick: async () => {
          session = W.setSkipped(session, idx, true);
          await persist(session);
          const n = W.nextPendingIndex(session, idx + 1);
          navigate(n >= 0 ? `/workout/${n}` : '/workout');
        },
      },
      icon('skip', 'size-4'),
      t('workout.skipExercise'),
    );

  const navBtns = [
    h('a', { href: idx > 0 ? `#/workout/${idx - 1}` : null, class: `icon-btn text-muted ${idx > 0 ? '' : 'pointer-events-none opacity-30'}`, 'aria-label': t('workout.prevExercise'), 'aria-disabled': idx > 0 ? null : 'true' }, icon('chevronLeft')),
    h('span', { class: 'text-sm text-muted tabular' }, `${idx + 1}/${session.entries.length}`),
    h('a', { href: idx < session.entries.length - 1 ? `#/workout/${idx + 1}` : null, class: `icon-btn text-muted ${idx < session.entries.length - 1 ? '' : 'pointer-events-none opacity-30'}`, 'aria-label': t('workout.nextExerciseShort'), 'aria-disabled': idx < session.entries.length - 1 ? null : 'true' }, icon('chevronRight')),
  ];

  const titleBlock = h(
    'div',
    { class: 'text-center' },
    h('h1', { class: 'text-[30px] leading-tight font-bold tracking-tight break-words' }, entry.name),
    h('p', { class: `mt-1 text-[17px] font-semibold ${done ? 'text-muted' : 'text-lime'}` }, subtitle),
  );

  const el = h(
    'div',
    { class: 'pb-4' },
    h(
      'div',
      { class: 'flex items-center justify-between pt-3' },
      h('a', { href: '#/workout', class: 'icon-btn -ml-2 text-lime', 'aria-label': t('workout.overview') }, icon('arrowLeft', 'size-6')),
      h('div', { class: 'flex items-center gap-1' }, navBtns),
    ),
    titleBlock,
    h('section', { class: 'mt-6 grid gap-6' }, weight.el, reps.el),
    entry.mode === 'max' && h('p', { class: 'mt-2 text-center text-sm text-muted' }, t('workout.toFailureHint')),
    h('div', { class: 'mt-6 grid gap-2' }, nextAction, completeBtn, skipBtn),
    restCard,
    h(
      'div',
      { class: 'mt-6 mb-2 flex items-center justify-between px-1' },
      h('h2', { class: 'text-[15px] font-semibold text-muted' }, t('workout.sets')),
      h('span', { class: 'text-[15px] font-semibold text-lime tabular' }, t('workout.setsDone', { done: entry.sets.length, total: entry.target.sets })),
    ),
    h('section', { class: 'card divide-y divide-line overflow-hidden' }, setRows),
    ex?.currentWeight > 0 && h('p', { class: 'mt-3 px-1 text-sm text-muted' }, t('workout.workingWeight', { w: fmtWeight(ex.currentWeight) })),
  );

  return { el, destroy: () => clearInterval(timer) };
}

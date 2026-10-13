import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, LANGS, setLang, getLang } from '../i18n/index.js';
import { app, updateSettings } from '../app/state.js';
import { navigate } from '../app/router.js';
import { exampleCycle } from '../domain/seed.js';
import { cleanName } from '../domain/text.js';
import { addCycle } from '../db/data.js';
import { requestPersistence } from '../db/db.js';
import { listDays } from '../db/repos/cycle.js';

let step = 1;
let draftName = '';

export default async function OnboardingView({ refresh }) {
  if (app.settings.onboarded) {
    navigate('/', { replace: true });
    return h('div');
  }
  return step === 1 ? stepOne(refresh) : stepTwo(refresh);
}

function brand() {
  return h(
    'div',
    { class: 'flex flex-col items-center pt-10 text-center' },
    h('div', { class: 'grid size-20 place-items-center rounded-[26px] bg-lime text-lime-ink shadow-[0_10px_40px_rgb(163_230_53/0.25)]' }, icon('dumbbell', 'size-11')),
    h('div', { class: 'mt-5 text-[34px] leading-none font-extrabold tracking-tight' }, 'Fit', h('span', { class: 'text-lime' }, 'week')),
  );
}

function stepOne(refresh) {
  const name = h('input', {
    class: 'field text-lg',
    type: 'text',
    maxlength: 40,
    value: draftName,
    placeholder: t('settings.namePlaceholder'),
    autocomplete: 'given-name',
    enterkeyhint: 'next',
    onInput: (e) => (draftName = e.target.value),
  });
  return h(
    'div',
    { class: 'flex min-h-[calc(100dvh-2rem)] flex-col pb-safe' },
    brand(),
    h('p', { class: 'mt-3 text-center text-muted' }, t('welcome.tagline')),
    h(
      'div',
      { class: 'mt-10 grid gap-2', role: 'group', 'aria-label': t('settings.language') },
      h('div', { class: 'px-1 text-sm font-semibold text-muted' }, t('settings.language')),
      LANGS.map((l) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(getLang() === l.code),
            class: `flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-lg font-semibold ${getLang() === l.code ? 'border-lime bg-lime-soft text-ink' : 'border-line bg-surface'}`,
            onClick: () => {
              setLang(l.code);
              refresh();
            },
          },
          l.label,
          getLang() === l.code && h('span', { class: 'text-lime' }, icon('check')),
        ),
      ),
    ),
    h('label', { class: 'mt-6 grid gap-2' }, h('span', { class: 'px-1 text-sm font-semibold text-muted' }, t('welcome.nameLabel')), name),
    h('div', { class: 'flex-1' }),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary mt-8 min-h-14 w-full text-lg',
        onClick: () => {
          step = 2;
          refresh();
        },
      },
      t('welcome.continue'),
      icon('arrowRight'),
    ),
  );
}

function stepTwo(refresh) {
  const preview = exampleCycle(getLang()).cycleDays;
  const finish = async (withExample) => {
    await updateSettings({ lang: getLang(), name: cleanName(draftName, 40), onboarded: true });
    if (withExample && !(await listDays()).length) await addCycle(exampleCycle(getLang()));
    requestPersistence();
    step = 1;
    navigate(withExample ? '/' : '/plan', { replace: true });
  };
  return h(
    'div',
    { class: 'pb-safe' },
    h(
      'div',
      { class: 'pt-4' },
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn -ml-2 text-lime',
          'aria-label': t('common.back'),
          onClick: () => {
            step = 1;
            refresh();
          },
        },
        icon('arrowLeft', 'size-6'),
      ),
    ),
    h('h1', { class: 'mt-2 text-[28px] leading-tight font-bold' }, t('welcome.startTitle')),
    h('p', { class: 'mt-2 text-muted' }, t('welcome.startText')),
    h(
      'button',
      { type: 'button', class: 'card mt-6 block w-full border-lime/50 p-4 text-left active:bg-surface-2', onClick: () => finish(true) },
      h('div', { class: 'flex items-center justify-between gap-3' }, h('div', { class: 'text-lg font-bold' }, t('welcome.example')), h('span', { class: 'chip' }, t('welcome.recommended'))),
      h('p', { class: 'mt-1 text-sm text-muted' }, t('welcome.exampleText')),
      h(
        'ol',
        { class: 'mt-3 grid gap-1.5' },
        preview.map((d, i) =>
          h('li', { class: 'flex items-center gap-3 text-[15px]' }, h('span', { class: 'grid size-7 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-lime tabular' }, String(i + 1)), h('span', { class: 'flex-1' }, d.name), h('span', { class: 'text-sm text-muted' }, t('common.exercises', { count: d.items.length }))),
        ),
      ),
    ),
    h(
      'button',
      { type: 'button', class: 'card mt-3 block w-full p-4 text-left active:bg-surface-2', onClick: () => finish(false) },
      h('div', { class: 'text-lg font-bold' }, t('welcome.empty')),
      h('p', { class: 'mt-1 text-sm text-muted' }, t('welcome.emptyText')),
    ),
  );
}

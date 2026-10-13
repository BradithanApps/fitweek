import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { header, segmented, toggle, sectionTitle } from '../ui/components/widgets.js';
import { openSheet, confirmSheet } from '../ui/components/sheet.js';
import { toast } from '../ui/components/toast.js';
import { t, LANGS, fmtRelDays, fmtWeekday, fmtNum } from '../i18n/index.js';
import { app, updateSettings, initSettings } from '../app/state.js';
import { navigate } from '../app/router.js';
import { toKey, diffDays, weekKeys } from '../domain/dates.js';
import { buildBackup, parseBackup, mergeData } from '../domain/backup.js';
import { cleanName } from '../domain/text.js';
import { readAll, writeAll, eraseAll } from '../db/data.js';
import { storageInfo, requestPersistence } from '../db/db.js';

export default async function SettingsView({ refresh }) {
  const st = app.settings;

  const row = (title, hint, control) =>
    h(
      'div',
      { class: 'px-4 py-3.5' },
      h('div', { class: `flex items-center justify-between gap-3 ${control && control.classList?.contains('seg') ? 'mb-2' : ''}` }, h('div', { class: 'min-w-0' }, h('div', { class: 'font-semibold' }, title), hint && h('div', { class: 'text-sm text-muted' }, hint)), control && !control.classList?.contains('seg') ? control : null),
      control && control.classList?.contains('seg') ? control : null,
    );

  // ——— Perfil ———
  const nameInput = h('input', {
    class: 'field mt-2',
    type: 'text',
    maxlength: 40,
    value: st.name,
    placeholder: t('settings.namePlaceholder'),
    autocomplete: 'given-name',
    onChange: async (e) => {
      await updateSettings({ name: cleanName(e.target.value, 40) });
      toast(t('common.saved'));
    },
  });

  const profile = h(
    'section',
    { class: 'card divide-y divide-line' },
    h('div', { class: 'px-4 py-3.5' }, h('label', { class: 'font-semibold' }, t('settings.name'), nameInput)),
    row(
      t('settings.language'),
      null,
      segmented({
        label: t('settings.language'),
        value: st.lang,
        options: LANGS.map((l) => ({ value: l.code, label: l.label })),
        onChange: (lang) => updateSettings({ lang }),
      }),
    ),
  );

  // ——— Entrenamiento ———
  const weekLabels = weekKeys(toKey());
  const restDays = h(
    'div',
    { class: 'grid grid-cols-7 gap-1', role: 'group', 'aria-label': t('settings.restDays') },
    weekLabels.map((key, i) => {
      const on = st.restWeekdays.includes(i);
      return h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(on),
          class: `min-h-11 rounded-xl text-sm font-semibold ${on ? 'bg-lime text-lime-ink' : 'border border-line bg-surface-2 text-muted'}`,
          onClick: async () => {
            const next = on ? st.restWeekdays.filter((d) => d !== i) : [...st.restWeekdays, i].sort();
            if (next.length > 6) return;
            await updateSettings({ restWeekdays: next });
            refresh();
          },
        },
        fmtWeekday(key).slice(0, 3),
      );
    }),
  );

  const training = h(
    'section',
    { class: 'card divide-y divide-line' },
    row(t('settings.unit'), t('settings.unitHint'), segmented({ label: t('settings.unit'), value: st.unit, options: [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }], onChange: (unit) => updateSettings({ unit }) })),
    row(
      t('settings.step'),
      t('settings.stepHint'),
      segmented({ label: t('settings.step'), value: st.weightStep, options: [1, 2.5, 5].map((n) => ({ value: n, label: fmtNum(n) })), onChange: (weightStep) => updateSettings({ weightStep }) }),
    ),
    row(
      t('settings.rest'),
      t('settings.restHint'),
      segmented({ label: t('settings.rest'), value: st.defaultRest, options: [60, 90, 120, 180].map((n) => ({ value: n, label: n < 120 ? `${n}s` : `${n / 60}m` })), onChange: (defaultRest) => updateSettings({ defaultRest }) }),
    ),
    h('div', { class: 'px-4 py-3.5' }, h('div', { class: 'font-semibold' }, t('settings.restDays')), h('div', { class: 'mb-2 text-sm text-muted' }, t('settings.restDaysHint', { n: 7 - st.restWeekdays.length })), restDays),
    row(t('settings.sound'), t('settings.soundHint'), toggle({ checked: st.sound, label: t('settings.sound'), onChange: (sound) => updateSettings({ sound }) })),
  );

  // ——— Datos ———
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onChange: (e) => importFile(e.target, refresh) });
  const lastBackup = st.lastBackupAt ? fmtRelDays(diffDays(toKey(new Date(st.lastBackupAt)), toKey())) : t('settings.never');

  const dataBtn = (iconName, label, onClick, cls = 'text-ink') =>
    h('button', { type: 'button', class: `flex min-h-14 w-full items-center gap-3 px-4 text-left font-semibold active:bg-surface-2 ${cls}`, onClick }, h('span', { class: cls === 'text-ink' ? 'text-lime' : '' }, icon(iconName)), label);

  const data = h(
    'section',
    { class: 'card divide-y divide-line overflow-hidden' },
    h('div', { class: 'px-4 py-3 text-sm text-muted' }, t('settings.dataHint'), ' ', h('b', { class: 'text-ink' }, `${t('settings.lastBackup')}: ${lastBackup}`)),
    dataBtn('download', t('settings.export'), () => exportData(refresh)),
    dataBtn('upload', t('settings.import'), () => fileInput.click()),
    dataBtn('trash', t('settings.erase'), eraseEverything, 'text-danger'),
    fileInput,
  );

  // ——— Acerca de ———
  const info = await storageInfo();
  const offline = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  const about = h(
    'section',
    { class: 'card divide-y divide-line text-[15px]' },
    aboutRow(t('settings.version'), __APP_VERSION__),
    aboutRow(t('settings.offline'), offline ? t('settings.offlineYes') : t('settings.offlineNo')),
    aboutRow(t('settings.storage'), info.usage != null ? `${(info.usage / 1024 / 1024).toFixed(1)} MB` : '—'),
    h(
      'div',
      { class: 'flex items-center justify-between gap-3 px-4 py-3' },
      h('span', { class: 'text-muted' }, t('settings.persistent')),
      info.persisted
        ? h('span', null, t('settings.yes'))
        : h(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondary min-h-9 px-3 text-sm',
              onClick: async () => {
                const ok = await requestPersistence();
                toast(ok ? t('settings.persistOk') : t('settings.persistNo'));
                refresh();
              },
            },
            t('settings.persistAsk'),
          ),
    ),
  );

  return h(
    'div',
    { class: 'pb-6' },
    header({ title: t('settings.title') }),
    profile,
    sectionTitle(t('settings.training')),
    training,
    sectionTitle(t('settings.data')),
    data,
    sectionTitle(t('settings.about')),
    about,
    h('p', { class: 'mt-6 px-1 text-center text-xs text-faint' }, t('settings.privacy')),
  );
}

function aboutRow(label, value) {
  return h('div', { class: 'flex items-center justify-between gap-3 px-4 py-3' }, h('span', { class: 'text-muted' }, label), h('span', { class: 'tabular' }, value));
}

async function exportData(refresh) {
  try {
    const all = await readAll();
    const json = JSON.stringify(buildBackup({ settings: app.settings, exercises: all.exercises, cycleDays: all.cycleDays, sessions: all.sessions }), null, 2);
    const filename = `fitweek-${toKey()}.json`;
    const file = new File([json], filename, { type: 'application/json' });
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'FitWeek' });
      } catch (err) {
        if (err?.name === 'AbortError') return; // El usuario cerró la hoja de compartir.
        throw err;
      }
    } else {
      const url = URL.createObjectURL(file);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    await updateSettings({ lastBackupAt: Date.now() });
    toast(t('settings.exported'));
    refresh();
  } catch (err) {
    console.error(err);
    toast(t('errors.export'));
  }
}

async function importFile(input, refresh) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return toast(t('backup.errTooBig'));
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return toast(t(parsed.error));
  const { counts, data } = parsed;

  openSheet({
    title: t('backup.previewTitle'),
    content: (close) =>
      h(
        'div',
        { class: 'grid gap-3' },
        h('p', { class: 'text-muted' }, t('backup.previewText', { days: counts.days, exercises: counts.exercises, sessions: counts.sessions })),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary min-h-14',
            onClick: async () => {
              close();
              try {
                const current = await readAll();
                const merged = mergeData(current, data);
                await writeAll({ ...merged, settings: {} });
                toast(t('backup.merged'));
                refresh();
              } catch (err) {
                console.error(err);
                toast(t('errors.import'));
              }
            },
          },
          t('backup.merge'),
        ),
        h('p', { class: 'px-1 text-sm text-muted' }, t('backup.mergeHint')),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-danger min-h-14',
            onClick: async () => {
              close();
              const ok = await confirmSheet({ title: t('backup.replaceTitle'), message: t('backup.replaceText'), confirm: t('backup.replace'), danger: true });
              if (!ok) return;
              try {
                await writeAll({ ...data, settings: { ...data.settings, onboarded: true, todayPick: null } });
                await initSettings();
                toast(t('backup.replaced'));
                navigate('/');
              } catch (err) {
                console.error(err);
                toast(t('errors.import'));
              }
            },
          },
          t('backup.replace'),
        ),
      ),
  });
}

async function eraseEverything() {
  const ok = await confirmSheet({ title: t('settings.eraseTitle'), message: t('settings.eraseText'), confirm: t('settings.eraseConfirm'), danger: true });
  if (!ok) return;
  await eraseAll();
  await initSettings();
  navigate('/welcome', { replace: true });
}

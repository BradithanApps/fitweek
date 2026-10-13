// Formularios y formatos compartidos entre pantallas.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openSheet } from '../ui/components/sheet.js';
import { miniStepper, segmented, toggle } from '../ui/components/widgets.js';
import { t, fmtNum } from '../i18n/index.js';
import { app, unit } from '../app/state.js';
import { nameKey, cleanName } from '../domain/text.js';

export const fmtWeight = (w) => `${fmtNum(w)} ${unit()}`;

export function fmtTarget({ sets, reps, mode }) {
  return mode === 'max' ? `${sets} × ${t('ex.toFailure')}` : `${sets} × ${reps}`;
}

export function parseWeight(raw) {
  const n = parseFloat(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n < 10000 ? Math.round(n * 100) / 100 : null;
}

/**
 * Hoja para crear/editar un ejercicio.
 * initial: { name, sets, reps, mode, weight, rest }
 * onSave(values) → Promise<string|void>  (si devuelve texto, se muestra como error)
 */
export function exerciseSheet({ title, initial = {}, catalog = [], excludeIds = new Set(), showRest = true, saveLabel, onSave, onDelete }) {
  const v = {
    name: initial.name ?? '',
    sets: initial.sets ?? 3,
    reps: initial.reps ?? 10,
    mode: initial.mode ?? 'reps',
    weight: initial.weight ?? null,
    rest: initial.rest ?? null,
  };

  openSheet({
    title,
    content: (close) => {
      const error = h('p', { class: 'min-h-5 text-sm text-danger', role: 'alert' });
      const suggestions = h('div', { class: 'mt-2 flex flex-wrap gap-2' });
      const weightInput = h('input', {
        class: 'field pr-14 text-lg tabular',
        type: 'text',
        inputmode: 'decimal',
        placeholder: '0',
        value: v.weight ? String(v.weight) : '',
        'aria-label': t('ex.weight'),
      });
      const nameInput = h('input', {
        class: 'field text-lg',
        type: 'text',
        maxlength: 60,
        autocomplete: 'off',
        autocapitalize: 'sentences',
        enterkeyhint: 'next',
        placeholder: t('ex.namePlaceholder'),
        value: v.name,
        autofocus: !initial.name,
        'aria-label': t('ex.name'),
        onInput: () => renderSuggestions(),
      });

      function renderSuggestions() {
        const q = nameKey(nameInput.value);
        const list = q
          ? catalog.filter((e) => !excludeIds.has(e.id) && e.nameKey.includes(q) && e.nameKey !== q).slice(0, 6)
          : [];
        suggestions.replaceChildren(
          ...list.map((e) =>
            h(
              'button',
              {
                type: 'button',
                class: 'chip min-h-9 px-3 text-sm',
                onClick: () => {
                  nameInput.value = e.name;
                  if (e.currentWeight) weightInput.value = String(e.currentWeight);
                  renderSuggestions();
                },
              },
              e.name,
            ),
          ),
        );
      }

      const sets = miniStepper({ value: v.sets, min: 1, max: 15, label: t('ex.sets'), onChange: (n) => (v.sets = n) });
      const reps = miniStepper({ value: v.reps, min: 1, max: 100, label: t('ex.reps'), onChange: (n) => (v.reps = n) });
      const repsWrap = h('div', null, reps.el);
      const setMode = (m) => {
        v.mode = m;
        repsWrap.style.opacity = m === 'max' ? '0.35' : '1';
        repsWrap.inert = m === 'max';
      };
      const maxToggle = toggle({ checked: v.mode === 'max', label: t('ex.toFailure'), onChange: (on) => setMode(on ? 'max' : 'reps') });
      setMode(v.mode);

      const restOptions = [
        { value: null, label: t('ex.restDefault') },
        { value: 60, label: '60s' },
        { value: 90, label: '90s' },
        { value: 120, label: '2m' },
        { value: 180, label: '3m' },
      ];

      const label = (text, extra) => h('div', { class: 'mb-2 flex items-center justify-between text-sm font-semibold text-muted' }, text, extra);

      const saveBtn = h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary min-h-14 w-full text-lg',
          onClick: async () => {
            const name = cleanName(nameInput.value);
            if (!name) {
              error.textContent = t('ex.errName');
              nameInput.focus();
              return;
            }
            const weight = weightInput.value.trim() === '' ? 0 : parseWeight(weightInput.value);
            if (weight === null) {
              error.textContent = t('ex.errWeight');
              weightInput.focus();
              return;
            }
            saveBtn.disabled = true;
            try {
              const msg = await onSave({ ...v, name, weight });
              if (msg) {
                error.textContent = msg;
                saveBtn.disabled = false;
                return;
              }
              close();
            } catch (err) {
              console.error(err);
              error.textContent = t('errors.save');
              saveBtn.disabled = false;
            }
          },
        },
        saveLabel || t('common.save'),
      );

      renderSuggestions();
      return h(
        'div',
        { class: 'grid gap-5' },
        h('div', null, label(t('ex.name')), nameInput, suggestions),
        h(
          'div',
          { class: 'grid grid-cols-2 gap-3' },
          h('div', null, label(t('ex.sets')), sets.el),
          h('div', null, label(t('ex.reps')), repsWrap),
        ),
        h(
          'label',
          { class: 'flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3' },
          h('span', null, h('span', { class: 'block font-semibold' }, t('ex.toFailure')), h('span', { class: 'block text-sm text-muted' }, t('ex.toFailureHint'))),
          maxToggle,
        ),
        h(
          'div',
          null,
          label(t('ex.weight')),
          h('div', { class: 'relative' }, weightInput, h('span', { class: 'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted' }, unit())),
          h('p', { class: 'mt-2 text-sm text-muted' }, t('ex.weightHint')),
        ),
        showRest && h('div', null, label(t('ex.rest')), segmented({ options: restOptions, value: v.rest, label: t('ex.rest'), onChange: (r) => (v.rest = r) })),
        error,
        h(
          'div',
          { class: 'grid gap-2' },
          saveBtn,
          onDelete &&
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-danger min-h-12 w-full',
                onClick: async () => {
                  close();
                  await onDelete();
                },
              },
              icon('trash'),
              t('ex.removeFromDay'),
            ),
        ),
      );
    },
  });
}

/** Hoja con un campo de texto (nombre de Día, etc.). */
export function textSheet({ title, value = '', placeholder, saveLabel, onSave, extra }) {
  openSheet({
    title,
    content: (close) => {
      const input = h('input', { class: 'field text-lg', type: 'text', maxlength: 40, value, placeholder, autofocus: true, enterkeyhint: 'done', autocapitalize: 'sentences' });
      const err = h('p', { class: 'min-h-5 text-sm text-danger', role: 'alert' });
      const save = async () => {
        const v = cleanName(input.value, 40);
        if (!v) {
          err.textContent = t('common.errEmpty');
          return;
        }
        await onSave(v);
        close();
      };
      input.addEventListener('keydown', (e) => e.key === 'Enter' && save());
      return h(
        'div',
        { class: 'grid gap-3' },
        input,
        err,
        h('button', { type: 'button', class: 'btn btn-primary min-h-14 text-lg', onClick: save }, saveLabel || t('common.save')),
        extra ? extra(close) : null,
      );
    },
  });
}

export function greetingKey(date = new Date()) {
  const hr = date.getHours();
  return hr < 5 ? 'home.greetNight' : hr < 12 ? 'home.greetMorning' : hr < 20 ? 'home.greetAfternoon' : 'home.greetEvening';
}

export function dayLabel(n) {
  return n ? t('common.dayN', { n }) : '';
}

export { app };

// Aviso y guía para instalar FitWeek en la pantalla de inicio.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openSheet } from '../ui/components/sheet.js';
import { toast } from '../ui/components/toast.js';
import { t } from '../i18n/index.js';
import { app, updateSettings } from '../app/state.js';
import { navigate } from '../app/router.js';
import { installMode, promptInstall, isIOSSafari, isMobile } from '../pwa/install.js';

const SNOOZE_DAYS = 14;

/** Inicia la instalación: diálogo nativo (Android) o guía paso a paso (iPhone). */
export async function startInstall({ hasData = false } = {}) {
  const mode = installMode();
  if (mode === 'prompt') {
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast(t('install.accepted'));
    return;
  }
  if (mode === 'ios') iosGuide({ hasData });
}

/** Tarjeta para Inicio. Solo en celulares, si se puede instalar y no se pospuso hace poco. */
export function installCard({ hasData = false, onChange } = {}) {
  const mode = installMode();
  if ((mode !== 'prompt' && mode !== 'ios') || !isMobile()) return null;
  const dismissed = app.settings.installDismissedAt;
  if (dismissed && Date.now() - dismissed < SNOOZE_DAYS * 86_400_000) return null;

  return h(
    'section',
    { class: 'card mt-4 border-lime/40 p-4' },
    h(
      'div',
      { class: 'flex items-start gap-3' },
      h('div', { class: 'grid size-11 shrink-0 place-items-center rounded-[14px] bg-lime text-lime-ink' }, icon('phone', 'size-6')),
      h('div', { class: 'min-w-0 flex-1' }, h('div', { class: 'font-semibold' }, t('install.cardTitle')), h('p', { class: 'mt-0.5 text-sm text-muted' }, t('install.cardText'))),
    ),
    h(
      'div',
      { class: 'mt-3 grid grid-cols-[1fr_auto] gap-2' },
      h('button', { type: 'button', class: 'btn btn-primary min-h-12', onClick: () => startInstall({ hasData }) }, icon('download'), t('install.button')),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost min-h-12 text-muted',
          onClick: async () => {
            await updateSettings({ installDismissedAt: Date.now() });
            onChange?.();
          },
        },
        t('install.later'),
      ),
    ),
  );
}

function iosGuide({ hasData }) {
  const safari = isIOSSafari();
  const steps = [
    { icon: 'share', title: safari ? t('install.iosStep1') : t('install.iosStep1Other'), text: safari ? t('install.iosStep1Hint') : t('install.iosStep1OtherHint') },
    { icon: 'addSquare', title: t('install.iosStep2'), text: t('install.iosStep2Hint') },
    { icon: 'check', title: t('install.iosStep3'), text: t('install.iosStep3Hint') },
  ];
  openSheet({
    title: t('install.iosTitle'),
    content: (close) =>
      h(
        'div',
        null,
        h('p', { class: 'mb-4 text-sm text-muted' }, t('install.iosIntro')),
        h(
          'ol',
          { class: 'grid gap-3' },
          steps.map((s, i) =>
            h(
              'li',
              { class: 'flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-3' },
              h('span', { class: 'grid size-7 shrink-0 place-items-center rounded-full bg-lime text-sm font-bold text-lime-ink tabular' }, String(i + 1)),
              h('div', { class: 'min-w-0 flex-1' }, h('div', { class: 'font-semibold' }, s.title), h('p', { class: 'mt-0.5 text-sm text-muted' }, s.text)),
              h('span', { class: 'grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-lime' }, icon(s.icon, 'size-6')),
            ),
          ),
        ),
        hasData &&
          h(
            'div',
            { class: 'mt-4 rounded-2xl border border-line p-3 text-sm text-muted' },
            h('p', null, t('install.iosDataWarning')),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-secondary mt-3 min-h-11 w-full text-[15px]',
                onClick: () => {
                  close();
                  navigate('/settings');
                },
              },
              icon('download', 'size-5 text-lime'),
              t('settings.export'),
            ),
          ),
        h('button', { type: 'button', class: 'btn btn-primary mt-4 min-h-14 w-full', onClick: () => close() }, t('install.gotIt')),
      ),
  });
}

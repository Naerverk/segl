import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { WatermarkConfig } from '../../models/types';
import type { WorkspaceAction } from '../../models/workspace';
import { watermarkText } from '../../pdf/watermark';
import { Disclosure } from '../Disclosure';
import { Slider } from '../PageSettings/PageSettings';

export function WatermarkSettings({ config, dispatch }: { config: WatermarkConfig; dispatch: (a: WorkspaceAction) => void }) {
  const { t, locale } = useI18n();
  const id = useId();
  const set = (patch: Partial<WatermarkConfig>) => dispatch({ type: 'setWatermark', patch });
  const text = watermarkText(config, locale);

  return (
    <section aria-labelledby={`${id}-t`} className="space-y-3">
      <h2 id={`${id}-t`} className="text-base font-semibold">
        {t('wm.title')}
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${id}-r`} className="field-label">
            {t('wm.recipient')}
          </label>
          <input
            id={`${id}-r`}
            className="input"
            value={config.recipient}
            placeholder={t('wm.recipientPlaceholder')}
            onChange={(e) => set({ recipient: e.target.value })}
            autoComplete="off"
            data-testid="wm-recipient"
          />
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="field-label">
            {t('wm.purpose')}
          </label>
          <input
            id={`${id}-p`}
            className="input"
            value={config.purpose}
            placeholder={t('wm.purposePlaceholder')}
            onChange={(e) => set({ purpose: e.target.value })}
            autoComplete="off"
            data-testid="wm-purpose"
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        {t('wm.preview')}{' '}
        <span className="font-semibold text-fg" data-testid="wm-text">
          {text || t('wm.empty')}
        </span>
      </p>

      <Disclosure summary={t('wm.customize')} testId="wm-advanced">
        <div>
          <label htmlFor={`${id}-tpl`} className="field-label">
            {t('wm.template')}
          </label>
          <input
            id={`${id}-tpl`}
            className="input font-mono !text-xs"
            value={config.template}
            onChange={(e) => set({ template: e.target.value })}
            aria-describedby={`${id}-tplh`}
            autoComplete="off"
            data-testid="wm-template"
          />
          <p id={`${id}-tplh`} className="mt-1 text-xs text-muted">
            {t('wm.templateHelp')}
          </p>
        </div>
        <div>
          <label htmlFor={`${id}-d`} className="field-label">
            {t('wm.date')}
          </label>
          <input id={`${id}-d`} type="date" className="input" value={config.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <fieldset>
          <legend className="field-label">{t('wm.layout')}</legend>
          <div className="segmented">
            {(['tiled', 'single'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={config.layout === l} onClick={() => set({ layout: l })}>
                {t(`wm.layout.${l}`)}
              </button>
            ))}
          </div>
        </fieldset>
        {config.layout === 'single' && (
          <div>
            <label htmlFor={`${id}-pos`} className="field-label">
              {t('wm.position')}
            </label>
            <select
              id={`${id}-pos`}
              className="input"
              value={config.position}
              onChange={(e) => set({ position: e.target.value as WatermarkConfig['position'] })}
            >
              {(['center', 'top', 'bottom'] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`wm.position.${p}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        <Slider id={`${id}-s`} label={t('wm.size')} value={config.fontSize} min={8} max={96} step={1} valueText={t('wm.sizeValue', { n: config.fontSize })} onChange={(v) => set({ fontSize: v })} />
        <Slider
          id={`${id}-o`}
          label={t('wm.opacity')}
          value={Math.round(config.opacity * 100)}
          min={5}
          max={100}
          step={5}
          valueText={t('wm.opacityValue', { n: Math.round(config.opacity * 100) })}
          onChange={(v) => set({ opacity: v / 100 })}
        />
        <Slider id={`${id}-rot`} label={t('wm.rotation')} value={config.rotation} min={-90} max={90} step={5} valueText={t('wm.rotationValue', { n: config.rotation })} onChange={(v) => set({ rotation: v })} />
        <div className="flex items-center gap-3">
          <label htmlFor={`${id}-c`} className="text-sm font-medium">
            {t('wm.color')}
          </label>
          <input id={`${id}-c`} type="color" className="h-8 w-12 cursor-pointer rounded border border-line bg-surface" value={config.color} onChange={(e) => set({ color: e.target.value })} />
        </div>
        <p className="text-xs text-muted">{t('wm.limit')}</p>
      </Disclosure>
    </section>
  );
}

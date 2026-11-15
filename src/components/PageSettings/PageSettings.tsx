import { Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useI18n } from '../../i18n';
import { DPI_LIMITS, QUALITY_LIMITS } from '../../models/defaults';
import type { PageMode, PageSettings as Settings } from '../../models/types';
import type { WorkspaceAction } from '../../models/workspace';
import { Disclosure } from '../Disclosure';

/** Ordered by how often they should be used: protect is the safe default. */
const MODES: PageMode[] = ['protect', 'quality'];
const QUALITY_DPIS = [150, 200, 300];

/** Returns the shared value of a field across pages, or undefined when mixed. */
function shared<K extends keyof Settings>(pages: Settings[], key: K): Settings[K] | undefined {
  const first = pages[0]?.[key];
  return pages.every((p) => p[key] === first) ? first : undefined;
}

export function PageSettings({
  pages,
  selected,
  active,
  dispatch,
}: {
  pages: Settings[];
  selected: number[];
  active: number;
  dispatch: (a: WorkspaceAction) => void;
}) {
  const { t, tp } = useI18n();
  const ids = useId();
  const sel = selected.map((i) => pages[i]);
  const mode = shared(sel, 'mode');
  const protectDpi = shared(sel, 'protectDpi');
  const qualityDpi = shared(sel, 'qualityDpi');
  const quality = shared(sel, 'jpegQuality');
  const watermark = shared(sel, 'watermark');
  const update = (patch: Partial<Omit<Settings, 'redactions'>>) => dispatch({ type: 'updatePages', indices: selected, patch });

  return (
    <section aria-labelledby={`${ids}-title`} className="space-y-3">
      <h2 id={`${ids}-title`} className="text-base font-semibold">
        {selected.length === 1 ? t('settings.title.one', { page: selected[0] + 1 }) : tp('settings.title', selected.length)}
      </h2>

      <fieldset>
        <legend className="sr-only">{t('settings.mode')}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-sunken p-1">
          {MODES.map((m) => (
            <label
              key={m}
              data-testid={`mode-${m}`}
              className={`relative cursor-pointer rounded-md px-2 py-1.5 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--pp-focus)] ${
                mode === m ? 'bg-surface font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name={`${ids}-mode`}
                value={m}
                checked={mode === m}
                onChange={() => dispatch({ type: 'setMode', indices: selected, mode: m })}
                className="sr-only"
              />
              {t(`mode.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-muted">{mode ? t(`mode.${mode}.desc`) : t('mode.mixed')}</p>
      <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={watermark === true}
            ref={(el) => {
              if (el) el.indeterminate = watermark === undefined;
            }}
            onChange={(e) => update({ watermark: e.target.checked })}
            data-testid="page-watermark"
          />
          {t('settings.watermark')}
        </label>

      {mode !== undefined && (
        <Disclosure summary={t('settings.advanced')} testId="page-advanced">
          {mode === 'quality' && (
            <div>
              <label htmlFor={`${ids}-fdpi`} className="field-label">
                {t('settings.dpi')}
              </label>
              <select id={`${ids}-fdpi`} className="input" value={qualityDpi ?? ''} onChange={(e) => update({ qualityDpi: Number(e.target.value) })}>
                {qualityDpi === undefined && <option value="">–</option>}
                {QUALITY_DPIS.map((d) => (
                  <option key={d} value={d}>
                    {t('settings.dpiValue', { n: d })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'protect' && (
            <>
              <Slider
                id={`${ids}-pdpi`}
                label={t('settings.dpi')}
                value={protectDpi ?? 150}
                min={DPI_LIMITS.min}
                max={DPI_LIMITS.max}
                step={10}
                valueText={protectDpi !== undefined ? t('settings.dpiValue', { n: protectDpi }) : '–'}
                onChange={(v) => update({ protectDpi: v })}
                testId="protect-dpi"
              />
              <Slider
                id={`${ids}-q`}
                label={t('settings.quality')}
                value={Math.round((quality ?? 0.65) * 100)}
                min={QUALITY_LIMITS.min * 100}
                max={QUALITY_LIMITS.max * 100}
                step={5}
                valueText={quality !== undefined ? t('settings.qualityValue', { n: Math.round(quality * 100) }) : '–'}
                onChange={(v) => update({ jpegQuality: v / 100 })}
                testId="protect-quality"
              />
            </>
          )}
        </Disclosure>
      )}

      <RedactionList page={active} settings={pages[active]} dispatch={dispatch} />
    </section>
  );
}

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  valueText,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  onChange: (v: number) => void;
  testId?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label flex justify-between">
        <span>{label}</span>
        <span className="font-normal tabular-nums text-muted">{valueText}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        data-testid={testId}
      />
    </div>
  );
}

/** Only shown when the active page has redactions – drawing happens in the preview. */
function RedactionList({ page, settings, dispatch }: { page: number; settings: Settings; dispatch: (a: WorkspaceAction) => void }) {
  const { t } = useI18n();
  const id = useId();
  if (settings.redactions.length === 0) return null;
  return (
    <section aria-labelledby={id} className="rounded-lg border border-line p-3">
      <h3 id={id} className="mb-2 text-sm font-medium">
        {t('redact.list')}
      </h3>
      <ul className="space-y-1.5" data-testid="redaction-list">
        {settings.redactions.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{t('redact.item', { n: i + 1 })}</span>
            <select
              aria-label={`${t('redact.color')} – ${t('redact.item', { n: i + 1 })}`}
              className="input !w-auto !py-0.5"
              value={r.color}
              onChange={(e) => dispatch({ type: 'updateRedaction', page, rect: { ...r, color: e.target.value as 'black' | 'white' } })}
            >
              <option value="black">{t('redact.black')}</option>
              <option value="white">{t('redact.white')}</option>
            </select>
            <button
              type="button"
              className="btn-icon"
              aria-label={t('redact.remove', { n: i + 1 })}
              onClick={() => dispatch({ type: 'removeRedaction', page, id: r.id })}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

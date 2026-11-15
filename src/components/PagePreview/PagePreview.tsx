import { Loader2, Plus, SquareDashed, ZoomIn, ZoomOut } from 'lucide-react';
import { newRedactionId } from '../../pdf/redact';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import type { PageInfo, PagePlan, RedactionColor, RedactionRect, WatermarkConfig } from '../../models/types';
import type { WorkspaceAction } from '../../models/workspace';
import type { PdfSession, PreviewImage } from '../../pdf/session';
import { usePreviewImage } from '../../hooks/usePreviewImage';
import { RedactionOverlay } from '../RedactionTool/RedactionOverlay';
import { watermarkText } from '../../pdf/watermark';

type View = 'result' | 'original' | 'compare';
type ZoomMode = 'fit-width' | 'fit-page' | 'custom';

/** CSS pixels per PDF point at 100 % zoom. */
const CSS_PX_PER_PT = 96 / 72;
const MAX_PREVIEW_DPI = 220;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Quantise preview DPI so small zoom changes reuse cached renders. */
function previewDpi(cssPxPerPt: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const dpi = cssPxPerPt * dpr * 72;
  return Math.max(36, Math.min(MAX_PREVIEW_DPI, Math.ceil(dpi / 24) * 24));
}

function PageImage({
  image,
  loading,
  error,
  width,
  height,
  alt,
  label,
  overlay,
}: {
  image: PreviewImage | null;
  loading: boolean;
  error: boolean;
  width: number;
  height: number;
  alt: string;
  label?: string;
  overlay?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <figure className="m-0 flex flex-col items-center">
      {label && <figcaption className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</figcaption>}
      <div className="relative bg-white shadow-sm ring-1 ring-line" style={{ width, height }}>
        {image && <img src={image.url} alt={alt} className="block h-full w-full select-none" draggable={false} data-testid="preview-image" />}
        {overlay}
        {loading && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-surface/90 px-2 py-0.5 text-xs text-muted" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {t('preview.rendering')}
          </span>
        )}
        {error && (
          <span className="absolute inset-x-2 top-2 note-danger" role="alert">
            {t('error.preview')}
          </span>
        )}
      </div>
    </figure>
  );
}

export function PagePreview({
  session,
  index,
  info,
  plan,
  redactions,
  watermark,
  pageCount,
  dispatch,
}: {
  session: PdfSession;
  index: number;
  info: PageInfo;
  plan: PagePlan;
  redactions: RedactionRect[];
  watermark: WatermarkConfig;
  pageCount: number;
  dispatch: (a: WorkspaceAction) => void;
}) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<View>('result');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-page');
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState<RedactionColor>('black');
  const [ref, size] = useElementSize<HTMLDivElement>();

  // Leave drawing mode when switching pages.
  useEffect(() => setDrawing(false), [index]);

  const panes = view === 'compare' ? 2 : 1;
  const gap = 24;
  const availW = Math.max(100, (size.width - 32 - (panes - 1) * gap) / panes);
  const availH = Math.max(100, size.height - 40 - (view === 'compare' ? 24 : 0));
  const fitW = availW / info.width;
  const fitP = Math.min(fitW, availH / info.height);
  const pxPerPt = zoomMode === 'fit-width' ? fitW : zoomMode === 'fit-page' ? fitP : zoom * CSS_PX_PER_PT;
  const effectiveZoom = pxPerPt / CSS_PX_PER_PT;
  const dispW = Math.round(info.width * pxPerPt);
  const dispH = Math.round(info.height * pxPerPt);
  const dpi = previewDpi(pxPerPt);
  const ready = size.width > 0;

  const wmKey = plan.watermark ? JSON.stringify(watermark) + watermarkText(watermark, locale) : '';
  const showOriginal = view !== 'result';
  const showResult = view !== 'original';
  const original = usePreviewImage(ready && showOriginal ? `o|${index}|${dpi}` : null, (s) => session.original(index, dpi, s), index);
  const result = usePreviewImage(
    ready && showResult ? `r|${JSON.stringify(plan)}|${dpi}|${wmKey}|${locale}` : null,
    (s) => session.result(plan, watermark, locale, dpi, s),
    index,
  );

  const stepZoom = (dir: 1 | -1) => {
    const cur = effectiveZoom;
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.001);
    setZoom(next ?? cur);
    setZoomMode('custom');
  };

  const planText = t('preview.planRaster', { dpi: plan.dpi, q: Math.round(plan.quality * 100) });

  const overlay = (burnt: boolean) => (
    <RedactionOverlay page={index} redactions={redactions} drawing={drawing} color={color} burnt={burnt} dispatch={dispatch} />
  );

  const resultImg = result.image;
  const clamped = resultImg?.clamped;

  return (
    <section aria-labelledby="preview-heading" className="flex h-full min-h-0 flex-col">
      <h2 id="preview-heading" className="sr-only">
        {t('preview.title')}
      </h2>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <div className="segmented" role="group" aria-label={t('preview.view')}>
          {(['result', 'compare', 'original'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} data-testid={`view-${v}`}>
              {t(`preview.${v}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={drawing ? 'btn-primary !py-1.5' : 'btn'}
          aria-pressed={drawing}
          onClick={() => setDrawing((d) => !d)}
          data-testid="redact-tool"
        >
          <SquareDashed className="h-4 w-4" aria-hidden />
          {t('redact.tool')}
        </button>
        {drawing && (
          <>
            <div className="segmented" role="group" aria-label={t('redact.color')}>
              {(['black', 'white'] as const).map((c) => (
                <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)}>
                  {t(`redact.${c}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                dispatch({ type: 'addRedaction', page: index, rect: { id: newRedactionId(), x: 0.35, y: 0.45, w: 0.3, h: 0.08, color } })
              }
              data-testid="add-redaction"
            >
              <Plus className="h-4 w-4" aria-hidden /> {t('redact.add')}
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5 text-muted">
          <button type="button" className="btn-ghost !px-1.5" onClick={() => stepZoom(-1)} aria-label={t('preview.zoomOut')} title={t('preview.zoomOut')}>
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="btn-ghost w-14 justify-center !px-1 text-xs tabular-nums"
            onClick={() => setZoomMode(zoomMode === 'fit-page' ? 'fit-width' : 'fit-page')}
            title={zoomMode === 'fit-page' ? t('preview.fitWidth') : t('preview.fitPage')}
            aria-label={`${t('preview.zoomLevel', { n: Math.round(effectiveZoom * 100) })}. ${zoomMode === 'fit-page' ? t('preview.fitWidth') : t('preview.fitPage')}`}
            data-testid="zoom-fit"
          >
            {Math.round(effectiveZoom * 100)} %
          </button>
          <button type="button" className="btn-ghost !px-1.5" onClick={() => stepZoom(1)} aria-label={t('preview.zoomIn')} title={t('preview.zoomIn')}>
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div ref={ref} className="checker relative min-h-0 flex-1 overflow-auto">
        {drawing && (
          <p className="sticky top-2 z-10 mx-auto mt-2 w-fit rounded-full bg-fg px-3 py-1 text-xs text-bg shadow" role="status">
            {t('redact.help')}
          </p>
        )}
        <div className="flex min-h-full min-w-fit items-start justify-center gap-6 p-4">
          {showOriginal && (
            <PageImage
              {...original}
              width={dispW}
              height={dispH}
              alt={t('preview.imageAlt', { n: index + 1, view: t('preview.original') })}
              label={view === 'compare' ? t('preview.before') : undefined}
              overlay={overlay(false)}
            />
          )}
          {showResult && (
            <PageImage
              {...result}
              width={dispW}
              height={dispH}
              alt={t('preview.imageAlt', { n: index + 1, view: t('preview.result') })}
              label={view === 'compare' ? t('preview.after') : undefined}
              overlay={view === 'result' ? overlay(true) : undefined}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-surface px-3 py-1 text-xs text-muted">
        <span data-testid="plan-label" title={plan.dpi > dpi && showResult ? t('preview.lowResNote', { dpi }) : undefined}>
          {planText}
        </span>
        {clamped && resultImg && <span className="text-warn">{t('preview.clamped', { dpi: Math.round(resultImg.effectiveDpi) })}</span>}
        <span className="ml-auto tabular-nums">{t('preview.pageOf', { n: index + 1, total: pageCount })}</span>
      </div>
    </section>
  );
}

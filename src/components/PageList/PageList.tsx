import { Image as ImageIcon, Shield, SquareDashed } from 'lucide-react';
import { memo, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useI18n } from '../../i18n';
import type { PagePlan, PageSettings } from '../../models/types';
import type { WorkspaceAction } from '../../models/workspace';
import type { PdfSession } from '../../pdf/session';

const MODE_ICON = { protect: Shield, quality: ImageIcon } as const;

function Thumbnail({ session, index, aspect }: { session: PdfSession; index: number; aspect: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          session.thumbnail(index).then((u) => alive && setUrl(u), () => {});
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [session, index]);
  return (
    <div ref={ref} className="checker w-full overflow-hidden rounded border border-line" style={{ aspectRatio: String(aspect) }}>
      {url && <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />}
    </div>
  );
}

interface ItemProps {
  session: PdfSession;
  index: number;
  aspect: number;
  settings: PageSettings;
  plan: PagePlan;
  selected: boolean;
  active: boolean;
  onClick: (e: MouseEvent, index: number) => void;
}

const PageItem = memo(function PageItem({ session, index, aspect, settings, plan, selected, active, onClick }: ItemProps) {
  const { t, tp } = useI18n();
  const Icon = MODE_ICON[settings.mode];
  const wm = plan.kind === 'raster' && plan.watermark;
  return (
    <li
      role="option"
      id={`page-option-${index}`}
      aria-selected={selected}
      data-testid={`page-${index + 1}`}
      data-mode={settings.mode}
      onClick={(e) => onClick(e, index)}
      className={`relative w-16 shrink-0 cursor-pointer select-none rounded-md border p-1.5 md:w-24 lg:w-auto ${
        selected ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-sunken'
      } ${active ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`}
    >
      <Thumbnail session={session} index={index} aspect={aspect} />
      <div className="mt-1 flex items-center justify-between gap-1 text-xs text-muted">
        <span className="font-medium text-fg">{index + 1}</span>
        <span className="flex items-center gap-1.5">
          {settings.redactions.length > 0 && (
            <span className="inline-flex items-center gap-0.5" title={tp('pages.redactions', settings.redactions.length)}>
              <SquareDashed className="h-3.5 w-3.5" aria-hidden />
              {settings.redactions.length}
            </span>
          )}
          <span title={t(`mode.${settings.mode}`)}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        </span>
      </div>
      <span className="sr-only">
        {t('pages.page', { n: index + 1 })}, {t(`mode.${settings.mode}`)}
        {settings.redactions.length > 0 && `, ${tp('pages.redactions', settings.redactions.length)}`}
        {wm && `, ${t('pages.watermark')}`}
      </span>
    </li>
  );
});

export function PageList({
  session,
  pages,
  plans,
  selected,
  active,
  dispatch,
}: {
  session: PdfSession;
  pages: PageSettings[];
  plans: PagePlan[];
  selected: number[];
  active: number;
  dispatch: (a: WorkspaceAction) => void;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLUListElement>(null);
  const selectedSet = new Set(selected);

  const onClick = (e: MouseEvent, index: number) => {
    dispatch({ type: 'select', index, range: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
  };

  useEffect(() => {
    document.getElementById(`page-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const n = pages.length;
    let next: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(n - 1, active + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(0, active - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      dispatch({ type: 'selectAll' });
      return;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      dispatch({ type: 'select', index: active, toggle: e.metaKey || e.ctrlKey || e.key === ' ' });
      return;
    }
    if (next === null) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) dispatch({ type: 'setActive', index: next });
    else dispatch({ type: 'select', index: next, range: e.shiftKey });
  };

  return (
    <nav aria-labelledby="pages-heading" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 id="pages-heading" className="text-sm font-semibold">
          {t('pages.title')} <span className="font-normal text-muted">({pages.length})</span>
        </h2>
        <button type="button" className="btn-ghost text-xs" onClick={() => dispatch({ type: 'selectAll' })}>
          {t('pages.selectAll')}
        </button>
      </div>
      <p id="pages-hint" className="hidden px-3 pb-2 text-[11px] leading-snug text-muted lg:block">
        {t('pages.selectionHint')}
      </p>
      <ul
        ref={listRef}
        role="listbox"
        aria-label={t('pages.listLabel')}
        aria-multiselectable="true"
        aria-describedby="pages-hint"
        aria-activedescendant={`page-option-${active}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        data-testid="page-list"
        className="flex min-h-0 flex-1 gap-1.5 overflow-x-auto px-2 pb-3 lg:grid lg:auto-rows-min lg:grid-cols-1 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-4"
      >
        {pages.map((p, i) => {
          const info = session.source.pages[i];
          return (
            <PageItem
              key={i}
              session={session}
              index={i}
              aspect={info.width / info.height}
              settings={p}
              plan={plans[i]}
              selected={selectedSet.has(i)}
              active={i === active}
              onClick={onClick}
            />
          );
        })}
      </ul>
    </nav>
  );
}

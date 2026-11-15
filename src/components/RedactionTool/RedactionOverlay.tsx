import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '../../i18n';
import type { RedactionColor, RedactionRect } from '../../models/types';
import type { WorkspaceAction } from '../../models/workspace';
import { clampRect, isMeaningfulRect, nudgeRect, rectFromPoints } from '../../pdf/geometry';
import { newRedactionId } from '../../pdf/redact';

type Drag =
  | { kind: 'draw'; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: 'move' | 'resize'; id: string; origin: { x: number; y: number }; rect: RedactionRect };

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/**
 * Interactive layer on top of the page image for drawing, moving and resizing redaction
 * rectangles. Rectangles are stored in normalised page coordinates and are fully keyboard
 * accessible (arrow keys move, Alt+arrow resizes, Delete removes).
 */
export function RedactionOverlay({
  page,
  redactions,
  drawing,
  color,
  burnt,
  dispatch,
}: {
  page: number;
  redactions: RedactionRect[];
  /** Whether new rectangles can be drawn. */
  drawing: boolean;
  color: RedactionColor;
  /** The underlying image already contains the redactions (result view). */
  burnt: boolean;
  dispatch: (a: WorkspaceAction) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<RedactionRect | null>(null);

  const point = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(r.width, Math.max(0, e.clientX - r.left)), y: Math.min(r.height, Math.max(0, e.clientY - r.top)), w: r.width, h: r.height };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!drawing || e.button !== 0 || e.target !== ref.current) return;
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    const p = point(e);
    setDrag({ kind: 'draw', start: p, current: p });
  };

  const startEdit = (e: PointerEvent, rect: RedactionRect, kind: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    ref.current!.setPointerCapture(e.pointerId);
    const p = point(e);
    setDrag({ kind, id: rect.id, origin: { x: p.x / p.w, y: p.y / p.h }, rect });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const p = point(e);
    if (drag.kind === 'draw') {
      const next = { ...drag, current: p };
      setDrag(next);
      setPreview({ id: 'preview', color, ...rectFromPoints(next.start, p, p.w, p.h) });
    } else {
      const dx = p.x / p.w - drag.origin.x;
      const dy = p.y / p.h - drag.origin.y;
      const r = drag.kind === 'move' ? nudgeRect(drag.rect, { dx, dy }) : nudgeRect(drag.rect, { dw: dx, dh: dy });
      setPreview(r);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!drag) return;
    ref.current?.releasePointerCapture(e.pointerId);
    if (drag.kind === 'draw') {
      const p = point(e);
      const r = rectFromPoints(drag.start, p, p.w, p.h);
      if (isMeaningfulRect(r)) dispatch({ type: 'addRedaction', page, rect: { id: newRedactionId(), color, ...r } });
    } else if (preview) {
      dispatch({ type: 'updateRedaction', page, rect: clampRect(preview) });
    }
    setDrag(null);
    setPreview(null);
  };

  const onKeyDown = (e: KeyboardEvent, rect: RedactionRect) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'removeRedaction', page, id: rect.id });
      return;
    }
    const d = keys[e.key];
    if (!d) return;
    e.preventDefault();
    const next = e.altKey ? nudgeRect(rect, { dw: d[0], dh: d[1] }) : nudgeRect(rect, { dx: d[0], dy: d[1] });
    dispatch({ type: 'updateRedaction', page, rect: next });
  };

  const shown = redactions.map((r) => (preview && drag && drag.kind !== 'draw' && drag.id === r.id ? preview : r));

  return (
    <div
      ref={ref}
      data-testid="redaction-overlay"
      className={`absolute inset-0 ${drawing ? 'cursor-crosshair' : ''}`}
      style={{ touchAction: drawing ? 'none' : 'auto' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDrag(null);
        setPreview(null);
      }}
    >
      {shown.map((r, i) => (
        <div
          key={r.id}
          role="button"
          tabIndex={0}
          aria-label={t('redact.areaLabel', { n: i + 1 })}
          data-testid="redaction-box"
          onKeyDown={(e) => onKeyDown(e, r)}
          onPointerDown={(e) => startEdit(e, r, 'move')}
          className={`redaction-box absolute cursor-move ${r.color === 'white' ? 'is-white' : ''} ${burnt ? 'is-burnt' : ''}`}
          style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }}
        >
          <span className="absolute -top-5 left-0 rounded bg-[#e11d48] px-1 text-[10px] font-semibold leading-4 text-white">
            {i + 1}
          </span>
          <span
            aria-hidden
            onPointerDown={(e) => startEdit(e, r, 'resize')}
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-[#e11d48]"
          />
        </div>
      ))}
      {preview && drag?.kind === 'draw' && (
        <div
          className={`redaction-box pointer-events-none absolute ${color === 'white' ? 'is-white' : ''}`}
          style={{ left: pct(preview.x), top: pct(preview.y), width: pct(preview.w), height: pct(preview.h) }}
        />
      )}
    </div>
  );
}

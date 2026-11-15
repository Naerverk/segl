import { useEffect, useState } from 'react';
import type { PreviewImage } from '../pdf/session';

/**
 * Loads a preview image via `load`, debounced and cancellable. Keeps showing the previous
 * image while a new one renders, so changing settings does not cause flicker.
 */
export function usePreviewImage(
  key: string | null,
  load: (signal: AbortSignal) => Promise<PreviewImage>,
  /** When this changes (e.g. another page), the previous image is cleared instead of kept. */
  resetKey: string | number = '',
  debounceMs = 120,
): { image: PreviewImage | null; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ key: string | null; image: PreviewImage | null; loading: boolean; error: boolean }>({
    key: null,
    image: null,
    loading: false,
    error: false,
  });
  const [lastReset, setLastReset] = useState(resetKey);
  if (lastReset !== resetKey) {
    // Adjust state during render (React-recommended pattern) so a stale page is never shown.
    setLastReset(resetKey);
    setState({ key: null, image: null, loading: true, error: false });
  }

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: false }));
    const timer = setTimeout(() => {
      load(ctrl.signal).then(
        (image) => {
          if (!ctrl.signal.aborted) setState({ key, image, loading: false, error: false });
        },
        () => {
          if (!ctrl.signal.aborted) setState((s) => ({ ...s, loading: false, error: true }));
        },
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `load` is intentionally excluded: `key` fully describes what is rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { image: state.image, loading: state.loading, error: state.error };
}

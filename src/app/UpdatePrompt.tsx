import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from '../i18n';

/**
 * Predictable app updates: a new service worker never takes over silently while a document is
 * open. The user decides when to reload (which discards the in-memory document).
 */
export function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  // The "ready for offline use" note is informational only – hide it after a few seconds.
  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="fixed left-1/2 top-14 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-lg">
      <span className="flex-1">{needRefresh ? t('pwa.update') : t('pwa.offlineReady')}</span>
      {needRefresh ? (
        <>
          <button type="button" className="btn-primary !px-3 !py-1" onClick={() => void updateServiceWorker(true)}>
            {t('pwa.reload')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setNeedRefresh(false)}>
            {t('pwa.dismiss')}
          </button>
        </>
      ) : (
        <button type="button" className="btn" onClick={() => setOfflineReady(false)}>
          {t('pwa.ok')}
        </button>
      )}
    </div>
  );
}

import { lazy, Suspense, useEffect, useState } from 'react';
import { DocumentUpload } from '../components/DocumentUpload/DocumentUpload';
import { PasswordDialog } from '../components/DocumentUpload/PasswordDialog';
import { Dialog } from '../components/Dialog';
import { useDocumentController } from '../hooks/useDocumentController';
import { I18nProvider, useI18n } from '../i18n';
import { PrivacyPage } from './PrivacyPage';
import { Footer, Header } from './Shell';

// The workspace (preview, redaction, export with pdf-lib) is only downloaded once a file is open.
const Workspace = lazy(() => import('../components/Workspace/Workspace').then((m) => ({ default: m.Workspace })));

type View = 'app' | 'about';
const viewFromHash = (): View => (/^#\/(personvern|privacy|about)/.test(window.location.hash) ? 'about' : 'app');

function useHashView() {
  const [view, setView] = useState<View>(viewFromHash);
  useEffect(() => {
    const on = () => {
      setView(viewFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [view, setView] as const;
}

function AppInner() {
  const { t } = useI18n();
  const [view, setView] = useHashView();
  const controller = useDocumentController();
  const { session, status } = controller;

  // Never put the (possibly sensitive) file name into the tab title / browser history.
  useEffect(() => {
    document.title = session ? `${t('app.name')} – ${t('app.docOpen')}` : t('app.name');
  }, [session, t]);

  const signatureWarning = status === 'ready' && session && !controller.signatureAcknowledged;

  return (
    <div className="flex min-h-svh flex-col md:h-full md:min-h-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {t('app.skipToContent')}
      </a>
      <Header view={view} onNavigate={setView} />
      <div className="flex flex-1 flex-col md:min-h-0 md:overflow-auto">
        {/* The workspace stays mounted while reading the privacy page, so nothing is lost. */}
        <div className={view === 'app' ? 'flex flex-1 flex-col md:min-h-0' : 'hidden'}>
          {status === 'ready' && session && controller.signatureAcknowledged ? (
            <Suspense fallback={null}>
              <Workspace controller={controller} session={session} />
            </Suspense>
          ) : (
            <main id="main" className="flex-1">
              <DocumentUpload controller={controller} />
            </main>
          )}
        </div>
        {view === 'about' && <PrivacyPage />}
      </div>
      <Footer />
      <PasswordDialog request={controller.passwordRequest} />
      <Dialog
        open={!!signatureWarning}
        title={session?.source.inspection.signatureStatus === 'unknown' ? t('signature.unknownTitle') : t('signature.title')} onCancel={() => void controller.close()} labelledBy="sig-title">
        <p className="text-sm" data-testid="signature-warning">
          {session?.source.inspection.signatureStatus === 'unknown' ? t('signature.unknownBody') : t('signature.body')}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => void controller.close()}>
            {t('signature.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={controller.acknowledgeSignature} data-testid="signature-continue">
            {t('signature.continue')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

export function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

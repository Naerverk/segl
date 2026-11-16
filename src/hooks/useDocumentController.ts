import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { emptyWorkspace, workspaceReducer } from '../models/workspace';
import { ImportError, type ImportErrorCode } from '../pdf/importBase';
import type { PdfSession } from '../pdf/session';
import { LatestImport } from '../lib/latestImport';

export interface PasswordRequest {
  reason: 'need' | 'incorrect';
  resolve: (pw: string | null) => void;
}

export type LoadStatus = 'idle' | 'loading' | 'ready';

/**
 * Owns the lifecycle of the open document: import, password prompt, signature warning,
 * workspace settings and complete cleanup when the document is closed.
 */
export function useDocumentController() {
  const { t } = useI18n();
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [session, setSession] = useState<PdfSession | null>(null);
  const [error, setError] = useState<ImportErrorCode | 'multiple' | null>(null);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const [signatureAcknowledged, setSignatureAcknowledged] = useState(false);
  const [workspace, dispatch] = useReducer(workspaceReducer, t('wm.default'), emptyWorkspace);
  /** Serialises imports: only the latest open() can become active. */
  const importsRef = useRef<LatestImport<PdfSession> | null>(null);
  if (!importsRef.current) importsRef.current = new LatestImport<PdfSession>((s) => s.dispose());
  const imports = importsRef.current;
  /** Request counter for UI state – incremented synchronously by open() and close(). */
  const requestRef = useRef(0);
  /** Pending password prompt, so it can always be settled (with null) on close/replace/unmount. */
  const pendingPasswordRef = useRef<((pw: string | null) => void) | null>(null);

  const settlePassword = () => {
    const resolve = pendingPasswordRef.current;
    pendingPasswordRef.current = null;
    resolve?.(null);
  };

  const resetUi = useCallback(() => {
    setSession(null);
    setPasswordRequest(null);
    setSignatureAcknowledged(false);
    dispatch({ type: 'reset', watermarkTemplate: t('wm.default') });
  }, [t]);

  // Keep the default watermark template in the current language until the user edits it.
  useEffect(() => {
    dispatch({ type: 'setWatermarkTemplateDefault', template: t('wm.default') });
  }, [t]);

  const close = useCallback(async () => {
    ++requestRef.current;
    settlePassword();
    resetUi();
    setStatus('idle');
    await imports.close();
  }, [imports, resetUi]);

  const open = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length !== 1) {
        setError('multiple');
        return;
      }
      const request = ++requestRef.current;
      settlePassword();
      resetUi();
      setError(null);
      setStatus('loading');
      try {
        const session = await imports.open(async (signal) => {
          // The PDF engine (PDF.js, pdf-lib) is only downloaded once a file is opened.
          const [{ loadSourceDocument }, { PdfSession }] = await Promise.all([import('../pdf/import'), import('../pdf/session')]);
          const source = await loadSourceDocument(
            list[0],
            (reason) =>
              new Promise<string | null>((resolve) => {
                if (signal.aborted || request !== requestRef.current) return resolve(null);
                const settle = (pw: string | null) => {
                  if (pendingPasswordRef.current === settle) pendingPasswordRef.current = null;
                  setPasswordRequest(null);
                  resolve(pw);
                };
                pendingPasswordRef.current = settle;
                signal.addEventListener('abort', () => settle(null), { once: true });
                setPasswordRequest({ reason, resolve: settle });
              }),
            signal,
          );
          return new PdfSession(source);
        });
        // Superseded by a newer open()/close(): its result was already disposed.
        if (!session || request !== requestRef.current) return;
        dispatch({ type: 'init', pageCount: session.source.pages.length, watermarkTemplate: t('wm.default') });
        setSession(session);
        // Warn when signed – and also when the signature status could not be determined.
        setSignatureAcknowledged(session.source.inspection.signatureStatus === 'none');
        setStatus('ready');
      } catch (e) {
        if (request !== requestRef.current || (e instanceof ImportError && e.code === 'cancelled')) return;
        setStatus('idle');
        setPasswordRequest(null);
        setError(e instanceof ImportError ? e.code : 'invalid');
      }
    },
    [imports, resetUi, t],
  );

  // Release everything if the component unmounts: running import, pending prompt and session.
  useEffect(
    () => () => {
      ++requestRef.current;
      pendingPasswordRef.current?.(null);
      void imports.close();
    },
    [imports],
  );

  return {
    status,
    session,
    error,
    clearError: () => setError(null),
    passwordRequest,
    signatureAcknowledged,
    acknowledgeSignature: () => setSignatureAcknowledged(true),
    workspace,
    dispatch,
    open,
    close,
  };
}

export type DocumentController = ReturnType<typeof useDocumentController>;

import { CheckCircle2, Download, KeyRound, Loader2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { formatBytes, normalizeExportFileName, suggestExportFileName } from '../../lib/filename';
import { AbortedError } from '../../lib/taskQueue';
import type { PagePlan } from '../../models/types';
import type { WorkspaceAction, WorkspaceState } from '../../models/workspace';
import { estimateOutputSize } from '../../pdf/estimate';
import { buildExportPdf, ExportCancelledError, OutputTooLargeError, PageRenderError, type ExportReport } from '../../pdf/export';
import type { PdfSession } from '../../pdf/session';
import { Disclosure } from '../Disclosure';
import { BuyMeACoffeeFrame } from '../../app/Shell';
import { config } from '../../config/app';
import { generatePassword } from '../../lib/random';
import { CopyButton, OneTimeLinkPanel, PasswordField } from './PasswordProtection';

type ExportState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number; encrypting?: boolean }
  | { status: 'done'; url: string; name: string; report: ExportReport; key: string; sizeBytes: number; password: string | null }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

export function ExportPanel({
  session,
  workspace,
  plans,
  dispatch,
}: {
  session: PdfSession;
  workspace: WorkspaceState;
  plans: PagePlan[];
  dispatch: (a: WorkspaceAction) => void;
}) {
  const { t, tp, locale } = useI18n();
  const id = useId();
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const ctrlRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const suggested = suggestExportFileName(session.source.name);
  const fileName = normalizeExportFileName(workspace.exportOptions.fileName, suggested);
  // Password protection lives only in this component's memory and is gone when the document closes.
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState('');
  const usePassword = protect ? password.trim() : '';
  const settingsKey = JSON.stringify([plans, workspace.watermark, fileName, locale, protect, usePassword]);
  const estimate = useMemo(() => estimateOutputSize(session.source.pages, plans, session.source.size), [session, plans]);

  const revoke = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };
  useEffect(
    () => () => {
      ctrlRef.current?.abort();
      revoke();
    },
    [],
  );

  const run = async () => {
    revoke();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState({ status: 'running', done: 0, total: plans.length });
    try {
      const built = await buildExportPdf({
        plans,
        rasterize: session.exportRasterizer(workspace.watermark, locale),
        signal: ctrl.signal,
        onProgress: (done, total) => setState({ status: 'running', done, total }),
      });
      let bytes = built.bytes;
      if (usePassword) {
        setState({ status: 'running', done: plans.length, total: plans.length, encrypting: true });
        // qpdf (WebAssembly) is only downloaded when password protection is used.
        const { qpdfEncryptor } = await import('../../pdf/encryption');
        bytes = await qpdfEncryptor.encrypt(bytes, { userPassword: usePassword }, ctrl.signal);
      }
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      urlRef.current = url;
      setState({ status: 'done', url, name: fileName, report: built.report, key: settingsKey, sizeBytes: bytes.byteLength, password: usePassword || null });
    } catch (e) {
      const name = (e as Error | undefined)?.name;
      if (e instanceof ExportCancelledError || e instanceof AbortedError || name === 'EncryptionCancelledError' || ctrl.signal.aborted) setState({ status: 'cancelled' });
      else if (name === 'EncryptionTooLargeError') setState({ status: 'error', message: t('error.encrypt-too-large') });
      else if (name === 'EncryptionError') setState({ status: 'error', message: t('error.encrypt') });
      else if (e instanceof PageRenderError) setState({ status: 'error', message: t('error.render', { page: e.page }) });
      else if (e instanceof OutputTooLargeError) setState({ status: 'error', message: t('error.output-too-large') });
      else setState({ status: 'error', message: t('error.export') });
    } finally {
      ctrlRef.current = null;
    }
  };

  const running = state.status === 'running';
  const done = state.status === 'done' && state.key === settingsKey ? state : null;

  return (
    <section aria-labelledby={`${id}-t`} className="space-y-3">
      <h2 id={`${id}-t`} className="sr-only">
        {t('export.title')}
      </h2>

      {done ? (
        <div className="space-y-2" data-testid="export-result" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden /> {t('export.done')}
            <span className="font-normal text-muted" data-testid="export-size">
              · {formatBytes(done.sizeBytes, locale)}
            </span>
          </p>
          <a href={done.url} download={done.name} className="btn-primary w-full !py-2.5" data-testid="download-link">
            <Download className="h-4 w-4" aria-hidden />
            {t('export.download')}
          </a>
          {done.password && (
            <div className="space-y-2" data-testid="export-protected">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-ok" aria-hidden /> {t('protect.done')}
              </p>
              <div className="flex gap-1.5">
                <input className="input min-w-0 font-mono" value={done.password} readOnly aria-label={t('protect.label')} onFocus={(e) => e.target.select()} data-testid="protect-result-password" />
                <CopyButton text={done.password} label={t('protect.copy')} testId="protect-copy" />
              </div>
              <p className="text-xs text-muted">{t('protect.sendSeparately')}</p>
              {config.secretShareUrl && <OneTimeLinkPanel key={done.password} password={done.password} serverUrl={config.secretShareUrl} />}
            </div>
          )}
          <BuyMeACoffeeFrame />
          <p className="truncate text-xs text-muted" title={done.name}>
            {done.name}
          </p>
          <p className="text-xs text-muted">{t('export.allRaster')}</p>
          {done.report.clampedPages.length > 0 && (
            <p className="text-xs text-warn">{t('export.clampedPages', { pages: done.report.clampedPages.join(', ') })}</p>
          )}
          <button type="button" className="btn-ghost text-xs" onClick={() => { revoke(); setState({ status: 'idle' }); }} data-testid="export-again">
            {t('export.again')}
          </button>
        </div>
      ) : running ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {state.encrypting ? t('export.encrypting') : t('export.progress', { done: Math.min(state.done + 1, state.total), total: state.total })}
          </div>
          <progress className="h-2 w-full" max={state.total} value={state.done} aria-label={t('export.title')} />
          <button type="button" className="btn" onClick={() => ctrlRef.current?.abort()} data-testid="export-cancel">
            <X className="h-4 w-4" aria-hidden /> {t('export.cancel')}
          </button>
        </div>
      ) : (
        <>
          <PasswordField
            enabled={protect}
            password={password}
            onToggle={(on) => {
              setProtect(on);
              if (on && !password) setPassword(generatePassword());
            }}
            onChange={setPassword}
            onRegenerate={() => setPassword(generatePassword())}
          />
          <button
            type="button"
            className="btn-primary w-full !py-2.5 text-base"
            onClick={() => void run()}
            disabled={protect && !usePassword}
            data-testid="export-button"
          >
            {t('export.button')}
          </button>
          <p className="text-center text-xs text-muted" data-testid="estimate">
            {tp('doc.pages', plans.length)} · {t('export.estimateShort', { size: formatBytes(estimate, locale) })}
          </p>
        </>
      )}

      <div aria-live="polite">
        {state.status === 'cancelled' && <p className="text-sm text-muted">{t('export.cancelled')}</p>}
        {state.status === 'error' && (
          <p className="note-danger" role="alert">
            {state.message}
          </p>
        )}
      </div>

      {!running && (
        <Disclosure summary={t('export.more')} testId="export-more">
          <div>
            <label htmlFor={`${id}-fn`} className="field-label">
              {t('export.fileName')}
            </label>
            <input
              id={`${id}-fn`}
              className="input"
              value={workspace.exportOptions.fileName}
              placeholder={suggested}
              onChange={(e) => dispatch({ type: 'setExportOptions', patch: { fileName: e.target.value } })}
              autoComplete="off"
            />
          </div>
        </Disclosure>
      )}
    </section>
  );
}

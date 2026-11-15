import { FileUp, Loader2, ShieldCheck } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { formatBytes } from '../../lib/filename';
import { MAX_FILE_BYTES, MAX_PAGES } from '../../pdf/import';
import type { DocumentController } from '../../hooks/useDocumentController';

export function DocumentUpload({ controller }: { controller: DocumentController }) {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const loading = controller.status === 'loading';

  const errorText = controller.error
    ? t(`error.${controller.error}` as const, {
        max: controller.error === 'too-large' ? formatBytes(MAX_FILE_BYTES, locale) : MAX_PAGES,
      })
    : null;

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-16 text-center sm:py-24" aria-labelledby="upload-title">
      <h1 id="upload-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t('upload.title')}
      </h1>
      <p className="mt-3 text-base text-muted">{t('upload.lead')}</p>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted" data-testid="not-safe">
        {t('upload.notSafe')}{' '}
        <a href="#/personvern" className="text-fg underline underline-offset-2 hover:text-accent">
          {t('upload.readMore')}
        </a>
      </p>

      <div
        data-testid="dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void controller.open(e.dataTransfer.files);
        }}
        className={`relative mt-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
        }`}
      >
        {/* Always mounted: choosing a new file replaces (and cancels) an import in progress. */}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          data-testid="file-input"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) void controller.open(e.target.files);
            e.target.value = '';
          }}
        />
        {loading ? (
          <p className="flex items-center gap-2 text-muted" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t('upload.loading')}
          </p>
        ) : (
          <>
            <FileUp className="mb-4 h-8 w-8 text-muted" aria-hidden />
            <button type="button" className="btn-primary !px-6 !py-2.5 text-base" onClick={() => inputRef.current?.click()} aria-describedby={hintId}>
              {t('upload.choose')}
            </button>
            <p className="mt-3 text-sm text-muted">
              {t('upload.or')} {t('upload.drop').toLowerCase()}
            </p>

          </>
        )}
      </div>

      {errorText && (
        <p role="alert" className="note-danger mt-4 text-left">
          {errorText}
        </p>
      )}

      <p id={hintId} className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
        <ShieldCheck className="h-4 w-4 text-ok" aria-hidden />
        {t('app.localNotice')}
      </p>
    </section>
  );
}

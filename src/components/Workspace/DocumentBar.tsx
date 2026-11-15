import { Info, X } from 'lucide-react';
import { useI18n, type MessageKey } from '../../i18n';
import { formatBytes } from '../../lib/filename';
import type { DocumentInspection } from '../../models/types';
import type { SourceDocument } from '../../pdf/import';

const FEATURES: [keyof DocumentInspection, MessageKey][] = [
  ['hasSignatures', 'doc.feature.signatures'],
  ['encrypted', 'doc.feature.encrypted'],
  ['hasForms', 'doc.feature.forms'],
  ['hasAnnotations', 'doc.feature.annotations'],
  ['hasAttachments', 'doc.feature.attachments'],
  ['hasJavaScript', 'doc.feature.javascript'],
  ['hasXfa', 'doc.feature.xfa'],
  ['hasMetadata', 'doc.feature.metadata'],
];

export function DocumentBar({ source, onClose }: { source: SourceDocument; onClose: () => void }) {
  const { t, tp, locale } = useI18n();
  const ins = source.inspection;
  const found = FEATURES.filter(([k]) => ins[k]).map(([, key]) => t(key));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-2">
      <h1 className="min-w-0 max-w-[40ch] truncate text-sm font-semibold" title={source.name} data-testid="doc-name">
        {source.name}
      </h1>
      <span className="text-sm text-muted" data-testid="doc-meta">
        {tp('doc.pages', source.pages.length)} · {formatBytes(source.size, locale)}
      </span>
      {found.length > 0 && (
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted" data-testid="doc-inspection" title={t('doc.featureNote')}>
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {t('doc.contains')} {found.join(', ')}
          </span>
        </span>
      )}
      {ins.hasXfa && <span className="text-xs text-warn">{t('doc.xfaNote')}</span>}
      {ins.incomplete && (
        <span className="text-xs text-warn" data-testid="inspection-incomplete">
          {ins.imageCheckUnknown ? t('doc.imageCheckUnknown') : t('doc.inspectionIncomplete')}
        </span>
      )}
      <button type="button" className="btn-ghost ml-auto" onClick={onClose} title={t('doc.closeHint')} data-testid="close-document">
        <X className="h-4 w-4" aria-hidden /> {t('doc.close')}
      </button>
    </div>
  );
}

import { useMemo } from 'react';
import { useI18n } from '../../i18n';
import type { DocumentController } from '../../hooks/useDocumentController';
import { resolvePlans } from '../../pdf/plan';
import type { PdfSession } from '../../pdf/session';
import { ExportPanel } from '../ExportDialog/ExportPanel';
import { PageList } from '../PageList/PageList';
import { PagePreview } from '../PagePreview/PagePreview';
import { PageSettings } from '../PageSettings/PageSettings';
import { WatermarkSettings } from '../WatermarkSettings/WatermarkSettings';
import { DocumentBar } from './DocumentBar';

export function Workspace({ controller, session }: { controller: DocumentController; session: PdfSession }) {
  const { t } = useI18n();
  const { workspace, dispatch } = controller;
  const plans = useMemo(() => resolvePlans(workspace.pages), [workspace.pages]);
  const active = Math.min(workspace.active, workspace.pages.length - 1);
  if (workspace.pages.length === 0 || active < 0) return null;
  const anyWatermark = plans.some((p) => p.watermark);

  return (
    <div className="flex flex-1 flex-col md:min-h-0">
      <DocumentBar source={session.source} onClose={() => void controller.close()} />
      <div className="grid flex-1 grid-cols-1 md:min-h-0 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[150px_minmax(0,1fr)_340px]">
        <aside className="border-b md:min-h-0 border-line md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-r">
          <PageList session={session} pages={workspace.pages} plans={plans} selected={workspace.selected} active={active} dispatch={dispatch} />
        </aside>
        <main id="main" className="flex h-[75svh] min-h-80 min-w-0 flex-col md:h-auto md:min-h-0">
          <PagePreview
            session={session}
            index={active}
            info={session.source.pages[active]}
            plan={plans[active]}
            redactions={workspace.pages[active].redactions}
            watermark={workspace.watermark}
            pageCount={workspace.pages.length}
            dispatch={dispatch}
          />
        </main>
        <aside
          className="flex flex-col border-t border-line bg-surface md:min-h-0 md:border-l md:border-t-0"
          aria-label={t('settings.panel')}
        >
          <div className="space-y-6 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
            <PageSettings pages={workspace.pages} selected={workspace.selected} active={active} dispatch={dispatch} />
            {anyWatermark && (
              <>
                <hr className="border-line" />
                <WatermarkSettings config={workspace.watermark} dispatch={dispatch} />
              </>
            )}
          </div>
          {/* The primary action stays visible at the bottom of the panel. */}
          <div className="border-t border-line p-4">
            <ExportPanel session={session} workspace={workspace} plans={plans} dispatch={dispatch} />
          </div>
        </aside>
      </div>
    </div>
  );
}

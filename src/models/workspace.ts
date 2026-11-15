import { defaultExportOptions, defaultPageSettings, defaultWatermark } from './defaults';
import type {
  ExportOptions,
  PageMode,
  PageSettings,
  RedactionRect,
  WatermarkConfig,
} from './types';

/**
 * Processing settings for the open document.
 *
 * The original PDF bytes are held separately (see SourceDocument) and are never modified;
 * this state only describes *what to do* with each page.
 */
export interface WorkspaceState {
  pages: PageSettings[];
  /** Selected page indices (sorted, unique). */
  selected: number[];
  /** Anchor for shift-range selection. */
  anchor: number | null;
  /** The page shown in the large preview. */
  active: number;
  watermark: WatermarkConfig;
  exportOptions: ExportOptions;
}

export type WorkspaceAction =
  | { type: 'init'; pageCount: number; watermarkTemplate: string; defaultMode?: PageMode }
  | { type: 'reset'; watermarkTemplate: string }
  | { type: 'select'; index: number; range?: boolean; toggle?: boolean }
  | { type: 'selectAll' }
  | { type: 'setActive'; index: number }
  | { type: 'setMode'; indices: number[]; mode: PageMode }
  | { type: 'updatePages'; indices: number[]; patch: Partial<Omit<PageSettings, 'redactions'>> }
  | { type: 'addRedaction'; page: number; rect: RedactionRect }
  | { type: 'updateRedaction'; page: number; rect: RedactionRect }
  | { type: 'removeRedaction'; page: number; id: string }
  | { type: 'clearRedactions'; page: number }
  | { type: 'setWatermark'; patch: Partial<WatermarkConfig> }
  | { type: 'setWatermarkTemplateDefault'; template: string }
  | { type: 'setExportOptions'; patch: Partial<ExportOptions> };

export function createWorkspace(pageCount: number, watermarkTemplate: string, defaultMode: PageMode = 'protect'): WorkspaceState {
  return {
    pages: Array.from({ length: pageCount }, () => ({ ...defaultPageSettings(), mode: defaultMode })),
    selected: pageCount > 0 ? [0] : [],
    anchor: pageCount > 0 ? 0 : null,
    active: 0,
    watermark: defaultWatermark(watermarkTemplate),
    exportOptions: defaultExportOptions(),
  };
}

export const emptyWorkspace = (template: string): WorkspaceState => createWorkspace(0, template);

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

function validIndices(state: WorkspaceState, indices: number[]) {
  return indices.filter((i) => Number.isInteger(i) && i >= 0 && i < state.pages.length);
}

function mapPages(state: WorkspaceState, indices: number[], fn: (p: PageSettings) => PageSettings): PageSettings[] {
  const set = new Set(validIndices(state, indices));
  return state.pages.map((p, i) => (set.has(i) ? fn(p) : p));
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'init':
      return createWorkspace(action.pageCount, action.watermarkTemplate, action.defaultMode);
    case 'reset':
      return emptyWorkspace(action.watermarkTemplate);
    case 'select': {
      const { index } = action;
      if (index < 0 || index >= state.pages.length) return state;
      if (action.range && state.anchor !== null) {
        const [a, b] = [Math.min(state.anchor, index), Math.max(state.anchor, index)];
        const range = Array.from({ length: b - a + 1 }, (_, k) => a + k);
        const selected = action.toggle ? uniqSorted([...state.selected, ...range]) : range;
        return { ...state, selected, active: index };
      }
      if (action.toggle) {
        const has = state.selected.includes(index);
        const selected = has ? state.selected.filter((i) => i !== index) : uniqSorted([...state.selected, index]);
        return { ...state, selected: selected.length ? selected : [index], anchor: index, active: index };
      }
      return { ...state, selected: [index], anchor: index, active: index };
    }
    case 'selectAll':
      return { ...state, selected: state.pages.map((_, i) => i) };
    case 'setActive':
      if (action.index < 0 || action.index >= state.pages.length) return state;
      return { ...state, active: action.index };
    case 'setMode':
      return { ...state, pages: mapPages(state, action.indices, (p) => ({ ...p, mode: action.mode })) };
    case 'updatePages':
      return { ...state, pages: mapPages(state, action.indices, (p) => ({ ...p, ...action.patch })) };
    case 'addRedaction':
      return {
        ...state,
        pages: mapPages(state, [action.page], (p) => ({ ...p, redactions: [...p.redactions, action.rect] })),
      };
    case 'updateRedaction':
      return {
        ...state,
        pages: mapPages(state, [action.page], (p) => ({
          ...p,
          redactions: p.redactions.map((r) => (r.id === action.rect.id ? action.rect : r)),
        })),
      };
    case 'removeRedaction':
      return {
        ...state,
        pages: mapPages(state, [action.page], (p) => ({
          ...p,
          redactions: p.redactions.filter((r) => r.id !== action.id),
        })),
      };
    case 'clearRedactions':
      return { ...state, pages: mapPages(state, [action.page], (p) => ({ ...p, redactions: [] })) };
    case 'setWatermark': {
      const templateEdited =
        action.patch.template !== undefined ? true : state.watermark.templateEdited;
      return { ...state, watermark: { ...state.watermark, ...action.patch, templateEdited } };
    }
    case 'setWatermarkTemplateDefault':
      if (state.watermark.templateEdited) return state;
      return { ...state, watermark: { ...state.watermark, template: action.template } };
    case 'setExportOptions':
      return { ...state, exportOptions: { ...state.exportOptions, ...action.patch } };
  }
}

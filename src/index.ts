export {
  DocumentEditor,
  type DocumentContent,
  type DocumentEditorOptions,
  type DocumentEditorUpdatePayload,
  type PageSize,
  type PaginationResult,
} from './DocumentEditor';

export type { PageData, ActivePageFocus } from './types';

export { Toolbar, type ToolbarOptions } from './Toolbar';
export {
  EditorContextMenu,
  type EditorContextMenuOptions,
} from './EditorContextMenu';
export { PrintPreview, type PrintPreviewOptions } from './Pagination';
export { PageStore, createEmptyPage } from './store/PageStore';
export { PageSheet, type PageSheetOptions } from './pages/PageSheet';
export {
  extractOverflowNodes,
  fillUnderflowFromNext,
  isDocVisuallyEmpty,
} from './pages/overflow';
export {
  captureCrossPageSelection,
  deleteCrossPageContent,
  deleteFromCrossPageSnapshot,
  pageContentSize,
  resolveDomPointToPagePos,
  resolveHeldSnapshot,
  snapshotCrossPageSelection,
  textOffsetToPmPos,
  type CrossPageSelection,
  type CrossPageDeleteResult,
  type HeldCrossPageSnapshot,
  type PageLocalPos,
} from './pages/crossPageDelete';

/** @deprecated Continuous-flow pagination; prefer independent pages (default). */
export { PagePagination, type PagePaginationOptions } from './extensions/PagePagination';
export {
  collectMeasuredUnits,
  layoutVirtualPages,
  syncVirtualSheets,
} from './extensions/virtualPageLayout';
export { measurePageMetrics, type PageMetrics } from './extensions/pageMetrics';
export { createDocumentExtensions } from './extensions';

export type { Editor, JSONContent, Extensions } from '@tiptap/core';

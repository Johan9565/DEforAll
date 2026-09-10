import { fitColWidthsToWidth, tablePixelWidth, MIN_COL_WIDTH, type WidgetTableAttrs } from './extensions/widgetTable/model';
import {
  Editor,
  type Extensions,
  type JSONContent,
} from '@tiptap/core';
import { Toolbar } from './Toolbar';
import { EditorContextMenu } from './EditorContextMenu';
import { createDocumentExtensions } from './extensions';
import { PagePagination } from './extensions/PagePagination';
import { measurePageMetrics, resolvePageMetrics, type PageMetrics } from './extensions/pageMetrics';
import { Ruler } from './Ruler';
import {
  findTextMatches,
  replaceAllTextMatches,
  replaceTextMatch,
  selectTextMatch,
  type DocumentSearchMatch,
} from './pages/findReplace';
import type {
  DocumentContent,
  DocumentEditorUpdatePayload,
  PageData,
  PageColumns,
  PageMargins,
  PageOrientation,
  PageSize,
  PaginationResult,
  DocumentRestrictions,
  PageConfig,
} from './types';
import { EMPTY_DOC } from './types';
import './styles/document.css';
import './styles/toolbar.css';

export type {
  DocumentContent,
  DocumentEditorUpdatePayload,
  PageData,
  PageSize,
  PageColumns,
  PageMargins,
  PageOrientation,
  PaginationResult,
  DocumentRestrictions,
  PageConfig,
} from './types';

export interface DocumentEditorOptions {
  /** Host element. Becomes `.cde-workspace`. */
  element: HTMLElement;
  initialContent?: DocumentContent;
  /** Physical page size. Defaults to US Letter. */
  pageSize?: PageSize;
  orientation?: PageOrientation;
  margins?: Partial<PageMargins>;
  columns?: PageColumns;
  lineNumbers?: boolean;
  editable?: boolean;
  /** Show the formatting toolbar. Defaults to true. */
  toolbar?: boolean;
  /** Custom right-click menu inside pages. Defaults to true. */
  contextMenu?: boolean;
  /** Title shown in the Word-style title bar. */
  documentTitle?: string;
  /**
   * Virtual page pagination with background sheets.
   * Defaults to true.
   */
  pagination?: boolean;
  restrictions?: DocumentRestrictions;
  /** Dual horizontal & vertical interactive margin rulers. Defaults to true. */
  ruler?: boolean;
  pageConfigs?: Record<number, PageConfig>;
  placeholder?: string;
  extensions?: Extensions;
  onUpdate?: (data: DocumentEditorUpdatePayload) => void;
  onPaginated?: (result: PaginationResult) => void;
}

/**
 * Single-instance document editor with Google Docs-style continuous pagination.
 * A single TipTap/ProseMirror instance flows over mathematically calculated
 * background sheets with zero node splitting, native undo/redo, and continuous selection.
 */
export class DocumentEditor {
  private readonly workspaceElement: HTMLElement;
  private readonly stageElement: HTMLElement;
  private readonly virtualSheetsElement: HTMLElement;
  private readonly editorLayerElement: HTMLElement;
  private readonly editorMountElement: HTMLElement;

  public readonly editor: Editor;
  private toolbar: Toolbar | null = null;
  private contextMenu: EditorContextMenu | null = null;
  private ruler: Ruler | null = null;
  private restrictions: DocumentRestrictions;
  private pageConfigs: Map<number, PageConfig> = new Map();

  private pageSize: PageSize;
  private orientation: PageOrientation;
  private margins: PageMargins;
  private columns: PageColumns;
  private lineNumbers: boolean;
  private paginationEnabled: boolean;
  private editable: boolean;
  private metrics: PageMetrics;
  private destroyed = false;
  private pageCount = 1;

  private readonly onUpdate?: (data: DocumentEditorUpdatePayload) => void;
  private readonly onPaginated?: (result: PaginationResult) => void;

  public get editorInstance(): Editor {
    return this.editor;
  }

  constructor(options: DocumentEditorOptions) {
    this.pageSize = options.pageSize ?? 'letter';
    this.orientation = options.orientation ?? 'portrait';
    const defaultMargin = this.pageSize === 'a4' ? 96 : 96;
    this.margins = { top: defaultMargin, right: defaultMargin, bottom: defaultMargin, left: defaultMargin, ...options.margins };
    this.columns = options.columns ?? 1;
    this.lineNumbers = options.lineNumbers ?? false;
    this.paginationEnabled = options.pagination ?? true;
    this.restrictions = {
      editable: options.editable ?? true,
      allowImages: true,
      allowTables: true,
      allowMarginEditing: true,
      allowPageSettings: true,
      allowFormatting: true,
      allowLinks: true,
      ...options.restrictions,
    };
    this.editable = this.restrictions.editable !== false;
    this.onUpdate = options.onUpdate;
    this.onPaginated = options.onPaginated;
    this.metrics = measurePageMetrics(this.pageSize, 24, this.orientation, this.margins);

    if (options.pageConfigs) {
      Object.entries(options.pageConfigs).forEach(([k, v]) => {
        this.pageConfigs.set(Number(k), v);
      });
    }

    this.workspaceElement = options.element;
    this.workspaceElement.classList.add('cde-workspace');
    this.workspaceElement.dataset.pageSize = this.pageSize;
    this.workspaceElement.dataset.pagination = this.paginationEnabled ? 'pages' : 'off';
    this.workspaceElement.dataset.orientation = this.orientation;
    this.workspaceElement.dataset.columns = String(this.columns);
    this.workspaceElement.dataset.lineNumbers = this.lineNumbers ? 'true' : 'false';

    // Build stage and layers
    this.stageElement = document.createElement('div');
    this.stageElement.className = `cde-document-stage cde-document-stage--${this.pageSize}`;
    this.stageElement.style.width = `${this.metrics.pageWidthPx}px`;

    this.virtualSheetsElement = document.createElement('div');
    this.virtualSheetsElement.className = 'cde-virtual-sheets';
    this.virtualSheetsElement.setAttribute('aria-hidden', 'true');
    this.stageElement.appendChild(this.virtualSheetsElement);

    this.editorLayerElement = document.createElement('div');
    this.editorLayerElement.className = 'cde-editor-layer';

    this.editorMountElement = document.createElement('div');
    this.editorMountElement.className = 'cde-editor-mount';
    this.editorLayerElement.appendChild(this.editorMountElement);

    this.stageElement.appendChild(this.editorLayerElement);
    this.workspaceElement.appendChild(this.stageElement);

    // Extensions setup
    const extensions: Extensions = [
      ...createDocumentExtensions({ placeholder: options.placeholder }),
      ...(options.extensions ?? []),
    ];

    if (this.paginationEnabled) {
      extensions.push(
        PagePagination.configure({
          pageSize: this.pageSize,
          orientation: this.orientation,
          margins: this.margins,
          gapPx: 24,
          getPageConfig: (idx) => this.pageConfigs.get(idx),
          onPaginated: (result) => {
            this.pageCount = result.pageCount;
            this.workspaceElement.dataset.pageCount = String(result.pageCount);
            this.toolbar?.setPageCount(result.pageCount);
            this.ruler?.update();
            this.onPaginated?.(result);
            this.emitUpdate();
          },
        }),
      );
    }

    const initialContent = options.initialContent ?? EMPTY_DOC;

    this.editor = new Editor({
      element: this.editorMountElement,
      extensions,
      content: initialContent,
      editable: this.editable,
      editorProps: {
        attributes: {
          class: 'cde-page-content ProseMirror',
          style: `padding: ${this.metrics.marginPx}px; min-height: ${this.metrics.pageHeightPx}px; width: ${this.metrics.pageWidthPx}px; box-sizing: border-box;`,
        },
        handlePaste: (_view, event) => {
          if (this.restrictions.allowImages === false) {
            const items = event.clipboardData?.items;
            if (items) {
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                  event.preventDefault();
                  return true;
                }
              }
            }
            const html = event.clipboardData?.getData('text/html');
            if (html && /<img\\s[^>]*>/i.test(html)) {
              event.preventDefault();
              return true;
            }
          }
          return false;
        },
        handleDrop: (_view, event) => {
          if (this.restrictions.allowImages === false) {
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) {
              for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                  event.preventDefault();
                  return true;
                }
              }
            }
          }
          return false;
        },
      },
      onUpdate: () => {
        this.emitUpdate();
        this.syncToolbarStats();
      },
      onSelectionUpdate: () => {
        this.toolbar?.notifyEditorChanged();
        this.ruler?.update();
      },
    });

    this.applyLayoutStyles();

    if (options.toolbar ?? true) {
      this.toolbar = new Toolbar({
        container: this.workspaceElement,
        getEditor: () => this.editor,
        documentTitle: options.documentTitle ?? 'Documento',
        onPrint: () => this.print(),
        pageLayout: {
          getPageSize: () => this.pageSize,
          setPageSize: (value) => this.setPageSize(value),
          getOrientation: () => this.orientation,
          setOrientation: (value) => this.setOrientation(value),
          setPageOrientation: (scope, orientation) => this.setPageOrientation(scope, orientation),
          getMargins: () => ({ ...this.margins }),
          setMargins: (value) => this.setMargins(value),
          setPageMargins: (scope, margins) => this.setPageMargins(scope, margins),
          getCurrentPageIndex: () => this.getActivePageIndex(),
          getColumns: () => this.columns,
          setColumns: (value) => this.setColumns(value),
          getLineNumbers: () => this.lineNumbers,
          toggleLineNumbers: () => this.setLineNumbers(!this.lineNumbers),
          insertPageBreak: () => this.insertPageBreak(),
          getRulerVisible: () => this.isRulerVisible(),
          toggleRuler: () => this.toggleRuler(),
          getPagination: () => this.paginationEnabled,
          setPagination: (value) => this.setPagination(value),
        },
        documentSearch: {
          find: (term, caseSensitive) => this.findInDocument(term, caseSensitive),
          goTo: (match) => this.goToSearchMatch(match),
          replace: (match, replacement) => this.replaceSearchMatch(match, replacement),
          replaceAll: (term, replacement, caseSensitive) =>
            this.replaceAllInDocument(term, replacement, caseSensitive),
        },
      });
    }

    if (options.ruler ?? true) {
      this.ruler = new Ruler({
        stageElement: this.stageElement,
        getMetrics: () => this.getPageMetrics(this.getActivePageIndex()),
        getRestrictions: () => this.restrictions,
        getActivePageOffset: () => {
          const sheets = Array.from(this.stageElement.querySelectorAll<HTMLElement>('.cde-virtual-sheet'));
          const activeIdx = this.getActivePageIndex();
          const sheet = sheets[activeIdx] ?? sheets[0];
          const top = sheet ? sheet.offsetTop + 24 : 24;
          return {
            top,
            width: this.metrics.pageWidthPx,
            height: this.metrics.pageHeightPx,
          };
        },
        onMarginsChange: (margins) => this.setMargins(margins),
      });
    }

    if (options.contextMenu ?? true) {
      this.contextMenu = new EditorContextMenu({
        container: this.stageElement,
        getEditor: () => this.editor,
        editable: this.editable,
        getRestrictions: () => this.restrictions,
      });
    }

    this.syncToolbarStats();
    this.emitUpdate();

    this.updatePrintPageStyle();
    window.addEventListener('beforeprint', this.handleBeforePrint);
    window.addEventListener('afterprint', this.handleAfterPrint);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  public getEditor(): Editor | null {
    return this.editor;
  }

  public getToolbar(): Toolbar | null {
    return this.toolbar;
  }

  public getPageCount(): number {
    return this.pageCount;
  }

  public getPages(): readonly PageData[] {
    return [
      {
        id: 'page-1',
        content: this.editor.getJSON(),
        htmlCache: this.editor.getHTML(),
      },
    ];
  }

  public findInDocument(
    term: string,
    caseSensitive = false,
  ): DocumentSearchMatch[] {
    if (!this.editor) return [];
    const matches = findTextMatches(this.editor, term, caseSensitive);
    return matches.map((m) => ({
      ...m,
      pageId: 'page-1',
      pageIndex: 0,
    }));
  }

  public goToSearchMatch(match: DocumentSearchMatch): void {
    if (!this.editor) return;
    selectTextMatch(this.editor, match);
  }

  public replaceSearchMatch(
    match: DocumentSearchMatch,
    replacement: string,
  ): void {
    if (!this.editor) return;
    replaceTextMatch(this.editor, match, replacement);
  }

  public replaceAllInDocument(
    term: string,
    replacement: string,
    caseSensitive = false,
  ): number {
    if (!this.editor) return 0;
    return replaceAllTextMatches(this.editor, term, replacement, caseSensitive);
  }

  public fitTablesToMargins(targetWidth?: number): void {
    const width = targetWidth ?? this.metrics.bodyWidthPx;
    if (!width || width <= 0) return;
    const { doc, tr } = this.editor.state;
    let modified = false;

    doc.descendants((node, pos) => {
      if (node.type.name === 'table') {
        const attrs = node.attrs as WidgetTableAttrs;
        const isWrapped = attrs.wrap === 'left' || attrs.wrap === 'right';
        const mr = isWrapped ? (attrs.marginRight ?? 16) : 0;
        const maxAllowed = Math.max(MIN_COL_WIDTH * (attrs.colWidths?.length || 1), width - mr);
        const currentW = tablePixelWidth(attrs);
        if (currentW > maxAllowed) {
          const next = fitColWidthsToWidth(attrs, maxAllowed);
          tr.setNodeMarkup(pos, undefined, next);
          modified = true;
        }
      }
    });

    if (modified) {
      this.editor.view.dispatch(tr);
    }
  }

  public setPageSize(pageSize: PageSize): void {
    if (this.pageSize === pageSize) return;
    this.pageSize = pageSize;
    this.metrics = measurePageMetrics(pageSize, 24, this.orientation, this.margins);
    this.workspaceElement.dataset.pageSize = pageSize;
    this.stageElement.className = `cde-document-stage cde-document-stage--${pageSize}`;
    this.stageElement.style.width = `${this.metrics.pageWidthPx}px`;

    const pm = this.editorMountElement.querySelector('.ProseMirror') as HTMLElement | null;
    if (pm) {
      pm.style.padding = `${this.metrics.marginPx}px`;
      pm.style.minHeight = `${this.metrics.pageHeightPx}px`;
      pm.style.width = `${this.metrics.pageWidthPx}px`;
      this.applyLayoutStyles();
    }

    const ext = this.editor.extensionManager.extensions.find(
      (e) => e.name === 'pagePagination',
    );
    if (ext) {
      ext.options.pageSize = pageSize;
      ext.options.orientation = this.orientation;
      ext.options.margins = this.margins;
      const storage = ext.storage as { metrics?: PageMetrics | null; scheduleRefresh?: (() => void) | null };
      storage.metrics = this.metrics;
      storage.scheduleRefresh?.();
    }
  }

  public getOrientation(): PageOrientation {
    return this.orientation;
  }

  public getPageSize(): PageSize {
    return this.pageSize;
  }

  public getMargins(): PageMargins {
    return { ...this.margins };
  }

  public setOrientation(orientation: PageOrientation): void {
    if (this.orientation === orientation) return;
    this.orientation = orientation;
    this.metrics = measurePageMetrics(this.pageSize, 24, orientation, this.margins);
    this.stageElement.style.width = `${this.metrics.pageWidthPx}px`;
    this.workspaceElement.dataset.orientation = orientation;
    this.applyLayoutStyles();
    this.refreshPaginationMetrics();
  }

  public setMargins(margins: Partial<PageMargins>): void {
    this.margins = { ...this.margins, ...margins };
    this.metrics = measurePageMetrics(this.pageSize, 24, this.orientation, this.margins);
    this.applyLayoutStyles();
    this.refreshPaginationMetrics();
    this.updateRuler();
  }

  public setColumns(columns: PageColumns): void {
    this.columns = columns;
    this.workspaceElement.dataset.columns = String(columns);
    this.applyLayoutStyles();
    this.refreshPaginationMetrics();
  }

  public setLineNumbers(enabled: boolean): void {
    this.lineNumbers = enabled;
    this.workspaceElement.dataset.lineNumbers = enabled ? 'true' : 'false';
    this.applyLayoutStyles();
  }

  public setRulerVisible(visible: boolean): void {
    this.ruler?.setVisible(visible);
  }

  public isRulerVisible(): boolean {
    return this.ruler?.isVisible() ?? false;
  }

  public toggleRuler(): void {
    this.ruler?.toggle();
  }

  private applyLayoutStyles(): void {
    const pm = this.editorMountElement.querySelector('.ProseMirror') as HTMLElement | null;
    if (pm) {
      pm.style.padding = `${this.margins.top}px ${this.margins.right}px ${this.margins.bottom}px ${this.margins.left}px`;
      pm.style.minHeight = `${this.metrics.pageHeightPx}px`;
      pm.style.width = `${this.metrics.pageWidthPx}px`;
      pm.style.columnCount = String(this.columns);
      pm.style.columnGap = '2rem';
    }
    this.stageElement.dataset.orientation = this.orientation;
    this.stageElement.dataset.columns = String(this.columns);
    this.updateRuler();
  }

  private updateRuler(): void {
    this.ruler?.update();
  }

  private refreshPaginationMetrics(): void {
    const ext = this.editor.extensionManager.extensions.find((e) => e.name === 'pagePagination');
    if (ext) {
      ext.options.pageSize = this.pageSize;
      ext.options.orientation = this.orientation;
      ext.options.margins = this.margins;
      const storage = ext.storage as { metrics?: PageMetrics | null; scheduleRefresh?: (() => void) | null };
      storage.metrics = this.metrics;
      storage.scheduleRefresh?.();
    }
  }

  private insertPageBreak(): void {
    this.editor.chain().focus().insertContent('<p style="break-before: page"><br></p>').run();
  }

  public setPagination(enabled: boolean): void {
    if (this.paginationEnabled === enabled) return;
    this.paginationEnabled = enabled;
    this.workspaceElement.dataset.pagination = enabled ? 'pages' : 'off';
    if (!enabled) {
      this.virtualSheetsElement.replaceChildren();
    }
  }

  public setEditable(editable: boolean): void {
    this.editable = editable;
    this.editor.setEditable(editable);
  }

  public getHTML(): string {
    return this.editor.getHTML();
  }

  public getJSON(): JSONContent {
    return this.editor.getJSON();
  }

  public setContent(content: DocumentContent, emitUpdate = true): void {
    this.editor.commands.setContent(content, emitUpdate);
    if (emitUpdate) {
      this.emitUpdate();
      this.syncToolbarStats();
    }
  }

  private emitUpdate(): void {
    if (this.destroyed) return;
    this.onUpdate?.({
      html: this.editor.getHTML(),
      json: this.editor.getJSON(),
      pages: [...this.getPages()],
      pageCount: this.pageCount,
    });
  }

  private syncToolbarStats(): void {
    const text = this.editor.getText();
    const characters = text.length;
    const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
    this.toolbar?.setDocumentStats({ characters, words });
    this.toolbar?.setPageCount(this.pageCount);
  }

  public getRestrictions(): Readonly<DocumentRestrictions> {
    return { ...this.restrictions };
  }

  public setRestrictions(restrictions: Partial<DocumentRestrictions>): void {
    this.restrictions = { ...this.restrictions, ...restrictions };
    if (this.restrictions.editable != null) {
      this.setEditable(this.restrictions.editable);
    }
    this.workspaceElement.classList.toggle('cde-readonly', this.restrictions.editable === false);
    this.workspaceElement.dataset.allowImages = String(this.restrictions.allowImages !== false);
    this.workspaceElement.dataset.allowTables = String(this.restrictions.allowTables !== false);
    this.workspaceElement.dataset.allowMarginEditing = String(this.restrictions.allowMarginEditing !== false);
    this.ruler?.update();
    this.toolbar?.notifyEditorChanged();
  }

  public getCurrentPageIndex(): number {
    return this.getActivePageIndex();
  }

  public getActivePageIndex(): number {
    try {
      const { selection } = this.editor.state;
      const coords = this.editor.view.coordsAtPos(selection.from);
      const sheets = Array.from(this.virtualSheetsElement.querySelectorAll('.cde-virtual-sheet'));
      for (let i = 0; i < sheets.length; i++) {
        const rect = sheets[i].getBoundingClientRect();
        if (coords.top >= rect.top && coords.top <= rect.bottom) {
          return i;
        }
      }
    } catch {
      // fallback
    }
    return 0;
  }

  public getPageConfig(pageIndex: number): PageConfig {
    return {
      pageSize: this.pageSize,
      orientation: this.orientation,
      margins: { ...this.margins },
      ...(this.pageConfigs.get(pageIndex) || {}),
    };
  }

  public setPageConfig(pageIndex: number, config: Partial<PageConfig>): void {
    const existing = this.getPageConfig(pageIndex);
    this.pageConfigs.set(pageIndex, {
      ...existing,
      ...config,
      margins: {
        ...existing.margins,
        ...(config.margins || {}),
      },
    });
    this.refreshPaginationMetrics();
    this.ruler?.update();
  }

  public setPageOrientation(pageIndexOrScope: number | 'all', orientation: PageOrientation): void {
    if (pageIndexOrScope === 'all') {
      this.setOrientation(orientation);
      this.pageConfigs.forEach((cfg, idx) => {
        cfg.orientation = orientation;
        this.pageConfigs.set(idx, cfg);
      });
      this.refreshPaginationMetrics();
      this.ruler?.update();
      return;
    }
    this.setPageConfig(pageIndexOrScope, { orientation });
  }

  public setPageMargins(pageIndexOrScope: number | 'all', margins: Partial<PageMargins>): void {
    if (pageIndexOrScope === 'all') {
      this.setMargins(margins);
      this.pageConfigs.forEach((cfg, idx) => {
        cfg.margins = { ...cfg.margins, ...margins };
        this.pageConfigs.set(idx, cfg);
      });
      this.refreshPaginationMetrics();
      this.ruler?.update();
      return;
    }
    this.setPageConfig(pageIndexOrScope, { margins });
  }

  public getPageMetrics(pageIndex = 0): PageMetrics {
    const config = this.pageConfigs.get(pageIndex);
    return resolvePageMetrics(this.metrics, config, 24);
  }

  private updatePrintPageStyle(): void {
    let styleEl = document.getElementById('cde-print-page-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cde-print-page-style';
      document.head.appendChild(styleEl);
    }
    const size = this.pageSize === 'a4' ? 'A4' : 'letter';
    const orient = this.orientation === 'landscape' ? 'landscape' : 'portrait';
    styleEl.textContent = `
      @page {
        size: ${size} ${orient};
        margin: 0 !important;
      }
      @media print {
        .cde-document-stage {
          width: ${this.metrics.pageWidthPx}px !important;
        }
      }
    `;
  }

  private handleBeforePrint = (): void => {
    this.updatePrintPageStyle();
    const ext = this.editor?.extensionManager?.extensions.find(
      (e) => e.name === 'pagePagination',
    );
    if (ext) {
      const storage = ext.storage as { setGapPx?: (gap: number) => void };
      storage.setGapPx?.(0);
    }
  };

  private handleAfterPrint = (): void => {
    const ext = this.editor?.extensionManager?.extensions.find(
      (e) => e.name === 'pagePagination',
    );
    if (ext) {
      const storage = ext.storage as { setGapPx?: (gap: number) => void };
      storage.setGapPx?.(24);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      if (
        this.workspaceElement.contains(document.activeElement) ||
        document.activeElement === document.body
      ) {
        e.preventDefault();
        this.print();
      }
    }
  };

  public print(): void {
    this.handleBeforePrint();
    window.print();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('beforeprint', this.handleBeforePrint);
    window.removeEventListener('afterprint', this.handleAfterPrint);
    window.removeEventListener('keydown', this.handleKeyDown);
    document.getElementById('cde-print-page-style')?.remove();
    this.ruler?.destroy();
    this.toolbar?.destroy();
    this.contextMenu?.destroy();
    this.editor.destroy();
    this.stageElement.remove();
  }
}

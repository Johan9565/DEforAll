import {
  Editor,
  generateHTML,
  generateJSON,
  type Extensions,
  type JSONContent,
} from '@tiptap/core';
import { Toolbar } from './Toolbar';
import { createDocumentExtensions } from './extensions';
import { measurePageMetrics, type PageMetrics } from './extensions/pageMetrics';
import { PageSheet } from './pages/PageSheet';
import {
  contentOverflows,
  createMeasureProbe,
  extractOverflow,
  filterMeaningfulNodes,
  isDocVisuallyEmpty,
  splitOverflowFromContent,
} from './pages/overflow';
import {
  captureCrossPageSelection,
  deleteCrossPageContent,
  deleteFromCrossPageSnapshot,
  resolveDomPointToPagePos,
  resolveHeldSnapshot,
  snapshotCrossPageSelection,
  type CrossPageSelection,
  type HeldCrossPageSnapshot,
} from './pages/crossPageDelete';
import {
  cloneCurrentSelectionRange,
  pageSheetFromPoint,
  restoreSelectionRange,
  selectionSpansMultipleSheets,
  setNativeSelectionFromPoints,
} from './pages/nativeSelection';
import { createEmptyPage, PageStore } from './store/PageStore';
import type {
  ActivePageFocus,
  DocumentContent,
  DocumentEditorUpdatePayload,
  PageData,
  PageSize,
  PaginationResult,
} from './types';
import './styles/document.css';
import './styles/toolbar.css';

export type {
  DocumentContent,
  DocumentEditorUpdatePayload,
  PageData,
  PageSize,
  PaginationResult,
} from './types';

export interface DocumentEditorOptions {
  /** Host element. Becomes `.cde-workspace`. */
  element: HTMLElement;
  initialContent?: DocumentContent;
  /** Physical page size. Defaults to US Letter. */
  pageSize?: PageSize;
  editable?: boolean;
  /** Show the formatting toolbar. Defaults to true. */
  toolbar?: boolean;
  /**
   * Independent physical pages (virtualized TipTap).
   * When false, falls back to a single continuous sheet.
   * Defaults to true.
   */
  pagination?: boolean;
  placeholder?: string;
  extensions?: Extensions;
  onUpdate?: (data: DocumentEditorUpdatePayload) => void;
  onPaginated?: (result: PaginationResult) => void;
}

/**
 * Document editor with virtualized TipTap instances:
 * - Store holds one JSON doc per page + HTML cache
 * - Only the active page mounts TipTap; others render static HTML
 * - Overflow pushes blocks to the next page; underflow pulls them back
 */
export class DocumentEditor {
  private readonly workspaceElement: HTMLElement;
  private readonly pagesContainer: HTMLElement;
  private readonly pageSize: PageSize;
  private readonly paginationEnabled: boolean;
  private readonly editable: boolean;
  private readonly extensions: Extensions;
  private readonly onUpdate?: (data: DocumentEditorUpdatePayload) => void;
  private readonly onPaginated?: (result: PaginationResult) => void;
  private readonly store: PageStore;
  private readonly sheets = new Map<string, PageSheet>();
  private readonly toolbar: Toolbar | null = null;
  private readonly metrics: PageMetrics;
  private readonly gapPx = 24;

  private activeEditor: Editor | null = null;
  private overflowRaf = 0;
  private balancing = false;
  private destroyed = false;
  private crossPageDeleting = false;

  /**
   * While the user drags a selection that may leave the TipTap page,
   * we freeze all sheets as static HTML so the browser can highlight across pages.
   */
  private selectDrag: {
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startPageId: string;
    fromStatic: boolean;
    bridged: boolean;
  } | null = null;

  /** Cloned Range kept after mouseup so the highlight can be restored visually. */
  private heldNativeRange: Range | null = null;
  /** Durable page indices + text offsets for delete (does not need live DOM nodes). */
  private heldCrossSnapshot: HeldCrossPageSnapshot | null = null;

  private readonly onSelectDragMove = (event: MouseEvent): void => {
    if (!this.selectDrag || this.destroyed) return;
    if ((event.buttons & 1) === 0) {
      this.finishSelectDrag(event);
      return;
    }

    this.selectDrag.lastX = event.clientX;
    this.selectDrag.lastY = event.clientY;

    if (!this.selectDrag.bridged) {
      if (this.shouldBridgeNativeSelection(event.clientX, event.clientY)) {
        this.bridgeToNativeSelection(event.clientX, event.clientY);
      }
      return;
    }

    setNativeSelectionFromPoints(
      this.selectDrag.startX,
      this.selectDrag.startY,
      event.clientX,
      event.clientY,
    );
  };

  private readonly onSelectDragUp = (event: MouseEvent): void => {
    this.finishSelectDrag(event);
  };

  private readonly onContainerKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed || !this.editable) return;

    const isCut =
      (event.key === 'x' || event.key === 'X') &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey;

    if (event.key !== 'Backspace' && event.key !== 'Delete' && !isCut) {
      return;
    }

    if (this.tryCrossPageDelete()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Still have a held cross selection — never let the browser navigate back
    if (this.heldCrossSnapshot) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed || !this.editable) return;

    const isDeleteKey =
      event.key === 'Backspace' ||
      event.key === 'Delete' ||
      ((event.key === 'x' || event.key === 'X') &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey);

    if (!isDeleteKey) return;

    if (
      this.heldCrossSnapshot ||
      this.heldNativeRange ||
      this.pagesContainer.classList.contains('has-cross-selection')
    ) {
      this.onContainerKeyDown(event);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.anchorNode;
    if (!node || !this.pagesContainer.contains(node)) return;
    this.onContainerKeyDown(event);
  };

  /** @deprecated Prefer getEditor(). Kept for hosts that read `.editor`. */
  public get editor(): Editor {
    const active = this.getEditor();
    if (!active) {
      throw new Error(
        'No hay editor TipTap activo. Activa una página antes de usar DocumentEditor.editor.',
      );
    }
    return active;
  }

  constructor(options: DocumentEditorOptions) {
    this.pageSize = options.pageSize ?? 'letter';
    this.paginationEnabled = options.pagination ?? true;
    this.editable = options.editable ?? true;
    this.onUpdate = options.onUpdate;
    this.onPaginated = options.onPaginated;
    this.metrics = measurePageMetrics(this.pageSize);

    this.extensions = [
      ...createDocumentExtensions({ placeholder: options.placeholder }),
      ...(options.extensions ?? []),
    ];

    this.workspaceElement = options.element;
    this.workspaceElement.classList.add('cde-workspace');
    this.workspaceElement.dataset.pageSize = this.pageSize;
    this.workspaceElement.dataset.pagination = this.paginationEnabled
      ? 'pages'
      : 'off';

    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = `cde-pages cde-pages--${this.pageSize}`;
    this.pagesContainer.tabIndex = -1;
    this.workspaceElement.appendChild(this.pagesContainer);

    const initialPages = this.bootstrapPages(options.initialContent);
    this.store = new PageStore(initialPages);

    if (options.toolbar ?? true) {
      this.toolbar = new Toolbar({
        container: this.workspaceElement,
        getEditor: () => this.activeEditor,
      });
    }

    this.pagesContainer.addEventListener('keydown', this.onContainerKeyDown, true);
    document.addEventListener('keydown', this.onDocumentKeyDown, true);

    this.store.subscribe(() => this.reconcileSheets());
    this.reconcileSheets();

    // Activate first page and redistribute overflow from initial content
    const first = this.store.getPageAt(0);
    if (first) {
      this.setActivePage(first.id, { type: 'start' });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.scheduleBalance());
      });
    }

    this.emitPaginated();
    this.syncToolbarStats();
  }

  public getEditor(): Editor | null {
    return this.activeEditor;
  }

  public getToolbar(): Toolbar | null {
    return this.toolbar;
  }

  public getPageCount(): number {
    return this.store.getPageCount();
  }

  public getPages(): readonly PageData[] {
    return this.store.getPages();
  }

  public getCharacterCount(): number {
    return this.activeEditor
      ? ((
          this.activeEditor.storage as {
            characterCount?: { characters: () => number };
          }
        ).characterCount?.characters() ?? 0)
      : 0;
  }

  public getWordCount(): number {
    return this.activeEditor
      ? ((
          this.activeEditor.storage as {
            characterCount?: { words: () => number };
          }
        ).characterCount?.words() ?? 0)
      : 0;
  }

  public refreshPagination(): PaginationResult {
    this.scheduleBalance();
    return { pageCount: this.getPageCount() };
  }

  public getHTML(): string {
    this.flushActiveToStore();
    return this.store.combinedHTML();
  }

  public getJSON(): JSONContent {
    this.flushActiveToStore();
    return this.store.combinedJSON();
  }

  public setContent(content: DocumentContent): void {
    const pages = this.bootstrapPages(content);
    this.destroyAllSheets();
    this.store.replaceAll(pages);
    this.reconcileSheets();
    const first = this.store.getPageAt(0);
    if (first) this.setActivePage(first.id, { type: 'start' });
    this.scheduleBalance();
    this.emitUpdate();
  }

  public focus(): void {
    const id = this.store.getActivePageId();
    if (id) {
      this.setActivePage(id, { type: 'end' });
    } else {
      const first = this.store.getPageAt(0);
      if (first) this.setActivePage(first.id, { type: 'start' });
    }
  }

  public isEmpty(): boolean {
    this.flushActiveToStore();
    return this.store.getPages().every((p) => isDocVisuallyEmpty(p.content));
  }

  public destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.overflowRaf);
    this.teardownSelectDragListeners();
    this.pagesContainer.removeEventListener(
      'keydown',
      this.onContainerKeyDown,
      true,
    );
    document.removeEventListener('keydown', this.onDocumentKeyDown, true);
    this.toolbar?.destroy();
    this.destroyAllSheets();
    this.pagesContainer.remove();
    this.activeEditor = null;
  }

  private bootstrapPages(content?: DocumentContent): PageData[] {
    if (!content) {
      return [createEmptyPage()];
    }

    let json: JSONContent;
    if (typeof content === 'string') {
      json = generateJSON(content, this.extensions) as JSONContent;
    } else {
      json = content;
    }

    if (!json.type) json = { type: 'doc', content: json.content ?? [] };

    const html = generateHTML(json, this.extensions);
    const page = createEmptyPage(html);
    page.content = json.type === 'doc' ? json : { type: 'doc', content: [json] };
    page.htmlCache = html;
    return [page];
  }

  private reconcileSheets(): void {
    if (this.destroyed) return;

    const pages = this.store.getPages();
    const activeId = this.store.getActivePageId();
    const seen = new Set<string>();

    pages.forEach((page, index) => {
      seen.add(page.id);
      let sheet = this.sheets.get(page.id);
      if (!sheet) {
        sheet = new PageSheet({
          page,
          pageSize: this.pageSize,
          pageIndex: index,
          pageCount: pages.length,
          extensions: this.extensions,
          editable: this.editable,
          gapPx: this.gapPx,
          isActive: page.id === activeId,
          onActivate: (pageId, focus) => this.setActivePage(pageId, focus),
          onContentChange: (pageId, json, html) => {
            this.store.setPageContent(pageId, json, html, { silent: true });
            if (!this.balancing) {
              this.scheduleBalance();
              this.emitUpdate();
              this.syncToolbarStats();
            }
          },
          onEditorReady: (pageId, editor) => {
            if (this.store.getActivePageId() === pageId) {
              this.activeEditor = editor;
              this.toolbar?.notifyEditorChanged();
            }
          },
          onEditorDestroyed: (pageId) => {
            if (
              this.store.getActivePageId() === pageId &&
              this.activeEditor &&
              !this.sheets.get(pageId)?.getEditor()
            ) {
              this.activeEditor = null;
              this.toolbar?.notifyEditorChanged();
            }
          },
          onPageNav: (pageId, direction) =>
            this.handlePageNav(direction, pageId),
          onCrossPageDelete: () => this.tryCrossPageDelete(),
          onEditorPointerDown: (pageId, event) =>
            this.beginSelectDrag(pageId, event, false),
          onStaticPointerDown: (pageId, event) =>
            this.beginSelectDrag(pageId, event, true),
        });
        this.sheets.set(page.id, sheet);
        this.pagesContainer.appendChild(sheet.root);
      } else {
        sheet.updateMeta(index, pages.length);
        sheet.syncFromStore(page, page.id === activeId);
      }
    });

    for (const [id, sheet] of this.sheets) {
      if (!seen.has(id)) {
        sheet.destroy();
        this.sheets.delete(id);
      }
    }

    // Keep DOM order in sync with store (only move nodes that are out of order)
    pages.forEach((page, index) => {
      const sheet = this.sheets.get(page.id);
      if (!sheet) return;
      const current = this.pagesContainer.children[index];
      if (current !== sheet.root) {
        const anchor = this.pagesContainer.children[index] ?? null;
        this.pagesContainer.insertBefore(sheet.root, anchor);
      }
    });

    this.emitPaginated();
    this.toolbar?.setPageCount(pages.length);
  }

  private setActivePage(pageId: string, focus?: ActivePageFocus): void {
    this.clearHeldNativeSelection();

    const currentId = this.store.getActivePageId();
    if (currentId && currentId !== pageId) {
      const currentSheet = this.sheets.get(currentId);
      currentSheet?.deactivate();
      this.activeEditor = null;
    }

    this.store.setActivePage(pageId);
    const page = this.store.getPage(pageId);
    const sheet = this.sheets.get(pageId);
    if (!page || !sheet) return;

    sheet.activate(page.content, focus);
    const editor = sheet.getEditor();
    if (editor) {
      this.activeEditor = editor;
      this.toolbar?.notifyEditorChanged();
    }
  }

  private handlePageNav(
    direction: 'next' | 'prev',
    pageId: string,
  ): boolean {
    const index = this.store.getPageIndex(pageId);
    if (index < 0) return false;
    const targetIndex = direction === 'next' ? index + 1 : index - 1;
    const target = this.store.getPageAt(targetIndex);
    if (!target) return false;
    this.setActivePage(target.id, {
      type: direction === 'next' ? 'start' : 'end',
    });
    return true;
  }

  private beginSelectDrag(
    pageId: string,
    event: MouseEvent,
    fromStatic: boolean,
  ): void {
    if (!this.editable) return;

    // New gesture replaces any held cross-page selection
    this.clearHeldNativeSelection();
    this.teardownSelectDragListeners();
    this.selectDrag = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startPageId: pageId,
      fromStatic,
      bridged: false,
    };

    document.addEventListener('mousemove', this.onSelectDragMove, true);
    document.addEventListener('mouseup', this.onSelectDragUp, true);
  }

  private shouldBridgeNativeSelection(clientX: number, clientY: number): boolean {
    if (!this.selectDrag) return false;

    const dx = Math.abs(clientX - this.selectDrag.startX);
    const dy = Math.abs(clientY - this.selectDrag.startY);

    // Starting on static: freeze TipTap as soon as it's a real drag
    if (this.selectDrag.fromStatic && (dx > 3 || dy > 3)) {
      return true;
    }

    const over = pageSheetFromPoint(clientX, clientY, this.pagesContainer);
    if (over && over.dataset.pageId !== this.selectDrag.startPageId) {
      return true;
    }

    const startSheet = this.sheets.get(this.selectDrag.startPageId)?.root;
    if (!startSheet) return false;

    const rect = startSheet.getBoundingClientRect();
    // Past the bottom gap toward the next page, or above toward the previous
    if (clientY > rect.bottom + 2 || clientY < rect.top - 2) {
      return true;
    }

    return false;
  }

  /**
   * Destroy TipTap so every sheet is plain selectable HTML, then drive
   * window.getSelection() with caretRangeFromPoint.
   */
  private bridgeToNativeSelection(clientX: number, clientY: number): void {
    if (!this.selectDrag || this.selectDrag.bridged) return;

    const editor = this.activeEditor;
    if (editor && !this.selectDrag.fromStatic) {
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.anchor);
        this.selectDrag.startX = coords.left;
        this.selectDrag.startY = (coords.top + coords.bottom) / 2;
      } catch {
        // keep original pointer coords
      }
    }

    this.freezeAllPagesAsStatic();
    this.selectDrag.bridged = true;
    this.pagesContainer.classList.add('is-native-selecting');

    requestAnimationFrame(() => {
      if (!this.selectDrag?.bridged) return;
      setNativeSelectionFromPoints(
        this.selectDrag.startX,
        this.selectDrag.startY,
        clientX,
        clientY,
      );
    });
  }

  private freezeAllPagesAsStatic(): void {
    const activeId = this.store.getActivePageId();
    if (activeId) {
      this.flushActiveToStore();
      this.sheets.get(activeId)?.deactivate();
      this.activeEditor = null;
      this.toolbar?.notifyEditorChanged();
    }
    // null active → reconcile keeps every sheet static
    this.store.setActivePage(null);
  }

  private finishSelectDrag(event: MouseEvent): void {
    const drag = this.selectDrag;
    this.teardownSelectDragListeners();
    this.pagesContainer.classList.remove('is-native-selecting');
    this.selectDrag = null;

    if (!drag?.bridged) return;

    const endX = drag.lastX ?? event.clientX;
    const endY = drag.lastY ?? event.clientY;

    // Re-apply from stored coords — mouseup handlers often collapse the live selection
    setNativeSelectionFromPoints(drag.startX, drag.startY, endX, endY);

    if (selectionSpansMultipleSheets(this.pagesContainer)) {
      this.holdNativeCrossSelection();
      return;
    }

    const ctx = {
      pagesContainer: this.pagesContainer,
      store: this.store,
      extensions: this.extensions,
      getEditor: (pageId: string) =>
        this.sheets.get(pageId)?.getEditor() ?? null,
    };

    // Same-page selection after bridge → remount TipTap and restore range
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const from = resolveDomPointToPagePos(
        range.startContainer,
        range.startOffset,
        ctx,
      );
      const to = resolveDomPointToPagePos(
        range.endContainer,
        range.endOffset,
        ctx,
      );

      if (from && to && from.pageId === to.pageId) {
        const a = Math.min(from.pos, to.pos);
        const b = Math.max(from.pos, to.pos);
        this.setActivePage(from.pageId, { type: 'pos', pos: a });
        const editor = this.sheets.get(from.pageId)?.getEditor();
        if (editor && a !== b) {
          editor.chain().setTextSelection({ from: a, to: b }).focus().run();
        }
        return;
      }
    }

    // Collapsed / failed map — remount TipTap under the pointer
    const sheetEl =
      pageSheetFromPoint(endX, endY, this.pagesContainer) ??
      this.sheets.get(drag.startPageId)?.root ??
      null;
    const pageId = sheetEl?.dataset.pageId ?? drag.startPageId;
    if (!pageId || !this.store.getPage(pageId)) return;

    this.setActivePage(pageId, {
      type: 'coords',
      left: endX,
      top: endY,
    });
  }

  /** Keep the native multi-page highlight alive after mouseup. */
  private holdNativeCrossSelection(): void {
    // Capture HTML before/after the live Range — this is what the user sees
    const snapshot = snapshotCrossPageSelection(this.pagesContainer);
    const live = cloneCurrentSelectionRange();

    if (!snapshot && !live) return;

    this.heldCrossSnapshot = snapshot;
    this.heldNativeRange = live;
    this.pagesContainer.classList.add('has-cross-selection');

    const restore = (): void => {
      if (!this.heldNativeRange || this.destroyed) return;
      restoreSelectionRange(this.heldNativeRange);
    };

    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 50);
  }

  private clearHeldNativeSelection(): void {
    this.heldNativeRange = null;
    this.heldCrossSnapshot = null;
    this.pagesContainer.classList.remove('has-cross-selection');
  }

  private resolveCrossPageSelection(): CrossPageSelection | null {
    if (this.heldCrossSnapshot) {
      const fromSnapshot = resolveHeldSnapshot(
        this.heldCrossSnapshot,
        this.store,
      );
      if (fromSnapshot) return fromSnapshot;
    }

    const ctx = {
      pagesContainer: this.pagesContainer,
      store: this.store,
      extensions: this.extensions,
      getEditor: (pageId: string) =>
        this.sheets.get(pageId)?.getEditor() ?? null,
    };

    if (this.heldNativeRange) {
      restoreSelectionRange(this.heldNativeRange);
    }

    let cross = captureCrossPageSelection(ctx);
    if (cross) return cross;

    if (this.heldNativeRange) {
      const start = resolveDomPointToPagePos(
        this.heldNativeRange.startContainer,
        this.heldNativeRange.startOffset,
        ctx,
      );
      const end = resolveDomPointToPagePos(
        this.heldNativeRange.endContainer,
        this.heldNativeRange.endOffset,
        ctx,
      );
      if (start && end && start.pageIndex !== end.pageIndex) {
        if (
          start.pageIndex > end.pageIndex ||
          (start.pageIndex === end.pageIndex && start.pos > end.pos)
        ) {
          return { from: end, to: start };
        }
        return { from: start, to: end };
      }
    }

    return null;
  }

  private teardownSelectDragListeners(): void {
    document.removeEventListener('mousemove', this.onSelectDragMove, true);
    document.removeEventListener('mouseup', this.onSelectDragUp, true);
  }

  /**
   * Cross-page Backspace/Delete/Cut via temporary headless TipTap fusion.
   * Merges spanned pages → deleteRange → writes result to the first page →
   * removes the rest → overflow re-paginates.
   */
  private tryCrossPageDelete(): boolean {
    if (this.crossPageDeleting || this.balancing || !this.editable) {
      return false;
    }

    this.flushActiveToStore();

    const cross = this.resolveCrossPageSelection();
    if (!cross) return false;

    const pages: PageData[] = [];
    for (let i = cross.from.pageIndex; i <= cross.to.pageIndex; i++) {
      const page = this.store.getPageAt(i);
      if (!page) return false;
      pages.push(page);
    }

    this.crossPageDeleting = true;
    try {
      // Prefer DOM HTML slices captured at mouseup (exact visual selection)
      const result = this.heldCrossSnapshot
        ? deleteFromCrossPageSnapshot(
            this.heldCrossSnapshot,
            this.extensions,
          )
        : deleteCrossPageContent(
            pages,
            cross.from.pos,
            cross.to.pos,
            this.extensions,
          );

      const keepId = this.store.collapsePageRange(
        cross.from.pageIndex,
        cross.to.pageIndex,
        result.json,
        result.html,
      );

      this.clearHeldNativeSelection();
      window.getSelection()?.removeAllRanges();

      // Always remount/focus the kept page with the surgically edited content
      const keepPage = this.store.getPage(keepId);
      const sheet = this.sheets.get(keepId);
      if (!keepPage || !sheet) return true;

      // collapsePageRange already set activePageId; force content onto TipTap
      if (this.store.getActivePageId() === keepId && sheet.getEditor()) {
        sheet.replaceContent(result.json, result.html);
      } else {
        this.setActivePage(keepId, { type: 'pos', pos: result.cursorPos });
        sheet.replaceContent(result.json, result.html);
      }

      const editor = sheet.getEditor();
      if (editor) {
        const max = editor.state.doc.content.size;
        const pos = Math.max(0, Math.min(result.cursorPos, max));
        editor.chain().setTextSelection(pos).focus().run();
        this.activeEditor = editor;
        this.toolbar?.notifyEditorChanged();
      } else {
        sheet.activate(result.json, {
          type: 'pos',
          pos: result.cursorPos,
        });
        this.activeEditor = sheet.getEditor();
        this.toolbar?.notifyEditorChanged();
      }

      this.scheduleBalance();
      this.emitUpdate();
      this.syncToolbarStats();
      return true;
    } finally {
      this.crossPageDeleting = false;
    }
  }

  private scheduleBalance(): void {
    if (!this.paginationEnabled || this.balancing) return;
    cancelAnimationFrame(this.overflowRaf);
    this.overflowRaf = requestAnimationFrame(() => {
      this.overflowRaf = requestAnimationFrame(() => {
        // Normal typing must NOT reflow — only when the active page overflows
        if (!this.activePageOverflows()) return;
        this.balanceDocument();
      });
    });
  }

  private activePageOverflows(): boolean {
    const editor = this.activeEditor;
    if (!editor?.view?.dom) return false;
    // Use content bottom, not scrollHeight (min-height makes scrollHeight always "full")
    return contentOverflows(editor, this.metrics.bodyHeightPx, 8);
  }

  /**
   * Reflow from the active page through all following pages until none overflow.
   * Splits mid-paragraph at the visual line that crosses the page bottom and
   * moves the caret onto the next sheet when the user was typing in the overflow.
   */
  private balanceDocument(): void {
    if (this.destroyed || this.balancing) return;
    const activeId = this.store.getActivePageId();
    if (!activeId) return;
    const sheet = this.sheets.get(activeId);
    if (!sheet) return;
    const editor = sheet.getEditor();
    if (!editor) return;

    const wasFocused = editor.isFocused;
    const selFrom = editor.state.selection.from;
    const bodyHeight = this.metrics.bodyHeightPx;

    if (!contentOverflows(editor, bodyHeight, 8)) return;

    const first = extractOverflow(editor, bodyHeight, selFrom);
    if (first.moved.length === 0) return;

    this.balancing = true;
    const probe = createMeasureProbe(this.pageSize, this.workspaceElement);
    let followToPageId: string | null = null;
    let followPosInNext = 1;
    const pagesAtStart = this.store.getPageCount();
    const maxNewPages = 40;

    try {
      const pushOverflow = (
        fromId: string,
        moved: JSONContent[],
      ): string | null => {
        const meaningful = filterMeaningfulNodes(moved);
        if (meaningful.length === 0) return null;

        if (this.store.getPageCount() - pagesAtStart >= maxNewPages) {
          return null;
        }

        const index = this.store.getPageIndex(fromId);
        let next = this.store.getPageAt(index + 1);
        if (!next) {
          next = this.store.addPageAfter(fromId, undefined, { silent: true });
        }
        const nextContent = [
          ...meaningful,
          ...(next.content.content ?? []),
        ];
        const nextJson: JSONContent = { type: 'doc', content: nextContent };
        this.store.setPageContent(
          next.id,
          nextJson,
          generateHTML(nextJson, this.extensions),
          { silent: true },
        );
        return next.id;
      };

      const nextId = pushOverflow(activeId, first.moved);
      this.store.setPageContent(
        activeId,
        editor.getJSON(),
        editor.getHTML(),
        { silent: true },
      );

      if (nextId && first.followCursor) {
        followToPageId = nextId;
        followPosInNext = 1;
        if (first.cutPos != null) {
          const offsetInMoved = Math.max(0, selFrom - first.cutPos);
          followPosInNext = Math.max(1, offsetInMoved);
        }
      }

      let guard = 0;
      let lastDocSize = editor.state.doc.content.size;
      while (guard++ < 50 && contentOverflows(editor, bodyHeight, 8)) {
        const { moved } = extractOverflow(
          editor,
          bodyHeight,
          editor.state.selection.from,
        );
        if (moved.length === 0) break;
        if (!pushOverflow(activeId, moved)) break;
        this.store.setPageContent(
          activeId,
          editor.getJSON(),
          editor.getHTML(),
          { silent: true },
        );
        const nextSize = editor.state.doc.content.size;
        if (nextSize >= lastDocSize) break;
        lastDocSize = nextSize;
      }

      let pageIndex = this.store.getPageIndex(activeId) + 1;
      let cascadeGuard = 0;
      while (pageIndex < this.store.getPageCount() && cascadeGuard++ < 80) {
        const page = this.store.getPageAt(pageIndex);
        if (!page) break;

        if (isDocVisuallyEmpty(page.content)) {
          pageIndex += 1;
          continue;
        }

        const { kept, overflow } = splitOverflowFromContent(
          page.content,
          bodyHeight,
          this.extensions,
          probe,
        );

        this.store.setPageContent(
          page.id,
          kept,
          generateHTML(kept, this.extensions),
          { silent: true },
        );

        const meaningfulOverflow = filterMeaningfulNodes(overflow);
        if (meaningfulOverflow.length > 0) {
          if (this.store.getPageCount() - pagesAtStart >= maxNewPages) break;

          let next = this.store.getPageAt(pageIndex + 1);
          if (!next) {
            next = this.store.addPageAfter(page.id, undefined, {
              silent: true,
            });
          }

          const nextContent = [
            ...meaningfulOverflow,
            ...(next.content.content ?? []),
          ];
          const nextJson: JSONContent = { type: 'doc', content: nextContent };
          this.store.setPageContent(
            next.id,
            nextJson,
            generateHTML(nextJson, this.extensions),
            { silent: true },
          );
        }

        pageIndex += 1;
      }

      this.store.pruneTrailingEmpty({ silent: true });
      this.reconcileSheets();
      this.emitPaginated();
      this.emitUpdate();
      this.syncToolbarStats();

      if (followToPageId && this.store.getPage(followToPageId)) {
        this.setActivePage(followToPageId, {
          type: 'pos',
          pos: followPosInNext,
        });
      } else if (wasFocused && sheet.getEditor()) {
        const live = sheet.getEditor()!;
        const max = live.state.doc.content.size;
        const pos = Math.max(1, Math.min(selFrom, max));
        live.chain().setTextSelection(pos).focus().run();
      }
    } finally {
      probe.destroy();
      this.balancing = false;
    }
  }

  private flushActiveToStore(): void {
    const activeId = this.store.getActivePageId();
    if (!activeId) return;
    const editor = this.sheets.get(activeId)?.getEditor();
    if (!editor) return;
    this.store.setPageContent(activeId, editor.getJSON(), editor.getHTML(), {
      silent: true,
    });
  }

  private destroyAllSheets(): void {
    for (const sheet of this.sheets.values()) sheet.destroy();
    this.sheets.clear();
    this.activeEditor = null;
  }

  private emitUpdate(): void {
    this.flushActiveToStore();
    this.onUpdate?.({
      html: this.store.combinedHTML(),
      json: this.store.combinedJSON(),
      pages: [...this.store.getPages()],
      pageCount: this.store.getPageCount(),
    });
  }

  private emitPaginated(): void {
    this.onPaginated?.({ pageCount: this.store.getPageCount() });
    this.workspaceElement.dataset.pageCount = String(this.store.getPageCount());
  }

  private syncToolbarStats(): void {
    // Aggregate rough stats from HTML caches + active editor
    let words = 0;
    let characters = 0;
    for (const page of this.store.getPages()) {
      const text = page.htmlCache.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) {
        characters += text.length;
        words += text.split(/\s+/).filter(Boolean).length;
      }
    }
    this.toolbar?.setDocumentStats({ characters, words });
    this.toolbar?.setPageCount(this.store.getPageCount());
  }
}

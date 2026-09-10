import {
  Editor,
  generateHTML,
  type Extensions,
  type JSONContent,
} from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { ActivePageFocus, PageData, PageSize } from '../types';
import { migrateDocTables } from '../extensions/widgetTable/model';

export interface PageSheetOptions {
  page: PageData;
  pageSize: PageSize;
  pageIndex: number;
  pageCount: number;
  extensions: Extensions;
  editable: boolean;
  gapPx: number;
  isActive: boolean;
  isMounted?: boolean;
  onActivate: (pageId: string, focus: ActivePageFocus) => void;
  onContentChange: (pageId: string, json: JSONContent, html: string) => void;
  onEditorReady: (pageId: string, editor: Editor) => void;
  onEditorDestroyed: (pageId: string) => void;
  onPageNav?: (pageId: string, direction: 'next' | 'prev') => boolean;
  /**
   * Backspace at doc start on a page after the first — host should join with
   * the previous sheet. Return true if handled.
   */
  onBackspaceAtStart?: (pageId: string) => boolean;
  /** Return true if cross-page delete was handled (Backspace / Delete / Cut). */
  onCrossPageDelete?: () => boolean;
  /**
   * Pointer down inside the live TipTap surface — host may bridge to native
   * multi-page selection when the drag leaves this sheet.
   */
  onEditorPointerDown?: (pageId: string, event: MouseEvent) => void;
  /**
   * Pointer down on static HTML — host may freeze TipTap so selection can
   * span multiple static sheets.
   */
  onStaticPointerDown?: (pageId: string, event: MouseEvent) => void;
}

/**
 * One physical sheet: static HTML when inactive, TipTap when active or within active window.
 * Shared typography classes prevent layout shift on activate/deactivate.
 */
export class PageSheet {
  public readonly root: HTMLElement;
  public readonly pageId: string;
  private readonly contentHost: HTMLElement;
  private readonly extensions: Extensions;
  private readonly editable: boolean;
  private editor: Editor | null = null;
  private options: PageSheetOptions;
  private pendingFocus: ActivePageFocus | null = null;
  /** When true, onCreate must not default to focus('end') — caller will place the caret. */
  private suppressAutoFocus = false;
  private staticPointerDown: { x: number; y: number } | null = null;

  constructor(options: PageSheetOptions) {
    this.options = options;
    this.pageId = options.page.id;
    this.extensions = options.extensions;
    this.editable = options.editable;

    this.root = document.createElement('div');
    this.root.className = `cde-page-sheet cde-page-sheet--${options.pageSize}`;
    this.root.dataset.pageId = options.page.id;
    this.root.dataset.pageIndex = String(options.pageIndex);

    this.contentHost = document.createElement('div');
    this.contentHost.className = 'cde-page-sheet__body';

    const footer = document.createElement('div');
    footer.className = 'cde-page-sheet__num';
    footer.textContent = String(options.pageIndex + 1);

    this.root.append(this.contentHost, footer);

    if (options.isMounted ?? options.isActive) {
      this.mountEditor(options.page.content);
      if (options.isActive) {
        this.root.classList.add('is-active');
      } else {
        this.root.classList.remove('is-active');
      }
    } else {
      this.renderStatic(options.page.htmlCache);
    }
  }

  public getEditor(): Editor | null {
    return this.editor;
  }

  public updateMeta(pageIndex: number, pageCount: number): void {
    this.root.dataset.pageIndex = String(pageIndex);
    const num = this.root.querySelector('.cde-page-sheet__num');
    if (num) num.textContent = String(pageIndex + 1);
    this.root.style.marginBottom =
      pageIndex < pageCount - 1 ? `${this.options.gapPx}px` : '0';
  }

  public syncFromStore(page: PageData, isMounted: boolean, isCurrentActive = isMounted): void {
    if (isMounted) {
      if (!this.editor) {
        // Mounted in background (adjacent sheet) — suppress auto focus
        this.suppressAutoFocus = true;
        this.mountEditor(page.content);
      }
      if (isCurrentActive) {
        this.root.classList.add('is-active');
        this.root.classList.remove('is-static');
      } else {
        this.root.classList.remove('is-active', 'is-static');
      }
      return;
    }

    if (this.editor) {
      this.persistAndDestroy();
      return;
    }

    // Avoid re-creating static DOM (would wipe a live native selection)
    const existing = this.contentHost.querySelector('.cde-page-sheet__static');
    const nextHtml = page.htmlCache || '<p></p>';
    if (!existing || existing.innerHTML !== nextHtml) {
      this.renderStatic(page.htmlCache);
    }
  }

  /** Replace content in the live editor or static mirror without remounting the sheet. */
  public replaceContent(content: JSONContent, html: string): void {
    if (this.editor) {
      this.editor.commands.setContent(migrateDocTables(content) as JSONContent, false);
      return;
    }
    this.renderStatic(html);
  }

  public activate(content: JSONContent, focus?: ActivePageFocus): void {
    this.root.classList.add('is-active');
    this.root.classList.remove('is-static');
    this.pendingFocus = focus ?? { type: 'start' };
    if (this.editor) {
      const curJson = JSON.stringify(this.editor.getJSON());
      const newJson = JSON.stringify(content);
      if (curJson !== newJson) {
        this.editor.commands.setContent(migrateDocTables(content) as JSONContent, false);
      }
      this.applyFocus(this.pendingFocus);
      this.suppressAutoFocus = true;
      return;
    }
    this.mountEditor(content);
  }

  public deactivate(): void {
    if (this.editor) this.persistAndDestroy();
  }

  public destroy(): void {
    if (this.editor) {
      const editor = this.editor;
      this.editor = null;
      editor.destroy();
      this.options.onEditorDestroyed(this.pageId);
    }
    this.root.remove();
  }

  private renderStatic(html: string): void {
    this.contentHost.replaceChildren();
    const staticEl = document.createElement('div');
    staticEl.className = 'cde-page-sheet__static cde-page-content ProseMirror';
    staticEl.innerHTML = html || '<p></p>';
    // Allow native selection across pages; activate only on plain click
    staticEl.addEventListener('mousedown', this.handleStaticMouseDown);
    staticEl.addEventListener('mouseup', this.handleStaticMouseUp);
    this.contentHost.appendChild(staticEl);
    this.root.classList.remove('is-active');
    this.root.classList.add('is-static');
  }

  private readonly handleStaticMouseDown = (event: MouseEvent): void => {
    if (!this.editable || event.button !== 0) return;
    // Do NOT preventDefault — browser must extend selection into this sheet
    this.staticPointerDown = { x: event.clientX, y: event.clientY };
    this.options.onStaticPointerDown?.(this.pageId, event);
  };

  private readonly handleStaticMouseUp = (event: MouseEvent): void => {
    if (!this.editable || !this.staticPointerDown) return;

    const dx = Math.abs(event.clientX - this.staticPointerDown.x);
    const dy = Math.abs(event.clientY - this.staticPointerDown.y);
    this.staticPointerDown = null;

    const pages = this.root.closest('.cde-pages');
    if (pages?.classList.contains('has-cross-selection')) {
      // Keep the held cross-page highlight; a plain click dismisses via host
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (dx > 4 || dy > 4) return;
    }

    const sel = window.getSelection();
    const hasRange = !!sel && !sel.isCollapsed;

    // Drag / cross-page highlight — keep native selection, do not steal focus
    if (hasRange || dx > 4 || dy > 4) return;

    this.options.onActivate(this.pageId, {
      type: 'coords',
      left: event.clientX,
      top: event.clientY,
    });
  };

  private mountEditor(content: JSONContent): void {
    this.contentHost.replaceChildren();
    const mount = document.createElement('div');
    mount.className = 'cde-page-sheet__editor-mount';
    this.contentHost.appendChild(mount);

    this.root.classList.remove('is-static');

    this.editor = new Editor({
      element: mount,
      extensions: this.extensions,
      content: migrateDocTables(content) as JSONContent,
      editable: this.editable,
      editorProps: {
        attributes: {
          class: 'cde-page-content ProseMirror',
        },
        handleDOMEvents: {
          mousedown: (_view, event) => {
            if (event.button === 0) {
              this.options.onEditorPointerDown?.(this.pageId, event);
              if (!this.root.classList.contains('is-active')) {
                this.options.onActivate(this.pageId, { type: 'none' });
              }
            }
            return false;
          },
          focus: () => {
            if (!this.root.classList.contains('is-active')) {
              this.options.onActivate(this.pageId, { type: 'none' });
            }
            return false;
          },
          // Let DocumentEditor's custom menu handle this (bubble + preventDefault)
          contextmenu: () => false,
        },
        handleKeyDown: (_view, event) => this.handleEditorKeyDown(event),
      },
      onUpdate: ({ editor }) => {
        this.options.onContentChange(
          this.pageId,
          editor.getJSON(),
          editor.getHTML(),
        );
      },
      onCreate: ({ editor }) => {
        this.options.onEditorReady(this.pageId, editor);
        requestAnimationFrame(() => {
          if (this.pendingFocus) {
            this.applyFocus(this.pendingFocus);
            this.pendingFocus = null;
            this.suppressAutoFocus = false;
            return;
          }
          if (this.suppressAutoFocus) {
            this.suppressAutoFocus = false;
            return;
          }
          // Default only for unexpected mounts — start, not end (overflow
          // caret must land beside the moved text at the top of the sheet).
          editor.commands.focus('start');
        });
      },
    });
  }

  private persistAndDestroy(): void {
    if (!this.editor) return;
    const json = this.editor.getJSON();
    const html = this.editor.getHTML() || generateHTML(json, this.extensions);
    this.options.onContentChange(this.pageId, json, html);

    const editor = this.editor;
    this.editor = null;
    editor.destroy();
    this.options.onEditorDestroyed(this.pageId);
    this.renderStatic(html);
  }

  private applyFocus(focus: ActivePageFocus): void {
    const editor = this.editor;
    if (!editor) return;

    if (focus.type === 'none') {
      return;
    }

    if (focus.type === 'coords') {
      const pos = editor.view.posAtCoords({
        left: focus.left,
        top: focus.top,
      });
      if (pos) {
        const selection = TextSelection.near(
          editor.state.doc.resolve(pos.pos),
        );
        editor.view.dispatch(editor.state.tr.setSelection(selection));
        editor.commands.focus();
        return;
      }
    }

    if (focus.type === 'pos') {
      const max = editor.state.doc.content.size;
      const pos = Math.max(0, Math.min(focus.pos, max));
      const selection = TextSelection.near(editor.state.doc.resolve(pos));
      editor.view.dispatch(editor.state.tr.setSelection(selection));
      editor.commands.focus();
      return;
    }

    if (focus.type === 'end') {
      editor.commands.focus('end');
      return;
    }

    editor.commands.focus('start');
  }

  private isAtDocStart(editor: Editor): boolean {
    const { selection } = editor.state;
    if (!selection.empty) return false;
    if (selection.from <= 1) return true;
    const $from = selection.$from;
    if ($from.parentOffset !== 0) return false;
    for (let d = 0; d < $from.depth; d++) {
      if ($from.index(d) !== 0) return false;
    }
    return true;
  }

  private isAtDocEnd(editor: Editor): boolean {
    const { selection, doc } = editor.state;
    if (!selection.empty) return false;
    if (selection.to >= doc.content.size - 1) return true;
    const $to = selection.$to;
    if ($to.parentOffset !== $to.parent.content.size) return false;
    for (let d = 0; d < $to.depth; d++) {
      const parent = $to.node(d);
      if ($to.index(d) !== parent.childCount - 1) return false;
    }
    return true;
  }

  private handleEditorKeyDown(event: KeyboardEvent): boolean {
    const isCut =
      (event.key === 'x' || event.key === 'X') &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey;

    if (
      (event.key === 'Backspace' || event.key === 'Delete' || isCut) &&
      this.options.onCrossPageDelete?.()
    ) {
      return true;
    }

    const editor = this.editor;
    if (!editor) return false;

    const atStart = this.isAtDocStart(editor);
    const atEnd = this.isAtDocEnd(editor);

    if (
      event.key === 'Backspace' &&
      atStart &&
      !event.shiftKey &&
      this.options.onBackspaceAtStart?.(this.pageId)
    ) {
      return true;
    }

    if (!this.options.onPageNav) return false;

    if (
      (event.key === 'ArrowDown' || event.key === 'ArrowRight') &&
      atEnd &&
      !event.shiftKey
    ) {
      return this.options.onPageNav(this.pageId, 'next');
    }

    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowLeft') &&
      atStart &&
      !event.shiftKey
    ) {
      return this.options.onPageNav(this.pageId, 'prev');
    }

    return false;
  }
}

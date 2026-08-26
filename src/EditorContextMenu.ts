import type { Editor } from '@tiptap/core';
import './styles/context-menu.css';

export interface EditorContextMenuOptions {
  /** Element that owns page sheets (typically `.cde-pages`). */
  container: HTMLElement;
  getEditor: () => Editor | null;
  editable?: boolean;
  /**
   * Ensure the page under the pointer is active (mount TipTap) before
   * running menu actions. Called with client coordinates.
   */
  ensurePageAtPoint?: (clientX: number, clientY: number) => void;
}

interface MenuItem {
  kind: 'item';
  label: string;
  shortcut?: string;
  disabled?: () => boolean;
  checked?: () => boolean;
  run: () => void | Promise<void>;
}

interface MenuSeparator {
  kind: 'separator';
}

type MenuEntry = MenuItem | MenuSeparator;

/**
 * Custom right-click menu for the document surface.
 * Blocks the browser menu and runs TipTap / clipboard actions.
 */
export class EditorContextMenu {
  private readonly container: HTMLElement;
  private readonly getEditor: () => Editor | null;
  private readonly editable: boolean;
  private readonly ensurePageAtPoint?: (
    clientX: number,
    clientY: number,
  ) => void;

  private menuEl: HTMLElement | null = null;
  private open = false;

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (!this.editable) return;
    const target = event.target;
    if (!(target instanceof Node) || !this.container.contains(target)) return;

    // Ignore right-clicks on chrome outside the sheet body (e.g. gaps)
    const sheet = (target instanceof Element ? target : target.parentElement)
      ?.closest('.cde-page-sheet');
    if (!sheet || !this.container.contains(sheet)) return;

    event.preventDefault();
    event.stopPropagation();

    this.ensurePageAtPoint?.(event.clientX, event.clientY);

    // Place caret only when there is no range — keep an existing selection
    requestAnimationFrame(() => {
      this.placeCaretIfCollapsed(event.clientX, event.clientY);
      this.show(event.clientX, event.clientY);
    });
  };

  private readonly onDocPointerDown = (event: MouseEvent): void => {
    if (!this.open || !this.menuEl) return;
    if (this.menuEl.contains(event.target as Node)) return;
    this.hide();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
      this.getEditor()?.commands.focus();
    }
  };

  private readonly onScroll = (): void => {
    if (this.open) this.hide();
  };

  constructor(options: EditorContextMenuOptions) {
    this.container = options.container;
    this.getEditor = options.getEditor;
    this.editable = options.editable ?? true;
    this.ensurePageAtPoint = options.ensurePageAtPoint;

    this.container.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('mousedown', this.onDocPointerDown, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('scroll', this.onScroll, true);
  }

  public destroy(): void {
    this.hide();
    this.container.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('mousedown', this.onDocPointerDown, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('scroll', this.onScroll, true);
  }

  private placeCaretIfCollapsed(clientX: number, clientY: number): void {
    const editor = this.getEditor();
    if (!editor || editor.isDestroyed) return;
    if (!editor.state.selection.empty) return;

    const pos = editor.view.posAtCoords({ left: clientX, top: clientY });
    if (!pos) return;
    editor.chain().setTextSelection(pos.pos).focus().run();
  }

  private buildEntries(): MenuEntry[] {
    const ed = () => this.getEditor();
    const hasRange = () => {
      const editor = ed();
      return !!editor && !editor.state.selection.empty;
    };

    return [
      {
        kind: 'item',
        label: 'Cortar',
        shortcut: 'Ctrl+X',
        disabled: () => !hasRange(),
        run: () => this.cut(),
      },
      {
        kind: 'item',
        label: 'Copiar',
        shortcut: 'Ctrl+C',
        disabled: () => !hasRange(),
        run: () => this.copy(),
      },
      {
        kind: 'item',
        label: 'Pegar',
        shortcut: 'Ctrl+V',
        run: () => this.paste(),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Negrita',
        shortcut: 'Ctrl+B',
        checked: () => ed()?.isActive('bold') ?? false,
        run: () => {
          ed()?.chain().focus().toggleBold().run();
        },
      },
      {
        kind: 'item',
        label: 'Cursiva',
        shortcut: 'Ctrl+I',
        checked: () => ed()?.isActive('italic') ?? false,
        run: () => {
          ed()?.chain().focus().toggleItalic().run();
        },
      },
      {
        kind: 'item',
        label: 'Subrayado',
        shortcut: 'Ctrl+U',
        checked: () => ed()?.isActive('underline') ?? false,
        run: () => {
          ed()?.chain().focus().toggleUnderline().run();
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Viñetas',
        checked: () => ed()?.isActive('bulletList') ?? false,
        run: () => {
          ed()?.chain().focus().toggleBulletList().run();
        },
      },
      {
        kind: 'item',
        label: 'Numeración',
        checked: () => ed()?.isActive('orderedList') ?? false,
        run: () => {
          ed()?.chain().focus().toggleOrderedList().run();
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Vínculo…',
        checked: () => ed()?.isActive('link') ?? false,
        run: () => this.editLink(),
      },
      {
        kind: 'item',
        label: 'Insertar tabla',
        run: () => {
          ed()
            ?.chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Seleccionar todo',
        shortcut: 'Ctrl+A',
        run: () => {
          ed()?.chain().focus().selectAll().run();
        },
      },
    ];
  }

  private show(clientX: number, clientY: number): void {
    this.hide();

    const menu = document.createElement('div');
    menu.className = 'cde-ctx-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;

    for (const entry of this.buildEntries()) {
      if (entry.kind === 'separator') {
        const hr = document.createElement('div');
        hr.className = 'cde-ctx-menu__sep';
        hr.setAttribute('role', 'separator');
        menu.appendChild(hr);
        continue;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cde-ctx-menu__item';
      btn.setAttribute('role', 'menuitem');
      if (entry.checked?.()) btn.classList.add('is-checked');
      if (entry.disabled?.()) {
        btn.disabled = true;
        btn.classList.add('is-disabled');
      }

      const label = document.createElement('span');
      label.className = 'cde-ctx-menu__label';
      label.textContent = entry.label;
      btn.appendChild(label);

      if (entry.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'cde-ctx-menu__shortcut';
        sc.textContent = entry.shortcut;
        btn.appendChild(sc);
      }

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        this.hide();
        try {
          await entry.run();
        } catch {
          // Clipboard permission denials, etc.
        }
      });

      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    this.menuEl = menu;
    this.open = true;

    const pad = 8;
    const rect = menu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  private hide(): void {
    this.menuEl?.remove();
    this.menuEl = null;
    this.open = false;
  }

  private selectionHtmlAndText(editor: Editor): { html: string; text: string } {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n\n');

    // Prefer live DOM selection (no @tiptap/pm/model import — avoids Vite dep churn)
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      editor.view.dom.contains(sel.anchorNode)
    ) {
      const wrap = document.createElement('div');
      wrap.appendChild(sel.getRangeAt(0).cloneContents());
      return { html: wrap.innerHTML || text, text };
    }

    return { html: text, text };
  }

  private async writeClipboard(html: string, text: string): Promise<void> {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
        return;
      } catch {
        // fall through
      }
    }
    await navigator.clipboard.writeText(text);
  }

  private async copy(): Promise<void> {
    const editor = this.getEditor();
    if (!editor || editor.state.selection.empty) return;
    const { html, text } = this.selectionHtmlAndText(editor);
    await this.writeClipboard(html, text);
    editor.commands.focus();
  }

  private async cut(): Promise<void> {
    const editor = this.getEditor();
    if (!editor || editor.state.selection.empty) return;
    const { html, text } = this.selectionHtmlAndText(editor);
    await this.writeClipboard(html, text);
    editor.chain().focus().deleteSelection().run();
  }

  private async paste(): Promise<void> {
    const editor = this.getEditor();
    if (!editor) return;

    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const html = await blob.text();
            if (html.trim()) {
              editor.chain().focus().insertContent(html).run();
              return;
            }
          }
        }
      }
    } catch {
      // Permission or unsupported — try plain text
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
      else editor.commands.focus();
    } catch {
      editor.commands.focus();
    }
  }

  private editLink(): void {
    const editor = this.getEditor();
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url.trim() })
      .run();
  }
}

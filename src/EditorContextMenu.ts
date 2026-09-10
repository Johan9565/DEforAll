import type { Editor } from '@tiptap/core';
import type { DocumentRestrictions } from './types';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import './styles/context-menu.css';

export interface EditorContextMenuOptions {
  /** Element that owns page sheets (typically `.cde-pages`). */
  container: HTMLElement;
  getEditor: () => Editor | null;
  editable?: boolean;
  getRestrictions?: () => DocumentRestrictions;
  /**
   * Ensure the page under the pointer is active (mount TipTap) before
   * running menu actions. Called with client coordinates.
   */
  ensurePageAtPoint?: (clientX: number, clientY: number) => void;
}

const THEME_COLORS: { label: string; color: string }[] = [
  { label: 'Transparente / Ninguno', color: '' },
  { label: 'Blanco', color: '#ffffff' },
  { label: 'Gris claro', color: '#f1f5f9' },
  { label: 'Gris oscuro', color: '#334155' },
  { label: 'Rojo claro', color: '#fee2e2' },
  { label: 'Rojo', color: '#ef4444' },
  { label: 'Ámbar', color: '#fef3c7' },
  { label: 'Naranja', color: '#f97316' },
  { label: 'Verde claro', color: '#dcfce7' },
  { label: 'Verde', color: '#22c55e' },
  { label: 'Azul claro', color: '#e0e7ff' },
  { label: 'Azul', color: '#3b82f6' },
  { label: 'Púrpura', color: '#a855f7' },
];

const BORDER_STYLES: { label: string; value: string }[] = [
  { label: 'Sólido', value: 'solid' },
  { label: 'Discontinuo', value: 'dashed' },
  { label: 'Punteado', value: 'dotted' },
  { label: 'Doble', value: 'double' },
  { label: 'Sin borde', value: 'none' },
];

const BORDER_WIDTHS: { label: string; value: number }[] = [
  { label: '1 px', value: 1 },
  { label: '2 px', value: 2 },
  { label: '3 px', value: 3 },
  { label: '4 px', value: 4 },
];

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

    const sheet = (target instanceof Element ? target : target.parentElement)
      ?.closest('.cde-page-sheet');
    if (!sheet || !this.container.contains(sheet)) return;

    event.preventDefault();
    event.stopPropagation();

    this.ensurePageAtPoint?.(event.clientX, event.clientY);

    requestAnimationFrame(() => {
      this.placeCaretIfCollapsed(event.clientX, event.clientY, event.target);
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

  private readonly onScroll = (event: Event): void => {
    if (!this.open || !this.menuEl) return;
    if (event.target instanceof Node && this.menuEl.contains(event.target)) {
      return;
    }
    this.hide();
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

  private placeCaretIfCollapsed(
    clientX: number,
    clientY: number,
    target?: EventTarget | null,
  ): void {
    const editor = this.getEditor();
    if (!editor || editor.isDestroyed) return;

    const el = target instanceof Element ? target : null;
    const widget = el?.closest('.cde-wt');
    if (widget) {
      try {
        const tablePos = editor.view.posAtDOM(widget, 0);
        const node = editor.state.doc.nodeAt(tablePos);
        if (node?.type.name === 'table') {
          editor.view.dispatch(
            editor.state.tr.setSelection(
              NodeSelection.create(editor.state.doc, tablePos),
            ),
          );
          return;
        }
      } catch {
        // fall through
      }
    }

    if (!editor.state.selection.empty) return;

    const pos = editor.view.posAtCoords({ left: clientX, top: clientY });
    if (!pos) return;
    editor.chain().setTextSelection(pos.pos).focus().run();
  }

  private inTable(): boolean {
    return this.getEditor()?.isActive('table') ?? false;
  }

  private show(clientX: number, clientY: number): void {
    this.hide();

    const editor = this.getEditor();
    if (!editor) return;

    const menu = document.createElement('div');
    menu.className = 'cde-ctx-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;

    const inTable = this.inTable();
    const hasRange = !editor.state.selection.empty;

    menu.appendChild(this.createMenuItem('Cortar', () => this.cut(), !hasRange, 'Ctrl+X'));
    menu.appendChild(this.createMenuItem('Copiar', () => this.copy(), !hasRange, 'Ctrl+C'));
    menu.appendChild(this.createMenuItem('Pegar', () => this.paste(), false, 'Ctrl+V'));
    menu.appendChild(this.createSeparator());

    const fmt = document.createElement('div');
    fmt.className = 'cde-ctx-menu__format';
    fmt.append(
      this.createFormatButton('B', 'Negrita', 'cde-ctx-menu__format-btn--bold', editor.isActive('bold'), () => {
        editor.chain().focus().toggleBold().run();
      }),
      this.createFormatButton('I', 'Cursiva', 'cde-ctx-menu__format-btn--italic', editor.isActive('italic'), () => {
        editor.chain().focus().toggleItalic().run();
      }),
      this.createFormatButton('U', 'Subrayado', 'cde-ctx-menu__format-btn--underline', editor.isActive('underline'), () => {
        editor.chain().focus().toggleUnderline().run();
      }),
    );
    menu.appendChild(fmt);
    menu.appendChild(this.createSeparator());

    menu.appendChild(
      this.createMenuItem('Viñetas', () => editor.chain().focus().toggleBulletList().run()),
    );
    menu.appendChild(
      this.createMenuItem('Numeración', () => editor.chain().focus().toggleOrderedList().run()),
    );
    menu.appendChild(this.createMenuItem('Vínculo…', () => this.editLink()));
    menu.appendChild(this.createSeparator());

    if (inTable) {
      menu.appendChild(this.createHeading('Tabla'));
      menu.appendChild(this.createMenuItem('Insertar fila encima', () => editor.chain().focus().addRowBefore().run()));
      menu.appendChild(this.createMenuItem('Insertar fila debajo', () => editor.chain().focus().addRowAfter().run()));
      menu.appendChild(this.createMenuItem('Insertar columna a la izquierda', () => editor.chain().focus().addColumnBefore().run()));
      menu.appendChild(this.createMenuItem('Insertar columna a la derecha', () => editor.chain().focus().addColumnAfter().run()));
      menu.appendChild(this.createMenuItem('Eliminar fila', () => editor.chain().focus().deleteRow().run()));
      menu.appendChild(this.createMenuItem('Eliminar columna', () => editor.chain().focus().deleteColumn().run()));
      menu.appendChild(this.createSeparator());

      menu.appendChild(this.createHeading('Celdas'));
      menu.appendChild(this.createMenuItem('Combinar celdas', () => (editor.commands as any).mergeCells()));
      menu.appendChild(this.createMenuItem('Dividir en 2 columnas', () => (editor.commands as any).splitCell({ cols: 2 })));
      menu.appendChild(this.createMenuItem('Dividir en 3 columnas', () => (editor.commands as any).splitCell({ cols: 3 })));
      menu.appendChild(this.createMenuItem('Dividir en columnas…', () => this.promptSplitCell()));
      menu.appendChild(this.createMenuItem('Dividir en 2 filas', () => (editor.commands as any).splitCell({ rows: 2 })));
      menu.appendChild(this.createMenuItem('Ancho de celda…', () => this.promptCellWidth()));
      menu.appendChild(this.createMenuItem('Alto de celda…', () => this.promptCellHeight()));
      menu.appendChild(this.createMenuItem('Alinear arriba', () => editor.chain().focus().setCellAttribute('verticalAlign', 'top').run()));
      menu.appendChild(this.createMenuItem('Alinear al centro', () => editor.chain().focus().setCellAttribute('verticalAlign', 'middle').run()));
      menu.appendChild(this.createMenuItem('Alinear abajo', () => editor.chain().focus().setCellAttribute('verticalAlign', 'bottom').run()));
      menu.appendChild(this.createMenuItem('Autoajustar columnas', () => (editor.commands as any).autoFitColumns()));
      menu.appendChild(this.createMenuItem('Distribuir columnas', () => (editor.commands as any).distributeColumns()));
      menu.appendChild(this.createMenuItem('Actualizar fórmulas', () => (editor.commands as any).recalculateFormulas()));
      menu.appendChild(this.createSeparator());

      menu.appendChild(this.createHeading('Fondo'));
      menu.appendChild(this.createPalette('Celda', THEME_COLORS, (color) => {
        editor.chain().focus().setCellAttribute('backgroundColor', color || null).run();
      }));
      menu.appendChild(this.createPalette('Tabla', THEME_COLORS, (color) => {
        (editor.commands as any).setTableBackground(color || null);
      }));
      menu.appendChild(this.createSeparator());

      menu.appendChild(this.createHeading('Bordes'));
      menu.appendChild(this.createBorderSection(editor));
      menu.appendChild(this.createSeparator());

      menu.appendChild(
        this.createMenuItem('Subir un renglón', () => this.moveTableByRow('up'), !this.canMoveTable('up')),
      );
      menu.appendChild(
        this.createMenuItem('Bajar un renglón', () => this.moveTableByRow('down'), !this.canMoveTable('down')),
      );
      menu.appendChild(
        this.createMenuItem('Eliminar tabla', () => editor.chain().focus().deleteTable().run(), false, '', true),
      );
    } else {
      menu.appendChild(
        this.createMenuItem('Insertar tabla', () => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true, wrap: 'left' }).run();
        }),
      );
    }

    menu.appendChild(this.createSeparator());
    menu.appendChild(
      this.createMenuItem('Seleccionar todo', () => editor.chain().focus().selectAll().run(), false, 'Ctrl+A'),
    );

    document.body.appendChild(menu);
    this.menuEl = menu;
    this.open = true;

    // Viewport-aware position clamping
    const pad = 12;
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

  private createFormatButton(
    letter: string,
    title: string,
    extraClass: string,
    active: boolean,
    run: () => void,
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cde-ctx-menu__format-btn ${extraClass}${active ? ' is-active' : ''}`;
    btn.textContent = letter;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
      run();
    });
    return btn;
  }

  private createPalette(
    label: string,
    colors: { label: string; color: string }[],
    apply: (color: string) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cde-ctx-menu__palette-group';

    const sub = document.createElement('div');
    sub.className = 'cde-ctx-menu__sublabel';
    sub.textContent = label;
    wrap.appendChild(sub);

    const row = document.createElement('div');
    row.className = 'cde-ctx-menu__palette';
    colors.forEach((tc) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'cde-ctx-menu__swatch-btn' + (tc.color ? '' : ' is-clear');
      sw.title = tc.label;
      if (tc.color) sw.style.backgroundColor = tc.color;
      sw.addEventListener('click', (e) => {
        e.preventDefault();
        this.hide();
        apply(tc.color);
      });
      row.appendChild(sw);
    });
    wrap.appendChild(row);
    return wrap;
  }

  private createBorderSection(editor: Editor): HTMLElement {
    const section = document.createElement('div');
    section.className = 'cde-ctx-menu__border-section';

    const styleRow = document.createElement('div');
    styleRow.className = 'cde-ctx-menu__chip-row';
    BORDER_STYLES.forEach((bs) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'cde-ctx-menu__border-chip' + (bs.value === 'none' ? ' is-none' : '');
      chip.title = bs.label;
      const sample = document.createElement('span');
      sample.className = 'cde-ctx-menu__border-sample';
      sample.style.borderTopStyle = bs.value === 'none' ? 'solid' : bs.value;
      chip.appendChild(sample);
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        this.hide();
        (editor.commands as any).setCellBorder({ style: bs.value });
        (editor.commands as any).setTableBorder({ style: bs.value });
      });
      styleRow.appendChild(chip);
    });

    const widthRow = document.createElement('div');
    widthRow.className = 'cde-ctx-menu__chip-row';
    BORDER_WIDTHS.forEach((bw) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'cde-ctx-menu__chip';
      chip.textContent = bw.label;
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        this.hide();
        (editor.commands as any).setCellBorder({ width: bw.value });
        (editor.commands as any).setTableBorder({ width: bw.value });
      });
      widthRow.appendChild(chip);
    });

    const bColorRow = document.createElement('div');
    bColorRow.className = 'cde-ctx-menu__palette';
    THEME_COLORS.forEach((tc) => {
      if (!tc.color) return;
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'cde-ctx-menu__swatch-btn';
      sw.title = tc.label;
      sw.style.backgroundColor = tc.color;
      sw.addEventListener('click', (e) => {
        e.preventDefault();
        this.hide();
        (editor.commands as any).setCellBorder({ color: tc.color });
        (editor.commands as any).setTableBorder({ color: tc.color });
      });
      bColorRow.appendChild(sw);
    });

    section.append(styleRow, widthRow, bColorRow);
    return section;
  }

  private createMenuItem(
    label: string,
    run: () => void,
    disabled = false,
    shortcut = '',
    danger = false,
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cde-ctx-menu__item' + (danger ? ' is-danger' : '');
    btn.disabled = disabled;

    const span = document.createElement('span');
    span.className = 'cde-ctx-menu__label';
    span.textContent = label;
    btn.appendChild(span);

    if (shortcut) {
      const sc = document.createElement('span');
      sc.className = 'cde-ctx-menu__shortcut';
      sc.textContent = shortcut;
      btn.appendChild(sc);
    }

    // Keep the caret and the table cell selection while the command runs.
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (disabled) return;
      this.hide();
      run();
    });
    return btn;
  }

  private createHeading(text: string): HTMLElement {
    const h = document.createElement('div');
    h.className = 'cde-ctx-menu__heading';
    h.textContent = text;
    return h;
  }

  private createSeparator(): HTMLElement {
    const hr = document.createElement('div');
    hr.className = 'cde-ctx-menu__sep';
    return hr;
  }

  private hide(): void {
    this.menuEl?.remove();
    this.menuEl = null;
    this.open = false;
  }

  private selectionHtmlAndText(editor: Editor): { html: string; text: string } {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n\n');

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

  private getActiveTableInfo(): {
    tablePos: number;
    index: number;
    parentChildCount: number;
  } | null {
    const editor = this.getEditor();
    if (!editor) return null;

    const { selection, doc } = editor.state;
    if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
      const $pos = doc.resolve(selection.from);
      return {
        tablePos: selection.from,
        index: $pos.index(),
        parentChildCount: $pos.parent.childCount,
      };
    }

    if (!editor.isActive('table')) return null;

    const { $from } = selection;
    let depth = $from.depth;
    while (depth > 0 && $from.node(depth).type.name !== 'table') {
      depth -= 1;
    }
    if (depth === 0 || $from.node(depth).type.name !== 'table') return null;

    return {
      tablePos: $from.before(depth),
      index: $from.index(depth - 1),
      parentChildCount: $from.node(depth - 1).childCount,
    };
  }

  private canMoveTable(direction: 'up' | 'down'): boolean {
    const info = this.getActiveTableInfo();
    if (!info) return false;
    if (direction === 'up') return info.index > 0;
    return info.index < info.parentChildCount - 1;
  }

  private moveTableByRow(direction: 'up' | 'down'): void {
    const editor = this.getEditor();
    if (!editor || editor.isDestroyed) return;

    const info = this.getActiveTableInfo();
    if (!info) return;

    const { state } = editor;
    const tableNode = state.doc.nodeAt(info.tablePos);
    if (!tableNode || tableNode.type.name !== 'table') return;

    const $table = state.doc.resolve(info.tablePos + 1);
    const parent = $table.node($table.depth - 1);
    const index = info.index;

    if (direction === 'up') {
      if (index <= 0) return;
      const prev = parent.child(index - 1);
      const start = info.tablePos - prev.nodeSize;
      const end = info.tablePos + tableNode.nodeSize;
      editor.view.dispatch(
        state.tr
          .replaceWith(start, end, Fragment.from([tableNode, prev]))
          .scrollIntoView(),
      );
    } else {
      if (index >= parent.childCount - 1) return;
      const next = parent.child(index + 1);
      const start = info.tablePos;
      const end = info.tablePos + tableNode.nodeSize + next.nodeSize;
      editor.view.dispatch(
        state.tr
          .replaceWith(start, end, Fragment.from([next, tableNode]))
          .scrollIntoView(),
      );
    }
    editor.commands.focus();
  }

  private promptSplitCell(): void {
    const editor = this.getEditor();
    if (!editor) return;
    const raw = window.prompt('Número de columnas en las que dividir la celda (ej. 2, 3, 4):', '3');
    if (raw === null) return;
    const n = parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n < 2) return;
    (editor.commands as any).splitCell({ cols: n });
  }

  private promptCellWidth(): void {
    const editor = this.getEditor();
    if (!editor) return;
    const raw = window.prompt('Ancho individual para la(s) celda(s) seleccionada(s) (px o %). Vacío = automático:', '120');
    if (raw === null) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      (editor.commands as any).setCellDimensions({ width: null });
      return;
    }
    const val = trimmed.endsWith('%') ? trimmed : parseInt(trimmed, 10);
    (editor.commands as any).setCellDimensions({ width: val });
  }

  private promptCellHeight(): void {
    const editor = this.getEditor();
    if (!editor) return;
    const raw = window.prompt('Alto individual para la(s) celda(s) seleccionada(s) (px o %). Vacío = automático:', '50');
    if (raw === null) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      (editor.commands as any).setCellDimensions({ height: null });
      return;
    }
    const val = trimmed.endsWith('%') ? trimmed : parseInt(trimmed, 10);
    (editor.commands as any).setCellDimensions({ height: val });
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

import type { Editor } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
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
  { label: 'Sólido —', value: 'solid' },
  { label: 'Discontinuo - -', value: 'dashed' },
  { label: 'Punteado · ·', value: 'dotted' },
  { label: 'Doble ═', value: 'double' },
  { label: 'Sin borde ✕', value: 'none' },
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

    // Quick Clipboard Row
    const clipRow = document.createElement('div');
    clipRow.className = 'cde-ctx-menu__row';

    const btnCut = this.createCompactButton('Cortar', 'Ctrl+X', !hasRange, () => this.cut());
    const btnCopy = this.createCompactButton('Copiar', 'Ctrl+C', !hasRange, () => this.copy());
    const btnPaste = this.createCompactButton('Pegar', 'Ctrl+V', false, () => this.paste());
    clipRow.append(btnCut, btnCopy, btnPaste);
    menu.appendChild(clipRow);

    // Text formatting row
    const fmtRow = document.createElement('div');
    fmtRow.className = 'cde-ctx-menu__row';
    fmtRow.append(
      this.createIconButton('<b>B</b>', 'Negrita', editor.isActive('bold'), () => {
        editor.chain().focus().toggleBold().run();
      }),
      this.createIconButton('<i>I</i>', 'Cursiva', editor.isActive('italic'), () => {
        editor.chain().focus().toggleItalic().run();
      }),
      this.createIconButton('<u>U</u>', 'Subrayado', editor.isActive('underline'), () => {
        editor.chain().focus().toggleUnderline().run();
      }),
      this.createIconButton('• Lista', 'Viñetas', editor.isActive('bulletList'), () => {
        editor.chain().focus().toggleBulletList().run();
      }),
      this.createIconButton('1. Lista', 'Numeración', editor.isActive('orderedList'), () => {
        editor.chain().focus().toggleOrderedList().run();
      }),
    );
    menu.appendChild(fmtRow);

    menu.appendChild(this.createSeparator());

    if (inTable) {
      // Table Header Section
      menu.appendChild(this.createHeading('Operaciones de Tabla'));

      // Row & Column operations
      const gridOps = document.createElement('div');
      gridOps.className = 'cde-ctx-menu__grid-ops';
      gridOps.append(
        this.createMenuItem('+ Fila arriba', () => editor.chain().focus().addRowBefore().run()),
        this.createMenuItem('+ Fila abajo', () => editor.chain().focus().addRowAfter().run()),
        this.createMenuItem('+ Col. izquierda', () => editor.chain().focus().addColumnBefore().run()),
        this.createMenuItem('+ Col. derecha', () => editor.chain().focus().addColumnAfter().run()),
        this.createMenuItem('- Eliminar fila', () => editor.chain().focus().deleteRow().run()),
        this.createMenuItem('- Eliminar columna', () => editor.chain().focus().deleteColumn().run()),
      );
      menu.appendChild(gridOps);

      menu.appendChild(this.createSeparator());

      // Merge / Split & Alignment & Dimensions & Formulas
      menu.appendChild(this.createHeading('Celdas (Combinar, Dividir y Tamaño)'));
      const cellOps = document.createElement('div');
      cellOps.className = 'cde-ctx-menu__grid-ops';
      cellOps.append(
        this.createMenuItem('🔀 Combinar celdas', () => (editor.commands as any).mergeCells()),
        this.createMenuItem('✂️ Dividir en 2 columnas', () => (editor.commands as any).splitCell({ cols: 2 })),
        this.createMenuItem('✂️ Dividir en 3 columnas', () => (editor.commands as any).splitCell({ cols: 3 })),
        this.createMenuItem('✂️ Dividir en N…', () => this.promptSplitCell()),
        this.createMenuItem('✂️ Dividir en 2 filas', () => (editor.commands as any).splitCell({ rows: 2 })),
        this.createMenuItem('📐 Autoajustar al contenido', () => (editor.commands as any).autoFitColumns()),
        this.createMenuItem('⚖️ Distribuir columnas', () => (editor.commands as any).distributeColumns()),
        this.createMenuItem('🧮 Actualizar fórmulas (=SUM...)', () => (editor.commands as any).recalculateFormulas()),
        this.createMenuItem('📏 Ancho de celda…', () => this.promptCellWidth()),
        this.createMenuItem('📏 Alto de celda…', () => this.promptCellHeight()),
        this.createMenuItem('⬆ Alinear arriba', () => editor.chain().focus().setCellAttribute('verticalAlign', 'top').run()),
        this.createMenuItem('⬍ Alinear centro', () => editor.chain().focus().setCellAttribute('verticalAlign', 'middle').run()),
        this.createMenuItem('⬇ Alinear abajo', () => editor.chain().focus().setCellAttribute('verticalAlign', 'bottom').run()),
      );
      menu.appendChild(cellOps);

      menu.appendChild(this.createSeparator());

      // Background Color Palette (Pintar)
      menu.appendChild(this.createHeading('Pintar Fondo (Celda / Tabla)'));
      const colorSection = document.createElement('div');
      colorSection.className = 'cde-ctx-menu__palette-group';

      const cellColorRow = document.createElement('div');
      cellColorRow.className = 'cde-ctx-menu__palette';
      cellColorRow.title = 'Color de fondo de la celda';
      THEME_COLORS.forEach((tc) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'cde-ctx-menu__swatch-btn';
        sw.title = `Celda: ${tc.label}`;
        sw.style.backgroundColor = tc.color || '#f8fafc';
        if (!tc.color) sw.textContent = '✕';
        sw.addEventListener('click', (e) => {
          e.preventDefault();
          this.hide();
          editor.chain().focus().setCellAttribute('backgroundColor', tc.color || null).run();
        });
        cellColorRow.appendChild(sw);
      });

      const tableColorRow = document.createElement('div');
      tableColorRow.className = 'cde-ctx-menu__palette';
      tableColorRow.title = 'Color de fondo de toda la tabla';
      THEME_COLORS.forEach((tc) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'cde-ctx-menu__swatch-btn';
        sw.title = `Toda la tabla: ${tc.label}`;
        sw.style.backgroundColor = tc.color || '#f8fafc';
        if (!tc.color) sw.textContent = '✕';
        sw.addEventListener('click', (e) => {
          e.preventDefault();
          this.hide();
          (editor.commands as any).setTableBackground(tc.color || null);
        });
        tableColorRow.appendChild(sw);
      });

      const cellLabel = document.createElement('div');
      cellLabel.className = 'cde-ctx-menu__sublabel';
      cellLabel.textContent = 'Fondo Celda:';
      const tableLabel = document.createElement('div');
      tableLabel.className = 'cde-ctx-menu__sublabel';
      tableLabel.textContent = 'Fondo Tabla:';

      colorSection.append(cellLabel, cellColorRow, tableLabel, tableColorRow);
      menu.appendChild(colorSection);

      menu.appendChild(this.createSeparator());

      // Border Decoration (Decorar bordes)
      menu.appendChild(this.createHeading('Decorar Bordes (Estilo, Grosor, Color)'));
      const borderSection = document.createElement('div');
      borderSection.className = 'cde-ctx-menu__border-section';

      // Style selector
      const styleRow = document.createElement('div');
      styleRow.className = 'cde-ctx-menu__chip-row';
      BORDER_STYLES.forEach((bs) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'cde-ctx-menu__chip';
        chip.textContent = bs.label;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          this.hide();
          (editor.commands as any).setCellBorder({ style: bs.value });
          (editor.commands as any).setTableBorder({ style: bs.value });
        });
        styleRow.appendChild(chip);
      });

      // Width selector
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

      // Border color row
      const bColorRow = document.createElement('div');
      bColorRow.className = 'cde-ctx-menu__palette';
      THEME_COLORS.forEach((tc) => {
        if (!tc.color) return;
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'cde-ctx-menu__swatch-btn';
        sw.title = `Borde: ${tc.label}`;
        sw.style.backgroundColor = tc.color;
        sw.addEventListener('click', (e) => {
          e.preventDefault();
          this.hide();
          (editor.commands as any).setCellBorder({ color: tc.color });
          (editor.commands as any).setTableBorder({ color: tc.color });
        });
        bColorRow.appendChild(sw);
      });

      borderSection.append(styleRow, widthRow, bColorRow);
      menu.appendChild(borderSection);

      menu.appendChild(this.createSeparator());

      // Table Navigation and Deletion
      menu.appendChild(this.createHeading('Ubicación y Gestión'));
      menu.appendChild(
        this.createMenuItem('↑ Mover tabla un renglón arriba', () => this.moveTableByRow('up'), !this.canMoveTable('up')),
      );
      menu.appendChild(
        this.createMenuItem('↓ Mover tabla un renglón abajo', () => this.moveTableByRow('down'), !this.canMoveTable('down')),
      );
      menu.appendChild(
        this.createMenuItem('🗑 Eliminar tabla completa', () => editor.chain().focus().deleteTable().run()),
      );
    } else {
      menu.appendChild(
        this.createMenuItem('➕ Insertar tabla', () => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true, wrap: 'left' }).run();
        }),
      );
    }

    menu.appendChild(this.createSeparator());
    menu.appendChild(this.createMenuItem('🔗 Vínculo…', () => this.editLink()));
    menu.appendChild(this.createMenuItem('Seleccionar todo', () => editor.chain().focus().selectAll().run(), false, 'Ctrl+A'));

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

  private createCompactButton(label: string, shortcut: string, disabled: boolean, run: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cde-ctx-menu__btn-compact';
    btn.disabled = disabled;
    btn.textContent = label;
    btn.title = shortcut;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
      run();
    });
    return btn;
  }

  private createIconButton(html: string, title: string, active: boolean, run: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cde-ctx-menu__btn-icon ${active ? 'is-active' : ''}`;
    btn.innerHTML = html;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
      run();
    });
    return btn;
  }

  private createMenuItem(label: string, run: () => void, disabled = false, shortcut = ''): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cde-ctx-menu__item';
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

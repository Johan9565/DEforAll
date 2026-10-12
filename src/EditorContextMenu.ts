import type { Editor } from '@tiptap/core';
import type { DocumentRestrictions } from './types';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { IMAGE_FILTERS, openCropModal } from './utils/imageEffects';
import { optimizeImage } from './utils/imageOptimizer';
import {
  lucideSvg,
  Scissors,
  Copy,
  ClipboardPaste,
  Crop,
  Palette,
  Maximize2,
  RotateCcw,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify,
  WrapText,
  Sparkles,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Rows3,
  Columns3,
  Merge,
  Split,
  MoveHorizontal,
  MoveVertical,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Scaling,
  AlignHorizontalDistributeCenter,
  Sigma,
  ArrowUpDown,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  LucideLink,
  Eraser,
  LucideImage,
  LucideTable,
  MousePointerClick,
  ChevronRight,
  type IconNode,
} from './icons';
import './styles/context-menu.css';

export interface EditorContextMenuOptions {
  /** Element that owns page sheets (typically `.cde-workspace` or `.cde-document-stage`). */
  container: HTMLElement;
  getEditor: () => Editor | null;
  editable?: boolean | (() => boolean);
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
  private readonly editable: boolean | (() => boolean);
  private readonly getRestrictions?: () => DocumentRestrictions;
  private readonly ensurePageAtPoint?: (
    clientX: number,
    clientY: number,
  ) => void;

  private menuEl: HTMLElement | null = null;
  private open = false;

  private isEditable(): boolean {
    if (typeof this.editable === 'function') return this.editable();
    return this.editable ?? true;
  }

  private isAllowed(action: keyof DocumentRestrictions): boolean {
    const r = this.getRestrictions?.();
    if (!r) return true;
    return r[action] !== false;
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (!this.isEditable()) return;
    const target = event.target;
    if (!(target instanceof Node) || !this.container.contains(target)) return;

    event.preventDefault();
    event.stopPropagation();

    this.ensurePageAtPoint?.(event.clientX, event.clientY);

    this.placeCaretIfCollapsed(event.clientX, event.clientY, event.target);
    this.show(event.clientX, event.clientY, event.target);
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
    this.getRestrictions = options.getRestrictions;
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

    // 1. Right click on Image
    const imgEl = el?.closest('img, .cde-image-box, .cde-image-container');
    if (imgEl) {
      try {
        const imgPos = editor.view.posAtDOM(imgEl, 0);
        const node = editor.state.doc.nodeAt(imgPos);
        if (node?.type.name === 'image') {
          editor.view.dispatch(
            editor.state.tr.setSelection(
              NodeSelection.create(editor.state.doc, imgPos),
            ),
          );
          return;
        }
      } catch {
        // fall through
      }
    }

    // 2. Right click on Table
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

    // 3. Keep active text selection if present
    if (!editor.state.selection.empty) return;

    // 4. Place caret at click position
    const pos = editor.view.posAtCoords({ left: clientX, top: clientY });
    if (!pos) return;
    editor.chain().setTextSelection(pos.pos).focus().run();
  }

  private inTable(): boolean {
    return this.getEditor()?.isActive('table') ?? false;
  }

  private show(clientX: number, clientY: number, target?: EventTarget | null): void {
    this.hide();

    const editor = this.getEditor();
    if (!editor) return;

    const menu = document.createElement('div');
    menu.className = 'cde-ctx-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;

    const el = target instanceof Element ? target : null;
    const isImage =
      (editor.state.selection instanceof NodeSelection &&
        editor.state.selection.node.type.name === 'image') ||
      Boolean(el?.closest('img, .cde-image-box, .cde-image-container'));

    const isTable = !isImage && (this.inTable() || Boolean(el?.closest('.cde-wt')));
    const hasTextRange = !isImage && !isTable && !editor.state.selection.empty;

    if (isImage) {
      this.buildImageMenu(menu, editor, el);
    } else if (isTable) {
      this.buildTableMenu(menu, editor);
    } else if (hasTextRange) {
      this.buildTextMenu(menu, editor);
    } else {
      this.buildDefaultMenu(menu, editor);
    }

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

  private buildImageMenu(menu: HTMLElement, editor: Editor, el: Element | null): void {
    const sel = editor.state.selection;
    let node = sel instanceof NodeSelection && sel.node.type.name === 'image' ? sel.node : null;
    let nodePos = sel.from;

    if (!node && el) {
      const imgEl = el.closest('img, .cde-image-box, .cde-image-container');
      if (imgEl) {
        try {
          const p = editor.view.posAtDOM(imgEl, 0);
          const found = editor.state.doc.nodeAt(p);
          if (found?.type.name === 'image') {
            node = found;
            nodePos = p;
          }
        } catch {
          // fall through
        }
      }
    }

    const src = node?.attrs.src || '';

    menu.appendChild(this.createHeading('Imagen'));

    // 1. Recortar (Crop)
    menu.appendChild(
      this.createMenuItem(
        'Recortar imagen…',
        () => {
          openCropModal(src, (cropped) => {
            editor.chain().focus().updateImage({ src: cropped }).run();
          });
        },
        { icon: Crop },
      ),
    );

    // 2. Filtros y efectos
    menu.appendChild(
      this.createSubmenu(
        'Filtros y efectos',
        IMAGE_FILTERS.map((f) => ({
          label: f.label,
          icon: Palette,
          action: () => editor.chain().focus().updateImage({ filter: f.id }).run(),
        })),
        Palette,
      ),
    );

    // 3. Dimensiones
    menu.appendChild(
      this.createMenuItem(
        'Cambiar dimensiones…',
        () => {
          const currentW = node?.attrs.width || '';
          const promptVal = window.prompt(
            'Ancho de la imagen en píxeles (ej. 400):',
            currentW ? String(currentW) : '400',
          );
          if (promptVal) {
            const num = parseInt(promptVal, 10);
            if (num > 20) {
              editor.chain().focus().updateImage({ width: num, height: null }).run();
            }
          }
        },
        { icon: Maximize2 },
      ),
    );

    menu.appendChild(
      this.createMenuItem(
        'Restablecer tamaño original',
        () => {
          editor.chain().focus().updateImage({ width: null, height: null }).run();
        },
        { icon: RotateCcw },
      ),
    );

    menu.appendChild(this.createSeparator());

    // 4. Alineación
    menu.appendChild(
      this.createSubmenu(
        'Alineación',
        [
          {
            label: 'Alinear a la izquierda',
            icon: AlignLeft,
            action: () => editor.chain().focus().updateImage({ alignment: 'left' }).run(),
          },
          {
            label: 'Centrar',
            icon: AlignCenter,
            action: () => editor.chain().focus().updateImage({ alignment: 'center' }).run(),
          },
          {
            label: 'Alinear a la derecha',
            icon: AlignRight,
            action: () => editor.chain().focus().updateImage({ alignment: 'right' }).run(),
          },
        ],
        AlignCenter,
      ),
    );

    // 5. Ajuste con el texto (Mover / Flotar)
    menu.appendChild(
      this.createSubmenu(
        'Ajuste con el texto',
        [
          {
            label: 'En línea con el texto (Bloque)',
            icon: AlignCenter,
            action: () => editor.chain().focus().updateImage({ wrap: 'none' }).run(),
          },
          {
            label: 'Flotar a la izquierda (texto a la der.)',
            icon: AlignLeft,
            action: () => editor.chain().focus().updateImage({ wrap: 'left' }).run(),
          },
          {
            label: 'Flotar a la derecha (texto a la izq.)',
            icon: AlignRight,
            action: () => editor.chain().focus().updateImage({ wrap: 'right' }).run(),
          },
        ],
        WrapText,
      ),
    );

    menu.appendChild(this.createSeparator());

    // 6. Optimizar
    menu.appendChild(
      this.createMenuItem(
        'Optimizar imagen (reducir peso)',
        async () => {
          if (!src) return;
          const res = await optimizeImage(src);
          editor.chain().focus().updateImage({ src: res.dataUrl }).run();
        },
        { icon: Sparkles },
      ),
    );

    menu.appendChild(this.createSeparator());

    // 7. Copiar, Cortar, Eliminar
    menu.appendChild(
      this.createMenuItem('Copiar imagen', () => this.copy(), {
        icon: Copy,
        shortcut: 'Ctrl+C',
      }),
    );
    menu.appendChild(
      this.createMenuItem('Cortar imagen', () => this.cut(), {
        icon: Scissors,
        shortcut: 'Ctrl+X',
      }),
    );
    menu.appendChild(
      this.createMenuItem(
        'Eliminar imagen',
        () => {
          editor.commands.deleteRange({
            from: nodePos,
            to: nodePos + (node?.nodeSize || 1),
          });
        },
        { icon: Trash2, danger: true },
      ),
    );
  }

  private buildTableMenu(menu: HTMLElement, editor: Editor): void {
    menu.appendChild(
      this.createMenuItem('Cortar', () => this.cut(), {
        icon: Scissors,
        shortcut: 'Ctrl+X',
      }),
    );
    menu.appendChild(
      this.createMenuItem('Copiar', () => this.copy(), {
        icon: Copy,
        shortcut: 'Ctrl+C',
      }),
    );
    menu.appendChild(
      this.createMenuItem('Pegar', () => this.paste(), {
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
      }),
    );
    menu.appendChild(this.createSeparator());

    menu.appendChild(this.createHeading('Filas y columnas'));
    menu.appendChild(
      this.createMenuItem(
        'Insertar fila encima',
        () => editor.chain().focus().addRowBefore().run(),
        { icon: ArrowUpToLine },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Insertar fila debajo',
        () => editor.chain().focus().addRowAfter().run(),
        { icon: ArrowDownToLine },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Insertar columna a la izquierda',
        () => editor.chain().focus().addColumnBefore().run(),
        { icon: ArrowLeftToLine },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Insertar columna a la derecha',
        () => editor.chain().focus().addColumnAfter().run(),
        { icon: ArrowRightToLine },
      ),
    );
    menu.appendChild(
      this.createMenuItem('Eliminar fila', () => editor.chain().focus().deleteRow().run(), {
        icon: Rows3,
      }),
    );
    menu.appendChild(
      this.createMenuItem(
        'Eliminar columna',
        () => editor.chain().focus().deleteColumn().run(),
        { icon: Columns3 },
      ),
    );
    menu.appendChild(this.createSeparator());

    menu.appendChild(this.createHeading('Celdas'));
    menu.appendChild(
      this.createMenuItem(
        'Combinar celdas',
        () => (editor.commands as any).mergeCells(),
        { icon: Merge },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Dividir en 2 columnas',
        () => (editor.commands as any).splitCell({ cols: 2 }),
        { icon: Split },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Dividir en 3 columnas',
        () => (editor.commands as any).splitCell({ cols: 3 }),
        { icon: Columns3 },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Dividir en columnas…',
        () => this.promptSplitCell(),
        { icon: Split },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Dividir en 2 filas',
        () => (editor.commands as any).splitCell({ rows: 2 }),
        { icon: Rows3 },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Ancho de celda…',
        () => this.promptCellWidth(),
        { icon: MoveHorizontal },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Alto de celda…',
        () => this.promptCellHeight(),
        { icon: MoveVertical },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Alinear arriba',
        () => editor.chain().focus().setCellAttribute('verticalAlign', 'top').run(),
        { icon: AlignVerticalJustifyStart },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Alinear al centro',
        () => editor.chain().focus().setCellAttribute('verticalAlign', 'middle').run(),
        { icon: AlignVerticalJustifyCenter },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Alinear abajo',
        () => editor.chain().focus().setCellAttribute('verticalAlign', 'bottom').run(),
        { icon: AlignVerticalJustifyEnd },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Autoajustar columnas',
        () => (editor.commands as any).autoFitColumns(),
        { icon: Scaling },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Distribuir columnas',
        () => (editor.commands as any).distributeColumns(),
        { icon: AlignHorizontalDistributeCenter },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Actualizar fórmulas',
        () => (editor.commands as any).recalculateFormulas(),
        { icon: Sigma },
      ),
    );
    menu.appendChild(this.createSeparator());

    menu.appendChild(this.createHeading('Fondo'));
    menu.appendChild(
      this.createPalette('Celda', THEME_COLORS, (color) => {
        editor.chain().focus().setCellAttribute('backgroundColor', color || null).run();
      }),
    );
    menu.appendChild(
      this.createPalette('Tabla', THEME_COLORS, (color) => {
        (editor.commands as any).setTableBackground(color || null);
      }),
    );
    menu.appendChild(this.createSeparator());

    menu.appendChild(this.createHeading('Bordes'));
    menu.appendChild(this.createBorderSection(editor));
    menu.appendChild(this.createSeparator());

    menu.appendChild(
      this.createMenuItem(
        'Subir un renglón',
        () => this.moveTableByRow('up'),
        { icon: ArrowUpDown, disabled: !this.canMoveTable('up') },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Bajar un renglón',
        () => this.moveTableByRow('down'),
        { icon: ArrowUpDown, disabled: !this.canMoveTable('down') },
      ),
    );
    menu.appendChild(
      this.createMenuItem(
        'Eliminar tabla',
        () => editor.chain().focus().deleteTable().run(),
        { icon: Trash2, danger: true },
      ),
    );
  }

  private buildTextMenu(menu: HTMLElement, editor: Editor): void {
    menu.appendChild(
      this.createMenuItem('Cortar', () => this.cut(), {
        icon: Scissors,
        shortcut: 'Ctrl+X',
      }),
    );
    menu.appendChild(
      this.createMenuItem('Copiar', () => this.copy(), {
        icon: Copy,
        shortcut: 'Ctrl+C',
      }),
    );
    menu.appendChild(
      this.createMenuItem('Pegar', () => this.paste(), {
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
      }),
    );
    menu.appendChild(this.createSeparator());

    const fmt = document.createElement('div');
    fmt.className = 'cde-ctx-menu__format';
    fmt.append(
      this.createFormatButton(
        Bold,
        'Negrita (Ctrl+B)',
        'cde-ctx-menu__format-btn--bold',
        editor.isActive('bold'),
        () => editor.chain().focus().toggleBold().run(),
      ),
      this.createFormatButton(
        Italic,
        'Cursiva (Ctrl+I)',
        'cde-ctx-menu__format-btn--italic',
        editor.isActive('italic'),
        () => editor.chain().focus().toggleItalic().run(),
      ),
      this.createFormatButton(
        Underline,
        'Subrayado (Ctrl+U)',
        'cde-ctx-menu__format-btn--underline',
        editor.isActive('underline'),
        () => editor.chain().focus().toggleUnderline().run(),
      ),
      this.createFormatButton(
        Strikethrough,
        'Tachado',
        'cde-ctx-menu__format-btn--strike',
        editor.isActive('strike'),
        () => editor.chain().focus().toggleStrike().run(),
      ),
    );
    menu.appendChild(fmt);
    menu.appendChild(this.createSeparator());

    menu.appendChild(
      this.createSubmenu(
        'Alineación',
        [
          {
            label: 'Izquierda',
            icon: AlignLeft,
            action: () => editor.chain().focus().setTextAlign('left').run(),
          },
          {
            label: 'Centrado',
            icon: AlignCenter,
            action: () => editor.chain().focus().setTextAlign('center').run(),
          },
          {
            label: 'Derecha',
            icon: AlignRight,
            action: () => editor.chain().focus().setTextAlign('right').run(),
          },
          {
            label: 'Justificado',
            icon: AlignJustify,
            action: () => editor.chain().focus().setTextAlign('justify').run(),
          },
        ],
        AlignCenter,
      ),
    );

    menu.appendChild(
      this.createMenuItem('Viñetas', () => editor.chain().focus().toggleBulletList().run(), {
        icon: List,
      }),
    );
    menu.appendChild(
      this.createMenuItem(
        'Numeración',
        () => editor.chain().focus().toggleOrderedList().run(),
        { icon: ListOrdered },
      ),
    );
    menu.appendChild(
      this.createMenuItem('Vínculo…', () => this.editLink(), {
        icon: LucideLink,
      }),
    );
    menu.appendChild(
      this.createMenuItem(
        'Quitar formato',
        () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
        { icon: Eraser },
      ),
    );
  }

  private buildDefaultMenu(menu: HTMLElement, editor: Editor): void {
    menu.appendChild(
      this.createMenuItem('Pegar', () => this.paste(), {
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
      }),
    );
    menu.appendChild(this.createSeparator());

    const hasInsertOptions =
      this.isAllowed('allowImages') ||
      this.isAllowed('allowTables') ||
      this.isAllowed('allowLinks');

    if (hasInsertOptions) {
      menu.appendChild(this.createHeading('Insertar'));
      if (this.isAllowed('allowImages')) {
        menu.appendChild(
          this.createMenuItem('Insertar imagen…', () => this.insertImagePrompt(editor), {
            icon: LucideImage,
          }),
        );
      }
      if (this.isAllowed('allowTables')) {
        menu.appendChild(
          this.createMenuItem(
            'Insertar tabla (3×3)',
            () => {
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true, wrap: 'left' })
                .run();
            },
            { icon: LucideTable },
          ),
        );
      }
      if (this.isAllowed('allowLinks')) {
        menu.appendChild(
          this.createMenuItem('Insertar vínculo…', () => this.editLink(), {
            icon: LucideLink,
          }),
        );
      }
      menu.appendChild(this.createSeparator());
    }

    menu.appendChild(
      this.createSubmenu(
        'Alineación',
        [
          {
            label: 'Izquierda',
            icon: AlignLeft,
            action: () => editor.chain().focus().setTextAlign('left').run(),
          },
          {
            label: 'Centrado',
            icon: AlignCenter,
            action: () => editor.chain().focus().setTextAlign('center').run(),
          },
          {
            label: 'Derecha',
            icon: AlignRight,
            action: () => editor.chain().focus().setTextAlign('right').run(),
          },
          {
            label: 'Justificado',
            icon: AlignJustify,
            action: () => editor.chain().focus().setTextAlign('justify').run(),
          },
        ],
        AlignCenter,
      ),
    );

    menu.appendChild(this.createSeparator());
    menu.appendChild(
      this.createMenuItem(
        'Seleccionar todo',
        () => editor.chain().focus().selectAll().run(),
        { icon: MousePointerClick, shortcut: 'Ctrl+A' },
      ),
    );
  }

  private insertImagePrompt(editor: Editor): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const opt = await optimizeImage(file);
      editor.chain().focus().setImage({ src: opt.dataUrl }).run();
    });
    input.click();
  }

  private createSubmenu(
    label: string,
    items: { label: string; action: () => void; icon?: IconNode }[],
    icon?: IconNode,
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'cde-ctx-menu__item cde-ctx-menu__item--has-sub';
    item.tabIndex = 0;

    const lead = document.createElement('span');
    lead.className = 'cde-ctx-menu__lead';

    if (icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'cde-ctx-menu__icon';
      iconSpan.innerHTML = lucideSvg(icon, 15);
      lead.appendChild(iconSpan);
    }

    const span = document.createElement('span');
    span.className = 'cde-ctx-menu__label';
    span.textContent = label;
    lead.appendChild(span);

    const arrow = document.createElement('span');
    arrow.className = 'cde-ctx-menu__arrow';
    arrow.innerHTML = lucideSvg(ChevronRight, 13);

    const sub = document.createElement('div');
    sub.className = 'cde-ctx-menu__sub';

    items.forEach((it) => {
      const subItem = document.createElement('button');
      subItem.type = 'button';
      subItem.className = 'cde-ctx-menu__item';

      const subLead = document.createElement('span');
      subLead.className = 'cde-ctx-menu__lead';

      if (it.icon) {
        const subIcon = document.createElement('span');
        subIcon.className = 'cde-ctx-menu__icon';
        subIcon.innerHTML = lucideSvg(it.icon, 14);
        subLead.appendChild(subIcon);
      }

      const subLabel = document.createElement('span');
      subLabel.className = 'cde-ctx-menu__label';
      subLabel.textContent = it.label;
      subLead.appendChild(subLabel);

      subItem.appendChild(subLead);

      subItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        it.action();
      });
      sub.appendChild(subItem);
    });

    item.append(lead, arrow, sub);
    return item;
  }

  private createFormatButton(
    icon: IconNode,
    title: string,
    extraClass: string,
    active: boolean,
    run: () => void,
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cde-ctx-menu__format-btn ${extraClass}${active ? ' is-active' : ''}`;
    btn.innerHTML = lucideSvg(icon, 15);
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
      chip.className =
        'cde-ctx-menu__border-chip' + (bs.value === 'none' ? ' is-none' : '');
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
    options?: {
      icon?: IconNode;
      shortcut?: string;
      danger?: boolean;
      disabled?: boolean;
    },
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cde-ctx-menu__item' + (options?.danger ? ' is-danger' : '');
    btn.disabled = options?.disabled ?? false;

    const lead = document.createElement('span');
    lead.className = 'cde-ctx-menu__lead';

    if (options?.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'cde-ctx-menu__icon';
      iconSpan.innerHTML = lucideSvg(options.icon, 15);
      lead.appendChild(iconSpan);
    }

    const span = document.createElement('span');
    span.className = 'cde-ctx-menu__label';
    span.textContent = label;
    lead.appendChild(span);

    btn.appendChild(lead);

    if (options?.shortcut) {
      const sc = document.createElement('span');
      sc.className = 'cde-ctx-menu__shortcut';
      sc.textContent = options.shortcut;
      btn.appendChild(sc);
    }

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (options?.disabled) return;
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
    if (!editor) return;
    const { html, text } = this.selectionHtmlAndText(editor);
    await this.writeClipboard(html, text);
    editor.commands.focus();
  }

  private async cut(): Promise<void> {
    const editor = this.getEditor();
    if (!editor) return;
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
    const raw = window.prompt(
      'Número de columnas en las que dividir la celda (ej. 2, 3, 4):',
      '3',
    );
    if (raw === null) return;
    const n = parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n < 2) return;
    (editor.commands as any).splitCell({ cols: n });
  }

  private promptCellWidth(): void {
    const editor = this.getEditor();
    if (!editor) return;
    const raw = window.prompt(
      'Ancho individual para la(s) celda(s) seleccionada(s) (px o %). Vacío = automático:',
      '120',
    );
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
    const raw = window.prompt(
      'Alto individual para la(s) celda(s) seleccionada(s) (px o %). Vacío = automático:',
      '50',
    );
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

import type { Editor } from '@tiptap/core';

export interface ToolbarOptions {
  /**
   * Live editor accessor — TipTap instances swap when the active page changes.
   * Prefer this over a fixed `editor` reference.
   */
  getEditor?: () => Editor | null;
  /** @deprecated Use getEditor for virtualized pages. */
  editor?: Editor;
  /** Element that will contain the toolbar (prepended). */
  container: HTMLElement;
}

interface ToolbarAction {
  title: string;
  label: string;
  group: string;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
  run: () => void;
}

const icon = (paths: string, viewBox = '0 0 24 24'): string =>
  `<svg class="cde-toolbar__icon" viewBox="${viewBox}" aria-hidden="true" focusable="false">${paths}</svg>`;

const TEXT_COLORS = [
  { title: 'Negro', color: '#111827' },
  { title: 'Rojo', color: '#b91c1c' },
  { title: 'Azul', color: '#1d4ed8' },
  { title: 'Verde', color: '#15803d' },
] as const;

const HIGHLIGHT_COLORS = [
  { title: 'Resaltar amarillo', color: '#fef08a' },
  { title: 'Resaltar verde', color: '#bbf7d0' },
  { title: 'Resaltar azul', color: '#bfdbfe' },
] as const;

/**
 * Sticky formatting toolbar for DocumentEditor.
 * Framework-agnostic DOM; syncs active states with the active TipTap instance.
 */
export class Toolbar {
  private readonly root: HTMLElement;
  private readonly getEditor: () => Editor | null;
  private readonly buttons = new Map<HTMLButtonElement, ToolbarAction>();
  private readonly onUpdate: () => void;
  private boundEditor: Editor | null = null;
  private pageCountEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;

  constructor(options: ToolbarOptions) {
    this.getEditor = options.getEditor ?? (() => options.editor ?? null);
    this.root = document.createElement('div');
    this.root.className = 'cde-toolbar';
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Formato del documento');

    this.build();
    options.container.prepend(this.root);

    this.onUpdate = () => this.syncState();
    this.notifyEditorChanged();
    this.syncState();
  }

  public getElement(): HTMLElement {
    return this.root;
  }

  /** Rebind listeners when the active page's TipTap instance changes. */
  public notifyEditorChanged(): void {
    if (this.boundEditor) {
      this.boundEditor.off('selectionUpdate', this.onUpdate);
      this.boundEditor.off('transaction', this.onUpdate);
    }
    this.boundEditor = this.getEditor();
    if (this.boundEditor) {
      this.boundEditor.on('selectionUpdate', this.onUpdate);
      this.boundEditor.on('transaction', this.onUpdate);
    }
    this.syncState();
  }

  public setPageCount(pageCount: number): void {
    if (!this.pageCountEl) {
      this.ensureMeta();
      this.pageCountEl = document.createElement('span');
      this.pageCountEl.className = 'cde-toolbar__pagecount';
      this.root.querySelector('.cde-toolbar__meta')?.appendChild(this.pageCountEl);
    }
    this.pageCountEl.textContent =
      pageCount === 1 ? '1 página' : `${pageCount} páginas`;
  }

  public setDocumentStats(stats: { characters: number; words: number }): void {
    if (!this.statsEl) {
      this.ensureMeta();
      this.statsEl = document.createElement('span');
      this.statsEl.className = 'cde-toolbar__stats';
      this.root.querySelector('.cde-toolbar__meta')?.prepend(this.statsEl);
    }
    this.statsEl.textContent = `${stats.words} pal. · ${stats.characters} car.`;
  }

  public destroy(): void {
    if (this.boundEditor) {
      this.boundEditor.off('selectionUpdate', this.onUpdate);
      this.boundEditor.off('transaction', this.onUpdate);
    }
    this.root.remove();
    this.buttons.clear();
  }

  private editor(): Editor | null {
    return this.getEditor();
  }

  private ensureMeta(): void {
    if (this.root.querySelector('.cde-toolbar__meta')) return;
    this.root.appendChild(this.createDivider());
    const meta = document.createElement('div');
    meta.className = 'cde-toolbar__meta';
    this.root.appendChild(meta);
  }

  private build(): void {
    const actions = this.createActions();
    let currentGroup = '';
    let groupEl: HTMLElement | null = null;

    for (const action of actions) {
      if (action.group !== currentGroup) {
        if (groupEl) {
          this.root.appendChild(this.createDivider());
        }
        currentGroup = action.group;
        groupEl = document.createElement('div');
        groupEl.className = 'cde-toolbar__group';
        groupEl.setAttribute('role', 'group');
        this.root.appendChild(groupEl);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cde-toolbar__btn';
      button.title = action.title;
      button.setAttribute('aria-label', action.title);
      button.innerHTML = action.label;

      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });

      button.addEventListener('click', () => {
        if (button.disabled) return;
        action.run();
        this.syncState();
      });

      this.buttons.set(button, action);
      groupEl!.appendChild(button);
    }
  }

  private createDivider(): HTMLElement {
    const divider = document.createElement('div');
    divider.className = 'cde-toolbar__divider';
    divider.setAttribute('aria-hidden', 'true');
    return divider;
  }

  private createActions(): ToolbarAction[] {
    const ed = () => this.editor();

    const colorActions: ToolbarAction[] = TEXT_COLORS.map((item) => ({
      group: 'color',
      title: `Color ${item.title}`,
      label: `<span class="cde-toolbar__swatch" style="background:${item.color}"></span>`,
      isActive: () => ed()?.isActive('textStyle', { color: item.color }) ?? false,
      run: () => ed()?.chain().focus().setColor(item.color).run(),
    }));

    const highlightActions: ToolbarAction[] = HIGHLIGHT_COLORS.map((item) => ({
      group: 'highlight',
      title: item.title,
      label: `<span class="cde-toolbar__swatch cde-toolbar__swatch--border" style="background:${item.color}"></span>`,
      isActive: () =>
        ed()?.isActive('highlight', { color: item.color }) ?? false,
      run: () =>
        ed()?.chain().focus().toggleHighlight({ color: item.color }).run(),
    }));

    return [
      {
        group: 'history',
        title: 'Deshacer',
        label: icon(
          '<path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isDisabled: () => !(ed()?.can().undo() ?? false),
        run: () => ed()?.chain().focus().undo().run(),
      },
      {
        group: 'history',
        title: 'Rehacer',
        label: icon(
          '<path d="M15 14l5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 9H10a6 6 0 0 0 0 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isDisabled: () => !(ed()?.can().redo() ?? false),
        run: () => ed()?.chain().focus().redo().run(),
      },
      {
        group: 'marks',
        title: 'Negrita',
        label: '<span class="cde-toolbar__text"><strong>B</strong></span>',
        isActive: () => ed()?.isActive('bold') ?? false,
        run: () => ed()?.chain().focus().toggleBold().run(),
      },
      {
        group: 'marks',
        title: 'Cursiva',
        label: '<span class="cde-toolbar__text"><em>I</em></span>',
        isActive: () => ed()?.isActive('italic') ?? false,
        run: () => ed()?.chain().focus().toggleItalic().run(),
      },
      {
        group: 'marks',
        title: 'Subrayado',
        label:
          '<span class="cde-toolbar__text" style="text-decoration:underline">U</span>',
        isActive: () => ed()?.isActive('underline') ?? false,
        run: () => ed()?.chain().focus().toggleUnderline().run(),
      },
      {
        group: 'marks',
        title: 'Tachado',
        label: '<span class="cde-toolbar__text"><s>S</s></span>',
        isActive: () => ed()?.isActive('strike') ?? false,
        run: () => ed()?.chain().focus().toggleStrike().run(),
      },
      {
        group: 'marks',
        title: 'Código',
        label: '<span class="cde-toolbar__text">&lt;/&gt;</span>',
        isActive: () => ed()?.isActive('code') ?? false,
        run: () => ed()?.chain().focus().toggleCode().run(),
      },
      {
        group: 'script',
        title: 'Subíndice',
        label: '<span class="cde-toolbar__text">X<sub>2</sub></span>',
        isActive: () => ed()?.isActive('subscript') ?? false,
        run: () => ed()?.chain().focus().toggleSubscript().run(),
      },
      {
        group: 'script',
        title: 'Superíndice',
        label: '<span class="cde-toolbar__text">X<sup>2</sup></span>',
        isActive: () => ed()?.isActive('superscript') ?? false,
        run: () => ed()?.chain().focus().toggleSuperscript().run(),
      },
      ...colorActions,
      {
        group: 'color',
        title: 'Quitar color',
        label: '<span class="cde-toolbar__text">∅</span>',
        run: () => ed()?.chain().focus().unsetColor().run(),
      },
      ...highlightActions,
      {
        group: 'highlight',
        title: 'Quitar resaltado',
        label: '<span class="cde-toolbar__text">∅</span>',
        run: () => ed()?.chain().focus().unsetHighlight().run(),
      },
      {
        group: 'headings',
        title: 'Título 1',
        label: '<span class="cde-toolbar__text">H1</span>',
        isActive: () => ed()?.isActive('heading', { level: 1 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        group: 'headings',
        title: 'Título 2',
        label: '<span class="cde-toolbar__text">H2</span>',
        isActive: () => ed()?.isActive('heading', { level: 2 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        group: 'headings',
        title: 'Título 3',
        label: '<span class="cde-toolbar__text">H3</span>',
        isActive: () => ed()?.isActive('heading', { level: 3 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        group: 'headings',
        title: 'Párrafo',
        label: '<span class="cde-toolbar__text">P</span>',
        isActive: () => ed()?.isActive('paragraph') ?? false,
        run: () => ed()?.chain().focus().setParagraph().run(),
      },
      {
        group: 'blocks',
        title: 'Cita',
        label: '<span class="cde-toolbar__text">“”</span>',
        isActive: () => ed()?.isActive('blockquote') ?? false,
        run: () => ed()?.chain().focus().toggleBlockquote().run(),
      },
      {
        group: 'blocks',
        title: 'Bloque de código',
        label: '<span class="cde-toolbar__text">{ }</span>',
        isActive: () => ed()?.isActive('codeBlock') ?? false,
        run: () => ed()?.chain().focus().toggleCodeBlock().run(),
      },
      {
        group: 'blocks',
        title: 'Línea horizontal',
        label: '<span class="cde-toolbar__text">―</span>',
        run: () => ed()?.chain().focus().setHorizontalRule().run(),
      },
      {
        group: 'lists',
        title: 'Lista con viñetas',
        label: icon(
          '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor"/>',
        ),
        isActive: () => ed()?.isActive('bulletList') ?? false,
        run: () => ed()?.chain().focus().toggleBulletList().run(),
      },
      {
        group: 'lists',
        title: 'Lista numerada',
        label: icon(
          '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="2" y="8" font-size="7" fill="currentColor" font-family="sans-serif">1</text><text x="2" y="14" font-size="7" fill="currentColor" font-family="sans-serif">2</text><text x="2" y="20" font-size="7" fill="currentColor" font-family="sans-serif">3</text>',
        ),
        isActive: () => ed()?.isActive('orderedList') ?? false,
        run: () => ed()?.chain().focus().toggleOrderedList().run(),
      },
      {
        group: 'lists',
        title: 'Lista de tareas',
        label: icon(
          '<rect x="3" y="5" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 8l1.2 1.2L8.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8h9M12 16h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="13" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>',
        ),
        isActive: () => ed()?.isActive('taskList') ?? false,
        run: () => ed()?.chain().focus().toggleTaskList().run(),
      },
      {
        group: 'align',
        title: 'Alinear a la izquierda',
        label: icon(
          '<path d="M4 6h16M4 12h10M4 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'left' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('left').run(),
      },
      {
        group: 'align',
        title: 'Centrar',
        label: icon(
          '<path d="M4 6h16M7 12h10M5 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'center' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('center').run(),
      },
      {
        group: 'align',
        title: 'Alinear a la derecha',
        label: icon(
          '<path d="M4 6h16M10 12h10M6 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'right' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('right').run(),
      },
      {
        group: 'align',
        title: 'Justificar',
        label: icon(
          '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'justify' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('justify').run(),
      },
      {
        group: 'insert',
        title: 'Enlace',
        label: icon(
          '<path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.76" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 18.24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive('link') ?? false,
        run: () => {
          const editor = ed();
          if (!editor) return;
          const previous = editor.getAttributes('link').href as
            | string
            | undefined;
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
        },
      },
      {
        group: 'insert',
        title: 'Imagen',
        label: icon(
          '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor"/><path d="M21 16l-5-5-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        ),
        run: () => {
          const url = window.prompt('URL de la imagen');
          if (!url?.trim()) return;
          ed()?.chain().focus().setImage({ src: url.trim() }).run();
        },
      },
      {
        group: 'insert',
        title: 'Salto duro de línea',
        label: '<span class="cde-toolbar__text">↵</span>',
        run: () => ed()?.chain().focus().setHardBreak().run(),
      },
      {
        group: 'table',
        title: 'Insertar tabla 3×3',
        label: icon(
          '<rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M3 16h18M9 4v16M15 4v16" fill="none" stroke="currentColor" stroke-width="2"/>',
        ),
        run: () =>
          ed()
            ?.chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        group: 'table',
        title: 'Añadir fila',
        label: '<span class="cde-toolbar__text">+F</span>',
        isDisabled: () => !(ed()?.can().addRowAfter() ?? false),
        run: () => ed()?.chain().focus().addRowAfter().run(),
      },
      {
        group: 'table',
        title: 'Añadir columna',
        label: '<span class="cde-toolbar__text">+C</span>',
        isDisabled: () => !(ed()?.can().addColumnAfter() ?? false),
        run: () => ed()?.chain().focus().addColumnAfter().run(),
      },
      {
        group: 'table',
        title: 'Eliminar tabla',
        label: '<span class="cde-toolbar__text">−T</span>',
        isDisabled: () => !(ed()?.can().deleteTable() ?? false),
        run: () => ed()?.chain().focus().deleteTable().run(),
      },
      {
        group: 'font',
        title: 'Fuente Times',
        label: '<span class="cde-toolbar__text">Times</span>',
        isActive: () =>
          ed()?.isActive('textStyle', {
            fontFamily: '"Times New Roman", Times, serif',
          }) ?? false,
        run: () =>
          ed()
            ?.chain()
            .focus()
            .setFontFamily('"Times New Roman", Times, serif')
            .run(),
      },
      {
        group: 'font',
        title: 'Fuente Arial',
        label: '<span class="cde-toolbar__text">Arial</span>',
        isActive: () =>
          ed()?.isActive('textStyle', { fontFamily: 'Arial, sans-serif' }) ??
          false,
        run: () =>
          ed()?.chain().focus().setFontFamily('Arial, sans-serif').run(),
      },
      {
        group: 'font',
        title: 'Fuente Courier',
        label: '<span class="cde-toolbar__text">Mono</span>',
        isActive: () =>
          ed()?.isActive('textStyle', {
            fontFamily: '"Courier New", monospace',
          }) ?? false,
        run: () =>
          ed()
            ?.chain()
            .focus()
            .setFontFamily('"Courier New", monospace')
            .run(),
      },
      {
        group: 'font',
        title: 'Quitar fuente',
        label: '<span class="cde-toolbar__text">∅</span>',
        run: () => ed()?.chain().focus().unsetFontFamily().run(),
      },
    ];
  }

  private syncState(): void {
    const hasEditor = !!this.editor();
    for (const [button, action] of this.buttons) {
      const active = action.isActive?.() ?? false;
      const disabled = !hasEditor || (action.isDisabled?.() ?? false);

      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.disabled = disabled;
    }
  }
}

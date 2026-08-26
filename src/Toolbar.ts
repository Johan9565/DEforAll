import type { Editor } from '@tiptap/core';
import {
  changeSelectionCase,
  FONT_SIZE_STEPS,
  parseFontSizePx,
  stepFontSizePx,
  type CaseMode,
} from './pages/textFormat';
import { sortSelectedBlocks } from './pages/sortBlocks';
import {
  findTextMatches,
  replaceAllTextMatches,
  replaceTextMatch,
  selectTextMatch,
  type DocumentSearchMatch,
} from './pages/findReplace';

export interface DocumentSearchApi {
  find: (term: string, caseSensitive: boolean) => DocumentSearchMatch[];
  goTo: (match: DocumentSearchMatch) => void;
  replace: (match: DocumentSearchMatch, replacement: string) => void;
  replaceAll: (
    term: string,
    replacement: string,
    caseSensitive: boolean,
  ) => number;
}

export interface ToolbarOptions {
  getEditor?: () => Editor | null;
  /** @deprecated Use getEditor for virtualized pages. */
  editor?: Editor;
  container: HTMLElement;
  documentTitle?: string;
  /** Cross-page find / replace (preferred over active-editor-only search). */
  documentSearch?: DocumentSearchApi;
}

type TabId = 'home' | 'insert' | 'layout' | 'view';

interface ToolbarAction {
  title: string;
  label: string;
  className?: string;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
  run: () => void;
}

interface ComboOption {
  label: string;
  value: string;
  style?: string;
}

interface ComboSelect {
  root: HTMLElement;
  getValue: () => string;
  setValue: (value: string) => void;
  setDisabled: (disabled: boolean) => void;
}

const icon = (paths: string, viewBox = '0 0 24 24'): string =>
  `<svg class="size-3.5 shrink-0" viewBox="${viewBox}" aria-hidden="true" focusable="false">${paths}</svg>`;

const CHEVRON = `<svg class="cde-tb-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BTN_SPLIT =
  'cde-tb-btn cde-tb-btn--split inline-flex items-center justify-center rounded-sm border border-transparent text-neutral-800 hover:bg-neutral-300/80 disabled:opacity-40 disabled:cursor-not-allowed';

const FONT_FAMILIES: ComboOption[] = [
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif', style: 'font-family:"Times New Roman",Times,serif' },
  { label: 'Arial', value: 'Arial, sans-serif', style: 'font-family:Arial,sans-serif' },
  { label: 'Calibri', value: 'Calibri, "Segoe UI", sans-serif', style: 'font-family:Calibri,"Segoe UI",sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif', style: 'font-family:Georgia,serif' },
  { label: 'Courier New', value: '"Courier New", monospace', style: 'font-family:"Courier New",monospace' },
];

const FONT_SIZES: ComboOption[] = FONT_SIZE_STEPS.map((size) => ({
  label: String(size),
  value: `${size}px`,
}));

/** Theme palette for font color (Word-like). */
const TEXT_COLORS = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#ffffff',
  '#980000',
  '#ff0000',
  '#ff9900',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#4a86e8',
  '#0000ff',
  '#9900ff',
  '#ff00ff',
  '#e6b8af',
  '#f4cccc',
  '#fce5cd',
  '#fff2cc',
  '#d9ead3',
  '#d0e0e3',
  '#c9daf8',
  '#cfe2f3',
  '#d9d2e9',
  '#ead1dc',
  '#dd7e6b',
  '#ea9999',
  '#f9cb9c',
  '#ffe599',
  '#b6d7a8',
  '#a2c4c9',
  '#a4c2f4',
  '#9fc5e8',
  '#b4a7d6',
  '#d5a6bd',
  '#cc4125',
  '#e06666',
  '#f6b26b',
  '#ffd966',
  '#93c47d',
  '#76a5af',
  '#6d9eeb',
  '#6fa8dc',
  '#8e7cc3',
  '#c27ba0',
  '#a61c00',
  '#cc0000',
  '#e69138',
  '#f1c232',
  '#6aa84f',
  '#45818e',
  '#3c78d8',
  '#3d85c6',
  '#674ea7',
  '#a64d79',
] as const;

/** Highlight / “subrayado” colors. */
const HIGHLIGHT_COLORS = [
  '#fef08a',
  '#fde047',
  '#bbf7d0',
  '#86efac',
  '#bfdbfe',
  '#93c5fd',
  '#fbcfe8',
  '#f9a8d4',
  '#fdba74',
  '#fecaca',
  '#e9d5ff',
  '#d1d5db',
  '#ffffff',
  '#000000',
] as const;

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Inicio' },
  { id: 'insert', label: 'Insertar' },
  { id: 'layout', label: 'Disposición' },
  { id: 'view', label: 'Vista' },
];

const BTN =
  'cde-tb-btn inline-flex items-center justify-center size-6 rounded-sm border border-transparent text-neutral-800 hover:bg-neutral-300/80 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ribbon-accent';
const BTN_LG =
  'cde-tb-btn cde-tb-btn--lg inline-flex flex-col items-center justify-center gap-0.5 min-w-[2.75rem] h-auto min-h-[2.75rem] px-1.5 py-1 rounded-sm border border-transparent text-neutral-800 hover:bg-neutral-300/80 disabled:opacity-40 disabled:cursor-not-allowed';
const QAT =
  'cde-tb-qat inline-flex items-center justify-center size-6 rounded-sm text-white/95 hover:bg-ribbon-titleHover disabled:opacity-45 disabled:cursor-not-allowed';
const STYLE_BTN =
  'cde-tb-style relative inline-flex h-12 w-[4.75rem] shrink-0 flex-col items-center justify-start overflow-hidden rounded border border-neutral-300 bg-white px-1 pb-3.5 pt-1 hover:border-blue-300 disabled:opacity-40';

/**
 * Compact Word-style ribbon using Tailwind utilities + custom combo selects.
 */
export class Toolbar {
  private readonly root: HTMLElement;
  private readonly getEditor: () => Editor | null;
  private readonly buttons = new Map<HTMLButtonElement, ToolbarAction>();
  private readonly onUpdate: () => void;
  private readonly onDocPointerDown: (event: PointerEvent) => void;
  private boundEditor: Editor | null = null;
  private pageCountEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private fontFamilyCombo: ComboSelect | null = null;
  private fontSizeCombo: ComboSelect | null = null;
  private findPanel: HTMLElement | null = null;
  private findInput: HTMLInputElement | null = null;
  private replaceInput: HTMLInputElement | null = null;
  private findStatusEl: HTMLElement | null = null;
  private findCaseSensitive = false;
  private findMatches: DocumentSearchMatch[] = [];
  private findIndex = -1;
  private readonly documentSearch: DocumentSearchApi | null;
  private activeTab: TabId = 'home';
  private readonly panels = new Map<TabId, HTMLElement>();
  private readonly tabButtons = new Map<TabId, HTMLButtonElement>();
  private openCombo: HTMLElement | null = null;

  constructor(options: ToolbarOptions) {
    this.getEditor = options.getEditor ?? (() => options.editor ?? null);
    this.documentSearch = options.documentSearch ?? null;
    this.root = document.createElement('div');
    this.root.className =
      'cde-toolbar sticky top-0 z-30 flex w-full flex-col border-b border-ribbon-line bg-ribbon-bg font-ui text-[11px] text-neutral-800 shadow-sm';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Cinta de formato');

    this.onDocPointerDown = (event) => {
      if (this.findPanel && !this.findPanel.classList.contains('hidden')) {
        if (this.findPanel.contains(event.target as Node)) return;
        // Keep find panel open when clicking the document; only close via × / Esc
      }
      if (!this.openCombo) return;
      if (this.openCombo.contains(event.target as Node)) return;
      this.closeCombos();
    };
    document.addEventListener('pointerdown', this.onDocPointerDown, true);

    this.build(options.documentTitle ?? 'Documento');
    options.container.prepend(this.root);

    this.onUpdate = () => this.syncState();
    this.notifyEditorChanged();
    this.syncState();
  }

  public getElement(): HTMLElement {
    return this.root;
  }

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
    if (!this.pageCountEl) return;
    this.pageCountEl.textContent =
      pageCount === 1 ? '1 página' : `${pageCount} páginas`;
  }

  public setDocumentStats(stats: { characters: number; words: number }): void {
    if (!this.statsEl) return;
    this.statsEl.textContent = `${stats.words} pal. · ${stats.characters} car.`;
  }

  public destroy(): void {
    document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    if (this.boundEditor) {
      this.boundEditor.off('selectionUpdate', this.onUpdate);
      this.boundEditor.off('transaction', this.onUpdate);
    }
    this.closeFindPanel();
    this.root.remove();
    this.buttons.clear();
  }

  private editor(): Editor | null {
    return this.getEditor();
  }

  private build(documentTitle: string): void {
    this.root.appendChild(this.buildTitleBar(documentTitle));
    this.root.appendChild(this.buildTabList());
    this.root.appendChild(this.buildRibbonBody());
  }

  private buildTitleBar(title: string): HTMLElement {
    const bar = document.createElement('div');
    bar.className =
      'flex items-center justify-between gap-2 bg-ribbon-title px-2 py-1 text-white';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-0.5';

    for (const action of [
      {
        title: 'Deshacer',
        label: icon(
          '<path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isDisabled: () => !(this.editor()?.can().undo() ?? false),
        run: () => this.editor()?.chain().focus().undo().run(),
      },
      {
        title: 'Rehacer',
        label: icon(
          '<path d="M15 14l5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 9H10a6 6 0 0 0 0 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isDisabled: () => !(this.editor()?.can().redo() ?? false),
        run: () => this.editor()?.chain().focus().redo().run(),
      },
    ]) {
      left.appendChild(this.createButton(action, QAT));
    }

    const name = document.createElement('p');
    name.className =
      'm-0 min-w-0 flex-1 truncate px-2 text-center text-xs font-semibold';
    name.textContent = title;

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2';
    this.statsEl = document.createElement('span');
    this.statsEl.className = 'whitespace-nowrap text-[10px] font-semibold text-white/90';
    this.pageCountEl = document.createElement('span');
    this.pageCountEl.className =
      'whitespace-nowrap text-[10px] font-semibold text-white/90';
    right.append(this.statsEl, this.pageCountEl);

    bar.append(left, name, right);
    return bar;
  }

  private buildTabList(): HTMLElement {
    const list = document.createElement('div');
    list.className =
      'flex flex-wrap items-end gap-0 border-b border-transparent bg-ribbon-bg px-2';
    list.setAttribute('role', 'tablist');

    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'relative mx-1.5 border-0 bg-transparent px-0.5 py-1 text-[12px] text-neutral-800 hover:font-semibold';
      btn.setAttribute('role', 'tab');
      btn.setAttribute(
        'aria-selected',
        tab.id === this.activeTab ? 'true' : 'false',
      );
      btn.dataset.tab = tab.id;
      btn.textContent = tab.label;
      if (tab.id === this.activeTab) {
        btn.classList.add('font-semibold', 'after:absolute', 'after:inset-x-0', 'after:bottom-0', 'after:border-b-2', 'after:border-ribbon-accent', 'after:rounded-sm');
      }

      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => this.setActiveTab(tab.id));

      this.tabButtons.set(tab.id, btn);
      list.appendChild(btn);
    }

    return list;
  }

  private buildRibbonBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'min-h-ribbon bg-ribbon-bg';

    const home = this.buildHomePanel();
    const insert = this.buildInsertPanel();
    const layout = this.buildLayoutPanel();
    const view = this.buildViewPanel();

    this.panels.set('home', home);
    this.panels.set('insert', insert);
    this.panels.set('layout', layout);
    this.panels.set('view', view);

    for (const [id, panel] of this.panels) {
      panel.hidden = id !== this.activeTab;
      body.appendChild(panel);
    }

    return body;
  }

  private setActiveTab(id: TabId): void {
    this.activeTab = id;
    this.closeCombos();
    const selected =
      'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:border-b-2 after:border-ribbon-accent after:rounded-sm';
    for (const [tabId, btn] of this.tabButtons) {
      const on = tabId === id;
      btn.classList.toggle('font-semibold', on);
      for (const cls of selected.split(' ')) {
        if (cls) btn.classList.toggle(cls, on);
      }
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const [tabId, panel] of this.panels) {
      panel.hidden = tabId !== id;
    }
  }

  private buildHomePanel(): HTMLElement {
    const panel = this.createPanel('home');
    const ed = () => this.editor();

    const clipboard = this.createSection('Portapapeles');
    const clipRows = document.createElement('div');
    clipRows.className = 'flex items-center gap-1';
    clipRows.appendChild(
      this.createButton(
        {
          title: 'Deshacer',
          label:
            icon(
              '<path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
            ) + '<span class="text-[10px] font-medium leading-none">Deshacer</span>',
          isDisabled: () => !(ed()?.can().undo() ?? false),
          run: () => ed()?.chain().focus().undo().run(),
        },
        BTN_LG,
      ),
    );
    const clipStack = document.createElement('div');
    clipStack.className = 'flex flex-col gap-0.5';
    clipStack.append(
      this.createButton({
        title: 'Rehacer',
        label: icon(
          '<path d="M15 14l5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 9H10a6 6 0 0 0 0 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isDisabled: () => !(ed()?.can().redo() ?? false),
        run: () => ed()?.chain().focus().redo().run(),
      }),
      this.createButton({
        title: 'Limpiar formato',
        label: icon(
          '<path d="M4 7h16M9 7V5h6v2M10 11v8M14 11v8M6 7l1 12h10l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        ),
        run: () =>
          ed()?.chain().focus().unsetAllMarks().clearNodes().run(),
      }),
    );
    clipRows.appendChild(clipStack);
    clipboard.querySelector('[data-section-body]')!.appendChild(clipRows);
    panel.appendChild(clipboard);

    const font = this.createSection('Fuente');
    const fontBody = font.querySelector('[data-section-body]')!;
    const fontTop = document.createElement('div');
    fontTop.className = 'flex items-center gap-1';

    this.fontFamilyCombo = this.createCombo({
      title: 'Fuente',
      options: FONT_FAMILIES,
      value: FONT_FAMILIES[0]!.value,
      wide: true,
      onChange: (value) => {
        ed()?.chain().focus().setFontFamily(value).run();
        this.syncState();
      },
    });
    this.fontSizeCombo = this.createCombo({
      title: 'Tamaño',
      options: FONT_SIZES,
      value: '12px',
      narrow: true,
      onChange: (value) => {
        ed()?.chain().focus().setFontSize(value).run();
        this.syncState();
      },
    });
    this.fontFamilyCombo.root.classList.add('cde-combo--font');
    this.fontSizeCombo.root.classList.add('cde-combo--size');

    const bumpSize = (direction: 1 | -1) => {
      const editor = ed();
      if (!editor) return;
      const current = parseFontSizePx(
        (editor.getAttributes('textStyle').fontSize as string | undefined) ??
          this.fontSizeCombo?.getValue(),
      );
      const next = stepFontSizePx(current, direction);
      const value = `${next}px`;
      editor.chain().focus().setFontSize(value).run();
      this.fontSizeCombo?.setValue(value);
      this.syncState();
    };

    fontTop.append(
      this.fontFamilyCombo.root,
      this.fontSizeCombo.root,
      this.createButton({
        title: 'Aumentar tamaño de fuente',
        label: icon(
          '<path d="M4 18V6h2.8l5 9.5L17.6 6H20v12h-2.2v-7.2L13.2 18h-1.6l-4.6-7.2V18H4z" fill="currentColor"/><path d="M19 4v3M17.5 5.5h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        ),
        run: () => bumpSize(1),
      }),
      this.createButton({
        title: 'Disminuir tamaño de fuente',
        label: icon(
          '<path d="M4 18V6h2.8l5 9.5L17.6 6H20v12h-2.2v-7.2L13.2 18h-1.6l-4.6-7.2V18H4z" fill="currentColor"/><path d="M17.5 5.5h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        ),
        run: () => bumpSize(-1),
      }),
    );
    fontBody.appendChild(fontTop);

    const fontMarks = document.createElement('div');
    fontMarks.className = 'flex flex-wrap items-center gap-0.5';
    fontMarks.append(
      this.createButton({
        title: 'Negrita',
        label: '<span class="text-xs font-bold">B</span>',
        isActive: () => ed()?.isActive('bold') ?? false,
        run: () => ed()?.chain().focus().toggleBold().run(),
      }),
      this.createButton({
        title: 'Cursiva',
        label: '<span class="text-xs font-bold italic">I</span>',
        isActive: () => ed()?.isActive('italic') ?? false,
        run: () => ed()?.chain().focus().toggleItalic().run(),
      }),
      this.createButton({
        title: 'Subrayado',
        label: '<span class="text-xs font-bold underline">U</span>',
        isActive: () => ed()?.isActive('underline') ?? false,
        run: () => ed()?.chain().focus().toggleUnderline().run(),
      }),
      this.createButton({
        title: 'Tachado',
        label: '<span class="text-xs font-bold line-through">S</span>',
        isActive: () => ed()?.isActive('strike') ?? false,
        run: () => ed()?.chain().focus().toggleStrike().run(),
      }),
      this.createButton({
        title: 'Subíndice',
        label: '<span class="text-xs font-bold">X<sub class="text-[9px]">2</sub></span>',
        isActive: () => ed()?.isActive('subscript') ?? false,
        run: () => ed()?.chain().focus().toggleSubscript().run(),
      }),
      this.createButton({
        title: 'Superíndice',
        label: '<span class="text-xs font-bold">X<sup class="text-[9px]">2</sup></span>',
        isActive: () => ed()?.isActive('superscript') ?? false,
        run: () => ed()?.chain().focus().toggleSuperscript().run(),
      }),
      this.createCaseMenu(),
      this.createColorMenu({
        kind: 'text',
        title: 'Color de fuente',
        colors: TEXT_COLORS,
        getActive: () =>
          (ed()?.getAttributes('textStyle').color as string | undefined) ?? null,
        apply: (color) => {
          if (!color) ed()?.chain().focus().unsetColor().run();
          else ed()?.chain().focus().setColor(color).run();
        },
      }),
      this.createColorMenu({
        kind: 'highlight',
        title: 'Color de resaltado',
        colors: HIGHLIGHT_COLORS,
        getActive: () =>
          (ed()?.getAttributes('highlight').color as string | undefined) ??
          (ed()?.isActive('highlight') ? '#fef08a' : null),
        apply: (color) => {
          if (!color) ed()?.chain().focus().unsetHighlight().run();
          else ed()?.chain().focus().setHighlight({ color }).run();
        },
      }),
    );
    fontBody.appendChild(fontMarks);
    panel.appendChild(font);

    const para = this.createSection('Párrafo');
    const paraBody = para.querySelector('[data-section-body]')!;
    const listRow = document.createElement('div');
    listRow.className = 'flex flex-wrap items-center gap-0.5';
    listRow.append(
      this.createButton({
        title: 'Viñetas',
        label: icon(
          '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor"/>',
        ),
        isActive: () => ed()?.isActive('bulletList') ?? false,
        run: () => ed()?.chain().focus().toggleBulletList().run(),
      }),
      this.createButton({
        title: 'Numeración',
        label: icon(
          '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="2" y="8" font-size="7" fill="currentColor" font-family="sans-serif">1</text><text x="2" y="14" font-size="7" fill="currentColor" font-family="sans-serif">2</text><text x="2" y="20" font-size="7" fill="currentColor" font-family="sans-serif">3</text>',
        ),
        isActive: () => ed()?.isActive('orderedList') ?? false,
        run: () => ed()?.chain().focus().toggleOrderedList().run(),
      }),
      this.createButton({
        title: 'Lista de tareas',
        label: icon(
          '<rect x="3" y="5" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 8l1.2 1.2L8.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8h9M12 16h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="13" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>',
        ),
        isActive: () => ed()?.isActive('taskList') ?? false,
        run: () => ed()?.chain().focus().toggleTaskList().run(),
      }),
      this.createButton({
        title: 'Aumentar sangría',
        label: icon(
          '<path d="M4 6h16M10 12h10M10 18h10M4 10v8l4-4-4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        ),
        run: () => ed()?.chain().focus().indent().run(),
      }),
      this.createButton({
        title: 'Disminuir sangría',
        label: icon(
          '<path d="M4 6h16M4 12h10M4 18h10M20 10v8l-4-4 4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        ),
        run: () => ed()?.chain().focus().outdent().run(),
      }),
    );
    paraBody.appendChild(listRow);

    const alignRow = document.createElement('div');
    alignRow.className = 'flex flex-wrap items-center gap-0.5';
    alignRow.append(
      this.createButton({
        title: 'Alinear a la izquierda',
        label: icon(
          '<path d="M4 6h16M4 12h10M4 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'left' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('left').run(),
      }),
      this.createButton({
        title: 'Centrar',
        label: icon(
          '<path d="M4 6h16M7 12h10M5 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'center' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('center').run(),
      }),
      this.createButton({
        title: 'Alinear a la derecha',
        label: icon(
          '<path d="M4 6h16M10 12h10M6 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'right' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('right').run(),
      }),
      this.createButton({
        title: 'Justificar',
        label: icon(
          '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'justify' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('justify').run(),
      }),
      this.createLineSpacingMenu(),
      this.createSortMenu(),
    );
    paraBody.appendChild(alignRow);
    panel.appendChild(para);

    const styles = this.createSection('Estilos');
    const gallery = document.createElement('div');
    gallery.className =
      'flex max-w-[min(34rem,68vw)] items-stretch gap-1 overflow-x-auto rounded-md border border-neutral-300 bg-white p-1';
    const styleItems = [
      {
        name: 'Normal',
        preview: 'text-[12px] text-neutral-800',
        active: () => ed()?.isActive('paragraph') ?? false,
        run: () => ed()?.chain().focus().setParagraph().run(),
      },
      {
        name: 'Título 1',
        preview: 'text-[15px] font-bold text-ribbon-title',
        active: () => ed()?.isActive('heading', { level: 1 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        name: 'Título 2',
        preview: 'text-[13px] font-bold text-ribbon-accent',
        active: () => ed()?.isActive('heading', { level: 2 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        name: 'Título 3',
        preview: 'text-[12px] font-bold',
        active: () => ed()?.isActive('heading', { level: 3 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        name: 'Título 4',
        preview: 'text-[11px] font-semibold italic',
        active: () => ed()?.isActive('heading', { level: 4 }) ?? false,
        run: () => ed()?.chain().focus().toggleHeading({ level: 4 }).run(),
      },
    ];
    for (const item of styleItems) {
      gallery.appendChild(
        this.createButton(
          {
            title: item.name,
            label: `<span class="leading-tight ${item.preview}">AaBbCc</span><span class="absolute inset-x-0 bottom-0 bg-neutral-100 py-px text-center text-[9px] font-medium text-neutral-700">${item.name}</span>`,
            isActive: item.active,
            run: item.run,
          },
          STYLE_BTN,
        ),
      );
    }
    styles.querySelector('[data-section-body]')!.appendChild(gallery);
    panel.appendChild(styles);

    panel.appendChild(this.createEditingSection());

    return panel;
  }

  private createEditingSection(): HTMLElement {
    const editing = this.createSection('Edición');
    const body = editing.querySelector('[data-section-body]')!;
    const row = document.createElement('div');
    row.className = 'cde-editing-row flex items-stretch gap-1';

    row.append(
      this.createButton(
        {
          title: 'Buscar',
          label:
            icon(
              '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
            ) + '<span class="text-[10px] font-medium leading-none">Buscar</span>',
          run: () => this.openFindPanel('find'),
        },
        BTN_LG,
      ),
      this.createButton(
        {
          title: 'Reemplazar',
          label:
            icon(
              '<path d="M4 7h10M4 12h7M4 17h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 9l3 3-3 3M19 12H12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
            ) + '<span class="text-[10px] font-medium leading-none">Reemplazar</span>',
          run: () => this.openFindPanel('replace'),
        },
        BTN_LG,
      ),
      this.createSelectMenu(),
    );

    body.appendChild(row);
    return editing;
  }

  private createSelectMenu(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cde-combo cde-select-menu relative';
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Seleccionar';
    trigger.className = BTN_LG;
    trigger.innerHTML =
      icon(
        '<path d="M5 4l6 16 2-6 6-2L5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      ) +
      '<span class="inline-flex items-center gap-0.5 text-[10px] font-medium leading-none">Seleccionar<span class="cde-tb-btn__caret inline-flex">' +
      CHEVRON +
      '</span></span>';

    const menu = document.createElement('ul');
    menu.className =
      'cde-combo__menu absolute left-0 top-[calc(100%+2px)] z-50 hidden min-w-[11rem] overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5';
    menu.setAttribute('role', 'menu');

    const items: { label: string; run: () => void }[] = [
      {
        label: 'Seleccionar todo',
        run: () => this.editor()?.chain().focus().selectAll().run(),
      },
      {
        label: 'Seleccionar párrafo',
        run: () => {
          const editor = this.editor();
          if (!editor) return;
          const { $from } = editor.state.selection;
          const start = $from.start($from.depth);
          const end = $from.end($from.depth);
          editor
            .chain()
            .focus()
            .setTextSelection({ from: start, to: end })
            .run();
        },
      },
    ];

    for (const item of items) {
      const li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      li.className =
        'cde-menu-item cursor-pointer px-2.5 py-1.5 text-[11px] text-neutral-800 hover:bg-neutral-100';
      li.textContent = item.label;
      li.addEventListener('mousedown', (e) => e.preventDefault());
      li.addEventListener('click', () => {
        item.run();
        this.closeCombos();
        this.syncState();
      });
      menu.appendChild(li);
    }

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    this.buttons.set(trigger, {
      title: 'Seleccionar',
      label: '',
      run: () => undefined,
    });
    return root;
  }

  private ensureFindPanel(): HTMLElement {
    if (this.findPanel) return this.findPanel;

    const panel = document.createElement('div');
    panel.className = 'cde-find-panel hidden';
    panel.setAttribute('role', 'search');
    panel.setAttribute('aria-label', 'Buscar y reemplazar');

    const findRow = document.createElement('div');
    findRow.className = 'cde-find-panel__row';

    this.findInput = document.createElement('input');
    this.findInput.type = 'search';
    this.findInput.className = 'cde-find-panel__input';
    this.findInput.placeholder = 'Buscar…';
    this.findInput.autocomplete = 'off';

    this.findStatusEl = document.createElement('span');
    this.findStatusEl.className = 'cde-find-panel__status';
    this.findStatusEl.textContent = '';

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'cde-find-panel__btn cde-find-panel__btn--text';
    searchBtn.textContent = 'Buscar';
    searchBtn.title = 'Buscar';
    searchBtn.addEventListener('click', () => this.runFind(true));

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'cde-find-panel__btn';
    prevBtn.title = 'Anterior';
    prevBtn.textContent = '↑';
    prevBtn.addEventListener('click', () => this.findStep(-1));

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'cde-find-panel__btn';
    nextBtn.title = 'Siguiente';
    nextBtn.textContent = '↓';
    nextBtn.addEventListener('click', () => this.findStep(1));

    const caseBtn = document.createElement('button');
    caseBtn.type = 'button';
    caseBtn.className = 'cde-find-panel__btn cde-find-panel__btn--toggle';
    caseBtn.title = 'Coincidir mayúsculas/minúsculas';
    caseBtn.textContent = 'Aa';
    caseBtn.addEventListener('click', () => {
      this.findCaseSensitive = !this.findCaseSensitive;
      caseBtn.classList.toggle('is-active', this.findCaseSensitive);
      // Do not jump while typing — only apply on next Buscar
      this.findMatches = [];
      this.findIndex = -1;
      if (this.findStatusEl) this.findStatusEl.textContent = '';
    });

    findRow.append(
      this.findInput,
      searchBtn,
      this.findStatusEl,
      prevBtn,
      nextBtn,
      caseBtn,
    );

    const replaceRow = document.createElement('div');
    replaceRow.className = 'cde-find-panel__row cde-find-panel__row--replace';
    replaceRow.dataset.replaceRow = 'true';

    this.replaceInput = document.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.className = 'cde-find-panel__input';
    this.replaceInput.placeholder = 'Reemplazar con…';
    this.replaceInput.autocomplete = 'off';

    const replaceOne = document.createElement('button');
    replaceOne.type = 'button';
    replaceOne.className = 'cde-find-panel__btn cde-find-panel__btn--text';
    replaceOne.textContent = 'Reemplazar';
    replaceOne.addEventListener('click', () => this.replaceCurrent());

    const replaceAll = document.createElement('button');
    replaceAll.type = 'button';
    replaceAll.className = 'cde-find-panel__btn cde-find-panel__btn--text';
    replaceAll.textContent = 'Reemplazar todo';
    replaceAll.addEventListener('click', () => this.replaceAllMatches());

    replaceRow.append(this.replaceInput, replaceOne, replaceAll);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cde-find-panel__close';
    closeBtn.title = 'Cerrar';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.closeFindPanel());

    // Typing alone must not navigate — only Buscar / Enter
    this.findInput.addEventListener('input', () => {
      this.findMatches = [];
      this.findIndex = -1;
      if (this.findStatusEl) this.findStatusEl.textContent = '';
    });
    this.findInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey && this.findMatches.length > 0) {
          this.findStep(-1);
        } else {
          this.runFind(true);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeFindPanel();
      }
    });
    this.replaceInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.replaceCurrent();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeFindPanel();
      }
    });

    panel.append(findRow, replaceRow, closeBtn);
    this.root.appendChild(panel);
    this.findPanel = panel;
    return panel;
  }

  private openFindPanel(mode: 'find' | 'replace'): void {
    this.closeCombos();
    const panel = this.ensureFindPanel();
    panel.classList.remove('hidden');
    panel.dataset.mode = mode;
    const replaceRow = panel.querySelector<HTMLElement>('[data-replace-row]');
    if (replaceRow) replaceRow.hidden = mode === 'find';
    requestAnimationFrame(() => this.findInput?.focus());
  }

  private closeFindPanel(): void {
    if (!this.findPanel) return;
    this.findPanel.classList.add('hidden');
    this.findMatches = [];
    this.findIndex = -1;
    if (this.findStatusEl) this.findStatusEl.textContent = '';
  }

  private runFind(selectFirst: boolean): void {
    const term = this.findInput?.value ?? '';
    if (!term.trim()) {
      this.findMatches = [];
      this.findIndex = -1;
      if (this.findStatusEl) this.findStatusEl.textContent = '';
      return;
    }

    if (this.documentSearch) {
      this.findMatches = this.documentSearch.find(
        term,
        this.findCaseSensitive,
      );
    } else {
      const editor = this.editor();
      if (!editor) {
        this.findMatches = [];
        this.findIndex = -1;
        if (this.findStatusEl) this.findStatusEl.textContent = '0/0';
        return;
      }
      this.findMatches = findTextMatches(
        editor,
        term,
        this.findCaseSensitive,
      ).map((m) => ({
        ...m,
        pageId: '',
        pageIndex: 0,
      }));
    }

    if (this.findMatches.length === 0) {
      this.findIndex = -1;
      if (this.findStatusEl) this.findStatusEl.textContent = '0/0';
      return;
    }

    if (
      selectFirst ||
      this.findIndex < 0 ||
      this.findIndex >= this.findMatches.length
    ) {
      this.findIndex = 0;
    }
    this.updateFindStatus();
    this.goToCurrentMatch();
  }

  private goToCurrentMatch(): void {
    const match = this.findMatches[this.findIndex];
    if (!match) return;

    if (this.documentSearch) {
      this.documentSearch.goTo(match);
      return;
    }

    const editor = this.editor();
    if (editor) selectTextMatch(editor, match);
  }

  private findStep(direction: 1 | -1): void {
    if (this.findMatches.length === 0) {
      this.runFind(true);
      return;
    }
    this.findIndex =
      (this.findIndex + direction + this.findMatches.length) %
      this.findMatches.length;
    this.updateFindStatus();
    this.goToCurrentMatch();
  }

  private updateFindStatus(): void {
    if (!this.findStatusEl) return;
    if (this.findMatches.length === 0) {
      this.findStatusEl.textContent = '0/0';
      return;
    }
    const match = this.findMatches[this.findIndex];
    const pageLabel =
      match && this.documentSearch
        ? ` · p.${match.pageIndex + 1}`
        : '';
    this.findStatusEl.textContent = `${this.findIndex + 1}/${this.findMatches.length}${pageLabel}`;
  }

  private replaceCurrent(): void {
    const term = this.findInput?.value ?? '';
    const replacement = this.replaceInput?.value ?? '';
    if (!term.trim()) return;

    if (this.findIndex < 0 || !this.findMatches[this.findIndex]) {
      this.runFind(true);
    }
    const match = this.findMatches[this.findIndex];
    if (!match) return;

    if (this.documentSearch) {
      this.documentSearch.replace(match, replacement);
    } else {
      const editor = this.editor();
      if (!editor) return;
      replaceTextMatch(editor, match, replacement);
    }

    // Re-scan document after the edit; keep nearby index
    const keepIndex = this.findIndex;
    this.runFind(false);
    if (this.findMatches.length === 0) return;
    this.findIndex = Math.min(keepIndex, this.findMatches.length - 1);
    this.updateFindStatus();
    this.goToCurrentMatch();
  }

  private replaceAllMatches(): void {
    const term = this.findInput?.value ?? '';
    const replacement = this.replaceInput?.value ?? '';
    if (!term.trim()) return;

    let count = 0;
    if (this.documentSearch) {
      count = this.documentSearch.replaceAll(
        term,
        replacement,
        this.findCaseSensitive,
      );
    } else {
      const editor = this.editor();
      if (!editor) return;
      count = replaceAllTextMatches(
        editor,
        term,
        replacement,
        this.findCaseSensitive,
      );
    }

    this.findMatches = [];
    this.findIndex = -1;
    if (this.findStatusEl) {
      this.findStatusEl.textContent =
        count === 0 ? '0/0' : `${count} reemplazo${count === 1 ? '' : 's'}`;
    }
  }

  private buildInsertPanel(): HTMLElement {
    const panel = this.createPanel('insert');
    const ed = () => this.editor();

    const links = this.createSection('Vínculos');
    links.querySelector('[data-section-body]')!.appendChild(
      this.createButton(
        {
          title: 'Enlace',
          label:
            icon(
              '<path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.76" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 18.24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
            ) + '<span class="text-[10px] font-medium">Vínculo</span>',
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
        BTN_LG,
      ),
    );
    panel.appendChild(links);

    const media = this.createSection('Ilustraciones');
    media.querySelector('[data-section-body]')!.appendChild(
      this.createButton(
        {
          title: 'Imagen',
          label:
            icon(
              '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor"/><path d="M21 16l-5-5-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
            ) + '<span class="text-[10px] font-medium">Imágenes</span>',
          run: () => {
            const url = window.prompt('URL de la imagen');
            if (!url?.trim()) return;
            ed()?.chain().focus().setImage({ src: url.trim() }).run();
          },
        },
        BTN_LG,
      ),
    );
    panel.appendChild(media);

    const tables = this.createSection('Tablas');
    const tableRow = document.createElement('div');
    tableRow.className = 'flex flex-wrap items-center gap-0.5';
    tableRow.append(
      this.createButton({
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
      }),
      this.createButton({
        title: 'Añadir fila',
        label: '<span class="text-[10px] font-bold">+F</span>',
        isDisabled: () => !(ed()?.can().addRowAfter() ?? false),
        run: () => ed()?.chain().focus().addRowAfter().run(),
      }),
      this.createButton({
        title: 'Añadir columna',
        label: '<span class="text-[10px] font-bold">+C</span>',
        isDisabled: () => !(ed()?.can().addColumnAfter() ?? false),
        run: () => ed()?.chain().focus().addColumnAfter().run(),
      }),
      this.createButton({
        title: 'Eliminar tabla',
        label: '<span class="text-[10px] font-bold">−T</span>',
        isDisabled: () => !(ed()?.can().deleteTable() ?? false),
        run: () => ed()?.chain().focus().deleteTable().run(),
      }),
    );
    tables.querySelector('[data-section-body]')!.appendChild(tableRow);
    panel.appendChild(tables);

    const blocks = this.createSection('Texto');
    const blockRow = document.createElement('div');
    blockRow.className = 'flex flex-wrap items-center gap-0.5';
    blockRow.append(
      this.createButton({
        title: 'Cita',
        label: '<span class="text-xs font-bold">“”</span>',
        isActive: () => ed()?.isActive('blockquote') ?? false,
        run: () => ed()?.chain().focus().toggleBlockquote().run(),
      }),
      this.createButton({
        title: 'Bloque de código',
        label: '<span class="text-[10px] font-bold">{ }</span>',
        isActive: () => ed()?.isActive('codeBlock') ?? false,
        run: () => ed()?.chain().focus().toggleCodeBlock().run(),
      }),
      this.createButton({
        title: 'Código en línea',
        label: '<span class="text-[10px] font-bold">&lt;/&gt;</span>',
        isActive: () => ed()?.isActive('code') ?? false,
        run: () => ed()?.chain().focus().toggleCode().run(),
      }),
      this.createButton({
        title: 'Línea horizontal',
        label: '<span class="text-xs font-bold">―</span>',
        run: () => ed()?.chain().focus().setHorizontalRule().run(),
      }),
      this.createButton({
        title: 'Salto de línea',
        label: '<span class="text-xs font-bold">↵</span>',
        run: () => ed()?.chain().focus().setHardBreak().run(),
      }),
    );
    blocks.querySelector('[data-section-body]')!.appendChild(blockRow);
    panel.appendChild(blocks);

    return panel;
  }

  private buildLayoutPanel(): HTMLElement {
    const panel = this.createPanel('layout');
    const ed = () => this.editor();
    const align = this.createSection('Alineación');
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-0.5';
    row.append(
      this.createButton({
        title: 'Izquierda',
        label: icon(
          '<path d="M4 6h16M4 12h10M4 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'left' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('left').run(),
      }),
      this.createButton({
        title: 'Centro',
        label: icon(
          '<path d="M4 6h16M7 12h10M5 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'center' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('center').run(),
      }),
      this.createButton({
        title: 'Derecha',
        label: icon(
          '<path d="M4 6h16M10 12h10M6 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'right' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('right').run(),
      }),
      this.createButton({
        title: 'Justificar',
        label: icon(
          '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        ),
        isActive: () => ed()?.isActive({ textAlign: 'justify' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('justify').run(),
      }),
    );
    align.querySelector('[data-section-body]')!.appendChild(row);
    panel.appendChild(align);

    const note = this.createSection('Página');
    const hint = document.createElement('p');
    hint.className = 'm-0 max-w-[16rem] text-[11px] leading-snug text-neutral-500';
    hint.textContent =
      'El tamaño de página (Letter / A4) se configura al crear el editor.';
    note.querySelector('[data-section-body]')!.appendChild(hint);
    panel.appendChild(note);

    return panel;
  }

  private buildViewPanel(): HTMLElement {
    const panel = this.createPanel('view');
    const info = this.createSection('Documento');
    const hint = document.createElement('p');
    hint.className = 'm-0 max-w-[18rem] text-[11px] leading-snug text-neutral-500';
    hint.textContent =
      'Las páginas se muestran como hojas independientes. Solo la página activa monta TipTap.';
    info.querySelector('[data-section-body]')!.appendChild(hint);
    panel.appendChild(info);
    return panel;
  }

  private createPanel(tabId: TabId): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'flex flex-row flex-wrap items-stretch px-1 py-1';
    panel.setAttribute('role', 'tabpanel');
    panel.dataset.tab = tabId;
    return panel;
  }

  private createSection(label: string): HTMLElement {
    const section = document.createElement('div');
    section.className =
      'flex min-h-[4.25rem] flex-col justify-between border-l border-ribbon-line px-2 py-1 first:border-l-0';

    const body = document.createElement('div');
    body.className = 'flex flex-1 flex-col justify-center gap-1';
    body.dataset.sectionBody = '';

    const caption = document.createElement('p');
    caption.className =
      'm-0 mt-1 text-center text-[10px] leading-none text-neutral-500';
    caption.textContent = label;

    section.append(body, caption);
    return section;
  }

  private createLineSpacingMenu(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cde-combo cde-spacing-menu relative';
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Espaciado entre líneas';
    trigger.className = BTN_SPLIT;
    trigger.innerHTML = `<span class="cde-tb-btn__face">${icon(
      '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 8v8M17 9.5l2-2 2 2M17 14.5l2 2 2-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    )}</span><span class="cde-tb-btn__caret">${CHEVRON}</span>`;

    const menu = document.createElement('ul');
    menu.className =
      'cde-combo__menu absolute left-0 top-[calc(100%+2px)] z-50 hidden min-w-[9.5rem] overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5';
    menu.setAttribute('role', 'menu');

    const items: { label: string; value: string | null }[] = [
      { label: '1.0', value: '1' },
      { label: '1.15', value: '1.15' },
      { label: '1.5', value: '1.5' },
      { label: '2.0', value: '2' },
      { label: '2.5', value: '2.5' },
      { label: '3.0', value: '3' },
      { label: 'Predeterminado', value: null },
    ];

    const syncActive = () => {
      const ed = this.editor();
      const current =
        (ed?.getAttributes('paragraph').lineHeight as string | null) ??
        (ed?.getAttributes('heading').lineHeight as string | null) ??
        null;
      for (const li of menu.querySelectorAll<HTMLElement>('[data-spacing]')) {
        const raw = li.dataset.spacing;
        const value = raw === '' ? null : raw ?? null;
        const on = value === current || (value === null && !current);
        li.classList.toggle('is-selected', on);
        li.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    };

    for (const item of items) {
      const li = document.createElement('li');
      li.setAttribute('role', 'menuitemradio');
      li.dataset.spacing = item.value ?? '';
      li.className =
        'cde-menu-item cursor-pointer px-2.5 py-1.5 text-[11px] text-neutral-800 hover:bg-neutral-100';
      li.textContent = item.label;
      li.addEventListener('mousedown', (e) => e.preventDefault());
      li.addEventListener('click', () => {
        const editor = this.editor();
        if (!editor) return;
        editor.chain().focus().setLineHeight(item.value).run();
        this.closeCombos();
        this.syncState();
      });
      menu.appendChild(li);
    }

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        syncActive();
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    this.buttons.set(trigger, {
      title: 'Espaciado entre líneas',
      label: '',
      isActive: () => {
        const ed = this.editor();
        return !!(
          ed?.getAttributes('paragraph').lineHeight ||
          ed?.getAttributes('heading').lineHeight
        );
      },
      run: () => undefined,
    });
    return root;
  }

  private createSortMenu(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cde-combo cde-sort-menu relative';
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Ordenar';
    trigger.className = BTN_SPLIT;
    trigger.innerHTML = `<span class="cde-tb-btn__face">${icon(
      '<path d="M8 6h13M8 12h10M8 18h7M3 6l1.5 2L6 6M3 18l1.5-2L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    )}</span><span class="cde-tb-btn__caret">${CHEVRON}</span>`;

    const menu = document.createElement('ul');
    menu.className =
      'cde-combo__menu absolute left-0 top-[calc(100%+2px)] z-50 hidden min-w-[11rem] overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5';
    menu.setAttribute('role', 'menu');

    const items: { label: string; direction: 'asc' | 'desc' }[] = [
      { label: 'Ordenar A → Z', direction: 'asc' },
      { label: 'Ordenar Z → A', direction: 'desc' },
    ];

    for (const item of items) {
      const li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      li.className =
        'cde-menu-item cursor-pointer px-2.5 py-1.5 text-[11px] text-neutral-800 hover:bg-neutral-100';
      li.textContent = item.label;
      li.addEventListener('mousedown', (e) => e.preventDefault());
      li.addEventListener('click', () => {
        const editor = this.editor();
        if (!editor) return;
        sortSelectedBlocks(editor, item.direction);
        this.closeCombos();
        this.syncState();
      });
      menu.appendChild(li);
    }

    const hint = document.createElement('li');
    hint.className =
      'pointer-events-none border-t border-neutral-200 px-2.5 py-1.5 text-[10px] text-neutral-500';
    hint.textContent = 'Selecciona 2 o más párrafos o ítems';
    menu.appendChild(hint);

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    this.buttons.set(trigger, {
      title: 'Ordenar',
      label: '',
      run: () => undefined,
    });
    return root;
  }

  private createCaseMenu(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cde-combo cde-case-menu relative';
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Cambiar mayúsculas y minúsculas';
    trigger.className = BTN_SPLIT;
    trigger.innerHTML = `<span class="cde-tb-btn__face"><span class="cde-tb-btn__glyph">Aa</span></span><span class="cde-tb-btn__caret">${CHEVRON}</span>`;

    const menu = document.createElement('ul');
    menu.className =
      'cde-combo__menu absolute left-0 top-[calc(100%+2px)] z-50 hidden min-w-[12rem] overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5';
    menu.setAttribute('role', 'menu');

    const items: { label: string; mode: CaseMode }[] = [
      { label: 'Tipo oración', mode: 'sentence' },
      { label: 'minúsculas', mode: 'lower' },
      { label: 'MAYÚSCULAS', mode: 'upper' },
      { label: 'Poner En Mayúscula Cada Palabra', mode: 'title' },
      { label: 'aLTERNAR mAYÚSCULAS', mode: 'toggle' },
    ];

    for (const item of items) {
      const li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      li.className =
        'cursor-pointer px-2.5 py-1.5 text-[11px] text-neutral-800 hover:bg-neutral-100';
      li.textContent = item.label;
      li.addEventListener('mousedown', (e) => e.preventDefault());
      li.addEventListener('click', () => {
        const editor = this.editor();
        if (!editor) return;
        changeSelectionCase(editor, item.mode);
        this.closeCombos();
        this.syncState();
      });
      menu.appendChild(li);
    }

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    this.buttons.set(trigger, {
      title: 'Cambiar mayúsculas y minúsculas',
      label: '',
      run: () => undefined,
    });
    return root;
  }

  private createColorMenu(options: {
    kind: 'text' | 'highlight';
    title: string;
    colors: readonly string[];
    getActive: () => string | null;
    apply: (color: string | null) => void;
  }): HTMLElement {
    const root = document.createElement('div');
    root.className = `cde-combo cde-color-menu cde-color-menu--${options.kind} relative`;
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = options.title;
    trigger.className = `${BTN_SPLIT} cde-color-trigger`;

    const face = document.createElement('span');
    face.className = 'cde-tb-btn__face';

    const swatch = document.createElement('span');
    swatch.className = 'cde-color-trigger__swatch';

    if (options.kind === 'text') {
      face.innerHTML = '<span class="cde-color-trigger__letter">A</span>';
    } else {
      face.innerHTML = icon(
        '<path d="M4 20h16M7 16l9-9 3 3-9 9H7v-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      );
    }
    face.appendChild(swatch);

    const caret = document.createElement('span');
    caret.className = 'cde-tb-btn__caret';
    caret.innerHTML = CHEVRON;

    trigger.append(face, caret);

    const syncSwatch = () => {
      const active = options.getActive();
      if (options.kind === 'text') {
        swatch.style.background = active || '#111827';
      } else {
        swatch.style.background = active || '#fef08a';
      }
      for (const sw of grid.querySelectorAll<HTMLElement>('.cde-color-menu__swatch')) {
        const on =
          !!active &&
          sw.dataset.color?.toLowerCase() === active.toLowerCase();
        sw.classList.toggle('is-selected', on);
      }
    };

    const menu = document.createElement('div');
    menu.className =
      'cde-combo__menu cde-color-menu__panel absolute left-0 top-[calc(100%+3px)] z-50 hidden';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', options.title);

    const heading = document.createElement('p');
    heading.className = 'cde-color-menu__heading';
    heading.textContent = 'Colores del tema';
    menu.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'cde-color-menu__grid';
    for (const color of options.colors) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'cde-color-menu__swatch';
      sw.title = color;
      sw.dataset.color = color;
      sw.style.background = color;
      if (
        color.toLowerCase() === '#ffffff' ||
        color.toLowerCase() === '#ffff00' ||
        color.toLowerCase() === '#fef08a'
      ) {
        sw.classList.add('cde-color-menu__swatch--bordered');
      }
      sw.addEventListener('mousedown', (e) => e.preventDefault());
      sw.addEventListener('click', () => {
        options.apply(color);
        syncSwatch();
        this.closeCombos();
        this.syncState();
      });
      grid.appendChild(sw);
    }
    menu.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'cde-color-menu__actions';

    const customRow = document.createElement('label');
    customRow.className = 'cde-color-menu__custom';
    const customInput = document.createElement('input');
    customInput.type = 'color';
    customInput.className = 'cde-color-menu__native';
    customInput.value = '#2563eb';
    customInput.title = 'Color personalizado';
    customInput.addEventListener('mousedown', (e) => e.stopPropagation());
    customInput.addEventListener('input', () => {
      options.apply(customInput.value);
      syncSwatch();
      this.syncState();
    });
    customInput.addEventListener('change', () => {
      this.closeCombos();
    });
    const customLabel = document.createElement('span');
    customLabel.textContent = 'Más colores…';
    customRow.append(customInput, customLabel);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'cde-color-menu__clear';
    clearBtn.textContent =
      options.kind === 'text' ? 'Quitar color' : 'Quitar resaltado';
    clearBtn.addEventListener('mousedown', (e) => e.preventDefault());
    clearBtn.addEventListener('click', () => {
      options.apply(null);
      syncSwatch();
      this.closeCombos();
      this.syncState();
    });

    actions.append(customRow, clearBtn);
    menu.appendChild(actions);

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        const active = options.getActive();
        if (active) customInput.value = active;
        syncSwatch();
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    syncSwatch();

    root.dataset.colorKind = options.kind;
    (root as HTMLElement & { __syncColor?: () => void }).__syncColor = syncSwatch;

    this.buttons.set(trigger, {
      title: options.title,
      label: '',
      isActive: () => !!options.getActive(),
      run: () => undefined,
    });

    return root;
  }

  private createCombo(options: {
    title: string;
    options: ComboOption[];
    value: string;
    onChange: (value: string) => void;
    wide?: boolean;
    narrow?: boolean;
  }): ComboSelect {
    let current = options.value;

    const root = document.createElement('div');
    root.className = 'cde-combo relative';
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = options.title;
    trigger.className = [
      'cde-combo__trigger group flex h-6 items-center gap-1 rounded-md border border-neutral-300 bg-gradient-to-b from-white to-neutral-50 px-1.5 text-left text-[11px] text-neutral-800 shadow-sm',
      'hover:border-blue-300 hover:from-white hover:to-blue-50',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ribbon-accent',
      'disabled:cursor-not-allowed disabled:opacity-45',
      options.wide ? 'min-w-[8.5rem] max-w-[10rem]' : '',
      options.narrow ? 'min-w-[2.75rem] max-w-[3.25rem] justify-between' : 'w-full justify-between',
    ]
      .filter(Boolean)
      .join(' ');

    const labelEl = document.createElement('span');
    labelEl.className = 'cde-combo__label min-w-0 flex-1 truncate';
    const initial = options.options.find((o) => o.value === current);
    labelEl.textContent = initial?.label ?? '';
    if (initial?.style) labelEl.setAttribute('style', initial.style);

    trigger.append(labelEl);
    trigger.insertAdjacentHTML('beforeend', CHEVRON);

    const menu = document.createElement('ul');
    menu.className =
      'cde-combo__menu absolute left-0 top-[calc(100%+2px)] z-50 hidden max-h-48 min-w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5';
    menu.setAttribute('role', 'listbox');

    const renderSelection = () => {
      const opt = options.options.find((o) => o.value === current);
      labelEl.textContent = opt?.label ?? '';
      if (opt?.style) labelEl.setAttribute('style', opt.style);
      else labelEl.removeAttribute('style');
      for (const item of menu.querySelectorAll('[data-value]')) {
        const on = (item as HTMLElement).dataset.value === current;
        item.classList.toggle('bg-blue-50', on);
        item.classList.toggle('text-ribbon-accent', on);
        item.classList.toggle('font-semibold', on);
        item.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    };

    for (const opt of options.options) {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.className =
        'cursor-pointer px-2.5 py-1.5 text-[11px] text-neutral-800 hover:bg-neutral-100';
      item.textContent = opt.label;
      if (opt.style) item.setAttribute('style', opt.style);
      item.addEventListener('mousedown', (e) => e.preventDefault());
      item.addEventListener('click', () => {
        current = opt.value;
        renderSelection();
        this.closeCombos();
        options.onChange(opt.value);
      });
      menu.appendChild(item);
    }

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    renderSelection();

    return {
      root,
      getValue: () => current,
      setValue: (value) => {
        current = value;
        renderSelection();
      },
      setDisabled: (disabled) => {
        trigger.disabled = disabled;
        if (disabled) this.closeCombos();
      },
    };
  }

  private closeCombos(): void {
    for (const menu of this.root.querySelectorAll('.cde-combo__menu')) {
      menu.classList.add('hidden');
    }
    for (const combo of this.root.querySelectorAll('.cde-combo.is-open')) {
      combo.classList.remove('is-open');
    }
    this.openCombo = null;
  }

  private createButton(
    action: ToolbarAction,
    className = BTN,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = action.className
      ? `${className} ${action.className}`
      : className;
    button.title = action.title;
    button.setAttribute('aria-label', action.title);
    button.innerHTML = action.label;

    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });

    button.addEventListener('click', () => {
      if (button.disabled) return;
      this.closeCombos();
      action.run();
      this.syncState();
    });

    this.buttons.set(button, action);
    return button;
  }

  private syncState(): void {
    const hasEditor = !!this.editor();
    const ed = this.editor();

    for (const [button, action] of this.buttons) {
      const active = action.isActive?.() ?? false;
      const disabled = !hasEditor || (action.isDisabled?.() ?? false);
      button.classList.toggle('cde-tb-btn--active', active);
      button.classList.toggle('bg-neutral-300/90', active);
      button.classList.toggle('ring-1', active);
      button.classList.toggle('ring-neutral-400/60', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.disabled = disabled;
    }

    this.fontFamilyCombo?.setDisabled(!hasEditor);
    this.fontSizeCombo?.setDisabled(!hasEditor);

    if (ed && this.fontFamilyCombo) {
      const family = ed.getAttributes('textStyle').fontFamily as
        | string
        | undefined;
      if (family) {
        const match = FONT_FAMILIES.find((f) => f.value === family);
        if (match) this.fontFamilyCombo.setValue(match.value);
      }
    }

    if (ed && this.fontSizeCombo) {
      const size = ed.getAttributes('textStyle').fontSize as string | undefined;
      if (size && FONT_SIZES.some((s) => s.value === size)) {
        this.fontSizeCombo.setValue(size);
      }
    }

    for (const el of this.root.querySelectorAll('.cde-color-menu')) {
      const sync = (el as HTMLElement & { __syncColor?: () => void }).__syncColor;
      sync?.();
    }
  }
}

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
import {
  TABLE_STYLE_PRESETS,
  type TableStylePreset,
  type WidgetCell,
  type WidgetTableAttrs,
} from './extensions/widgetTable/model';
import { findActiveTableAttrs, hasActiveTable } from './extensions/widgetTable/WidgetTable';
import type { WidgetTableView } from './extensions/widgetTable/WidgetTableView';
import type { PageColumns, PageMargins, PageOrientation, PageSize, DocumentRestrictions } from './types';
import {
  lucideSvg,
  FileText,
  Lock,
  LucideImage,
  ImageOff,
  LucideTable,
  TableProperties,
  LucideLink,
  Unlink,
  Columns2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Ruler,
  Maximize2,
  RemoveFormatting,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  WrapText,
  Search,
  Replace,
  ZoomIn,
  ZoomOut,
  RectangleVertical,
  SeparatorHorizontal,
  PanelLeftClose,
  Palette,
  Highlighter,
  BookOpen,
  RotateCcw,
  Scaling,
  Trash2,
  Rows3,
  Type,
  Merge,
  Split,
  Square,
  Paintbrush,
  AlignHorizontalDistributeCenter,
  Sigma,
  AArrowUp,
  AArrowDown,
  CaseUpper,
  MoveVertical,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Grid2X2,
  ClipboardPaste,
  Copy,
  Scissors,
  Eraser,
  IndentIncrease,
  IndentDecrease,
  ArrowDownAZ,
  MousePointerClick,
  FilePlus2,
  FileCode2,
  CodeXml,
  CornerDownLeft,
  Calendar,
  Globe,
  Maximize,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Undo2,
  Redo2,
  Printer,
} from './icons';

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
  pageLayout?: {
    getPageSize: () => PageSize;
    setPageSize: (value: PageSize) => void;
    getOrientation: () => PageOrientation;
    setOrientation: (value: PageOrientation) => void;
    setPageOrientation?: (pageIndexOrScope: number | 'all', orientation: PageOrientation) => void;
    getMargins: () => PageMargins;
    setMargins: (value: Partial<PageMargins>) => void;
    setPageMargins?: (pageIndexOrScope: number | 'all', margins: Partial<PageMargins>) => void;
    getCurrentPageIndex?: () => number;
    getColumns: () => PageColumns;
    setColumns: (value: PageColumns) => void;
    getLineNumbers: () => boolean;
    toggleLineNumbers: () => void;
    insertPageBreak: () => void;
    getRulerVisible?: () => boolean;
    toggleRuler?: () => void;
    getPagination?: () => boolean;
    setPagination?: (enabled: boolean) => void;
  };
  getRestrictions?: () => DocumentRestrictions;
  setRestrictions?: (restrictions: Partial<DocumentRestrictions>) => void;
  onPrint?: () => void;
}

type TabId = 'home' | 'insert' | 'table' | 'layout' | 'options' | 'view';

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



const CHEVRON = `<svg class="cde-tb-caret shrink-0" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block;vertical-align:middle;flex-shrink:0;width:10px;height:10px;"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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

/** Table shading palette — 8 per row to match the color grid. */
const TABLE_COLORS = [
  '#ffffff',
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#475569',
  '#0f172a',
  '#fee2e2',
  '#fef3c7',
  '#dcfce7',
  '#d1fae5',
  '#e0f2fe',
  '#e0e7ff',
  '#f3e8ff',
  '#fce7f3',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const;

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Inicio' },
  { id: 'insert', label: 'Insertar' },
  { id: 'table', label: 'Tabla' },
  { id: 'layout', label: 'Disposición de página' },
  { id: 'options', label: 'Opciones del documento' },
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
/** Icon + short caption on a single line — readable without a tooltip. */
const BTN_TEXT =
  'cde-tb-btn cde-tb-btn--text inline-flex items-center justify-center gap-1 h-6 rounded-sm border border-transparent px-1.5 text-[10px] font-medium text-neutral-800 hover:bg-neutral-300/80 disabled:opacity-40 disabled:cursor-not-allowed';
const TABLE_STYLE_BTN =
  'cde-tb-tablestyle relative inline-flex h-12 w-[4.5rem] shrink-0 flex-col items-center justify-start gap-1 overflow-hidden rounded border border-neutral-300 bg-white p-1 hover:border-blue-300 disabled:opacity-40';

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
  private tableFontCombo: ComboSelect | null = null;
  private tableSizeCombo: ComboSelect | null = null;
  private readonly tableCombos: ComboSelect[] = [];
  private tableCombosDisabled: boolean | null = null;
  private syncing = false;
  private tableAttrsCache: WidgetTableAttrs | null | undefined;
  private findPanel: HTMLElement | null = null;
  private findInput: HTMLInputElement | null = null;
  private replaceInput: HTMLInputElement | null = null;
  private findStatusEl: HTMLElement | null = null;
  private findCaseSensitive = false;
  private findMatches: DocumentSearchMatch[] = [];
  private findIndex = -1;
  private readonly documentSearch: DocumentSearchApi | null;
  private readonly pageLayout: ToolbarOptions['pageLayout'];
  private readonly getRestrictionsProp?: () => DocumentRestrictions;
  private readonly setRestrictionsProp?: (restrictions: Partial<DocumentRestrictions>) => void;
  private readonly onPrintProp?: () => void;
  private restrictionsBadgeEl: HTMLElement | null = null;
  private activeTab: TabId = 'home';
  private readonly panels = new Map<TabId, HTMLElement>();
  private readonly tabButtons = new Map<TabId, HTMLButtonElement>();
  private openCombo: HTMLElement | null = null;
  private isAllowed(action: keyof DocumentRestrictions): boolean {
    const r = this.getRestrictionsProp?.();
    if (!r) return true;
    if (r.editable === false && action !== 'allowPageSettings') return false;
    return r[action] !== false;
  }

  constructor(options: ToolbarOptions) {
    this.getEditor = options.getEditor ?? (() => options.editor ?? null);
    this.documentSearch = options.documentSearch ?? null;
    this.pageLayout = options.pageLayout;
    this.getRestrictionsProp = options.getRestrictions;
    this.setRestrictionsProp = options.setRestrictions;
    this.onPrintProp = options.onPrint;
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

  private applyFontFamily(value: string): void {
    const editor = this.editor();
    if (!editor) return;
    if (this.hasTable()) {
      const widget = this.activeTableWidget();
      const appliedInline = widget?.applyFontToSelection(value, null);
      if (!appliedInline) {
        const cell = this.activeCell();
        if (cell) {
          editor.commands.setCellAttribute('fontFamily', value);
        } else {
          editor.commands.setTableFontFamily(value);
        }
      }
    } else {
      editor.commands.setFontFamily(value);
    }
    this.syncState();
  }

  private applyFontSize(value: string): void {
    const editor = this.editor();
    if (!editor) return;
    if (this.hasTable()) {
      const widget = this.activeTableWidget();
      const appliedInline = widget?.applyFontToSelection(null, value);
      if (!appliedInline) {
        const cell = this.activeCell();
        if (cell) {
          editor.commands.setCellAttribute('fontSize', value);
        } else {
          editor.commands.setTableFontSize(value);
        }
      }
    } else {
      editor.commands.setFontSize(value);
    }
    this.syncState();
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
        title: 'Deshacer (Ctrl+Z)',
        label: lucideSvg(Undo2, 14),
        isDisabled: () => !(this.editor()?.can().undo() ?? false),
        run: () => this.editor()?.chain().focus().undo().run(),
      },
      {
        title: 'Rehacer (Ctrl+Y)',
        label: lucideSvg(Redo2, 14),
        isDisabled: () => !(this.editor()?.can().redo() ?? false),
        run: () => this.editor()?.chain().focus().redo().run(),
      },
      {
        title: 'Imprimir (Ctrl+P)',
        label: lucideSvg(Printer, 14),
        run: () => (this.onPrintProp ? this.onPrintProp() : window.print()),
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
    const table = this.buildTablePanel();
    const layout = this.buildLayoutPanel();
    const options = this.buildOptionsPanel();
    const view = this.buildViewPanel();

    this.panels.set('home', home);
    this.panels.set('insert', insert);
    this.panels.set('table', table);
    this.panels.set('layout', layout);
    this.panels.set('options', options);
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

    // Pegar principal
    clipRows.appendChild(
      this.createButton(
        {
          title: 'Pegar desde el portapapeles',
          label: `${lucideSvg(ClipboardPaste, 18)}<span class="text-[10px] font-medium leading-none">Pegar</span>`,
          run: async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) {
                ed()?.chain().focus().insertContent(text).run();
              }
            } catch {
              const text = window.prompt('Pega aqu? el texto a insertar:');
              if (text) {
                ed()?.chain().focus().insertContent(text).run();
              }
            }
          },
        },
        BTN_LG,
      ),
    );

    const clipStack1 = document.createElement('div');
    clipStack1.className = 'flex flex-col gap-0.5';
    clipStack1.append(
      this.createButton(
        {
          title: 'Cortar',
          label: `${lucideSvg(Scissors, 13)}<span class="text-[9px] leading-none">Cortar</span>`,
          run: () => document.execCommand('cut'),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Copiar',
          label: `${lucideSvg(Copy, 13)}<span class="text-[9px] leading-none">Copiar</span>`,
          run: () => document.execCommand('copy'),
        },
        BTN_TEXT,
      ),
    );

    const clipStack2 = document.createElement('div');
    clipStack2.className = 'flex flex-col gap-0.5';
    clipStack2.append(
      this.createButton({
        title: 'Deshacer (Ctrl+Z)',
        label: lucideSvg(Undo2, 14),
        isDisabled: () => !(ed()?.can().undo() ?? false),
        run: () => ed()?.chain().focus().undo().run(),
      }),
      this.createButton({
        title: 'Rehacer (Ctrl+Y)',
        label: lucideSvg(Redo2, 14),
        isDisabled: () => !(ed()?.can().redo() ?? false),
        run: () => ed()?.chain().focus().redo().run(),
      }),
    );

    const clipStack3 = document.createElement('div');
    clipStack3.className = 'flex flex-col gap-0.5';
    clipStack3.append(
      this.createButton({
        title: 'Limpiar formato',
        label: lucideSvg(Eraser, 14),
        run: () => ed()?.chain().focus().unsetAllMarks().clearNodes().run(),
      }),
    );

    clipRows.append(clipStack1, clipStack2, clipStack3);
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
        this.applyFontFamily(value);
      },
    });
    this.fontSizeCombo = this.createCombo({
      title: 'Tamaño',
      options: FONT_SIZES,
      value: '12px',
      narrow: true,
      onChange: (value) => {
        this.applyFontSize(value);
      },
    });
    this.fontFamilyCombo.root.classList.add('cde-combo--font');
    this.fontSizeCombo.root.classList.add('cde-combo--size');

    const bumpSize = (direction: 1 | -1) => {
      const editor = ed();
      if (!editor) return;
      const activeCell = this.activeCell();
      const current = parseFontSizePx(
        activeCell?.fontSize ??
        this.tableAttrs()?.fontSize ??
        (editor.getAttributes('textStyle').fontSize as string | undefined) ??
          this.fontSizeCombo?.getValue(),
      );
      const next = stepFontSizePx(current, direction);
      const value = `${next}px`;
      this.applyFontSize(value);
      this.fontSizeCombo?.setValue(value);
    };

    fontTop.append(
      this.fontFamilyCombo.root,
      this.fontSizeCombo.root,
      this.createButton({
        title: 'Aumentar tamaño de fuente',
        label: lucideSvg(AArrowUp, 14),
        run: () => bumpSize(1),
      }),
      this.createButton({
        title: 'Disminuir tamaño de fuente',
        label: lucideSvg(AArrowDown, 14),
        run: () => bumpSize(-1),
      }),
    );
    fontBody.appendChild(fontTop);

    const fontMarks = document.createElement('div');
    fontMarks.className = 'flex flex-wrap items-center gap-0.5';
    fontMarks.append(
      this.createButton({
        title: 'Negrita (Ctrl+B)',
        label: lucideSvg(Bold, 14),
        isActive: () => {
          if (this.hasTable()) return document.queryCommandState('bold');
          return ed()?.isActive('bold') ?? false;
        },
        isDisabled: () => !this.isAllowed('allowFormatting'),
        run: () => {
          if (this.hasTable()) {
            document.execCommand('bold', false);
            this.activeTableWidget()?.persistCurrent();
          } else {
            ed()?.chain().focus().toggleBold().run();
          }
        },
      }),
      this.createButton({
        title: 'Cursiva (Ctrl+I)',
        label: lucideSvg(Italic, 14),
        isActive: () => {
          if (this.hasTable()) return document.queryCommandState('italic');
          return ed()?.isActive('italic') ?? false;
        },
        isDisabled: () => !this.isAllowed('allowFormatting'),
        run: () => {
          if (this.hasTable()) {
            document.execCommand('italic', false);
            this.activeTableWidget()?.persistCurrent();
          } else {
            ed()?.chain().focus().toggleItalic().run();
          }
        },
      }),
      this.createButton({
        title: 'Subrayado (Ctrl+U)',
        label: lucideSvg(Underline, 14),
        isActive: () => {
          if (this.hasTable()) return document.queryCommandState('underline');
          return ed()?.isActive('underline') ?? false;
        },
        isDisabled: () => !this.isAllowed('allowFormatting'),
        run: () => {
          if (this.hasTable()) {
            document.execCommand('underline', false);
            this.activeTableWidget()?.persistCurrent();
          } else {
            ed()?.chain().focus().toggleUnderline().run();
          }
        },
      }),
      this.createButton({
        title: 'Tachado',
        label: lucideSvg(Strikethrough, 14),
        isActive: () => ed()?.isActive('strike') ?? false,
        isDisabled: () => !this.isAllowed('allowFormatting'),
        run: () => ed()?.chain().focus().toggleStrike().run(),
      }),
      this.createButton({
        title: 'Subíndice',
        label: lucideSvg(Subscript, 14),
        isActive: () => ed()?.isActive('subscript') ?? false,
        run: () => ed()?.chain().focus().toggleSubscript().run(),
      }),
      this.createButton({
        title: 'Superíndice',
        label: lucideSvg(Superscript, 14),
        isActive: () => ed()?.isActive('superscript') ?? false,
        run: () => ed()?.chain().focus().toggleSuperscript().run(),
      }),
      this.createCaseMenu(),
      this.createColorMenu({
        kind: 'text',
        isDisabled: () => !this.isAllowed('allowFormatting'),
        title: 'Color de fuente',
        colors: TEXT_COLORS,
        getActive: () => {
          if (this.hasTable()) {
            return this.activeCell()?.color ?? null;
          }
          return (ed()?.getAttributes('textStyle').color as string | undefined) ?? null;
        },
        apply: (color) => {
          if (this.hasTable()) {
            const widget = this.activeTableWidget();
            const appliedInline = color ? widget?.applyColorToSelection(color) : false;
            if (!appliedInline) {
              ed()?.commands.setCellAttribute('color', color || '');
            }
          } else {
            if (!color) ed()?.chain().focus().unsetColor().run();
            else ed()?.chain().focus().setColor(color).run();
          }
        },
      }),
      this.createColorMenu({
        kind: 'highlight',
        isDisabled: () => !this.isAllowed('allowFormatting'),
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
        label: lucideSvg(List, 14),
        isActive: () => ed()?.isActive('bulletList') ?? false,
        run: () => ed()?.chain().focus().toggleBulletList().run(),
      }),
      this.createButton({
        title: 'Numeración',
        label: lucideSvg(ListOrdered, 14),
        isActive: () => ed()?.isActive('orderedList') ?? false,
        run: () => ed()?.chain().focus().toggleOrderedList().run(),
      }),
      this.createButton({
        title: 'Lista de tareas',
        label: lucideSvg(ListTodo, 14),
        isActive: () => ed()?.isActive('taskList') ?? false,
        run: () => ed()?.chain().focus().toggleTaskList().run(),
      }),
      this.createButton({
        title: 'Disminuir sangría',
        label: lucideSvg(IndentDecrease, 14),
        run: () => ed()?.chain().focus().outdent().run(),
      }),
      this.createButton({
        title: 'Aumentar sangría',
        label: lucideSvg(IndentIncrease, 14),
        run: () => ed()?.chain().focus().indent().run(),
      }),
    );
    paraBody.appendChild(listRow);

    const alignRow = document.createElement('div');
    alignRow.className = 'flex flex-wrap items-center gap-0.5';
    alignRow.append(
      this.createButton({
        title: 'Alinear a la izquierda',
        label: lucideSvg(AlignLeft, 14),
        isActive: () => ed()?.isActive({ textAlign: 'left' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('left').run(),
      }),
      this.createButton({
        title: 'Centrar',
        label: lucideSvg(AlignCenter, 14),
        isActive: () => ed()?.isActive({ textAlign: 'center' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('center').run(),
      }),
      this.createButton({
        title: 'Alinear a la derecha',
        label: lucideSvg(AlignRight, 14),
        isActive: () => ed()?.isActive({ textAlign: 'right' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('right').run(),
      }),
      this.createButton({
        title: 'Justificar',
        label: lucideSvg(AlignJustify, 14),
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
          title: 'Buscar en documento',
          label: `${lucideSvg(Search, 18)}<span class="text-[10px] font-medium leading-none">Buscar</span>`,
          run: () => this.openFindPanel('find'),
        },
        BTN_LG,
      ),
      this.createButton(
        {
          title: 'Buscar y reemplazar',
          label: `${lucideSvg(Replace, 18)}<span class="text-[10px] font-medium leading-none">Reemplazar</span>`,
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
      `${lucideSvg(MousePointerClick, 18)}<span class="inline-flex items-center gap-0.5 text-[10px] font-medium leading-none">Seleccionar<span class="cde-tb-btn__caret inline-flex">${CHEVRON}</span></span>`;

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

  private insertImageSrc(url: string): void {
    const editor = this.editor();
    if (!editor) return;
    const tableStorage = editor.storage?.table as
      | { activeWidget?: { readCellsFromDom: () => void } }
      | undefined;
    if (
      tableStorage?.activeWidget &&
      document.activeElement?.closest('.cde-wt__cell')
    ) {
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${url}" class="cde-wt__img" style="max-width:100%;height:auto;display:block;margin:0.25em 0;" />`,
      );
      tableStorage.activeWidget.readCellsFromDom();
      return;
    }
    editor.chain().focus().setImage({ src: url }).run();
  }

  private buildInsertPanel(): HTMLElement {
    const panel = this.createPanel('insert');
    const ed = () => this.editor();

    // 1. Páginas
    if (this.pageLayout) {
      const pages = this.createSection('Páginas');
      pages.querySelector('[data-section-body]')!.appendChild(
        this.createButton(
          {
            title: 'Insertar un salto de página formal en la posición actual',
            label: `${lucideSvg(FilePlus2, 18)}<span class="text-[10px] font-medium">Salto de pág.</span>`,
            isDisabled: () => !this.isAllowed('allowPageSettings'),
            run: () => this.pageLayout?.insertPageBreak(),
          },
          BTN_LG,
        ),
      );
      panel.appendChild(pages);
    }

    // 2. Tablas
    const tables = this.createSection('Tablas');
    const tableBody = tables.querySelector('[data-section-body]')!;
    const tableRow = document.createElement('div');
    tableRow.className = 'flex flex-wrap items-center gap-1';
    tableRow.append(
      this.createTableInsertMenu(),
      this.createButton(
        {
          title: 'Abrir la pestaña Tabla para dar formato a la tabla actual',
          label: `${lucideSvg(TableProperties, 14)}<span>Diseño de tabla</span>`,
          isDisabled: () => !this.hasTable(),
          run: () => this.setActiveTab('table'),
        },
        BTN_TEXT,
      ),
    );
    tableBody.appendChild(tableRow);
    panel.appendChild(tables);

    // 3. Ilustraciones (Imágenes)
    const media = this.createSection('Ilustraciones');
    const mediaBody = media.querySelector('[data-section-body]')!;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        if (!url) return;
        this.insertImageSrc(url);
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
    mediaBody.appendChild(fileInput);

    mediaBody.appendChild(
      this.createDropdown({
        title: 'Insertar imágenes desde archivo local o dirección URL',
        caption: 'Imágenes',
        face: lucideSvg(LucideImage, 18),
        large: true,
        isDisabled: () => !this.isAllowed('allowImages'),
        menuClassName: 'cde-tb-menu--list',
        build: (menu) => {
          menu.append(
            this.createMenuItem('Subir desde este equipo?', () => {
              fileInput.click();
            }),
            this.createMenuItem('Por dirección URL…', () => {
              const url = window.prompt('URL de la imagen:');
              if (url?.trim()) {
                this.insertImageSrc(url.trim());
              }
            }),
          );
        },
      }),
    );
    panel.appendChild(media);

    // 4. Vínculos
    const links = this.createSection('Vínculos');
    links.querySelector('[data-section-body]')!.appendChild(
      this.createButton(
        {
          title: 'Insertar o editar vínculo web',
          label: `${lucideSvg(LucideLink, 18)}<span class="text-[10px] font-medium">Vínculo</span>`,
          isDisabled: () => !this.isAllowed('allowLinks'),
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

    // 5. Texto y Bloques
    const blocks = this.createSection('Texto');
    const blockRow = document.createElement('div');
    blockRow.className = 'flex flex-wrap items-center gap-0.5';
    blockRow.append(
      this.createButton({
        title: 'Cita en bloque',
        label: lucideSvg(Quote, 14),
        isActive: () => ed()?.isActive('blockquote') ?? false,
        run: () => ed()?.chain().focus().toggleBlockquote().run(),
      }),
      this.createButton({
        title: 'Bloque de código',
        label: lucideSvg(FileCode2, 14),
        isActive: () => ed()?.isActive('codeBlock') ?? false,
        run: () => ed()?.chain().focus().toggleCodeBlock().run(),
      }),
      this.createButton({
        title: 'Código en línea',
        label: lucideSvg(CodeXml, 14),
        isActive: () => ed()?.isActive('code') ?? false,
        run: () => ed()?.chain().focus().toggleCode().run(),
      }),
      this.createButton({
        title: 'Línea horizontal divisoria',
        label: lucideSvg(Minus, 14),
        run: () => ed()?.chain().focus().setHorizontalRule().run(),
      }),
      this.createButton({
        title: 'Salto de línea suave (Shift+Enter)',
        label: lucideSvg(CornerDownLeft, 14),
        run: () => ed()?.chain().focus().setHardBreak().run(),
      }),
      this.createButton({
        title: 'Insertar fecha y hora actual',
        label: lucideSvg(Calendar, 14),
        run: () => {
          const now = new Date();
          const str = now.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          ed()?.chain().focus().insertContent(str).run();
        },
      }),
    );
    blocks.querySelector('[data-section-body]')!.appendChild(blockRow);
    panel.appendChild(blocks);

    return panel;
  }

  private tableAttrs(): WidgetTableAttrs | null {
    if (this.syncing && this.tableAttrsCache !== undefined) {
      return this.tableAttrsCache;
    }
    const editor = this.editor();
    const attrs =
      editor && hasActiveTable(editor) ? findActiveTableAttrs(editor) : null;
    if (this.syncing) this.tableAttrsCache = attrs;
    return attrs;
  }

  private activeTableWidget(): WidgetTableView | null {
    const activeEl = document.activeElement;
    const tableEl = activeEl?.closest('.cde-wt') as (HTMLElement & { __view?: WidgetTableView }) | null;
    if (tableEl?.__view) return tableEl.__view;

    const storage = this.editor()?.storage?.table as
      | { activeWidget?: WidgetTableView }
      | undefined;
    if (storage?.activeWidget) return storage.activeWidget;

    const selectedTable = document.querySelector('.cde-wt.is-selected, .cde-wt:hover') as (HTMLElement & { __view?: WidgetTableView }) | null;
    return selectedTable?.__view ?? null;
  }

  private hasTable(): boolean {
    if (this.syncing) return this.tableAttrs() !== null;
    const editor = this.editor();
    return editor ? hasActiveTable(editor) : false;
  }

  /** Cell under the caret — drives the shading and alignment indicators. */
  private activeCell(): WidgetCell | null {
    const attrs = this.tableAttrs();
    if (!attrs) return null;
    const storage = this.editor()?.storage?.table as
      | { row?: number; col?: number }
      | undefined;
    return attrs.cells[storage?.row ?? 0]?.[storage?.col ?? 0] ?? null;
  }

  private insertTableWithStyle(
    rows: number,
    cols: number,
    styleId: string | null,
  ): void {
    const editor = this.editor();
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true, styleId })
      .run();
    this.setActiveTab('table');
    requestAnimationFrame(() => {
      this.focusInsertedTable();
      this.syncState();
    });
  }

  /** Put the caret in the first cell so the Tabla tab acts on the new table. */
  private focusInsertedTable(): void {
    const editor = this.editor();
    if (!editor || editor.isDestroyed) return;

    const { from } = editor.state.selection;
    let tablePos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table' && pos <= from) tablePos = pos;
      return undefined;
    });
    if (tablePos == null) return;

    const dom = editor.view.nodeDOM(tablePos);
    if (!(dom instanceof HTMLElement)) return;
    const cell = dom.querySelector<HTMLElement>('.cde-wt__cell');
    cell?.focus();
  }

  /** Word-like size picker: hover the grid, click to insert. */
  private createTableInsertMenu(): HTMLElement {
    const maxRows = 8;
    const maxCols = 10;

    return this.createDropdown({
      title: 'Insertar tabla',
      caption: 'Tabla',
      face: lucideSvg(LucideTable, 18),
      large: true,
      className: 'cde-table-insert',
      menuClassName: 'cde-tb-menu--panel cde-tablegrid',
      isDisabled: () => !this.isAllowed('allowTables'),
      build: (menu) => {
        const label = document.createElement('p');
        label.className = 'cde-tablegrid__label';
        label.textContent = 'Insertar tabla';

        const grid = document.createElement('div');
        grid.className = 'cde-tablegrid__grid';
        grid.style.gridTemplateColumns = `repeat(${maxCols}, 1rem)`;

        const cellEls: HTMLElement[] = [];
        const highlight = (rows: number, cols: number) => {
          cellEls.forEach((cell) => {
            const r = Number(cell.dataset.row);
            const c = Number(cell.dataset.col);
            cell.classList.toggle('is-on', r <= rows && c <= cols);
          });
          label.textContent =
            rows > 0 && cols > 0
              ? `Tabla de ${cols} × ${rows}`
              : 'Insertar tabla';
        };

        for (let r = 1; r <= maxRows; r += 1) {
          for (let c = 1; c <= maxCols; c += 1) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cde-tablegrid__cell';
            cell.dataset.row = String(r);
            cell.dataset.col = String(c);
            cell.title = `${c} × ${r}`;
            cell.setAttribute('aria-label', `Tabla de ${c} columnas por ${r} filas`);
            cell.addEventListener('mouseenter', () => highlight(r, c));
            cell.addEventListener('focus', () => highlight(r, c));
            cell.addEventListener('mousedown', (e) => e.preventDefault());
            cell.addEventListener('click', () => {
              this.closeCombos();
              this.insertTableWithStyle(r, c, null);
            });
            cellEls.push(cell);
            grid.appendChild(cell);
          }
        }
        grid.addEventListener('mouseleave', () => highlight(0, 0));

        const quickLabel = this.createMenuHeading('Tablas con estilo (3 × 3)');
        const quickRow = document.createElement('div');
        quickRow.className = 'cde-tablegrid__quick';
        for (const id of ['grid', 'blue', 'gray', 'no-border']) {
          const preset = TABLE_STYLE_PRESETS.find((p) => p.id === id);
          if (!preset) continue;
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'cde-tb-chip';
          chip.title = `Insertar tabla 3 × 3 con estilo ${preset.name}`;
          chip.innerHTML = `${this.tableStylePreview(preset)}<span>${preset.name}</span>`;
          chip.addEventListener('mousedown', (e) => e.preventDefault());
          chip.addEventListener('click', () => {
            this.closeCombos();
            this.insertTableWithStyle(3, 3, preset.id);
          });
          quickRow.appendChild(chip);
        }

        const footer = document.createElement('div');
        footer.className = 'cde-tb-menu__footer';
        footer.appendChild(
          this.createMenuItem('Insertar tabla…', () => this.promptInsertTable()),
        );

        menu.append(label, grid, quickLabel, quickRow, footer);
      },
    });
  }

  private promptInsertTable(): void {
    const raw = window.prompt('Tamaño de la tabla (columnas × filas)', '3 x 3');
    if (!raw) return;
    const match = raw.match(/(\d+)\s*[x×*,\s]\s*(\d+)/i);
    if (!match) return;
    const cols = Math.min(30, Math.max(1, Number(match[1])));
    const rows = Math.min(60, Math.max(1, Number(match[2])));
    this.insertTableWithStyle(rows, cols, null);
  }

  /** Miniature 3-row table used by the gallery and quick chips. */
  private tableStylePreview(preset: TableStylePreset): string {
    const border =
      preset.borderStyle === 'none' || !preset.borderColor
        ? '1px dashed #d4d4d4'
        : `${Math.max(1, preset.borderWidth ?? 1)}px ${preset.borderStyle ?? 'solid'} ${preset.borderColor}`;
    const rowBorder =
      preset.cellBorderStyle === 'none' || !preset.cellBorderColor
        ? 'transparent'
        : preset.cellBorderColor;
    const rows = [
      preset.headerBackground ?? '#ffffff',
      preset.bodyBackground ?? '#ffffff',
      preset.bandBackground ?? preset.bodyBackground ?? '#ffffff',
    ]
      .map(
        (bg, i) =>
          `<span class="cde-tb-tablestyle__row" style="background:${bg};border-top:${
            i === 0 ? '0' : `1px solid ${rowBorder}`
          }"></span>`,
      )
      .join('');
    return `<span class="cde-tb-tablestyle__preview" style="border:${border}">${rows}</span>`;
  }

  private createTableStyleGallery(): HTMLElement {
    const gallery = document.createElement('div');
    gallery.className = 'cde-tb-tablestyles';

    for (const preset of TABLE_STYLE_PRESETS) {
      gallery.appendChild(
        this.createButton(
          {
            title: `Estilo de tabla: ${preset.name}`,
            label: `${this.tableStylePreview(preset)}<span class="cde-tb-tablestyle__name">${preset.name}</span>`,
            isActive: () => {
              const attrs = this.tableAttrs();
              if (!attrs) return false;
              return (attrs.styleId ?? 'plain') === preset.id;
            },
            isDisabled: () => !this.hasTable(),
            run: () =>
              this.editor()
                ?.chain()
                .focus()
                .applyTableStyle(preset.id === 'plain' ? null : preset.id)
                .run(),
          },
          TABLE_STYLE_BTN,
        ),
      );
    }

    return gallery;
  }

  private buildTablePanel(): HTMLElement {
    const panel = this.createPanel('table');
    const ed = () => this.editor();
    const disabled = () => !this.hasTable();

    // ?? 1. Estilos de tabla ??
    const styles = this.createSection('Estilos de tabla');
    const stylesBody = styles.querySelector('[data-section-body]')!;
    stylesBody.appendChild(this.createTableStyleGallery());

    const optionsRow = document.createElement('div');
    optionsRow.className = 'flex flex-wrap items-center gap-0.5 mt-0.5';
    optionsRow.append(
      this.createButton(
        {
          title: 'Mostrar u ocultar la fila de encabezado',
          label: `${lucideSvg(LucideTable, 14)}<span>Encabezado</span>`,
          isActive: () => this.tableAttrs()?.withHeaderRow ?? false,
          isDisabled: disabled,
          run: () => ed()?.chain().focus().toggleTableHeaderRow().run(),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Sombrear filas alternas',
          label: `${lucideSvg(Rows3, 14)}<span>Filas con bandas</span>`,
          isActive: () => this.tableAttrs()?.banded !== false,
          isDisabled: disabled,
          run: () => ed()?.chain().focus().toggleTableBandedRows().run(),
        },
        BTN_TEXT,
      ),
    );
    stylesBody.appendChild(optionsRow);
    panel.appendChild(styles);

    // ?? 2. Fuente y texto de la tabla ??
    const fontSection = this.createSection('Fuente');
    const fontBody = fontSection.querySelector('[data-section-body]')!;
    const fontRow = document.createElement('div');
    fontRow.className = 'flex flex-wrap items-center gap-0.5';

    this.tableFontCombo = this.createCombo({
      title: 'Fuente de la tabla',
      options: FONT_FAMILIES,
      value: FONT_FAMILIES[0]!.value,
      wide: true,
      onChange: (value) => {
        ed()?.commands.setTableFontFamily(value);
        this.syncState();
      },
    });
    this.tableSizeCombo = this.createCombo({
      title: 'Tamaño de fuente de la tabla',
      options: FONT_SIZES,
      value: '12px',
      narrow: true,
      onChange: (value) => {
        ed()?.commands.setTableFontSize(value);
        this.syncState();
      },
    });
    this.tableCombos.push(this.tableFontCombo, this.tableSizeCombo);

    fontRow.append(
      this.tableFontCombo.root,
      this.tableSizeCombo.root,
      this.createColorMenu({
        kind: 'cellText',
        title: 'Color del texto de las celdas seleccionadas',
        caption: 'Texto',
        face: lucideSvg(Type, 14),
        colors: TEXT_COLORS,
        defaultSwatch: '#111827',
        clearLabel: 'Color automático',
        isDisabled: disabled,
        getActive: () => this.activeCell()?.color ?? null,
        apply: (color) =>
          ed()?.chain().focus().setCellAttribute('color', color).run(),
      }),
    );
    fontBody.appendChild(fontRow);
    panel.appendChild(fontSection);

    // ?? 3. Sombreado y bordes ??
    const paint = this.createSection('Sombreado y bordes');
    const paintBody = paint.querySelector('[data-section-body]')!;

    const shadeRow = document.createElement('div');
    shadeRow.className = 'flex flex-wrap items-center gap-0.5';
    shadeRow.append(
      this.createColorMenu({
        kind: 'cell',
        title: 'Color de relleno de las celdas seleccionadas',
        caption: 'Celda',
        face: lucideSvg(Paintbrush, 14),
        colors: TABLE_COLORS,
        defaultSwatch: '#e0e7ff',
        clearLabel: 'Sin relleno',
        isDisabled: disabled,
        getActive: () => this.activeCell()?.backgroundColor ?? null,
        apply: (color) =>
          ed()?.chain().focus().setCellAttribute('backgroundColor', color).run(),
      }),
      this.createColorMenu({
        kind: 'table',
        title: 'Color de fondo de toda la tabla',
        caption: 'Tabla',
        face: lucideSvg(Palette, 14),
        colors: TABLE_COLORS,
        defaultSwatch: '#f1f5f9',
        clearLabel: 'Sin fondo',
        isDisabled: disabled,
        getActive: () => this.tableAttrs()?.backgroundColor ?? null,
        apply: (color) => ed()?.chain().focus().setTableBackground(color).run(),
      }),
    );
    paintBody.appendChild(shadeRow);

    const borderRow = document.createElement('div');
    borderRow.className = 'flex flex-wrap items-center gap-0.5';

    const borderStyleCombo = this.createCombo({
      title: 'Estilo de borde',
      options: [
        { label: 'Sólido', value: 'solid' },
        { label: 'Discontinuo', value: 'dashed' },
        { label: 'Punteado', value: 'dotted' },
        { label: 'Doble', value: 'double' },
        { label: 'Sin borde', value: 'none' },
      ],
      value: 'solid',
      medium: true,
      onChange: (value) => {
        ed()?.chain().focus().setCellBorder({ style: value }).run();
        ed()?.chain().focus().setTableBorder({ style: value }).run();
        this.syncState();
      },
    });
    const borderWidthCombo = this.createCombo({
      title: 'Grosor del borde',
      options: [
        { label: '1 px', value: '1' },
        { label: '2 px', value: '2' },
        { label: '3 px', value: '3' },
        { label: '4 px', value: '4' },
      ],
      value: '1',
      narrow: true,
      onChange: (value) => {
        const width = Number(value);
        ed()?.chain().focus().setCellBorder({ width }).run();
        ed()?.chain().focus().setTableBorder({ width }).run();
        this.syncState();
      },
    });
    borderStyleCombo.root.classList.add('cde-combo--border');
    borderWidthCombo.root.classList.add('cde-combo--size');
    this.tableCombos.push(borderStyleCombo, borderWidthCombo);

    borderRow.append(
      borderStyleCombo.root,
      borderWidthCombo.root,
      this.createColorMenu({
        kind: 'border',
        title: 'Color del borde',
        face: lucideSvg(Square, 14),
        colors: TABLE_COLORS,
        defaultSwatch: '#94a3b8',
        clearLabel: 'Color predeterminado',
        isDisabled: disabled,
        getActive: () => this.activeCell()?.borderColor ?? null,
        apply: (color) => {
          ed()?.chain().focus().setCellBorder({ color }).run();
          ed()?.chain().focus().setTableBorder({ color }).run();
        },
      }),
      this.createButton(
        {
          title: 'Aplicar todos los bordes',
          label: `${lucideSvg(Square, 14)}<span>Todos</span>`,
          isDisabled: disabled,
          run: () => {
            const border = { style: 'solid', color: '#94a3b8', width: 1 };
            ed()?.chain().focus().setCellBorder(border).run();
            ed()?.chain().focus().setTableBorder(border).run();
          },
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Quitar todos los bordes',
          label: `${lucideSvg(Grid2X2, 14)}<span>Ninguno</span>`,
          isDisabled: disabled,
          run: () => {
            const border = { style: 'none', color: 'transparent', width: 0 };
            ed()?.chain().focus().setCellBorder(border).run();
            ed()?.chain().focus().setTableBorder(border).run();
          },
        },
        BTN_TEXT,
      ),
    );
    paintBody.appendChild(borderRow);
    panel.appendChild(paint);

    // ?? 4. Filas y columnas ??
    const structure = this.createSection('Filas y columnas');
    const structureBody = structure.querySelector('[data-section-body]')!;

    const insertRow = document.createElement('div');
    insertRow.className = 'flex flex-wrap items-center gap-0.5';
    insertRow.append(
      this.createButton(
        {
          title: 'Insertar una fila encima de la celda actual',
          label: `${lucideSvg(ArrowUpToLine, 14)}<span>Fila arriba</span>`,
          isDisabled: () => !(ed()?.can().addRowBefore() ?? false),
          run: () => ed()?.chain().focus().addRowBefore().run(),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Insertar una fila debajo de la celda actual',
          label: `${lucideSvg(ArrowDownToLine, 14)}<span>Fila abajo</span>`,
          isDisabled: () => !(ed()?.can().addRowAfter() ?? false),
          run: () => ed()?.chain().focus().addRowAfter().run(),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Insertar una columna a la izquierda',
          label: `${lucideSvg(ArrowLeftToLine, 14)}<span>Col. izq.</span>`,
          isDisabled: () => !(ed()?.can().addColumnBefore() ?? false),
          run: () => ed()?.chain().focus().addColumnBefore().run(),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Insertar una columna a la derecha',
          label: `${lucideSvg(ArrowRightToLine, 14)}<span>Col. der.</span>`,
          isDisabled: () => !(ed()?.can().addColumnAfter() ?? false),
          run: () => ed()?.chain().focus().addColumnAfter().run(),
        },
        BTN_TEXT,
      ),
    );
    structureBody.appendChild(insertRow);

    const mergeRow = document.createElement('div');
    mergeRow.className = 'flex flex-wrap items-center gap-0.5';
    mergeRow.append(
      this.createDropdown({
        title: 'Eliminar filas, columnas o la tabla',
        caption: 'Eliminar',
        face: lucideSvg(Trash2, 14),
        isDisabled: disabled,
        menuClassName: 'cde-tb-menu--list',
        build: (menu) => {
          menu.append(
            this.createMenuItem('Eliminar fila', () =>
              ed()?.chain().focus().deleteRow().run(),
            ),
            this.createMenuItem('Eliminar columna', () =>
              ed()?.chain().focus().deleteColumn().run(),
            ),
            this.createMenuItem('Eliminar tabla', () =>
              ed()?.chain().focus().deleteTable().run(),
            ),
          );
        },
      }),
      this.createButton(
        {
          title: 'Combinar las celdas seleccionadas en una sola',
          label: `${lucideSvg(Merge, 14)}<span>Combinar</span>`,
          isDisabled: () => !(ed()?.can().mergeCells() ?? false),
          run: () => ed()?.chain().focus().mergeCells().run(),
        },
        BTN_TEXT,
      ),
      this.createDropdown({
        title: 'Dividir la celda actual',
        caption: 'Dividir',
        face: lucideSvg(Split, 14),
        isDisabled: disabled,
        menuClassName: 'cde-tb-menu--list',
        build: (menu) => {
          menu.append(this.createMenuHeading('En columnas'));
          for (const cols of [2, 3, 4]) {
            menu.appendChild(
              this.createMenuItem(`${cols} columnas`, () =>
                ed()?.chain().focus().splitCell({ cols }).run(),
              ),
            );
          }
          menu.append(this.createMenuHeading('En filas'));
          for (const rows of [2, 3]) {
            menu.appendChild(
              this.createMenuItem(`${rows} filas`, () =>
                ed()?.chain().focus().splitCell({ rows }).run(),
              ),
            );
          }
        },
      }),
    );
    structureBody.appendChild(mergeRow);
    panel.appendChild(structure);

    // ?? 5. Alineación y tamaño ??
    const cells = this.createSection('Alineación y tamaño');
    const cellsBody = cells.querySelector('[data-section-body]')!;

    const alignRow = document.createElement('div');
    alignRow.className = 'flex flex-wrap items-center gap-0.5';
    const valign: { label: string; value: 'top' | 'middle' | 'bottom'; ico: any }[] = [
      { label: 'Alinear arriba', value: 'top', ico: AlignVerticalJustifyStart },
      { label: 'Centrar verticalmente', value: 'middle', ico: AlignVerticalJustifyCenter },
      { label: 'Alinear abajo', value: 'bottom', ico: AlignVerticalJustifyEnd },
    ];
    for (const item of valign) {
      alignRow.appendChild(
        this.createButton({
          title: item.label,
          label: lucideSvg(item.ico, 14),
          isActive: () => this.activeCell()?.verticalAlign === item.value,
          isDisabled: disabled,
          run: () =>
            ed()?.chain().focus().setCellAttribute('verticalAlign', item.value).run(),
        }),
      );
    }
    alignRow.appendChild(
      this.createDropdown({
        title: 'Ajuste del texto alrededor de la tabla',
        caption: 'Ajuste',
        face: lucideSvg(WrapText, 14),
        isDisabled: disabled,
        menuClassName: 'cde-tb-menu--list',
        build: (menu) => {
          const items: { label: string; value: 'none' | 'left' | 'right' }[] = [
            { label: 'En línea con el texto', value: 'none' },
            { label: 'Texto a la derecha', value: 'left' },
            { label: 'Texto a la izquierda', value: 'right' },
          ];
          for (const item of items) {
            menu.appendChild(
              this.createMenuItem(item.label, () =>
                ed()?.chain().focus().setTableWrap(item.value).run(),
              ),
            );
          }
        },
      }),
    );
    cellsBody.appendChild(alignRow);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'flex flex-wrap items-center gap-0.5';
    sizeRow.append(
      this.createButton(
        {
          title: 'Ajustar el ancho de las columnas al contenido',
          label: `${lucideSvg(Scaling, 14)}<span>Autoajustar</span>`,
          isDisabled: disabled,
          run: () => ed()?.chain().focus().autoFitColumns().run(),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Igualar el ancho de todas las columnas',
          label: `${lucideSvg(AlignHorizontalDistributeCenter, 14)}<span>Distribuir</span>`,
          isDisabled: disabled,
          run: () => ed()?.chain().focus().distributeColumns().run(),
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Recalcular fórmulas como =SUM(ABOVE)',
          label: `${lucideSvg(Sigma, 14)}<span>Fórmulas</span>`,
          isDisabled: disabled,
          run: () => ed()?.chain().focus().recalculateFormulas().run(),
        },
        BTN_TEXT,
      ),
    );
    cellsBody.appendChild(sizeRow);
    panel.appendChild(cells);

    return panel;
  }

  private buildLayoutPanel(): HTMLElement {
    const panel = this.createPanel('layout');
    const ed = () => this.editor();

    if (this.pageLayout) {
      // 1. Configurar Página
      const setup = this.createSection('Configurar Página');
      const setupRow = document.createElement('div');
      setupRow.className = 'flex flex-wrap items-center gap-0.5';
      setupRow.append(
        this.createLayoutMenu(
          'Márgenes',
          [
            ['Pág. actual: Normal (2,54 cm)', () => this.applyMargins(this.currPage(), { top: 96, right: 96, bottom: 96, left: 96 })],
            ['Pág. actual: Estrecho (1,27 cm)', () => this.applyMargins(this.currPage(), { top: 48, right: 48, bottom: 48, left: 48 })],
            ['Pág. actual: Ancho (3,81 cm)', () => this.applyMargins(this.currPage(), { top: 144, right: 144, bottom: 144, left: 144 })],
            ['Todo el doc: Normal (2,54 cm)', () => this.applyMargins('all', { top: 96, right: 96, bottom: 96, left: 96 })],
            ['Todo el doc: Estrecho (1,27 cm)', () => this.applyMargins('all', { top: 48, right: 48, bottom: 48, left: 48 })],
            ['Todo el doc: Ancho (3,81 cm)', () => this.applyMargins('all', { top: 144, right: 144, bottom: 144, left: 144 })],
            ['Personalizar márgenes…', () => this.promptMargins()],
          ],
          () => !this.isAllowed('allowMarginEditing'),
          lucideSvg(PanelLeftClose),
        ),
        this.createLayoutMenu(
          'Orientación',
          [
            ['Pág. actual: Vertical', () => this.applyOrientation(this.currPage(), 'portrait')],
            ['Pág. actual: Horizontal', () => this.applyOrientation(this.currPage(), 'landscape')],
            ['Todo el doc: Vertical', () => this.applyOrientation('all', 'portrait')],
            ['Todo el doc: Horizontal', () => this.applyOrientation('all', 'landscape')],
          ],
          () => !this.isAllowed('allowPageSettings'),
          lucideSvg(RectangleVertical),
        ),
        this.createLayoutMenu(
          'Tamaño',
          [
            ['Carta (Letter)', () => this.pageLayout!.setPageSize('letter')],
            ['A4 (21,0 × 29,7 cm)', () => this.pageLayout!.setPageSize('a4')],
          ],
          () => !this.isAllowed('allowPageSettings'),
          lucideSvg(FileText),
        ),
        this.createLayoutMenu(
          'Columnas',
          [
            ['Una columna', () => this.pageLayout!.setColumns(1)],
            ['Dos columnas', () => this.pageLayout!.setColumns(2)],
            ['Tres columnas', () => this.pageLayout!.setColumns(3)],
          ],
          () => !this.isAllowed('allowPageSettings'),
          lucideSvg(Columns2),
        ),
      );
      setup.querySelector('[data-section-body]')!.appendChild(setupRow);
      panel.appendChild(setup);

      // 2. Saltos y Estructura
      const breaks = this.createSection('Saltos y Estructura');
      const breaksRow = document.createElement('div');
      breaksRow.className = 'flex flex-wrap items-center gap-1';
      breaksRow.append(
        this.createButton(
          {
            title: 'Insertar salto de página',
            label: `${lucideSvg(SeparatorHorizontal)}<span class="text-[10px] font-medium">Salto de pág.</span>`,
            isDisabled: () => !this.isAllowed('allowPageSettings'),
            run: () => this.pageLayout!.insertPageBreak(),
          },
          BTN_TEXT,
        ),
        this.createButton(
          {
            title: 'Números de línea',
            label: `${lucideSvg(ListOrdered)}<span class="text-[10px] font-medium">Núm. líneas</span>`,
            isActive: () => this.pageLayout!.getLineNumbers(),
            run: () => this.pageLayout!.toggleLineNumbers(),
          },
          BTN_TEXT,
        ),
      );
      breaks.querySelector('[data-section-body]')!.appendChild(breaksRow);
      panel.appendChild(breaks);

      // 3. Reglas y Medidas
      const rulerSec = this.createSection('Reglas y Medidas');
      const rulerRow = document.createElement('div');
      rulerRow.className = 'flex flex-wrap items-center gap-1';
      if (this.pageLayout.toggleRuler) {
        rulerRow.appendChild(
          this.createButton(
            {
              title: 'Mostrar u ocultar reglas duales (horizontal y vertical)',
              label: `${lucideSvg(Ruler)}<span class="text-[10px] font-medium">Reglas</span>`,
              isActive: () => this.pageLayout?.getRulerVisible?.() ?? true,
              run: () => {
                this.pageLayout?.toggleRuler?.();
                this.syncState();
              },
            },
            BTN_TEXT,
          ),
        );
      }
      rulerRow.appendChild(
        this.createButton(
          {
            title: 'Configurar medidas exactas de márgenes en cm',
            label: `${lucideSvg(Sliders)}<span class="text-[10px] font-medium">Medidas (cm)</span>`,
            isDisabled: () => !this.isAllowed('allowMarginEditing'),
            run: () => this.promptMargins(),
          },
          BTN_TEXT,
        ),
      );
      rulerSec.querySelector('[data-section-body]')!.appendChild(rulerRow);
      panel.appendChild(rulerSec);
    }

      // 4. Impresión
      const printSec = this.createSection('Impresión');
      const printRow = document.createElement('div');
      printRow.className = 'flex flex-wrap items-center gap-1';
      printRow.appendChild(
        this.createButton(
          {
            title: 'Imprimir documento (Ctrl+P)',
            label: `${lucideSvg(Printer)}<span class="text-[10px] font-medium">Imprimir</span>`,
            run: () => (this.onPrintProp ? this.onPrintProp() : window.print()),
          },
          BTN_TEXT,
        ),
      );
      printSec.querySelector('[data-section-body]')!.appendChild(printRow);
      panel.appendChild(printSec);

    // 4. Párrafo y Alineación
    const align = this.createSection('Párrafo');
    const alignRow = document.createElement('div');
    alignRow.className = 'flex flex-wrap items-center gap-0.5';
    alignRow.append(
      this.createButton({
        title: 'Alinear a la izquierda',
        label: lucideSvg(AlignLeft),
        isActive: () => ed()?.isActive({ textAlign: 'left' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('left').run(),
      }),
      this.createButton({
        title: 'Centrar',
        label: lucideSvg(AlignCenter),
        isActive: () => ed()?.isActive({ textAlign: 'center' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('center').run(),
      }),
      this.createButton({
        title: 'Alinear a la derecha',
        label: lucideSvg(AlignRight),
        isActive: () => ed()?.isActive({ textAlign: 'right' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('right').run(),
      }),
      this.createButton({
        title: 'Justificar',
        label: lucideSvg(AlignJustify),
        isActive: () => ed()?.isActive({ textAlign: 'justify' }) ?? false,
        run: () => ed()?.chain().focus().setTextAlign('justify').run(),
      }),
    );
    align.querySelector('[data-section-body]')!.appendChild(alignRow);
    panel.appendChild(align);

    return panel;
  }

  private buildOptionsPanel(): HTMLElement {
    const panel = this.createPanel('options');
    const r = () => this.getRestrictionsProp?.() || {};

    // 1. Acceso y Edición
    const accessSec = this.createSection('Modo de Acceso');
    const accessRow = document.createElement('div');
    accessRow.className = 'flex items-center gap-1.5';

    const readOnlyBtn = this.createButton(
      {
        title: 'Modo Solo Lectura: bloquea cualquier edición o cambio en el documento',
        label: `<span class="cde-tb-btn__face">${lucideSvg(Lock)}</span><span class="text-[10px] font-medium leading-none">Solo lectura</span>`,
        isActive: () => r().editable === false,
        run: () => {
          const cur = r().editable !== false;
          this.setRestrictionsProp?.({ editable: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );
    accessRow.appendChild(readOnlyBtn);
    accessSec.querySelector('[data-section-body]')!.appendChild(accessRow);
    panel.appendChild(accessSec);

    // 2. Restricciones de Contenido
    const contentSec = this.createSection('Restricciones de Contenido');
    const contentRow = document.createElement('div');
    contentRow.className = 'flex flex-wrap items-center gap-1';

    const noImgBtn = this.createButton(
      {
        title: 'Bloquear imágenes: no permite insertar imágenes, ni pegarlas ni arrastrarlas',
        label: `<span class="cde-tb-btn__face">${lucideSvg(ImageOff)}</span><span class="text-[10px]">Sin imágenes</span>`,
        isActive: () => r().allowImages === false,
        run: () => {
          const cur = r().allowImages !== false;
          this.setRestrictionsProp?.({ allowImages: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    const noTablesBtn = this.createButton(
      {
        title: 'Bloquear tablas: impide insertar y editar tablas en el documento',
        label: `<span class="cde-tb-btn__face">${lucideSvg(LucideTable)}</span><span class="text-[10px]">Sin tablas</span>`,
        isActive: () => r().allowTables === false,
        run: () => {
          const cur = r().allowTables !== false;
          this.setRestrictionsProp?.({ allowTables: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    const noLinksBtn = this.createButton(
      {
        title: 'Bloquear vínculos: impide insertar o editar enlaces en el documento',
        label: `<span class="cde-tb-btn__face">${lucideSvg(Unlink)}</span><span class="text-[10px]">Sin vínculos</span>`,
        isActive: () => r().allowLinks === false,
        run: () => {
          const cur = r().allowLinks !== false;
          this.setRestrictionsProp?.({ allowLinks: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    contentRow.append(noImgBtn, noTablesBtn, noLinksBtn);
    contentSec.querySelector('[data-section-body]')!.appendChild(contentRow);
    panel.appendChild(contentSec);

    // 3. Restricciones de Diseño
    const designSec = this.createSection('Restricciones de Diseño');
    const designRow = document.createElement('div');
    designRow.className = 'flex flex-wrap items-center gap-1';

    const noMarginsBtn = this.createButton(
      {
        title: 'Bloquear márgenes: desactiva los manejadores de regla y menús de márgenes',
        label: `<span class="cde-tb-btn__face">${lucideSvg(PanelLeftClose)}</span><span class="text-[10px]">Bloquear márgenes</span>`,
        isActive: () => r().allowMarginEditing === false,
        run: () => {
          const cur = r().allowMarginEditing !== false;
          this.setRestrictionsProp?.({ allowMarginEditing: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    const noPageSettingsBtn = this.createButton(
      {
        title: 'Bloquear ajustes de página: no permite cambiar orientación, tamaño ni columnas',
        label: `<span class="cde-tb-btn__face">${lucideSvg(FileText)}</span><span class="text-[10px]">Bloquear config. pág.</span>`,
        isActive: () => r().allowPageSettings === false,
        run: () => {
          const cur = r().allowPageSettings !== false;
          this.setRestrictionsProp?.({ allowPageSettings: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    const noFormattingBtn = this.createButton(
      {
        title: 'Bloquear formato: desactiva negrita, cursiva, fuentes, colores y estilos',
        label: `<span class="cde-tb-btn__face">${lucideSvg(RemoveFormatting)}</span><span class="text-[10px]">Bloquear formato</span>`,
        isActive: () => r().allowFormatting === false,
        run: () => {
          const cur = r().allowFormatting !== false;
          this.setRestrictionsProp?.({ allowFormatting: !cur });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    designRow.append(noMarginsBtn, noPageSettingsBtn, noFormattingBtn);
    designSec.querySelector('[data-section-body]')!.appendChild(designRow);
    panel.appendChild(designSec);

    // 4. Gestión y Seguridad
    const securitySec = this.createSection('Seguridad del Documento');
    const secRow = document.createElement('div');
    secRow.className = 'flex items-center gap-2';

    const resetBtn = this.createButton(
      {
        title: 'Restablecer todas las políticas: permitir edición total sin restricciones',
        label: `<span class="cde-tb-btn__face">${lucideSvg(RotateCcw)}</span><span class="text-[10px] font-medium">Permitir todo</span>`,
        run: () => {
          this.setRestrictionsProp?.({
            editable: true,
            allowImages: true,
            allowTables: true,
            allowMarginEditing: true,
            allowPageSettings: true,
            allowFormatting: true,
            allowLinks: true,
          });
          this.syncState();
        },
      },
      BTN_TEXT,
    );

    this.restrictionsBadgeEl = document.createElement('span');
    this.restrictionsBadgeEl.className =
      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold';
    this.updateRestrictionsBadge();

    secRow.append(resetBtn, this.restrictionsBadgeEl);
    securitySec.querySelector('[data-section-body]')!.appendChild(secRow);
    panel.appendChild(securitySec);

    return panel;
  }

  private updateRestrictionsBadge(): void {
    if (!this.restrictionsBadgeEl) return;
    const r = this.getRestrictionsProp?.() || {};
    const hasAnyRestriction =
      r.editable === false ||
      r.allowImages === false ||
      r.allowTables === false ||
      r.allowMarginEditing === false ||
      r.allowPageSettings === false ||
      r.allowFormatting === false ||
      r.allowLinks === false;

    if (hasAnyRestriction) {
      this.restrictionsBadgeEl.className =
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300';
      this.restrictionsBadgeEl.innerHTML = `${lucideSvg(ShieldAlert, 14)}<span>Restringido</span>`;
    } else {
      this.restrictionsBadgeEl.className =
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
      this.restrictionsBadgeEl.innerHTML = `${lucideSvg(ShieldCheck, 14)}<span>Sin restricciones</span>`;
    }
  }

  private currPage(): number {
    return this.pageLayout?.getCurrentPageIndex?.() ?? 0;
  }

  private applyOrientation(scope: number | 'all', orientation: PageOrientation): void {
    if (this.pageLayout?.setPageOrientation) {
      this.pageLayout.setPageOrientation(scope, orientation);
    } else {
      this.pageLayout?.setOrientation(orientation);
    }
  }

  private applyMargins(scope: number | 'all', margins: Partial<PageMargins>): void {
    if (this.pageLayout?.setPageMargins) {
      this.pageLayout.setPageMargins(scope, margins);
    } else {
      this.pageLayout?.setMargins(margins);
    }
  }

  private createLayoutMenu(
    label: string,
    items: Array<[string, () => void]>,
    isDisabled?: () => boolean,
    iconSvg?: string,
  ): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cde-combo relative';
    root.dataset.combo = 'true';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = `${BTN_TEXT} min-w-[5.25rem] justify-between`;
    trigger.title = label;
    trigger.innerHTML = `${iconSvg ? `<span class="cde-tb-btn__face">${iconSvg}</span>` : ''}<span>${label}</span>${CHEVRON}`;
    const menu = document.createElement('div');
    menu.className =
      'cde-combo__menu cde-tb-menu absolute left-0 top-[calc(100%+2px)] z-50 hidden min-w-full rounded-md border border-neutral-200 bg-white py-1 shadow-lg';
    menu.setAttribute('role', 'menu');
    for (const [itemLabel, run] of items) {
      menu.appendChild(
        this.createMenuItem(itemLabel, () => {
          run();
          this.closeCombos();
          this.syncState();
        }),
      );
    }
    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (isDisabled?.()) return;
      const open = menu.classList.contains('hidden');
      this.closeCombos();
      if (open) {
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    this.buttons.set(trigger, {
      title: label,
      label: '',
      isDisabled,
      run: () => undefined,
    });

    root.append(trigger, menu);
    return root;
  }

  private promptMargins(): void {
    const current = this.pageLayout!.getMargins();
    const raw = window.prompt(
      'Márgenes en centímetros (superior, derecho, inferior, izquierdo)',
      [current.top, current.right, current.bottom, current.left]
        .map((v) => (v / 37.8).toFixed(2))
        .join(', '),
    );
    if (!raw) return;
    const values = raw.split(',').map((v) => Number(v.trim()) * 37.8);
    if (values.length === 4 && values.every((v) => Number.isFinite(v) && v >= 0)) {
      this.pageLayout!.setMargins({
        top: values[0],
        right: values[1],
        bottom: values[2],
        left: values[3],
      });
    }
  }

  private buildViewPanel(): HTMLElement {
    const panel = this.createPanel('view');

    // 1. Vistas de Documento
    const viewsSec = this.createSection('Vistas');
    const viewsRow = document.createElement('div');
    viewsRow.className = 'flex items-center gap-1';
    viewsRow.append(
      this.createButton(
        {
          title: 'Diseño de impresión: ver las hojas con márgenes y saltos de página reales',
          label: `${lucideSvg(BookOpen, 14)}<span class="text-[10px] font-medium">Diseño de impresión</span>`,
          isActive: () => this.pageLayout?.getPagination?.() ?? true,
          run: () => {
            this.pageLayout?.setPagination?.(true);
            this.syncState();
          },
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Diseño web / Continuo: flujo continuo sin saltos de página virtuales',
          label: `${lucideSvg(Globe, 14)}<span class="text-[10px] font-medium">Diseño web</span>`,
          isActive: () => !(this.pageLayout?.getPagination?.() ?? true),
          run: () => {
            this.pageLayout?.setPagination?.(false);
            this.syncState();
          },
        },
        BTN_TEXT,
      ),
      this.createButton(
        {
          title: 'Alternar pantalla completa',
          label: `${lucideSvg(Maximize2, 14)}<span class="text-[10px] font-medium">Pantalla completa</span>`,
          isActive: () => !!document.fullscreenElement,
          run: () => {
            if (document.fullscreenElement) {
              void document.exitFullscreen();
            } else {
              const ws = (this.root.closest('.cde-workspace') || document.documentElement) as HTMLElement;
              void ws.requestFullscreen?.();
            }
          },
        },
        BTN_TEXT,
      ),
    );
    viewsSec.querySelector('[data-section-body]')!.appendChild(viewsRow);
    panel.appendChild(viewsSec);

    // 2. Mostrar
    if (this.pageLayout) {
      const showSection = this.createSection('Mostrar');
      const body = showSection.querySelector('[data-section-body]')!;
      const row = document.createElement('div');
      row.className = 'flex items-center gap-1';

      if (this.pageLayout.toggleRuler) {
        row.appendChild(
          this.createButton(
            {
              title: 'Mostrar u ocultar reglas duales (horizontal y vertical)',
              label: `${lucideSvg(Ruler, 14)}<span class="text-[10px] font-medium">Reglas</span>`,
              isActive: () => this.pageLayout?.getRulerVisible?.() ?? true,
              run: () => {
                this.pageLayout?.toggleRuler?.();
                this.syncState();
              },
            },
            BTN_TEXT,
          ),
        );
      }

      row.appendChild(
        this.createButton(
          {
            title: 'Mostrar números de línea a la izquierda del contenido',
            label: `${lucideSvg(ListOrdered, 14)}<span class="text-[10px] font-medium">Núm. líneas</span>`,
            isActive: () => this.pageLayout!.getLineNumbers(),
            run: () => {
              this.pageLayout!.toggleLineNumbers();
              this.syncState();
            },
          },
          BTN_TEXT,
        ),
      );

      body.appendChild(row);
      panel.appendChild(showSection);
    }

    // 3. Zoom
    const zoomSec = this.createSection('Zoom');
    const zoomRow = document.createElement('div');
    zoomRow.className = 'flex items-center gap-1';

    let currentZoom = 1.0;
    const getZoomTarget = (): HTMLElement | null => {
      return (
        (this.root.closest('.cde-workspace')?.querySelector('.cde-document-stage') as HTMLElement | null) ||
        (document.querySelector('.cde-document-stage') as HTMLElement | null)
      );
    };

    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'min-w-[2.5rem] text-center text-[10px] font-semibold text-neutral-700';
    zoomLabel.textContent = '100%';

    const applyZoom = (scale: number) => {
      currentZoom = Math.min(2.0, Math.max(0.5, Math.round(scale * 10) / 10));
      zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
      const target = getZoomTarget();
      if (target) {
        target.style.transform = currentZoom === 1.0 ? '' : `scale(${currentZoom})`;
        target.style.transformOrigin = 'top center';
      }
    };

    zoomRow.append(
      this.createButton(
        {
          title: 'Alejar zoom (Ctrl -)',
          label: lucideSvg(ZoomOut, 14),
          run: () => applyZoom(currentZoom - 0.1),
        },
        BTN,
      ),
      zoomLabel,
      this.createButton(
        {
          title: 'Acercar zoom (Ctrl +)',
          label: lucideSvg(ZoomIn, 14),
          run: () => applyZoom(currentZoom + 0.1),
        },
        BTN,
      ),
      this.createButton(
        {
          title: 'Restablecer escala al 100%',
          label: `${lucideSvg(Maximize, 14)}<span>100%</span>`,
          run: () => applyZoom(1.0),
        },
        BTN_TEXT,
      ),
    );
    zoomSec.querySelector('[data-section-body]')!.appendChild(zoomRow);
    panel.appendChild(zoomSec);

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
    trigger.innerHTML = `<span class="cde-tb-btn__face">${lucideSvg(MoveVertical, 14)}</span><span class="cde-tb-btn__caret">${CHEVRON}</span>`;

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
    trigger.innerHTML = `<span class="cde-tb-btn__face">${lucideSvg(ArrowDownAZ, 14)}</span><span class="cde-tb-btn__caret">${CHEVRON}</span>`;

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
    trigger.innerHTML = `<span class="cde-tb-btn__face">${lucideSvg(CaseUpper, 14)}</span><span class="cde-tb-btn__caret">${CHEVRON}</span>`;

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
    kind: 'text' | 'highlight' | 'cell' | 'table' | 'cellText' | 'border';
    title: string;
    colors: readonly string[];
    getActive: () => string | null;
    apply: (color: string | null) => void;
    /** Inline SVG/markup for the trigger; defaults per kind. */
    face?: string;
    caption?: string;
    clearLabel?: string;
    defaultSwatch?: string;
    isDisabled?: () => boolean;
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

    if (options.face) {
      face.innerHTML = options.face;
    } else if (options.kind === 'text') {
      face.innerHTML = '<span class="cde-color-trigger__letter">A</span>';
    } else {
      face.innerHTML = lucideSvg(Highlighter, 14);
    }
    face.appendChild(swatch);

    const caret = document.createElement('span');
    caret.className = 'cde-tb-btn__caret';
    caret.innerHTML = CHEVRON;

    trigger.append(face, caret);

    if (options.caption) {
      const caption = document.createElement('span');
      caption.className = 'cde-color-trigger__caption';
      caption.textContent = options.caption;
      trigger.insertBefore(caption, caret);
    }

    const fallbackSwatch =
      options.defaultSwatch ?? (options.kind === 'text' ? '#111827' : '#fef08a');

    const syncSwatch = () => {
      const active = options.getActive();
      swatch.style.background = active || fallbackSwatch;
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
      options.clearLabel ??
      (options.kind === 'text' ? 'Quitar color' : 'Quitar resaltado');
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
      isDisabled: options.isDisabled,
      run: () => undefined,
    });

    return root;
  }

  /**
   * Split button that opens a panel. `build` receives the panel and a closer so
   * callers can lay out list items, chips or grids.
   */
  private createDropdown(options: {
    title: string;
    caption?: string;
    face: string;
    className?: string;
    menuClassName?: string;
    large?: boolean;
    isActive?: () => boolean;
    isDisabled?: () => boolean;
    onOpen?: () => void;
    build: (menu: HTMLElement, close: () => void) => void;
  }): HTMLElement {
    const root = document.createElement('div');
    root.className = `cde-combo relative ${options.className ?? ''}`.trim();
    root.dataset.combo = 'true';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = options.title;
    trigger.setAttribute('aria-label', options.title);

    if (options.large) {
      trigger.className = BTN_LG;
      trigger.innerHTML = `${options.face}<span class="inline-flex items-center gap-0.5 text-[10px] font-medium leading-none">${
        options.caption ?? ''
      }<span class="cde-tb-btn__caret inline-flex">${CHEVRON}</span></span>`;
    } else {
      trigger.className = BTN_SPLIT;
      trigger.innerHTML = `<span class="cde-tb-btn__face">${options.face}</span>${
        options.caption
          ? `<span class="cde-tb-btn__text">${options.caption}</span>`
          : ''
      }<span class="cde-tb-btn__caret">${CHEVRON}</span>`;
    }

    const menu = document.createElement('div');
    menu.className = `cde-combo__menu cde-tb-menu absolute left-0 top-[calc(100%+2px)] z-50 hidden ${
      options.menuClassName ?? ''
    }`.trim();
    menu.setAttribute('role', 'menu');

    const close = () => this.closeCombos();
    options.build(menu, close);

    trigger.addEventListener('mousedown', (e) => e.preventDefault());
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;
      const willOpen = menu.classList.contains('hidden');
      this.closeCombos();
      if (willOpen) {
        options.onOpen?.();
        menu.classList.remove('hidden');
        root.classList.add('is-open');
        this.openCombo = root;
      }
    });

    root.append(trigger, menu);
    this.buttons.set(trigger, {
      title: options.title,
      label: '',
      isActive: options.isActive,
      isDisabled: options.isDisabled,
      run: () => undefined,
    });
    return root;
  }

  private createMenuItem(label: string, run: () => void): HTMLElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.className = 'cde-tb-menu__item';
    item.textContent = label;
    item.addEventListener('mousedown', (e) => e.preventDefault());
    item.addEventListener('click', () => {
      run();
      this.closeCombos();
      this.syncState();
    });
    return item;
  }

  private createMenuHeading(label: string): HTMLElement {
    const heading = document.createElement('p');
    heading.className = 'cde-tb-menu__heading';
    heading.textContent = label;
    return heading;
  }

  private createCombo(options: {
    title: string;
    options: ComboOption[];
    value: string;
    onChange: (value: string) => void;
    wide?: boolean;
    narrow?: boolean;
    medium?: boolean;
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
      options.medium ? 'min-w-[6.5rem] max-w-[8rem] justify-between' : '',
      options.narrow
        ? 'min-w-[2.75rem] max-w-[3.25rem] justify-between'
        : options.medium
          ? ''
          : 'w-full justify-between',
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
    this.syncing = true;
    this.tableAttrsCache = undefined;
    try {
      this.syncStateInternal();
    } finally {
      this.syncing = false;
      this.tableAttrsCache = undefined;
    }
  }

  private syncStateInternal(): void {
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

    const allowFmt = this.isAllowed('allowFormatting');
    this.fontFamilyCombo?.setDisabled(!hasEditor || !allowFmt);
    this.fontSizeCombo?.setDisabled(!hasEditor || !allowFmt);

    // Only on change: setDisabled(true) closes open menus.
    const tableDisabled = !this.hasTable();
    if (this.tableCombosDisabled !== tableDisabled) {
      this.tableCombosDisabled = tableDisabled;
      for (const combo of this.tableCombos) {
        combo.setDisabled(tableDisabled);
      }
    }

    const activeCell = this.activeCell();
    const attrs = this.tableAttrs();
    const cellFamily = activeCell?.fontFamily ?? attrs?.fontFamily ?? (ed?.getAttributes('textStyle').fontFamily as string | undefined);
    if (cellFamily) {
      const match = FONT_FAMILIES.find((f) =>
        f.value.toLowerCase() === cellFamily.toLowerCase() ||
        cellFamily.toLowerCase().includes(f.label.toLowerCase()) ||
        f.label.toLowerCase() === cellFamily.toLowerCase()
      );
      if (match) {
        this.fontFamilyCombo?.setValue(match.value);
        this.tableFontCombo?.setValue(match.value);
      }
    }

    const rawCellSize = activeCell?.fontSize ?? attrs?.fontSize ?? (ed?.getAttributes('textStyle').fontSize as string | undefined);
    if (rawCellSize) {
      const px = parseFontSizePx(rawCellSize);
      const formattedSize = `${px}px`;
      if (FONT_SIZES.some((s) => s.value === formattedSize)) {
        this.fontSizeCombo?.setValue(formattedSize);
        this.tableSizeCombo?.setValue(formattedSize);
      } else if (FONT_SIZES.some((s) => s.value === rawCellSize)) {
        this.fontSizeCombo?.setValue(rawCellSize);
        this.tableSizeCombo?.setValue(rawCellSize);
      }
    }

    for (const el of this.root.querySelectorAll('.cde-color-menu')) {
      const sync = (el as HTMLElement & { __syncColor?: () => void }).__syncColor;
      sync?.();
    }
  }
}

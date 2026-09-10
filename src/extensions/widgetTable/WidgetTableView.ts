import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';
import type { PageSize } from '../../types';
import { measurePageMetrics, type PageMetrics } from '../pageMetrics';
import {
  cloneAttrs,
  emptyCell,
  evaluateTableFormulas,
  MIN_COL_WIDTH,
  MIN_ROW_HEIGHT,
  normalizeAttrs,
  tablePixelWidth,
  type WidgetTableAttrs,
} from './model';

export interface WidgetTableViewProps {
  node: ProseMirrorNode;
  editor: Editor;
  getPos: () => number | undefined;
}

function cleanDomFontStyles(
  td: HTMLElement,
  prop: 'fontSize' | 'fontFamily' | 'all',
): void {
  td.querySelectorAll('*').forEach((el) => {
    const h = el as HTMLElement;
    if (prop === 'fontSize' || prop === 'all') {
      if (h.style.fontSize) h.style.fontSize = '';
      if (h.hasAttribute('size')) h.removeAttribute('size');
    }
    if (prop === 'fontFamily' || prop === 'all') {
      if (h.style.fontFamily) h.style.fontFamily = '';
      if (h.hasAttribute('face')) h.removeAttribute('face');
    }
    if (!h.getAttribute('style')?.trim()) {
      h.removeAttribute('style');
    }
  });
}

/**
 * Atomic HTML table widget. ProseMirror does not control inner cell cursors —
 * each cell is a contenteditable element whose state is continuously synchronized.
 */
export class WidgetTableView implements NodeView {
  public readonly dom: HTMLElement;
  private readonly editor: Editor;
  private readonly getPos: () => number | undefined;
  private node: ProseMirrorNode;
  private currentData: WidgetTableAttrs;
  private grid!: HTMLTableElement;
  private chrome!: HTMLElement;
  private handleLayer!: HTMLElement;
  private applying = false;
  private focused: { row: number; col: number } | null = null;
  private hasActiveFocus = false;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private cellInputDebounce: number | null = null;

  constructor(props: WidgetTableViewProps) {
    this.node = props.node;
    this.editor = props.editor;
    this.getPos = props.getPos;
    this.currentData = normalizeAttrs(this.node.attrs as Partial<WidgetTableAttrs>);

    this.dom = document.createElement('div');
    this.dom.className = 'cde-wt';
    this.dom.dataset.widgetTable = 'true';
    (this.dom as unknown as { __view: WidgetTableView }).__view = this;
    this.dom.contentEditable = 'false';

    this.chrome = this.buildChrome();
    this.grid = document.createElement('table');
    this.grid.className = 'cde-wt__grid';
    this.handleLayer = document.createElement('div');
    this.handleLayer.className = 'cde-wt__handles';
    this.handleLayer.contentEditable = 'false';

    this.dom.append(this.chrome, this.grid, this.handleLayer);
    this.render(this.currentData);

    window.addEventListener('mouseup', this.onWindowMouseUp);
    document.addEventListener('mousedown', this.onDocMouseDown, true);

    if (typeof ResizeObserver !== 'undefined') {
      let resizeTimer = 0;
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.destroyed) {
          this.layoutHandles(this.currentData);
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            if (!this.destroyed) {
              this.requestPaginationRefresh();
            }
          }, 30);
        }
      });
      this.resizeObserver.observe(this.grid);
    }
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (this.applying) return true;

    const nextData = normalizeAttrs(node.attrs as Partial<WidgetTableAttrs>);
    const prevData = this.currentData;
    this.currentData = nextData;

    // If table dimensions changed, re-render
    const dimChanged =
      nextData.cells.length !== prevData.cells.length ||
      nextData.cells.some((r, i) => r.length !== (prevData.cells[i]?.length ?? 0)) ||
      nextData.colWidths.length !== prevData.colWidths.length ||
      nextData.withHeaderRow !== prevData.withHeaderRow;

    if (dimChanged) {
      const focus = this.focused;
      this.render(nextData);
      if (focus && this.hasActiveFocus) {
        const cell = this.grid.querySelector(
          `.cde-wt__cell[data-row="${focus.row}"][data-col="${focus.col}"]`,
        ) as HTMLElement | null;
        cell?.focus();
      }
      return true;
    }

    // In-place non-destructive update while editing
    this.updateInPlace(nextData);
    return true;
  }

  private updateInPlace(data: WidgetTableAttrs): void {
    const width = tablePixelWidth(data);
    this.dom.style.width = `${width}px`;
    this.dom.style.marginRight = `${data.marginRight ?? 16}px`;
    this.dom.dataset.wrap = data.wrap || 'none';
    this.dom.classList.remove('cde-wt--wrap-none', 'cde-wt--wrap-left', 'cde-wt--wrap-right');
    this.dom.classList.add(`cde-wt--wrap-${data.wrap || 'none'}`);
    if (data.tableId) this.dom.dataset.tableId = data.tableId;
    else delete this.dom.dataset.tableId;
    if (data.isContinuation) this.dom.dataset.tableContinuation = "true";
    else delete this.dom.dataset.tableContinuation;
    if (data.hasRepeatedHeader) this.dom.dataset.tableRepeatedHeader = "true";
    else delete this.dom.dataset.tableRepeatedHeader;
    this.grid.style.width = `${width}px`;
    this.grid.style.borderStyle = data.borderStyle || '';
    this.grid.style.borderColor = data.borderColor || '';
    this.grid.style.borderWidth = data.borderWidth != null ? `${data.borderWidth}px` : '';
    this.grid.style.backgroundColor = data.backgroundColor || '';
    this.grid.style.fontFamily = data.fontFamily || '';
    this.grid.style.fontSize = data.fontSize || '';

    const cols = this.grid.querySelectorAll('col');
    data.colWidths.forEach((w, i) => {
      const col = cols[i] as HTMLElement | undefined;
      if (col) col.style.width = `${w}px`;
    });

    const rows = this.grid.querySelectorAll('tr');
    data.cells.forEach((row, r) => {
      const tr = rows[r] as HTMLTableRowElement | undefined;
      if (!tr) return;
      const rh = data.rowHeights[r];
      tr.style.height = rh != null ? `${rh}px` : '';

      const cells = tr.querySelectorAll('th, td');
      row.forEach((cell, c) => {
        const td = cells[c] as HTMLTableCellElement | undefined;
        if (!td) return;

        // Do not touch innerHTML of currently focused cell to avoid caret reset
        const isCurrentCell = this.focused?.row === r && this.focused?.col === c;
        if (!isCurrentCell) {
          if (td.innerHTML !== cell.contentHtml) {
            td.innerHTML = cell.contentHtml;
          }
        }

        td.style.backgroundColor = cell.backgroundColor || '';
        td.style.color = cell.color || '';
        const effFont = cell.fontFamily || data.fontFamily || '';
        td.style.fontFamily = effFont;
        const effSize = cell.fontSize || data.fontSize || '';
        td.style.fontSize = effSize;
        if (effFont || effSize) {
          cleanDomFontStyles(td, effFont && effSize ? 'all' : effFont ? 'fontFamily' : 'fontSize');
        }
        td.style.verticalAlign = cell.verticalAlign;
        td.style.borderStyle = cell.borderStyle || '';
        td.style.borderColor = cell.borderColor || '';
        td.style.borderWidth = cell.borderWidth != null ? `${cell.borderWidth}px` : '';
        if (cell.width) td.style.width = typeof cell.width === 'number' ? `${cell.width}px` : cell.width;
        if (cell.height) td.style.height = typeof cell.height === 'number' ? `${cell.height}px` : cell.height;
        else td.style.height = rh != null ? `${rh}px` : '';
        if (cell.rowspan && cell.rowspan > 1) td.rowSpan = cell.rowspan;
        else td.removeAttribute('rowspan');
        if (cell.colspan && cell.colspan > 1) td.colSpan = cell.colspan;
        else td.removeAttribute('colspan');
      });
    });

    this.requestPaginationRefresh();
    this.layoutHandles(data);
    this.refreshMoveButtons();
  }

  selectNode(): void {
    this.dom.classList.add('is-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected');
    this.clearCellSelection();
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement | null;
    // Allow dragging handles and clicking buttons
    if (target?.closest('.cde-wt__col-handle, .cde-wt__row-handle, .cde-wt__margin-handle, .cde-wt__btn')) {
      return true;
    }
    // Only capture events occurring strictly inside cells
    if (target?.closest('.cde-wt__cell')) {
      return true;
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  private getPageMetrics(): PageMetrics | null {
    const ext = this.editor.extensionManager.extensions.find(
      (e) => e.name === 'pagePagination',
    );
    const storage = ext?.storage as { metrics?: PageMetrics | null } | undefined;
    if (storage?.metrics) return storage.metrics;

    const workspace = this.dom.closest('.cde-workspace') as HTMLElement | null;
    const pageSize = (workspace?.dataset.pageSize as PageSize) || 'letter';
    return measurePageMetrics(pageSize);
  }

  public requestPaginationRefresh(): void {
    if (this.destroyed) return;
    try {
      const ext = this.editor.extensionManager.extensions.find(
        (e) => e.name === 'pagePagination',
      );
      const storage = ext?.storage as { requestRefresh?: () => void } | undefined;
      storage?.requestRefresh?.();
    } catch {
      // ignore
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.cellInputDebounce != null) {
      window.clearTimeout(this.cellInputDebounce);
      this.cellInputDebounce = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    document.removeEventListener('mousedown', this.onDocMouseDown, true);
    this.clearCellSelection();
    this.releaseActiveWidget();
    this.dom.replaceChildren();
  }

  public readCellsFromDom(): WidgetTableAttrs {
    const next = cloneAttrs(this.currentData);
    this.grid.querySelectorAll('.cde-wt__cell').forEach((el) => {
      const r = Number((el as HTMLElement).dataset.row);
      const c = Number((el as HTMLElement).dataset.col);
      if (!next.cells[r] || !next.cells[r]![c]) return;
      next.cells[r]![c] = {
        ...next.cells[r]![c]!,
        contentHtml: (el as HTMLElement).innerHTML || '',
      };
    });
    this.currentData = next;
    return next;
  }

  public persistCurrent(): void {
    const data = this.readCellsFromDom();
    this.persist(data);
  }

  private persist(next: WidgetTableAttrs): void {
    const pos = this.getPos();
    if (pos == null || this.destroyed) return;
    this.applying = true;
    this.currentData = next;
    this.editor.view.dispatch(
      this.editor.state.tr.setNodeMarkup(pos, undefined, next),
    );
    this.applying = false;
  }

  private selectThisNode(): void {
    const pos = this.getPos();
    if (pos == null) return;
    const { state, dispatch } = this.editor.view;
    dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
  }

  public applyFontToSelection(
    fontFamily?: string | null,
    fontSize?: string | null,
  ): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const targetCell = (container instanceof Element
      ? container
      : container.parentElement
    )?.closest('.cde-wt__cell') as HTMLElement | null;

    if (!targetCell || !this.dom.contains(targetCell)) return false;

    const row = Number(targetCell.dataset.row);
    const col = Number(targetCell.dataset.col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return false;

    const span = document.createElement('span');
    if (fontFamily) span.style.fontFamily = fontFamily;
    if (fontSize) span.style.fontSize = fontSize;

    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);

      this.onCellInput(row, col, targetCell);
      this.persistCurrent();
      return true;
    } catch {
      return false;
    }
  }

  public applyColorToSelection(color: string | null): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const targetCell = (container instanceof Element
      ? container
      : container.parentElement
    )?.closest('.cde-wt__cell') as HTMLElement | null;

    if (!targetCell || !this.dom.contains(targetCell)) return false;

    const row = Number(targetCell.dataset.row);
    const col = Number(targetCell.dataset.col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return false;

    const span = document.createElement('span');
    if (color) span.style.color = color;

    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);

      this.onCellInput(row, col, targetCell);
      this.persistCurrent();
      return true;
    } catch {
      return false;
    }
  }

  private render(data: WidgetTableAttrs): void {
    const width = tablePixelWidth(data);
    this.dom.style.width = `${width}px`;
    this.dom.style.marginRight = `${data.marginRight ?? 16}px`;
    this.dom.dataset.wrap = data.wrap || 'none';
    this.dom.classList.remove('cde-wt--wrap-none', 'cde-wt--wrap-left', 'cde-wt--wrap-right');
    this.dom.classList.add(`cde-wt--wrap-${data.wrap || 'none'}`);
    if (data.tableId) this.dom.dataset.tableId = data.tableId;
    else delete this.dom.dataset.tableId;
    if (data.isContinuation) this.dom.dataset.tableContinuation = "true";
    else delete this.dom.dataset.tableContinuation;
    if (data.hasRepeatedHeader) this.dom.dataset.tableRepeatedHeader = "true";
    else delete this.dom.dataset.tableRepeatedHeader;
    this.grid.style.width = `${width}px`;
    this.grid.style.borderStyle = data.borderStyle || '';
    this.grid.style.borderColor = data.borderColor || '';
    this.grid.style.borderWidth = data.borderWidth != null ? `${data.borderWidth}px` : '';
    this.grid.style.backgroundColor = data.backgroundColor || '';
    this.grid.style.fontFamily = data.fontFamily || '';
    this.grid.style.fontSize = data.fontSize || '';
    this.grid.replaceChildren();

    const colgroup = document.createElement('colgroup');
    data.colWidths.forEach((w) => {
      const col = document.createElement('col');
      col.style.width = `${w}px`;
      colgroup.appendChild(col);
    });
    this.grid.appendChild(colgroup);

    const tbody = document.createElement('tbody');
    data.cells.forEach((row, r) => {
      const tr = document.createElement('tr');
      const rh = data.rowHeights[r];
      if (rh != null) tr.style.height = `${rh}px`;

      row.forEach((cell, c) => {
        const tag = data.withHeaderRow && r === 0 ? 'th' : 'td';
        const td = document.createElement(tag);
        td.className = 'cde-wt__cell';
        td.dataset.row = String(r);
        td.dataset.col = String(c);
        if (this.editor.isEditable) {
          td.contentEditable = 'true';
          td.spellcheck = true;
        }
        td.innerHTML = cell.contentHtml || '';
        if (cell.backgroundColor) td.style.backgroundColor = cell.backgroundColor;
        if (cell.color) td.style.color = cell.color;
        const effFont = cell.fontFamily || data.fontFamily || '';
        if (effFont) td.style.fontFamily = effFont;
        const effSize = cell.fontSize || data.fontSize || '';
        if (effSize) td.style.fontSize = effSize;
        if (effFont || effSize) {
          cleanDomFontStyles(td, effFont && effSize ? 'all' : effFont ? 'fontFamily' : 'fontSize');
        }
        td.style.verticalAlign = cell.verticalAlign;
        if (cell.borderStyle) td.style.borderStyle = cell.borderStyle;
        if (cell.borderColor) td.style.borderColor = cell.borderColor;
        if (cell.borderWidth != null) td.style.borderWidth = `${cell.borderWidth}px`;
        if (cell.width) td.style.width = typeof cell.width === 'number' ? `${cell.width}px` : cell.width;
        if (cell.height) td.style.height = typeof cell.height === 'number' ? `${cell.height}px` : cell.height;
        else if (rh != null) td.style.height = `${rh}px`;
        if (cell.rowspan && cell.rowspan > 1) td.rowSpan = cell.rowspan;
        if (cell.colspan && cell.colspan > 1) td.colSpan = cell.colspan;

        td.addEventListener('focus', () => this.onCellFocus(r, c));
        td.addEventListener('blur', () => this.onCellBlur());
        td.addEventListener('input', () => this.onCellInput(r, c, td));
        td.addEventListener('paste', (e) => this.onCellPaste(e, r, c, td));
        td.addEventListener('keydown', (e) => this.onCellKeyDown(e, r, c, data));
        td.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          this.onCellMouseDown(e, r, c);
        });
        td.addEventListener('mouseenter', () => this.onCellMouseEnter(r, c));

        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    this.grid.appendChild(tbody);

    this.selectedCells = this.selectedCells.filter(
      ({ row, col }) => col < (data.cells[row]?.length ?? 0),
    );
    this.paintCellSelection();
    this.requestPaginationRefresh();
    this.layoutHandles(data);
    this.refreshMoveButtons();
  }

  private layoutHandles(data: WidgetTableAttrs): void {
    this.handleLayer.replaceChildren();
    if (!this.editor.isEditable) return;

    const gridRect = this.grid.getBoundingClientRect();
    const domRect = this.dom.getBoundingClientRect();
    const gridWidth = Math.round(gridRect.width) || tablePixelWidth(data);
    const gridHeight = Math.round(gridRect.height);

    const rows = Array.from(this.grid.querySelectorAll('tr'));
    if (rows.length === 0) return;

    // Per-cell border drag handles
    rows.forEach((tr, r) => {
      let currentVirtualCol = 0;
      const cells = Array.from(tr.querySelectorAll('th, td'));
      cells.forEach((cellEl, c) => {
        const cellRect = cellEl.getBoundingClientRect();
        if (cellRect.width === 0 || cellRect.height === 0) return;

        const cellX = Math.round(cellRect.left - domRect.left);
        const cellY = Math.round(cellRect.top - domRect.top);
        const cellW = Math.round(cellRect.width);
        const cellH = Math.round(cellRect.height);
        const right = cellX + cellW;
        const bottom = cellY + cellH;

        // Leftmost border handle of the first cell
        if (c === 0 && r === 0) {
          const leftHandle = document.createElement('div');
          leftHandle.className = 'cde-wt__col-handle';
          leftHandle.title = 'Arrastrar para cambiar el ancho';
          leftHandle.style.left = `${cellX}px`;
          leftHandle.style.top = '0px';
          leftHandle.style.height = `${gridHeight}px`;
          leftHandle.addEventListener('mousedown', (e) => this.startLeftColResize(e, data));
          this.handleLayer.appendChild(leftHandle);
        }

        const cellData = data.cells[r]?.[c];
        const span = cellData?.colspan || 1;
        currentVirtualCol += span;
        const targetColIdx = currentVirtualCol - 1;

        const rSpan = cellData?.rowspan || 1;
        const targetRowIdx = r + rSpan - 1;

        // Vertical right border handle (scoped strictly to this cell's height and vertical span)
        const colHandle = document.createElement('div');
        colHandle.className = 'cde-wt__col-handle';
        colHandle.title = 'Arrastrar para cambiar el ancho';
        colHandle.style.left = `${right}px`;
        colHandle.style.top = `${cellY}px`;
        colHandle.style.height = `${cellH}px`;
        colHandle.addEventListener('mousedown', (e) =>
          this.startColResize(e, targetColIdx, right, cellY, cellH, data),
        );
        this.handleLayer.appendChild(colHandle);

        // Horizontal bottom border handle (scoped strictly to this cell's width and horizontal span)
        const rowHandle = document.createElement('div');
        rowHandle.className = 'cde-wt__row-handle';
        rowHandle.title = 'Arrastrar para cambiar el alto';
        rowHandle.style.top = `${bottom}px`;
        rowHandle.style.left = `${cellX}px`;
        rowHandle.style.width = `${cellW}px`;
        rowHandle.addEventListener('mousedown', (e) =>
          this.startRowResize(e, targetRowIdx, bottom, cellX, cellW, data),
        );
        this.handleLayer.appendChild(rowHandle);
      });
    });

    // Spacing / Margin handle on right edge (strictly bounded within page content width)
    const canvas = this.canvasWidth();
    const available = Math.max(0, canvas - gridWidth);
    const m = Math.min(data.marginRight ?? 16, available);

    if (available > 4) {
      const marginHandle = document.createElement('div');
      marginHandle.className = 'cde-wt__margin-handle';
      marginHandle.title = 'Arrastrar para separar tablas. Clic para escribir texto en este espacio.';
      marginHandle.style.left = `${gridWidth}px`;
      marginHandle.style.width = `${Math.min(available, Math.max(14, m))}px`;
      marginHandle.style.height = `${gridHeight}px`;
      marginHandle.addEventListener('mousedown', (e) => this.handleMarginClickOrDrag(e, data));
      this.handleLayer.appendChild(marginHandle);
    }
  }

  private handleMarginClickOrDrag(event: MouseEvent, snapshot: WidgetTableAttrs): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    snapshot = this.readCellsFromDom();
    this.selectThisNode();

    const startX = event.clientX;
    const startY = event.clientY;
    const startM = snapshot.marginRight ?? 16;
    let current = startM;
    let hasDragged = false;

    let guide: HTMLElement | null = null;
    const gridW = this.grid.offsetWidth || tablePixelWidth(snapshot);
    const gridH = this.grid.offsetHeight;

    const onMove = (e: MouseEvent): void => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      if (!hasDragged && Math.hypot(deltaX, deltaY) > 3) {
        hasDragged = true;
        guide = document.createElement('div');
        guide.className = 'cde-wt__guide cde-wt__guide--col';
        guide.style.left = `${gridW + startM}px`;
        guide.style.top = '0px';
        guide.style.height = `${gridH}px`;
        this.dom.appendChild(guide);
      }

      if (hasDragged && guide) {
        const maxMargin = Math.max(0, this.canvasWidth() - gridW);
        current = Math.max(0, Math.min(maxMargin, Math.round(startM + deltaX)));
        this.dom.style.marginRight = `${current}px`;
        guide.style.left = `${gridW + current}px`;
      }
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (guide) guide.remove();

      if (hasDragged) {
        const next = cloneAttrs(snapshot);
        next.marginRight = current;
        this.persist(next);
        this.layoutHandles(next);
      } else {
        this.insertOrFocusParagraphBetween();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private insertOrFocusParagraphBetween(): void {
    const pos = this.getPos();
    if (pos == null) return;
    const tableNode = this.editor.state.doc.nodeAt(pos);
    if (!tableNode) return;

    const afterPos = pos + tableNode.nodeSize;
    const { state, view } = this.editor;
    const nextNode = state.doc.nodeAt(afterPos);

    if (nextNode && nextNode.type.name === 'paragraph') {
      view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, afterPos)));
      this.editor.commands.focus(afterPos + 1);
    } else {
      this.editor.chain()
        .insertContentAt(afterPos, { type: 'paragraph' })
        .focus(afterPos + 1)
        .run();
    }
  }

  private startLeftColResize(event: MouseEvent, snapshot: WidgetTableAttrs): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    snapshot = this.readCellsFromDom();
    this.clearCellSelection();
    this.selectThisNode();

    const startX = event.clientX;
    const startW = snapshot.colWidths[0] ?? MIN_COL_WIDTH;
    const cols = this.grid.querySelectorAll('col');
    const canvas = this.canvasWidth();
    let current = startW;

    const guide = document.createElement('div');
    guide.className = 'cde-wt__guide cde-wt__guide--col';
    guide.style.left = '0px';
    guide.style.top = '0px';
    guide.style.height = `${this.grid.offsetHeight}px`;

    const badge = document.createElement('div');
    badge.className = 'cde-wt__guide-badge';
    badge.textContent = `${current} px`;
    guide.appendChild(badge);
    this.dom.appendChild(guide);

    const onMove = (e: MouseEvent): void => {
      const deltaX = e.clientX - startX;
      const others = snapshot.colWidths.reduce(
        (sum, w, i) => (i === 0 ? sum : sum + w),
        0,
      );
      const isWrapped = snapshot.wrap === 'left' || snapshot.wrap === 'right';
      const m = isWrapped ? (snapshot.marginRight ?? 16) : 0;
      const max = Math.max(MIN_COL_WIDTH, canvas - others - m);
      current = Math.max(MIN_COL_WIDTH, Math.min(max, Math.round(startW - deltaX)));
      const colEl = cols[0] as HTMLElement | undefined;
      if (colEl) colEl.style.width = `${current}px`;
      const widths = snapshot.colWidths.map((w, i) => (i === 0 ? current : w));
      const total = widths.reduce((s, w) => s + w, 0);
      this.grid.style.width = `${total}px`;
      this.dom.style.width = `${total}px`;
      guide.style.left = `${startW - current}px`;
      badge.textContent = `${current} px`;
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      guide.remove();
      const next = cloneAttrs(snapshot);
      next.colWidths[0] = current;
      next.cells.forEach((row) => {
        if (row[0]) delete row[0].width;
      });
      this.persist(next);
      this.layoutHandles(next);
      this.requestPaginationRefresh();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private startColResize(
    event: MouseEvent,
    colIndex: number,
    initialRight: number,
    cellY: number,
    cellH: number,
    snapshot: WidgetTableAttrs,
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    snapshot = this.readCellsFromDom();
    this.clearCellSelection();
    this.selectThisNode();

    const startX = event.clientX;
    const startW = snapshot.colWidths[colIndex] ?? MIN_COL_WIDTH;
    const canvas = this.canvasWidth();
    const cols = this.grid.querySelectorAll('col');
    let current = startW;

    const guide = document.createElement('div');
    guide.className = 'cde-wt__guide cde-wt__guide--col';
    guide.style.left = `${initialRight}px`;
    guide.style.top = `${cellY}px`;
    guide.style.height = `${cellH}px`;

    const badge = document.createElement('div');
    badge.className = 'cde-wt__guide-badge';
    badge.textContent = `${startW} px`;
    guide.appendChild(badge);
    this.dom.appendChild(guide);

    const onMove = (e: MouseEvent): void => {
      const deltaX = Math.round(e.clientX - startX);
      const others = snapshot.colWidths.reduce(
        (sum, w, i) => (i === colIndex ? sum : sum + w),
        0,
      );
      const isWrapped = snapshot.wrap === 'left' || snapshot.wrap === 'right';
      const m = isWrapped ? (snapshot.marginRight ?? 16) : 0;
      const max = Math.max(MIN_COL_WIDTH, canvas - others - m);
      current = Math.max(MIN_COL_WIDTH, Math.min(max, startW + deltaX));

      const colEl = cols[colIndex] as HTMLElement | undefined;
      if (colEl) colEl.style.width = `${current}px`;

      const widths = snapshot.colWidths.map((w, i) => (i === colIndex ? current : w));
      const total = widths.reduce((s, w) => s + w, 0);
      this.grid.style.width = `${total}px`;
      this.dom.style.width = `${total}px`;

      guide.style.left = `${initialRight + (current - startW)}px`;
      badge.textContent = `${current} px`;
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      guide.remove();
      const next = cloneAttrs(snapshot);
      next.colWidths[colIndex] = current;
      next.cells.forEach((row) => {
        const cell = row[colIndex];
        if (cell) delete cell.width;
      });
      this.persist(next);
      this.layoutHandles(next);
      this.requestPaginationRefresh();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private startRowResize(
    event: MouseEvent,
    row: number,
    initialBottom: number,
    cellX: number,
    cellW: number,
    snapshot: WidgetTableAttrs,
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    snapshot = this.readCellsFromDom();
    this.clearCellSelection();
    this.selectThisNode();

    const tr = this.grid.querySelectorAll('tr')[row] as HTMLTableRowElement | undefined;
    if (!tr) return;

    const startY = event.clientY;
    const startH = Math.max(MIN_ROW_HEIGHT, Math.round(tr.getBoundingClientRect().height));
    let current = startH;

    const guide = document.createElement('div');
    guide.className = 'cde-wt__guide cde-wt__guide--row';
    guide.style.top = `${initialBottom}px`;
    guide.style.left = `${cellX}px`;
    guide.style.width = `${cellW}px`;

    const badge = document.createElement('div');
    badge.className = 'cde-wt__guide-badge';
    badge.textContent = `${current} px`;
    guide.appendChild(badge);
    this.dom.appendChild(guide);

    tr.classList.add('is-resizing');

    const onMove = (e: MouseEvent): void => {
      const deltaY = Math.round(e.clientY - startY);
      current = Math.max(MIN_ROW_HEIGHT, startH + deltaY);
      guide.style.top = `${initialBottom + (current - startH)}px`;
      badge.textContent = `${current} px`;

      tr.style.height = `${current}px`;
      tr.querySelectorAll('th, td').forEach((cell) => {
        (cell as HTMLElement).style.height = `${current}px`;
      });
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      guide.remove();
      tr.classList.remove('is-resizing');
      const next = cloneAttrs(snapshot);
      next.rowHeights[row] = current;
      next.cells[row]?.forEach((cell) => {
        delete cell.height;
      });
      this.persist(next);
      this.layoutHandles(next);
      this.requestPaginationRefresh();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private canvasWidth(): number {
    const metrics = this.getPageMetrics();
    if (metrics?.bodyWidthPx) {
      return metrics.bodyWidthPx;
    }
    const pm = this.editor.view.dom as HTMLElement;
    if (!pm) return 624;
    const style = window.getComputedStyle(pm);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    return Math.max(100, Math.floor(pm.clientWidth - padLeft - padRight));
  }

  private isSelectingCells = false;
  private selectionAnchor: { row: number; col: number } | null = null;
  private selectedCells: Array<{ row: number; col: number }> = [];

  private readonly onWindowMouseUp = (): void => {
    this.isSelectingCells = false;
  };

  private readonly onDocMouseDown = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Node) || this.dom.contains(target)) return;
    // The ribbon and the context menu operate on the table being edited.
    const el = target instanceof Element ? target : target.parentElement;
    if (el?.closest('.cde-toolbar, .cde-ctx-menu')) return;
    this.clearCellSelection();
    this.releaseActiveWidget();
    this.dom.classList.remove('is-selected');
  };

  private releaseActiveWidget(): void {
    const storage = this.editor.storage as {
      table?: { activeWidget?: WidgetTableView | null };
    };
    if (storage.table?.activeWidget === this) {
      storage.table.activeWidget = null;
    }
  }

  private onCellMouseDown(e: MouseEvent, r: number, c: number): void {
    if (e.button !== 0) return;
    if (e.shiftKey && this.focused) {
      e.preventDefault();
      this.selectCellRange(this.focused.row, this.focused.col, r, c);
      return;
    }

    this.isSelectingCells = true;
    this.selectionAnchor = { row: r, col: c };
    // A single click is editing, not a sticky selection highlight.
    this.clearCellSelection();
  }

  private onCellMouseEnter(r: number, c: number): void {
    if (!this.isSelectingCells || !this.selectionAnchor) return;
    const a = this.selectionAnchor;
    if (a.row === r && a.col === c && this.selectedCells.length <= 1) return;
    this.selectCellRange(a.row, a.col, r, c);
  }

  public clearCellSelection(): void {
    this.selectedCells = [];
    this.grid.querySelectorAll('.is-selected-cell').forEach((el) => {
      el.classList.remove('is-selected-cell');
    });
    const storage = this.editor.storage as {
      table?: { row: number; col: number; selectedCells?: Array<{ row: number; col: number }>; activeWidget?: WidgetTableView };
    };
    if (storage.table) {
      storage.table.selectedCells = [];
    }
  }

  public selectCellRange(r1: number, c1: number, r2: number, c2: number): void {
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);

    // Only cells that exist: merged rows are shorter than the column count.
    const cells: Array<{ row: number; col: number }> = [];
    for (let r = minR; r <= maxR; r += 1) {
      const row = this.currentData.cells[r];
      if (!row) continue;
      for (let c = minC; c <= maxC; c += 1) {
        if (c < row.length) cells.push({ row: r, col: c });
      }
    }

    this.selectedCells = cells.length > 1 ? cells : [];
    this.paintCellSelection();

    const storage = this.editor.storage as {
      table?: { row: number; col: number; selectedCells?: Array<{ row: number; col: number }>; activeWidget?: WidgetTableView };
    };
    if (storage.table) {
      storage.table.selectedCells = [...this.selectedCells];
    }
  }

  /** Mirror `selectedCells` onto the DOM; also used after a re-render. */
  private paintCellSelection(): void {
    this.grid.querySelectorAll('.is-selected-cell').forEach((el) => {
      el.classList.remove('is-selected-cell');
    });
    if (this.selectedCells.length <= 1) return;
    for (const { row, col } of this.selectedCells) {
      this.grid
        .querySelector(`.cde-wt__cell[data-row="${row}"][data-col="${col}"]`)
        ?.classList.add('is-selected-cell');
    }
  }

  /**
   * Cells the user sees highlighted. Commands use this instead of the shared
   * storage so a re-render or a focus hand-off cannot silently shrink it.
   */
  public getSelection(): Array<{ row: number; col: number }> {
    const fromDom: Array<{ row: number; col: number }> = [];
    this.grid.querySelectorAll('.cde-wt__cell.is-selected-cell').forEach((el) => {
      const row = Number((el as HTMLElement).dataset.row);
      const col = Number((el as HTMLElement).dataset.col);
      if (Number.isFinite(row) && Number.isFinite(col)) fromDom.push({ row, col });
    });
    if (fromDom.length > 1) return fromDom;
    return this.selectedCells.length > 1 ? [...this.selectedCells] : [];
  }

  private onCellFocus(row: number, col: number): void {
    this.focused = { row, col };
    this.hasActiveFocus = true;
    const storage = this.editor.storage as {
      table?: { row: number; col: number; selectedCells?: Array<{ row: number; col: number }>; activeWidget?: WidgetTableView };
    };
    storage.table = {
      row,
      col,
      selectedCells: this.selectedCells.length > 0 ? this.selectedCells : [{ row, col }],
      activeWidget: this,
    };
  }

  private onCellInput(row: number, col: number, td: HTMLElement): void {
    if (this.currentData.cells[row]?.[col]) {
      this.currentData.cells[row]![col]!.contentHtml = td.innerHTML;
    }
    if (this.cellInputDebounce != null) {
      window.clearTimeout(this.cellInputDebounce);
    }
    this.cellInputDebounce = window.setTimeout(() => {
      this.cellInputDebounce = null;
      if (!this.destroyed) {
        this.persistCurrent();
      }
    }, 250);
  }

  private onCellPaste(
    event: ClipboardEvent,
    row: number,
    col: number,
    td: HTMLElement,
  ): void {
    event.stopPropagation();
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    // Handle image file paste directly into cell
    if (clipboardData.files && clipboardData.files.length > 0) {
      const file = clipboardData.files[0];
      if (file && file.type.startsWith('image/')) {
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          document.execCommand(
            'insertHTML',
            false,
            `<img src="${src}" class="cde-wt__img" style="max-width:100%;height:auto;display:block;margin:0.25em 0;" />`,
          );
          this.onCellInput(row, col, td);
        };
        reader.readAsDataURL(file);
        return;
      }
    }

    // Handle rich HTML (nested tables, lists, formatted text)
    const html = clipboardData.getData('text/html');
    if (html) {
      event.preventDefault();
      document.execCommand('insertHTML', false, html);
      this.onCellInput(row, col, td);
      return;
    }

    // Handle plain text
    const text = clipboardData.getData('text/plain');
    if (text) {
      event.preventDefault();
      document.execCommand('insertText', false, text);
      this.onCellInput(row, col, td);
    }
  }

  private onCellBlur(): void {
    if (this.cellInputDebounce != null) {
      window.clearTimeout(this.cellInputDebounce);
      this.cellInputDebounce = null;
    }
    let data = this.readCellsFromDom();
    const hasFormula = data.cells.some((r) => r.some((c) => c.contentHtml.replace(/<[^>]+>/g, '').trim().startsWith('=')));
    if (hasFormula) {
      data = evaluateTableFormulas(data);
      this.currentData = data;
      this.updateInPlace(data);
    }
    this.hasActiveFocus = false;
    this.persist(data);
    // The cell selection is deliberately kept: losing focus to the ribbon, the
    // context menu or `chain().focus()` must not shrink what a command sees.
    // onDocMouseDown clears it when the user really clicks outside the table.
  }

  private onCellKeyDown(
    event: KeyboardEvent,
    row: number,
    col: number,
    data: WidgetTableAttrs,
  ): void {
    // Rich text shortcuts inside cell
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        document.execCommand('bold', false);
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        document.execCommand('italic', false);
        return;
      }
      if (key === 'u') {
        event.preventDefault();
        document.execCommand('underline', false);
        return;
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.clearCellSelection();
      this.dom.classList.remove('is-selected');
      (event.target as HTMLElement).blur();
      this.editor.view.focus();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const rows = data.cells.length;
      let r = row;
      let c = col;

      if (event.shiftKey) {
        c -= 1;
        if (c < 0) {
          r -= 1;
          if (r >= 0) {
            c = (data.cells[r]?.length ?? 1) - 1;
          }
        }
      } else {
        c += 1;
        const currentLen = data.cells[r]?.length ?? 1;
        if (c >= currentLen) {
          c = 0;
          r += 1;
        }
      }

      if (r >= 0 && r < rows) {
        const next = this.grid.querySelector(
          `.cde-wt__cell[data-row="${r}"][data-col="${c}"]`,
        ) as HTMLElement | null;
        next?.focus();
      } else if (r >= rows && !event.shiftKey) {
        // Tab in terminal cell: append a new row matching structure
        const currentData = this.readCellsFromDom();
        const next = cloneAttrs(currentData);
        const lastRow = next.cells[next.cells.length - 1] ?? [];
        const newRow = lastRow.map((cell) => ({ ...emptyCell(), colspan: cell.colspan || 1 }));
        next.cells.push(newRow);
        next.rowHeights.push(null);
        this.render(next);
        this.persist(next);
        requestAnimationFrame(() => {
          const newCell = this.grid.querySelector(
            `.cde-wt__cell[data-row="${rows}"][data-col="0"]`,
          ) as HTMLElement | null;
          newCell?.focus();
        });
      }
      return;
    }

    // Allow Enter / Shift+Enter to insert line breaks inside cell rather than breaking ProseMirror block
    if (event.key === 'Enter') {
      event.stopPropagation();
      return;
    }

    event.stopPropagation();
  }

  private buildChrome(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'cde-wt__chrome';

    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'cde-wt__btn';
    up.dataset.move = 'up';
    up.title = 'Mover tabla un renglón arriba';
    up.textContent = '↑';
    up.addEventListener('mousedown', (e) => e.preventDefault());
    up.addEventListener('click', (e) => {
      e.preventDefault();
      this.moveByBlock('up');
    });

    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'cde-wt__btn';
    down.dataset.move = 'down';
    down.title = 'Mover tabla un renglón abajo';
    down.textContent = '↓';
    down.addEventListener('mousedown', (e) => e.preventDefault());
    down.addEventListener('click', (e) => {
      e.preventDefault();
      this.moveByBlock('down');
    });

    bar.append(up, down);
    return bar;
  }

  private refreshMoveButtons(): void {
    const info = this.blockInfo();
    const up = this.chrome.querySelector<HTMLButtonElement>('[data-move="up"]');
    const down = this.chrome.querySelector<HTMLButtonElement>('[data-move="down"]');
    if (up) up.disabled = !info || info.index <= 0;
    if (down) down.disabled = !info || info.index >= info.parent.childCount - 1;
  }

  private blockInfo(): {
    tablePos: number;
    index: number;
    parent: ProseMirrorNode;
  } | null {
    const pos = this.getPos();
    if (pos == null) return null;
    const $pos = this.editor.state.doc.resolve(pos);
    return {
      tablePos: pos,
      index: $pos.index(),
      parent: $pos.parent,
    };
  }

  private moveByBlock(direction: 'up' | 'down'): void {
    this.clearCellSelection();
    this.persist(this.readCellsFromDom());
    const info = this.blockInfo();
    if (!info) return;
    const { tablePos, index, parent } = info;
    const tableNode = this.editor.state.doc.nodeAt(tablePos);
    if (!tableNode) return;

    if (direction === 'up') {
      if (index <= 0) return;
      const prev = parent.child(index - 1);
      const start = tablePos - prev.nodeSize;
      const end = tablePos + tableNode.nodeSize;
      this.editor.view.dispatch(
        this.editor.state.tr
          .replaceWith(start, end, Fragment.from([tableNode, prev]))
          .scrollIntoView(),
      );
    } else {
      if (index >= parent.childCount - 1) return;
      const next = parent.child(index + 1);
      const start = tablePos;
      const end = tablePos + tableNode.nodeSize + next.nodeSize;
      this.editor.view.dispatch(
        this.editor.state.tr
          .replaceWith(start, end, Fragment.from([next, tableNode]))
          .scrollIntoView(),
      );
    }
  }
}

import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';
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

  constructor(props: WidgetTableViewProps) {
    this.node = props.node;
    this.editor = props.editor;
    this.getPos = props.getPos;
    this.currentData = normalizeAttrs(this.node.attrs as Partial<WidgetTableAttrs>);

    this.dom = document.createElement('div');
    this.dom.className = 'cde-wt';
    this.dom.dataset.widgetTable = 'true';
    this.dom.contentEditable = 'false';

    this.chrome = this.buildChrome();
    this.grid = document.createElement('table');
    this.grid.className = 'cde-wt__grid';
    this.handleLayer = document.createElement('div');
    this.handleLayer.className = 'cde-wt__handles';
    this.handleLayer.contentEditable = 'false';

    this.dom.append(this.chrome, this.grid, this.handleLayer);
    this.render(this.currentData);

    window.addEventListener('mouseup', () => {
      this.isSelectingCells = false;
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.destroyed) {
          this.layoutHandles(this.currentData);
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

    // If table dimensions changed or not active, re-render
    const dimChanged =
      nextData.cells.length !== prevData.cells.length ||
      nextData.cells.some((r, i) => r.length !== (prevData.cells[i]?.length ?? 0)) ||
      nextData.colWidths.length !== prevData.colWidths.length ||
      nextData.withHeaderRow !== prevData.withHeaderRow;

    if (!this.hasActiveFocus || dimChanged) {
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
    this.grid.style.width = `${width}px`;
    this.grid.style.borderStyle = data.borderStyle || '';
    this.grid.style.borderColor = data.borderColor || '';
    this.grid.style.borderWidth = data.borderWidth != null ? `${data.borderWidth}px` : '';
    this.grid.style.backgroundColor = data.backgroundColor || '';

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

    this.layoutHandles(data);
    this.refreshMoveButtons();
  }

  selectNode(): void {
    this.dom.classList.add('is-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected');
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

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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

  private render(data: WidgetTableAttrs): void {
    const width = tablePixelWidth(data);
    this.dom.style.width = `${width}px`;
    this.dom.style.marginRight = `${data.marginRight ?? 16}px`;
    this.dom.dataset.wrap = data.wrap || 'none';
    this.dom.classList.remove('cde-wt--wrap-none', 'cde-wt--wrap-left', 'cde-wt--wrap-right');
    this.dom.classList.add(`cde-wt--wrap-${data.wrap || 'none'}`);
    this.grid.style.width = `${width}px`;
    this.grid.style.borderStyle = data.borderStyle || '';
    this.grid.style.borderColor = data.borderColor || '';
    this.grid.style.borderWidth = data.borderWidth != null ? `${data.borderWidth}px` : '';
    this.grid.style.backgroundColor = data.backgroundColor || '';
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

    this.layoutHandles(data);
    this.refreshMoveButtons();
  }

  private layoutHandles(data: WidgetTableAttrs): void {
    this.handleLayer.replaceChildren();
    if (!this.editor.isEditable || this.destroyed) return;

    const gridWidth = this.grid.offsetWidth || tablePixelWidth(data);
    const gridHeight = this.grid.offsetHeight;
    this.handleLayer.style.width = `${gridWidth}px`;
    this.handleLayer.style.height = `${gridHeight}px`;

    // Left-most outer border handle (resizes column 0)
    const leftHandle = document.createElement('div');
    leftHandle.className = 'cde-wt__col-handle cde-wt__col-handle--left';
    leftHandle.title = 'Arrastrar para cambiar el ancho de la primera columna';
    leftHandle.style.left = '0px';
    leftHandle.style.height = `${gridHeight}px`;
    leftHandle.addEventListener('mousedown', (e) => this.startLeftColResize(e, data));
    this.handleLayer.appendChild(leftHandle);

    // Collect exact column boundary positions across all rows
    const colEdges = new Map<number, { gridColIndex: number; right: number }>();
    const rows = this.grid.querySelectorAll('tbody > tr');

    rows.forEach((tr, r) => {
      let currentVirtualCol = 0;
      const cells = tr.querySelectorAll('th, td');
      cells.forEach((td, c) => {
        const cellData = data.cells[r]?.[c];
        const span = cellData?.colspan || 1;
        currentVirtualCol += span;
        const targetColIdx = currentVirtualCol - 1;
        const cellEl = td as HTMLElement;
        const right = cellEl.offsetLeft + cellEl.offsetWidth;
        if (!colEdges.has(targetColIdx) || right > (colEdges.get(targetColIdx)?.right ?? 0)) {
          colEdges.set(targetColIdx, { gridColIndex: targetColIdx, right });
        }
      });
    });

    colEdges.forEach(({ gridColIndex, right }) => {
      const handle = document.createElement('div');
      handle.className = 'cde-wt__col-handle';
      handle.title = 'Arrastrar para cambiar el ancho';
      handle.style.left = `${right}px`;
      handle.style.height = `${gridHeight}px`;
      handle.addEventListener('mousedown', (e) => this.startColResize(e, gridColIndex, right, data));
      this.handleLayer.appendChild(handle);
    });

    // Spacing / Margin handle on right edge
    const m = data.marginRight ?? 16;
    const marginHandle = document.createElement('div');
    marginHandle.className = 'cde-wt__margin-handle';
    marginHandle.title = 'Arrastrar para separar tablas. Clic para escribir texto en este espacio.';
    marginHandle.style.left = `${gridWidth}px`;
    marginHandle.style.width = `${Math.max(14, m)}px`;
    marginHandle.style.height = `${gridHeight}px`;
    marginHandle.addEventListener('mousedown', (e) => this.handleMarginClickOrDrag(e, data));
    this.handleLayer.appendChild(marginHandle);

    // Measure exact DOM boundaries for rows
    rows.forEach((tr, i) => {
      const trEl = tr as HTMLElement;
      const bottom = trEl.offsetTop + trEl.offsetHeight;
      const handle = document.createElement('div');
      handle.className = 'cde-wt__row-handle';
      handle.title = 'Arrastrar para cambiar el alto';
      handle.style.top = `${bottom}px`;
      handle.style.width = `${gridWidth}px`;
      handle.addEventListener('mousedown', (e) => this.startRowResize(e, i, bottom, data));
      this.handleLayer.appendChild(handle);
    });
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

    const onMove = (e: MouseEvent): void => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      if (!hasDragged && Math.hypot(deltaX, deltaY) > 3) {
        hasDragged = true;
        guide = document.createElement('div');
        guide.className = 'cde-wt__guide cde-wt__guide--col';
        guide.style.left = `${gridW + startM}px`;
        this.dom.appendChild(guide);
      }

      if (hasDragged && guide) {
        current = Math.max(0, Math.min(500, Math.round(startM + deltaX)));
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
    this.selectThisNode();

    const startX = event.clientX;
    const startW = snapshot.colWidths[0] ?? MIN_COL_WIDTH;
    const cols = this.grid.querySelectorAll('col');
    const canvas = this.canvasWidth();
    let current = startW;

    const guide = document.createElement('div');
    guide.className = 'cde-wt__guide cde-wt__guide--col';
    guide.style.left = '0px';
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
      const max = Math.max(MIN_COL_WIDTH, canvas - others);
      current = Math.max(MIN_COL_WIDTH, Math.min(max, Math.round(startW - deltaX)));
      const colEl = cols[0] as HTMLElement | undefined;
      if (colEl) colEl.style.width = `${current}px`;
      const widths = snapshot.colWidths.map((w, i) => (i === 0 ? current : w));
      const total = widths.reduce((s, w) => s + w, 0);
      this.grid.style.width = `${total}px`;
      this.dom.style.width = `${total}px`;
      badge.textContent = `${current} px`;
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      guide.remove();
      const next = cloneAttrs(snapshot);
      next.colWidths[0] = current;
      this.persist(next);
      this.layoutHandles(next);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private startColResize(
    event: MouseEvent,
    colIndex: number,
    initialRight: number,
    snapshot: WidgetTableAttrs,
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    snapshot = this.readCellsFromDom();
    this.selectThisNode();

    const startX = event.clientX;
    const startW = snapshot.colWidths[colIndex] ?? MIN_COL_WIDTH;
    const canvas = this.canvasWidth();
    let current = startW;

    const guide = document.createElement('div');
    guide.className = 'cde-wt__guide cde-wt__guide--col';
    guide.style.left = `${initialRight}px`;
    guide.style.height = `${this.grid.offsetHeight}px`;

    const badge = document.createElement('div');
    badge.className = 'cde-wt__guide-badge';
    badge.textContent = `${current} px`;
    guide.appendChild(badge);
    this.dom.appendChild(guide);

    const onMove = (e: MouseEvent): void => {
      const deltaX = e.clientX - startX;
      const others = snapshot.colWidths.reduce(
        (sum, w, i) => (i === colIndex ? sum : sum + w),
        0,
      );
      const max = Math.max(MIN_COL_WIDTH, canvas - others);
      current = Math.max(MIN_COL_WIDTH, Math.min(max, Math.round(startW + deltaX)));

      guide.style.left = `${initialRight + deltaX}px`;
      badge.textContent = `${current} px`;

      const cols = this.grid.querySelectorAll('col');
      const colEl = cols[colIndex] as HTMLElement | undefined;
      if (colEl) colEl.style.width = `${current}px`;
      const widths = snapshot.colWidths.map((w, i) => (i === colIndex ? current : w));
      const total = widths.reduce((s, w) => s + w, 0);
      this.grid.style.width = `${total}px`;
      this.dom.style.width = `${total}px`;
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      guide.remove();
      const next = cloneAttrs(snapshot);
      next.colWidths[colIndex] = current;
      this.persist(next);
      this.layoutHandles(next);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private startRowResize(
    event: MouseEvent,
    row: number,
    initialBottom: number,
    snapshot: WidgetTableAttrs,
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    snapshot = this.readCellsFromDom();
    this.selectThisNode();

    const tr = this.grid.querySelectorAll('tr')[row] as HTMLTableRowElement | undefined;
    if (!tr) return;

    const startY = event.clientY;
    const startH = Math.max(MIN_ROW_HEIGHT, Math.round(tr.getBoundingClientRect().height));
    let current = startH;

    const guide = document.createElement('div');
    guide.className = 'cde-wt__guide cde-wt__guide--row';
    guide.style.top = `${initialBottom}px`;
    guide.style.width = `${this.grid.offsetWidth}px`;

    const badge = document.createElement('div');
    badge.className = 'cde-wt__guide-badge';
    badge.textContent = `${current} px`;
    guide.appendChild(badge);
    this.dom.appendChild(guide);

    tr.classList.add('is-resizing');

    const onMove = (e: MouseEvent): void => {
      const deltaY = e.clientY - startY;
      current = Math.max(MIN_ROW_HEIGHT, Math.round(startH + deltaY));
      guide.style.top = `${initialBottom + deltaY}px`;
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
      this.persist(next);
      this.layoutHandles(next);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private canvasWidth(): number {
    const pm = this.editor.view.dom as HTMLElement;
    return pm.clientWidth || 600;
  }

  private isSelectingCells = false;
  private selectionAnchor: { row: number; col: number } | null = null;
  private selectedCells: Array<{ row: number; col: number }> = [];

  private onCellMouseDown(e: MouseEvent, r: number, c: number): void {
    if (e.button !== 0) return;
    if (e.shiftKey && this.focused) {
      e.preventDefault();
      this.selectCellRange(this.focused.row, this.focused.col, r, c);
      return;
    }

    this.isSelectingCells = true;
    this.selectionAnchor = { row: r, col: c };
    this.selectCellRange(r, c, r, c);
  }

  private onCellMouseEnter(r: number, c: number): void {
    if (this.isSelectingCells && this.selectionAnchor) {
      this.selectCellRange(this.selectionAnchor.row, this.selectionAnchor.col, r, c);
    }
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

    this.grid.querySelectorAll('.is-selected-cell').forEach((el) => {
      el.classList.remove('is-selected-cell');
    });

    const cells: Array<{ row: number; col: number }> = [];
    for (let r = minR; r <= maxR; r += 1) {
      for (let c = minC; c <= maxC; c += 1) {
        cells.push({ row: r, col: c });
        const el = this.grid.querySelector(`.cde-wt__cell[data-row="${r}"][data-col="${c}"]`);
        if (el) {
          el.classList.add('is-selected-cell');
        }
      }
    }

    this.selectedCells = cells;
    const storage = this.editor.storage as {
      table?: { row: number; col: number; selectedCells?: Array<{ row: number; col: number }>; activeWidget?: WidgetTableView };
    };
    if (storage.table) {
      storage.table.selectedCells = [...cells];
    }
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
    let data = this.readCellsFromDom();
    const hasFormula = data.cells.some((r) => r.some((c) => c.contentHtml.replace(/<[^>]+>/g, '').trim().startsWith('=')));
    if (hasFormula) {
      data = evaluateTableFormulas(data);
      this.currentData = data;
      this.updateInPlace(data);
    }
    this.hasActiveFocus = false;
    this.persist(data);
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
      (event.target as HTMLElement).blur();
      this.selectThisNode();
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

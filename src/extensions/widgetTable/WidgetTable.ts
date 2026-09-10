import type { PageMetrics } from '../pageMetrics';
import { mergeAttributes, Node } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
import {
  applyTableStylePreset,
  attrsToHtml,
  autoFitColWidths,
  cleanCellFontStyles,
  cloneAttrs,
  createWidgetTableAttrs,
  DEFAULT_COL_WIDTH,
  distributeColsEvenly,
  emptyCell,
  evaluateTableFormulas,
  fitColWidthsToWidth,
  MIN_COL_WIDTH,
  MIN_ROW_HEIGHT,
  normalizeAttrs,
  parseTableElement,
  refreshTableStyle,
  tablePixelWidth,
  type TableWrap,
  type WidgetCell,
  type WidgetTableAttrs,
} from './model';
import { WidgetTableView } from './WidgetTableView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    widgetTable: {
      insertTable: (options?: {
        rows?: number;
        cols?: number;
        withHeaderRow?: boolean;
        wrap?: TableWrap;
        styleId?: string | null;
      }) => ReturnType;
      addRowAfter: () => ReturnType;
      addRowBefore: () => ReturnType;
      addColumnAfter: () => ReturnType;
      addColumnBefore: () => ReturnType;
      deleteRow: () => ReturnType;
      deleteColumn: () => ReturnType;
      deleteTable: () => ReturnType;
      mergeCells: () => ReturnType;
      splitCell: (options?: { cols?: number; rows?: number }) => ReturnType;
      setCellDimensions: (dimensions: { width?: number | string | null; height?: number | string | null }) => ReturnType;
      setCellBorder: (border: { style?: string | null; color?: string | null; width?: number | null }) => ReturnType;
      setTableBorder: (border: { style?: string | null; color?: string | null; width?: number | null }) => ReturnType;
      setTableBackground: (color: string | null) => ReturnType;
      setCellAttribute: (name: string, value: unknown) => ReturnType;
      setTableFontFamily: (fontFamily: string | null) => ReturnType;
      setTableFontSize: (fontSize: string | null) => ReturnType;
      setTableWrap: (wrap: TableWrap) => ReturnType;
      autoFitColumns: () => ReturnType;
      distributeColumns: () => ReturnType;
      recalculateFormulas: () => ReturnType;
      applyTableStyle: (styleId: string | null) => ReturnType;
      toggleTableHeaderRow: () => ReturnType;
      toggleTableBandedRows: () => ReturnType;
    };
  }
}

function syncActiveWidget(editor: { storage: Record<string, unknown> }): void {
  const s = editor.storage.table as { activeWidget?: WidgetTableView } | undefined;
  if (s?.activeWidget) {
    try {
      s.activeWidget.readCellsFromDom();
    } catch {
      // ignore
    }
  }
}

function findTable(
  state: EditorState,
  editor?: { storage: Record<string, unknown> },
): { pos: number; attrs: WidgetTableAttrs } | null {
  const activeWidget = (editor?.storage.table as any)?.activeWidget;
  if (activeWidget) {
    try {
      const pos = activeWidget.getPos();
      if (typeof pos === 'number') {
        const node = state.doc.nodeAt(pos);
        if (node && node.type.name === 'table') {
          return { pos, attrs: normalizeAttrs(node.attrs as Partial<WidgetTableAttrs>) };
        }
      }
    } catch {
      // ignore
    }
  }

  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === 'table') {
    return { pos: sel.from, attrs: normalizeAttrs(sel.node.attrs as Partial<WidgetTableAttrs>) };
  }

  const $from = sel.$from;
  const after = $from.nodeAfter;
  if (after?.type.name === 'table') {
    return { pos: $from.pos, attrs: normalizeAttrs(after.attrs as Partial<WidgetTableAttrs>) };
  }
  const before = $from.nodeBefore;
  if (before?.type.name === 'table') {
    return {
      pos: $from.pos - before.nodeSize,
      attrs: normalizeAttrs(before.attrs as Partial<WidgetTableAttrs>),
    };
  }

  let found: { pos: number; attrs: WidgetTableAttrs } | null = null;
  state.doc.descendants((node, pos) => {
    if (found || node.type.name !== 'table') return;
    if (pos <= state.selection.from && pos + node.nodeSize >= state.selection.from) {
      found = { pos, attrs: normalizeAttrs(node.attrs as Partial<WidgetTableAttrs>) };
      return false;
    }
    return undefined;
  });
  return found;
}

/** Attributes of the table being edited — used by the ribbon to reflect state. */
export function findActiveTableAttrs(editor: {
  state: EditorState;
  storage: Record<string, unknown>;
}): WidgetTableAttrs | null {
  return findTable(editor.state, editor)?.attrs ?? null;
}

/** True when a table widget currently owns the caret or the node selection. */
export function hasActiveTable(editor: {
  state: EditorState;
  storage: Record<string, unknown>;
}): boolean {
  const storage = editor.storage.table as { activeWidget?: unknown } | undefined;
  if (storage?.activeWidget) return true;
  if (typeof document !== 'undefined' && document.activeElement?.closest('.cde-wt, .cde-wt__cell')) {
    return true;
  }
  const sel = editor.state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === 'table') return true;
  return sel.$from.nodeAfter?.type.name === 'table';
}

/** New columns match the current average so the table does not jump in size. */
function newColumnWidth(attrs: WidgetTableAttrs): number {
  if (attrs.colWidths.length === 0) return DEFAULT_COL_WIDTH;
  const avg = Math.round(tablePixelWidth(attrs) / attrs.colWidths.length);
  return Math.max(MIN_COL_WIDTH, Math.min(DEFAULT_COL_WIDTH, avg));
}

/** Width the table can occupy: the editable canvas inside margins minus any wrap gap. */
function usableWidth(
  editor: {
    view?: { dom?: HTMLElement };
    extensionManager?: { extensions: Array<{ name: string; storage?: Record<string, unknown> }> };
  },
  attrs?: Partial<WidgetTableAttrs>,
): number {
  const ext = editor.extensionManager?.extensions?.find((e) => e.name === 'pagePagination');
  const metrics = (ext?.storage as { metrics?: PageMetrics })?.metrics;
  let canvas = metrics?.bodyWidthPx;

  if (!canvas || canvas <= 0) {
    const pm = editor.view?.dom as HTMLElement | undefined;
    if (pm && typeof window !== 'undefined') {
      const style = window.getComputedStyle(pm);
      const padLeft = parseFloat(style.paddingLeft) || 96;
      const padRight = parseFloat(style.paddingRight) || 96;
      canvas = Math.max(100, Math.floor((pm.clientWidth || 816) - padLeft - padRight));
    } else {
      canvas = 624;
    }
  }

  const isWrapped = attrs?.wrap === 'left' || attrs?.wrap === 'right';
  const mr = isWrapped ? (attrs?.marginRight ?? 16) : 0;
  const numCols = Math.max(1, attrs?.colWidths?.length || 1);
  return Math.max(MIN_COL_WIDTH * numCols, canvas - mr);
}

function activeCell(editor: { storage: Record<string, unknown> }): { row: number; col: number } {
  const s = editor.storage.table as { row?: number; col?: number } | undefined;
  return { row: s?.row ?? 0, col: s?.col ?? 0 };
}

function getSelectedCells(editor: { storage: Record<string, unknown> }): Array<{ row: number; col: number }> {
  const s = editor.storage.table as {
    row?: number;
    col?: number;
    selectedCells?: Array<{ row: number; col: number }>;
    activeWidget?: WidgetTableView | null;
  } | undefined;

  // The widget owns the highlight the user sees; storage is only a mirror.
  const live = s?.activeWidget?.getSelection?.() ?? [];
  if (live.length > 1) return live;
  if (s?.selectedCells && s.selectedCells.length > 1) {
    return s.selectedCells;
  }
  return [{ row: s?.row ?? 0, col: s?.col ?? 0 }];
}

function clearWidgetSelection(editor: { storage: Record<string, unknown> }): void {
  const s = editor.storage.table as { activeWidget?: WidgetTableView | null } | undefined;
  s?.activeWidget?.clearCellSelection?.();
}

/**
 * Atomic table widget: HTML table with its own editing/resize, stored as JSON attrs.
 */
export const WidgetTable = Node.create({
  name: 'table',

  group: 'block',

  content: '',

  atom: true,

  isolating: true,

  selectable: true,

  draggable: false,

  addStorage() {
    return { row: 0, col: 0, activeWidget: null };
  },

  addAttributes() {
    return {
      cells: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).cells,
        renderHTML: () => ({}),
      },
      colWidths: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).colWidths,
        renderHTML: () => ({}),
      },
      rowHeights: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).rowHeights,
        renderHTML: () => ({}),
      },
      withHeaderRow: {
        default: true,
        parseHTML: (el) => parseTableElement(el as HTMLElement).withHeaderRow,
        renderHTML: () => ({}),
      },
      wrap: {
        default: 'left',
        parseHTML: (el) => ((el.dataset.wrap || el.getAttribute('data-wrap')) as TableWrap) || 'left',
        renderHTML: (attrs) => ({ 'data-wrap': attrs.wrap || 'left' }),
      },
      marginRight: {
        default: 16,
        parseHTML: (el) => parseTableElement(el as HTMLElement).marginRight,
        renderHTML: () => ({}),
      },
      borderStyle: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).borderStyle,
        renderHTML: () => ({}),
      },
      borderColor: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).borderColor,
        renderHTML: () => ({}),
      },
      borderWidth: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).borderWidth,
        renderHTML: () => ({}),
      },
      backgroundColor: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).backgroundColor,
        renderHTML: () => ({}),
      },
      styleId: {
        default: null,
        parseHTML: (el) => el.dataset.tableStyle || null,
        renderHTML: (attrs) =>
          attrs.styleId ? { 'data-table-style': attrs.styleId as string } : {},
      },
      banded: {
        default: true,
        parseHTML: (el) => el.dataset.banded !== 'false',
        renderHTML: (attrs) => (attrs.banded === false ? { 'data-banded': 'false' } : {}),
      },
      tableId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-table-id'),
        renderHTML: (attrs) => (attrs.tableId ? { 'data-table-id': attrs.tableId as string } : {}),
      },
      isContinuation: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-table-continuation') === 'true' || el.dataset.tableContinuation === 'true',
        renderHTML: (attrs) => (attrs.isContinuation ? { 'data-table-continuation': 'true' } : {}),
      },
      hasRepeatedHeader: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-table-repeated-header') === 'true' || el.dataset.tableRepeatedHeader === 'true',
        renderHTML: (attrs) => (attrs.hasRepeatedHeader ? { 'data-table-repeated-header': 'true' } : {}),
      },
      fontFamily: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).fontFamily,
        renderHTML: (attrs) => (attrs.fontFamily ? { 'data-font-family': attrs.fontFamily as string } : {}),
      },
      fontSize: {
        default: null,
        parseHTML: (el) => parseTableElement(el as HTMLElement).fontSize,
        renderHTML: (attrs) => (attrs.fontSize ? { 'data-font-size': attrs.fontSize as string } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-widget-table]',
        getAttrs: (el) => parseTableElement(el as HTMLElement),
      },
      {
        tag: 'table',
        getAttrs: (el) => parseTableElement(el as HTMLElement),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const data = normalizeAttrs(node.attrs as Partial<WidgetTableAttrs>);
    if (typeof document !== 'undefined') {
      const template = document.createElement('template');
      template.innerHTML = attrsToHtml(data).trim();
      const el = template.content.firstElementChild as HTMLElement;
      if (el) {
        Object.entries(HTMLAttributes).forEach(([key, val]) => {
          if (val != null) el.setAttribute(key, String(val));
        });
        return el;
      }
    }

    const width = tablePixelWidth(data);

    const colgroup: unknown[] = ['colgroup', {}, ...data.colWidths.map((w) => ['col', { style: `width:${w}px` }])];

    const rows = data.cells.map((row, r) => {
      const rh = data.rowHeights[r];
      const cells = row.map((cell) => {
        const tag = data.withHeaderRow && r === 0 ? 'th' : 'td';
        const style: string[] = [];
        if (cell.backgroundColor) style.push(`background-color:${cell.backgroundColor}`);
        if (cell.color) style.push(`color:${cell.color}`);
        if (cell.fontFamily) style.push(`font-family:${cell.fontFamily}`);
        if (cell.fontSize) style.push(`font-size:${cell.fontSize}`);
        if (cell.borderStyle) style.push(`border-style:${cell.borderStyle}`);
        if (cell.borderColor) style.push(`border-color:${cell.borderColor}`);
        if (cell.borderWidth != null) style.push(`border-width:${cell.borderWidth}px`);
        if (cell.verticalAlign !== 'top') style.push(`vertical-align:${cell.verticalAlign}`);
        if (rh != null) style.push(`height:${rh}px`);
        return [
          tag,
          {
            class: 'cde-wt__cell',
            ...(style.length ? { style: style.join(';') } : {}),
          },
          cell.contentHtml || '',
        ];
      });
      return ['tr', rh != null ? { style: `height:${rh}px` } : {}, ...cells];
    });

    const gridStyle = [`width:${width}px`];
    if (data.borderStyle) gridStyle.push(`border-style:${data.borderStyle}`);
    if (data.borderColor) gridStyle.push(`border-color:${data.borderColor}`);
    if (data.borderWidth != null) gridStyle.push(`border-width:${data.borderWidth}px`);
    if (data.backgroundColor) gridStyle.push(`background-color:${data.backgroundColor}`);
    if (data.fontFamily) gridStyle.push(`font-family:${data.fontFamily}`);
    if (data.fontSize) gridStyle.push(`font-size:${data.fontSize}`);

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `cde-wt cde-wt--wrap-${data.wrap}`,
        'data-widget-table': 'true',
        'data-wrap': data.wrap,
        style: `width:${width}px;margin-right:${data.marginRight ?? 16}px`,
      }),
      ['table', { class: 'cde-wt__grid', style: gridStyle.join(';') }, colgroup, ['tbody', {}, ...rows]],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) =>
      new WidgetTableView({
        node,
        editor,
        getPos: () => (typeof getPos === 'function' ? getPos() : undefined),
      });
  },

  addCommands() {
    return {
      insertTable:
        ({
          rows = 3,
          cols = 3,
          withHeaderRow = true,
          wrap = 'left',
          styleId = null,
        } = {}) =>
        ({ commands, state, editor }) => {
          const { selection } = state;
          const pos = selection.from;
          const after = state.doc.resolve(pos).nodeAfter;
          const base = applyTableStylePreset(
            createWidgetTableAttrs(rows, cols, withHeaderRow, wrap),
            styleId,
          );
          const content: Array<Record<string, unknown>> = [
            {
              type: this.name,
              attrs: fitColWidthsToWidth(base, usableWidth(editor, base)),
            },
          ];
          if (!after || after.type.name !== 'paragraph') {
            content.push({ type: 'paragraph' });
          }
          return commands.insertContent(content);
        },

      setTableWrap:
        (wrap: TableWrap) =>
        ({ state, dispatch, editor }) => {
          syncActiveWidget(editor);
          const found = findTable(state, editor);
          if (!found) return false;
          if (dispatch) {
            const next = cloneAttrs(found.attrs);
            next.wrap = wrap;
            dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
          }
          return true;
        },

      addRowAfter: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const { row } = activeCell(editor);
          const next = cloneAttrs(found.attrs);
          const cols = next.cells[0]?.length ?? 1;
          const at = Math.min(row + 1, next.cells.length);
          next.cells.splice(at, 0, Array.from({ length: cols }, () => emptyCell()));
          next.rowHeights.splice(at, 0, null);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, refreshTableStyle(next)));
        }
        return true;
      },

      addRowBefore: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const { row } = activeCell(editor);
          const next = cloneAttrs(found.attrs);
          const cols = next.cells[0]?.length ?? 1;
          const at = Math.max(0, row);
          next.cells.splice(at, 0, Array.from({ length: cols }, () => emptyCell()));
          next.rowHeights.splice(at, 0, null);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, refreshTableStyle(next)));
        }
        return true;
      },

      addColumnAfter: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const { col } = activeCell(editor);
          const next = cloneAttrs(found.attrs);
          const at = Math.min(col + 1, next.colWidths.length);
          next.cells.forEach((row) => {
            const rowAt = Math.min(at, row.length);
            row.splice(rowAt, 0, emptyCell());
          });
          next.colWidths.splice(at, 0, newColumnWidth(next));
          dispatch(
            state.tr.setNodeMarkup(
              found.pos,
              undefined,
              fitColWidthsToWidth(refreshTableStyle(next), usableWidth(editor, next)),
            ),
          );
        }
        return true;
      },

      addColumnBefore: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const { col } = activeCell(editor);
          const next = cloneAttrs(found.attrs);
          const at = Math.max(0, col);
          next.cells.forEach((row) => {
            const rowAt = Math.min(at, row.length);
            row.splice(rowAt, 0, emptyCell());
          });
          next.colWidths.splice(at, 0, newColumnWidth(next));
          dispatch(
            state.tr.setNodeMarkup(
              found.pos,
              undefined,
              fitColWidthsToWidth(refreshTableStyle(next), usableWidth(editor, next)),
            ),
          );
        }
        return true;
      },

      deleteRow: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found || found.attrs.cells.length <= 1) return false;
        if (dispatch) {
          const { row } = activeCell(editor);
          const next = cloneAttrs(found.attrs);
          const at = Math.min(row, next.cells.length - 1);
          next.cells.splice(at, 1);
          next.rowHeights.splice(at, 1);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, refreshTableStyle(next)));
        }
        return true;
      },

      deleteColumn: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found || found.attrs.colWidths.length <= 1) return false;
        if (dispatch) {
          const { col } = activeCell(editor);
          const next = cloneAttrs(found.attrs);
          const at = Math.min(col, next.colWidths.length - 1);
          next.cells.forEach((row) => {
            if (at < row.length) row.splice(at, 1);
          });
          next.colWidths.splice(at, 1);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, refreshTableStyle(next)));
        }
        return true;
      },

      deleteTable: () => ({ state, dispatch, editor }) => {
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const node = state.doc.nodeAt(found.pos);
          if (!node) return false;
          dispatch(state.tr.delete(found.pos, found.pos + node.nodeSize));
        }
        return true;
      },

      mergeCells: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          // Keep only coordinates that still exist, without duplicates.
          const seen = new Set<string>();
          const selected = getSelectedCells(editor)
            .filter(({ row, col }) => {
              const key = `${row}:${col}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return col < (next.cells[row]?.length ?? 0);
            })
            .sort((a, b) => a.row - b.row || a.col - b.col);

          if (selected.length > 1) {
            const first = selected[0]!;
            const minR = first.row;
            const minC = Math.min(...selected.map((s) => s.col));
            const maxR = selected[selected.length - 1]!.row;

            const target = next.cells[minR]?.[minC];
            if (!target) return false;

            const texts: string[] = [];
            let topRowColspan = 0;
            for (const { row, col } of selected) {
              const cell = next.cells[row]?.[col];
              if (!cell) continue;
              if (cell.contentHtml) texts.push(cell.contentHtml);
              if (row === minR) topRowColspan += cell.colspan || 1;
            }

            target.contentHtml = texts.join(' ').trim();
            target.colspan = topRowColspan;
            target.rowspan = maxR - minR + 1;

            // Drop the absorbed cells back-to-front so indexes stay valid.
            for (const { row, col } of [...selected].reverse()) {
              if (row === minR && col === minC) continue;
              const cells = next.cells[row];
              if (cells && col < cells.length) cells.splice(col, 1);
            }
          } else {
            // Single cell: absorb the neighbour to the right, like Word's Ctrl+M.
            const { row, col } = selected[0] ?? activeCell(editor);
            const current = next.cells[row]?.[col];
            const neighbor = next.cells[row]?.[col + 1];
            if (!current || !neighbor) return false;
            current.colspan = (current.colspan || 1) + (neighbor.colspan || 1);
            if (neighbor.contentHtml) {
              current.contentHtml = `${current.contentHtml} ${neighbor.contentHtml}`.trim();
            }
            next.cells[row]!.splice(col + 1, 1);
          }

          clearWidgetSelection(editor);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      splitCell: (options?: { cols?: number; rows?: number }) => ({ state, dispatch, editor }: { state: EditorState; dispatch?: (tr: any) => void; editor: any }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const targets = getSelectedCells(editor);
          const next = cloneAttrs(found.attrs);

          if (options?.rows && options.rows >= 2) {
            const rowsCount = options.rows;
            const sortedTargets = [...targets].sort((a, b) => b.row - a.row);

            sortedTargets.forEach(({ row, col }) => {
              const cell = next.cells[row]?.[col];
              if (!cell) return;

              const currentSpan = Math.max(1, cell.rowspan || 1);

              if (currentSpan % rowsCount === 0) {
                const subSpan = currentSpan / rowsCount;
                cell.rowspan = subSpan;
                for (let k = 1; k < rowsCount; k += 1) {
                  const targetRowIdx = row + k * subSpan;
                  if (next.cells[targetRowIdx]) {
                    next.cells[targetRowIdx]!.splice(col, 0, {
                      ...emptyCell(),
                      colspan: cell.colspan || 1,
                      rowspan: subSpan,
                    });
                  }
                }
              } else {
                // Word-like row split:
                // 1. All other cells in this row have their rowspan multiplied by rowsCount
                next.cells[row]!.forEach((c, idx) => {
                  if (idx !== col) {
                    c.rowspan = (c.rowspan || 1) * rowsCount;
                  }
                });

                // 2. Target cell becomes 1 rowspan
                cell.rowspan = 1;

                // 3. Insert (rowsCount - 1) new sub-rows
                const newRows: WidgetCell[][] = Array.from({ length: rowsCount - 1 }, () => [
                  {
                    ...emptyCell(),
                    colspan: cell.colspan || 1,
                    rowspan: 1,
                  },
                ]);
                next.cells.splice(row + 1, 0, ...newRows);

                // 4. Scale row heights
                const origH = next.rowHeights[row];
                const subH = origH != null ? Math.max(MIN_ROW_HEIGHT, Math.floor(origH / rowsCount)) : null;
                next.rowHeights[row] = subH;
                const newHeights = Array.from({ length: rowsCount - 1 }, () => subH);
                next.rowHeights.splice(row + 1, 0, ...newHeights);
              }
            });
          } else {
            // Horizontal column splitting using Colspan Grid Scaling
            const colsCount = Math.max(2, options?.cols ?? 2);

            targets.forEach(({ row, col }) => {
              const cell = next.cells[row]?.[col];
              if (!cell) return;

              const currentSpan = Math.max(1, cell.colspan || 1);

              if (currentSpan % colsCount !== 0) {
                next.cells.forEach((r) => {
                  r.forEach((c) => {
                    c.colspan = (c.colspan || 1) * colsCount;
                  });
                });

                const newColWidths: number[] = [];
                next.colWidths.forEach((w) => {
                  const base = Math.floor(w / colsCount);
                  const rem = w % colsCount;
                  for (let i = 0; i < colsCount; i += 1) {
                    newColWidths.push(i === colsCount - 1 ? base + rem : base);
                  }
                });
                next.colWidths = newColWidths;
              }

              const newSpan = Math.max(1, Math.round((cell.colspan || 1) / colsCount));
              cell.colspan = newSpan;

              const newCells: WidgetCell[] = Array.from({ length: colsCount - 1 }, () => ({
                ...emptyCell(),
                colspan: newSpan,
              }));
              next.cells[row]!.splice(col + 1, 0, ...newCells);
            });
          }

          clearWidgetSelection(editor);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setCellDimensions: (dimensions: { width?: number | string | null; height?: number | string | null }) => ({ state, dispatch, editor }: { state: EditorState; dispatch?: (tr: any) => void; editor: any }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const targets = getSelectedCells(editor);
          const next = cloneAttrs(found.attrs);
          targets.forEach(({ row, col }) => {
            const cell = next.cells[row]?.[col];
            if (!cell) return;
            if (dimensions.width !== undefined) cell.width = dimensions.width;
            if (dimensions.height !== undefined) cell.height = dimensions.height;
          });
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setCellBorder: (border: { style?: string | null; color?: string | null; width?: number | null }) => ({ state, dispatch, editor }: { state: EditorState; dispatch?: (tr: any) => void; editor: any }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const targets = getSelectedCells(editor);
          const next = cloneAttrs(found.attrs);
          next.styleId = null;
          targets.forEach(({ row, col }) => {
            const cell = next.cells[row]?.[col];
            if (!cell) return;
            if (border.style !== undefined) cell.borderStyle = border.style;
            if (border.color !== undefined) cell.borderColor = border.color;
            if (border.width !== undefined) cell.borderWidth = border.width;
          });
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setTableBorder: (border: { style?: string | null; color?: string | null; width?: number | null }) => ({ state, dispatch, editor }: { state: EditorState; dispatch?: (tr: any) => void; editor: any }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          next.styleId = null;
          if (border.style !== undefined) next.borderStyle = border.style;
          if (border.color !== undefined) next.borderColor = border.color;
          if (border.width !== undefined) next.borderWidth = border.width;
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setTableBackground: (color: string | null) => ({ state, dispatch, editor }: { state: EditorState; dispatch?: (tr: any) => void; editor: any }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          next.styleId = null;
          next.backgroundColor = color;
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setCellAttribute: (name, value) => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const targets = getSelectedCells(editor);
          const next = cloneAttrs(found.attrs);
          if (name !== 'verticalAlign' && name !== 'minHeight') {
            next.styleId = null;
          }
          targets.forEach(({ row, col }) => {
            const cell = next.cells[row]?.[col];
            if (!cell) return;
            if (name === 'backgroundColor') {
              cell.backgroundColor = (value as string) || null;
            }
            if (name === 'color') {
              cell.color = (value as string) || null;
            }
            if (name === 'fontFamily') {
              cell.fontFamily = (value as string) || null;
              if (value && cell.contentHtml) {
                cell.contentHtml = cleanCellFontStyles(cell.contentHtml, 'fontFamily');
              }
            }
            if (name === 'fontSize') {
              cell.fontSize = (value as string) || null;
              if (value && cell.contentHtml) {
                cell.contentHtml = cleanCellFontStyles(cell.contentHtml, 'fontSize');
              }
            }
            if (name === 'verticalAlign') {
              cell.verticalAlign =
                value === 'middle' || value === 'bottom' ? value : 'top';
            }
            if (name === 'borderStyle') {
              cell.borderStyle = (value as string) || null;
            }
            if (name === 'borderColor') {
              cell.borderColor = (value as string) || null;
            }
            if (name === 'borderWidth') {
              cell.borderWidth = typeof value === 'number' ? value : null;
            }
            if (name === 'minHeight') {
              if (value == null || value === '') {
                next.rowHeights[row] = null;
              } else {
                const n = Number(value);
                next.rowHeights[row] =
                  Number.isFinite(n) && n > 0
                    ? Math.max(MIN_ROW_HEIGHT, Math.round(n))
                    : null;
              }
            }
          });
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setTableFontFamily: (fontFamily: string | null) => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          next.fontFamily = fontFamily;
          next.cells.forEach((row) => {
            row.forEach((cell) => {
              cell.fontFamily = fontFamily;
              if (fontFamily && cell.contentHtml) {
                cell.contentHtml = cleanCellFontStyles(cell.contentHtml, 'fontFamily');
              }
            });
          });
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      setTableFontSize: (fontSize: string | null) => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          next.fontSize = fontSize;
          next.cells.forEach((row) => {
            row.forEach((cell) => {
              cell.fontSize = fontSize;
              if (fontSize && cell.contentHtml) {
                cell.contentHtml = cleanCellFontStyles(cell.contentHtml, 'fontSize');
              }
            });
          });
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      autoFitColumns: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = autoFitColWidths(
            found.attrs,
            usableWidth(editor, found.attrs),
          );
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      distributeColumns: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = fitColWidthsToWidth(
            distributeColsEvenly(found.attrs),
            usableWidth(editor, found.attrs),
          );
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      recalculateFormulas: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = evaluateTableFormulas(found.attrs);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      applyTableStyle: (styleId: string | null) => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = applyTableStylePreset(found.attrs, styleId);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      toggleTableHeaderRow: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          next.withHeaderRow = !next.withHeaderRow;
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, refreshTableStyle(next)));
        }
        return true;
      },

      toggleTableBandedRows: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = cloneAttrs(found.attrs);
          next.banded = next.banded === false;
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, refreshTableStyle(next)));
        }
        return true;
      },
    };
  },
});

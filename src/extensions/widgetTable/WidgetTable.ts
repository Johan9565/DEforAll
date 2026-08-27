import { mergeAttributes, Node } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
import {
  autoFitColWidths,
  cloneAttrs,
  createWidgetTableAttrs,
  distributeColsEvenly,
  emptyCell,
  evaluateTableFormulas,
  MIN_ROW_HEIGHT,
  normalizeAttrs,
  parseTableElement,
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
      setTableWrap: (wrap: TableWrap) => ReturnType;
      autoFitColumns: () => ReturnType;
      distributeColumns: () => ReturnType;
      recalculateFormulas: () => ReturnType;
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

function activeCell(editor: { storage: Record<string, unknown> }): { row: number; col: number } {
  const s = editor.storage.table as { row?: number; col?: number } | undefined;
  return { row: s?.row ?? 0, col: s?.col ?? 0 };
}

function getSelectedCells(editor: { storage: Record<string, unknown> }): Array<{ row: number; col: number }> {
  const s = editor.storage.table as {
    row?: number;
    col?: number;
    selectedCells?: Array<{ row: number; col: number }>;
  } | undefined;
  if (s?.selectedCells && s.selectedCells.length > 0) {
    return s.selectedCells;
  }
  return [{ row: s?.row ?? 0, col: s?.col ?? 0 }];
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
    const width = tablePixelWidth(data);

    const colgroup: unknown[] = ['colgroup', {}, ...data.colWidths.map((w) => ['col', { style: `width:${w}px` }])];

    const rows = data.cells.map((row, r) => {
      const rh = data.rowHeights[r];
      const cells = row.map((cell) => {
        const tag = data.withHeaderRow && r === 0 ? 'th' : 'td';
        const style: string[] = [];
        if (cell.backgroundColor) style.push(`background-color:${cell.backgroundColor}`);
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

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `cde-wt cde-wt--wrap-${data.wrap}`,
        'data-widget-table': 'true',
        'data-wrap': data.wrap,
        style: `width:${width}px`,
      }),
      ['table', { class: 'cde-wt__grid', style: `width:${width}px` }, colgroup, ['tbody', {}, ...rows]],
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
        ({ rows = 3, cols = 3, withHeaderRow = true, wrap = 'left' } = {}) =>
        ({ commands, state }) => {
          const { selection } = state;
          const pos = selection.from;
          const after = state.doc.resolve(pos).nodeAfter;
          const content: Array<Record<string, unknown>> = [
            {
              type: this.name,
              attrs: createWidgetTableAttrs(rows, cols, withHeaderRow, wrap),
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
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
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
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
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
          next.colWidths.splice(at, 0, 120);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
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
          next.colWidths.splice(at, 0, 120);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
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
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
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
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
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
          const selected = getSelectedCells(editor);
          const next = cloneAttrs(found.attrs);

          if (selected.length > 1) {
            const minR = Math.min(...selected.map((s) => s.row));
            const maxR = Math.max(...selected.map((s) => s.row));
            const minC = Math.min(...selected.map((s) => s.col));
            const maxC = Math.max(...selected.map((s) => s.col));

            if (minR === maxR) {
              // Horizontal merge in a single row
              const texts: string[] = [];
              let sumColspan = 0;
              for (let c = minC; c <= maxC; c += 1) {
                const cell = next.cells[minR]?.[c];
                if (cell?.contentHtml) texts.push(cell.contentHtml);
                sumColspan += (cell?.colspan || 1);
              }
              const target = next.cells[minR]?.[minC];
              if (target) {
                target.contentHtml = texts.join(' ').trim();
                target.colspan = sumColspan;
              }
              const countToRemove = maxC - minC;
              if (countToRemove > 0) {
                next.cells[minR]!.splice(minC + 1, countToRemove);
              }
            } else {
              // 2D rectangular merge
              const texts: string[] = [];
              let topRowColspan = 0;
              for (let c = minC; c <= maxC; c += 1) {
                topRowColspan += (next.cells[minR]?.[c]?.colspan || 1);
              }

              for (let r = minR; r <= maxR; r += 1) {
                for (let c = minC; c <= maxC; c += 1) {
                  const cell = next.cells[r]?.[c];
                  if (cell?.contentHtml) texts.push(cell.contentHtml);
                }
              }
              const target = next.cells[minR]?.[minC];
              if (target) {
                target.contentHtml = texts.join(' ').trim();
                target.rowspan = (maxR - minR + 1);
                target.colspan = topRowColspan;
              }
              // Remove other merged cells in top row
              if (maxC > minC) {
                next.cells[minR]!.splice(minC + 1, maxC - minC);
              }
              // In subsequent rows, remove the merged columns
              for (let r = minR + 1; r <= maxR; r += 1) {
                next.cells[r]!.splice(minC, maxC - minC + 1);
              }
            }
          } else {
            // Default 2-cell merge with right neighbor
            const { row, col } = activeCell(editor);
            const current = next.cells[row]?.[col];
            const neighbor = next.cells[row]?.[col + 1];
            if (!current || !neighbor) return false;
            current.colspan = (current.colspan || 1) + (neighbor.colspan || 1);
            if (neighbor.contentHtml) {
              current.contentHtml = `${current.contentHtml} ${neighbor.contentHtml}`.trim();
            }
            next.cells[row]!.splice(col + 1, 1);
          }

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
          targets.forEach(({ row, col }) => {
            const cell = next.cells[row]?.[col];
            if (!cell) return;
            if (name === 'backgroundColor') {
              cell.backgroundColor = (value as string) || null;
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

      autoFitColumns: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const pm = editor.view.dom as HTMLElement;
          const canvas = pm.clientWidth || 600;
          const next = autoFitColWidths(found.attrs, canvas);
          dispatch(state.tr.setNodeMarkup(found.pos, undefined, next));
        }
        return true;
      },

      distributeColumns: () => ({ state, dispatch, editor }) => {
        syncActiveWidget(editor);
        const found = findTable(state, editor);
        if (!found) return false;
        if (dispatch) {
          const next = distributeColsEvenly(found.attrs);
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
    };
  },
});

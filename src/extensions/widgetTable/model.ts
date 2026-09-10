export const MIN_COL_WIDTH = 16;
export const MIN_ROW_HEIGHT = 20;
export const DEFAULT_COL_WIDTH = 120;

export type CellAlign = 'top' | 'middle' | 'bottom';
export type TableWrap = 'none' | 'left' | 'right';

export interface WidgetCell {
  contentHtml: string;
  backgroundColor: string | null;
  verticalAlign: CellAlign;
  rowspan?: number;
  colspan?: number;
  width?: number | string | null;
  height?: number | string | null;
  borderStyle?: string | null;
  borderColor?: string | null;
  borderWidth?: number | null;
  color?: string | null;
  fontFamily?: string | null;
  fontSize?: string | null;
}

export interface WidgetTableAttrs {
  cells: WidgetCell[][];
  colWidths: number[];
  rowHeights: Array<number | null>;
  withHeaderRow: boolean;
  wrap: TableWrap;
  marginRight?: number;
  borderStyle?: string | null;
  borderColor?: string | null;
  borderWidth?: number | null;
  backgroundColor?: string | null;
  /** Id of the applied gallery preset (see TABLE_STYLE_PRESETS). */
  styleId?: string | null;
  /** Alternating row shading for the applied preset. */
  banded?: boolean;
  /** Stable identity shared by page continuations of the same table. */
  tableId?: string | null;
  /** True when this table slice continues from a preceding page. */
  isContinuation?: boolean;
  /** True when row 0 was duplicated as a repeating header across the page split. */
  hasRepeatedHeader?: boolean;
  fontFamily?: string | null;
  fontSize?: string | null;
}

export function emptyCell(): WidgetCell {
  return {
    contentHtml: '',
    backgroundColor: null,
    verticalAlign: 'top',
    rowspan: 1,
    colspan: 1,
    color: null,
    fontFamily: null,
    fontSize: null,
  };
}

export function createWidgetTableAttrs(
  rows = 3,
  cols = 3,
  withHeaderRow = true,
  wrap: TableWrap = 'none',
  marginRight = 16,
  targetWidth?: number,
): WidgetTableAttrs {
  const r = Math.max(1, rows);
  const c = Math.max(1, cols);
  const totalW = targetWidth && targetWidth > 0 ? targetWidth : 624;
  const colW = Math.max(MIN_COL_WIDTH, Math.floor(totalW / c));
  const remainder = totalW - (colW * c);
  const colWidths = Array.from({ length: c }, (_, i) => (i === c - 1 ? colW + remainder : colW));

  return {
    withHeaderRow,
    wrap,
    marginRight,
    styleId: null,
    banded: true,
    tableId: `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    isContinuation: false,
    hasRepeatedHeader: false,
    colWidths,
    rowHeights: Array.from({ length: r }, () => null),
    cells: Array.from({ length: r }, () =>
      Array.from({ length: c }, () => emptyCell()),
    ),
  };
}

export function normalizeAttrs(raw: Partial<WidgetTableAttrs> | null | undefined): WidgetTableAttrs {
  const base = createWidgetTableAttrs(3, 3, true, 'left');
  if (!raw) return base;

  const cellsIn = Array.isArray(raw.cells) ? raw.cells : base.cells;
  const rows = Math.max(1, cellsIn.length);

  const cells: WidgetCell[][] = [];
  for (let i = 0; i < rows; i += 1) {
    const src = Array.isArray(cellsIn[i]) ? cellsIn[i]! : [];
    const rowLen = Math.max(1, src.length);
    const row: WidgetCell[] = [];
    for (let j = 0; j < rowLen; j += 1) {
      const cell = src[j] as (WidgetCell & { text?: string }) | undefined;
      let html = '';
      if (typeof cell?.contentHtml === 'string') {
        html = cell.contentHtml;
      } else if (typeof cell?.text === 'string') {
        html = escapeHtml(cell.text);
      }

      row.push({
        contentHtml: html,
        backgroundColor: cell?.backgroundColor ?? null,
        verticalAlign:
          cell?.verticalAlign === 'middle' || cell?.verticalAlign === 'bottom'
            ? cell.verticalAlign
            : 'top',
        rowspan: Math.max(1, Number(cell?.rowspan) || 1),
        colspan: Math.max(1, Number(cell?.colspan) || 1),
        width: cell?.width ?? null,
        height: cell?.height ?? null,
        borderStyle: cell?.borderStyle ?? null,
        borderColor: cell?.borderColor ?? null,
        borderWidth: typeof cell?.borderWidth === 'number' ? cell.borderWidth : null,
        color: cell?.color ?? null,
        fontFamily: cell?.fontFamily ?? null,
        fontSize: cell?.fontSize ?? null,
      });
    }
    cells.push(row);
  }

  const totalGridCols = cells.reduce((max, row) => {
    const rowSpanSum = row.reduce((sum, cell) => sum + (cell.colspan || 1), 0);
    return Math.max(max, rowSpanSum);
  }, 1);

  const colWidths = Array.from({ length: totalGridCols }, (_, i) => {
    const w = Number(raw.colWidths?.[i]);
    return Number.isFinite(w) && w >= MIN_COL_WIDTH ? Math.round(w) : DEFAULT_COL_WIDTH;
  });

  const rowHeights = Array.from({ length: rows }, (_, i) => {
    const h = raw.rowHeights?.[i];
    if (h == null) return null;
    const n = Number(h);
    return Number.isFinite(n) && n >= MIN_ROW_HEIGHT ? Math.round(n) : null;
  });

  const wrap: TableWrap =
    raw.wrap === 'none' || raw.wrap === 'right' ? raw.wrap : 'left';

  const marginRight =
    typeof raw.marginRight === 'number' && Number.isFinite(raw.marginRight) && raw.marginRight >= 0
      ? Math.round(raw.marginRight)
      : 16;

  return {
    cells,
    colWidths,
    rowHeights,
    withHeaderRow: raw.withHeaderRow !== false,
    wrap,
    marginRight,
    borderStyle: raw.borderStyle ?? null,
    borderColor: raw.borderColor ?? null,
    borderWidth: typeof raw.borderWidth === 'number' ? raw.borderWidth : null,
    backgroundColor: raw.backgroundColor ?? null,
    styleId: raw.styleId ?? null,
    banded: raw.banded !== false,
    tableId: raw.tableId ?? null,
    isContinuation: Boolean(raw.isContinuation),
    hasRepeatedHeader: Boolean(raw.hasRepeatedHeader),
    fontFamily: typeof raw.fontFamily === 'string' ? raw.fontFamily : null,
    fontSize: typeof raw.fontSize === 'string' ? raw.fontSize : null,
  };
}

export function cloneAttrs(attrs: WidgetTableAttrs): WidgetTableAttrs {
  return {
    withHeaderRow: attrs.withHeaderRow,
    wrap: attrs.wrap ?? 'none',
    marginRight: attrs.marginRight ?? 16,
    borderStyle: attrs.borderStyle ?? null,
    borderColor: attrs.borderColor ?? null,
    borderWidth: attrs.borderWidth ?? null,
    backgroundColor: attrs.backgroundColor ?? null,
    styleId: attrs.styleId ?? null,
    banded: attrs.banded !== false,
    tableId: attrs.tableId ?? null,
    isContinuation: Boolean(attrs.isContinuation),
    hasRepeatedHeader: Boolean(attrs.hasRepeatedHeader),
    fontFamily: attrs.fontFamily ?? null,
    fontSize: attrs.fontSize ?? null,
    colWidths: [...attrs.colWidths],
    rowHeights: [...attrs.rowHeights],
    cells: attrs.cells.map((row) => row.map((c) => ({ ...c }))),
  };
}

export function tablePixelWidth(attrs: WidgetTableAttrs): number {
  return attrs.colWidths.reduce((s, w) => s + w, 0);
}

function nodeToHtml(node: { type?: string; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; content?: unknown[] }): string {
  if (node.type === 'text') {
    let t = escapeHtml(node.text ?? '');
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') t = `<strong>${t}</strong>`;
        else if (mark.type === 'italic') t = `<em>${t}</em>`;
        else if (mark.type === 'underline') t = `<u>${t}</u>`;
        else if (mark.type === 'link' && mark.attrs?.href) {
          t = `<a href="${escapeHtml(String(mark.attrs.href))}">${t}</a>`;
        }
      }
    }
    return t;
  }
  if (node.type === 'hardBreak') return '<br>';
  if (!Array.isArray(node.content)) return '';
  const inner = node.content.map((child) => nodeToHtml(child as { type?: string; text?: string })).join('');
  if (node.type === 'paragraph') {
    return inner || '';
  }
  return inner;
}

/**
 * Strips conflicting child inline font styles (font-size and/or font-family) from cell HTML
 * so that cell-level or table-level styling can take effect on all text inside the cell.
 */
export function cleanCellFontStyles(
  html: string,
  prop: 'fontSize' | 'fontFamily' | 'all' = 'all',
): string {
  if (!html || (!html.includes('font-size') && !html.includes('font-family') && !html.includes('face') && !html.includes('size'))) {
    return html;
  }
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('*').forEach((el) => {
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
    return div.innerHTML;
  }
  return html;
}

/**
 * Convert a nested TipTap table JSON (tableRow / tableCell) into widget attrs.
 */
export function legacyTableToAttrs(node: {
  attrs?: Record<string, unknown>;
  content?: Array<{
    content?: Array<{
      attrs?: { backgroundColor?: string | null; verticalAlign?: string };
      content?: unknown[];
    }>;
  }>;
}): WidgetTableAttrs {
  const rows = node.content ?? [];
  if (rows.length === 0) return createWidgetTableAttrs();

  const cells: WidgetCell[][] = rows.map((row) =>
    (row.content ?? []).map((cell) => {
      const htmlParts = (cell.content ?? []).map((child) =>
        nodeToHtml(child as { type?: string; text?: string; content?: unknown[] }),
      );
      const contentHtml = htmlParts.join('<br>');
      return {
        contentHtml,
        backgroundColor: cell.attrs?.backgroundColor ?? null,
        verticalAlign:
          cell.attrs?.verticalAlign === 'middle' || cell.attrs?.verticalAlign === 'bottom'
            ? cell.attrs.verticalAlign
            : 'top',
      };
    }),
  );

  return normalizeAttrs({
    cells,
    withHeaderRow: true,
    wrap: (node.attrs?.wrap as TableWrap) || 'none',
    colWidths: node.attrs?.colWidths as number[] | undefined,
    rowHeights: node.attrs?.rowHeights as Array<number | null> | undefined,
  });
}

export function parseTableElement(el: HTMLElement): WidgetTableAttrs {
  const table = (el.tagName === 'TABLE' ? el : el.querySelector('table')) as HTMLTableElement | null;
  if (!table) return createWidgetTableAttrs();

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return createWidgetTableAttrs();

  const cells: WidgetCell[][] = rows.map((tr) =>
    Array.from(tr.querySelectorAll('th, td')).map((cell) => {
      const htmlEl = cell as HTMLElement;
      const rawHtml = htmlEl.innerHTML || '';
      return {
        contentHtml: rawHtml.trim(),
        backgroundColor: htmlEl.style.backgroundColor || null,
        verticalAlign:
          htmlEl.style.verticalAlign === 'middle' || htmlEl.style.verticalAlign === 'bottom'
            ? (htmlEl.style.verticalAlign as CellAlign)
            : 'top',
        rowspan: parseInt(htmlEl.getAttribute('rowspan') || '1', 10) || 1,
        colspan: parseInt(htmlEl.getAttribute('colspan') || '1', 10) || 1,
        width: htmlEl.style.width || null,
        height: htmlEl.style.height || null,
        borderStyle: htmlEl.style.borderStyle || null,
        borderColor: htmlEl.style.borderColor || null,
        borderWidth: htmlEl.style.borderWidth ? parseInt(htmlEl.style.borderWidth, 10) : null,
        color: htmlEl.style.color || null,
        fontFamily: (htmlEl.style.fontFamily || htmlEl.dataset.fontFamily || "").replace(/['"]+/g, "") || null,
        fontSize: htmlEl.style.fontSize || htmlEl.dataset.fontSize || null,
      };
    }),
  );

  const totalGridCols = cells.reduce((max, row) => {
    const rowSpanSum = row.reduce((sum, cell) => sum + (cell.colspan || 1), 0);
    return Math.max(max, rowSpanSum);
  }, 1);
  const colWidths = Array.from({ length: totalGridCols }, (_, i) => {
    const col = table.querySelectorAll('col')[i] as HTMLElement | undefined;
    const w = col ? parseInt(col.style.width || col.getAttribute('width') || '', 10) : NaN;
    if (Number.isFinite(w) && w >= MIN_COL_WIDTH) return w;
    const first = rows[0]?.querySelectorAll('th, td')[i] as HTMLElement | undefined;
    const measuredWidth = first ? first.getBoundingClientRect().width : 0;
    const cw = measuredWidth > 0 ? measuredWidth : DEFAULT_COL_WIDTH;
    return Math.max(MIN_COL_WIDTH, Math.round(cw));
  });

  const rowHeights = rows.map((tr) => {
    const h = parseInt((tr as HTMLElement).style.height || '', 10);
    return Number.isFinite(h) && h >= MIN_ROW_HEIGHT ? h : null;
  });

  const wrapAttr = (el.dataset.wrap || el.getAttribute('data-wrap')) as TableWrap | undefined;
  const wrap: TableWrap = wrapAttr === 'left' || wrapAttr === 'right' ? wrapAttr : 'left';
  const marginRight = parseInt(el.style.marginRight || el.dataset.marginRight || '16', 10) || 16;

  return normalizeAttrs({
    cells,
    colWidths,
    rowHeights,
    withHeaderRow: rows[0]?.querySelector('th') != null,
    wrap,
    marginRight,
    borderStyle: table.style.borderStyle || null,
    borderColor: table.style.borderColor || null,
    borderWidth: table.style.borderWidth ? parseInt(table.style.borderWidth, 10) : null,
    backgroundColor: table.style.backgroundColor || null,
    styleId: el.dataset.tableStyle || null,
    banded: el.dataset.banded !== 'false',
    tableId: el.dataset.tableId || el.getAttribute('data-table-id') || null,
    isContinuation: el.dataset.tableContinuation === 'true' || el.getAttribute('data-table-continuation') === 'true',
    hasRepeatedHeader: el.dataset.tableRepeatedHeader === 'true' || el.getAttribute('data-table-repeated-header') === 'true',
    fontFamily: (table.style.fontFamily || el.dataset.fontFamily || el.getAttribute('data-font-family') || '').replace(/['"]+/g, '') || null,
    fontSize: table.style.fontSize || el.dataset.fontSize || el.getAttribute('data-font-size') || null,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export function attrsToHtml(attrs: WidgetTableAttrs): string {
  const data = normalizeAttrs(attrs);
  const width = tablePixelWidth(data);
  const cols = data.colWidths
    .map((w) => `<col style="width:${w}px">`)
    .join('');

  const tableStyles: string[] = [`width:${width}px`];
  if (data.borderStyle) tableStyles.push(`border-style:${data.borderStyle}`);
  if (data.borderColor) tableStyles.push(`border-color:${data.borderColor}`);
  if (data.borderWidth != null) tableStyles.push(`border-width:${data.borderWidth}px`);
  if (data.backgroundColor) tableStyles.push(`background-color:${data.backgroundColor}`);
  if (data.fontFamily) tableStyles.push(`font-family:${data.fontFamily}`);
  if (data.fontSize) tableStyles.push(`font-size:${data.fontSize}`);

  const body = data.cells
    .map((row, r) => {
      const h = data.rowHeights[r];
      const heightAttr = h != null ? ` style="height:${h}px"` : '';
      const cells = row
        .map((cell) => {
          const tag = data.withHeaderRow && r === 0 ? 'th' : 'td';
          const style: string[] = [];
          if (cell.backgroundColor) style.push(`background-color:${cell.backgroundColor}`);
          if (cell.verticalAlign !== 'top') style.push(`vertical-align:${cell.verticalAlign}`);
          if (cell.width) style.push(`width:${typeof cell.width === 'number' ? `${cell.width}px` : cell.width}`);
          if (cell.height) style.push(`height:${typeof cell.height === 'number' ? `${cell.height}px` : cell.height}`);
          else if (h != null) style.push(`height:${h}px`);
          if (cell.borderStyle) style.push(`border-style:${cell.borderStyle}`);
          if (cell.borderColor) style.push(`border-color:${cell.borderColor}`);
          if (cell.borderWidth != null) style.push(`border-width:${cell.borderWidth}px`);
          if (cell.color) style.push(`color:${cell.color}`);
          if (cell.fontFamily) style.push(`font-family:${cell.fontFamily}`);
          if (cell.fontSize) style.push(`font-size:${cell.fontSize}`);
          const styleAttr = style.length ? ` style="${style.join(';')}"` : '';
          const spanAttrs: string[] = [];
          if (cell.rowspan && cell.rowspan > 1) spanAttrs.push(`rowspan="${cell.rowspan}"`);
          if (cell.colspan && cell.colspan > 1) spanAttrs.push(`colspan="${cell.colspan}"`);
          const extra = spanAttrs.length ? ` ${spanAttrs.join(' ')}` : '';
          const content = cell.contentHtml || '';
          return `<${tag}${styleAttr}${extra}>${content}</${tag}>`;
        })
        .join('');
      return `<tr${heightAttr}>${cells}</tr>`;
    })
    .join('');

  const styleAttrs = [
    data.styleId ? ` data-table-style="${data.styleId}"` : '',
    data.banded === false ? ' data-banded="false"' : '',
    data.tableId ? ` data-table-id="${escapeHtml(data.tableId)}"` : '',
    data.isContinuation ? ' data-table-continuation="true"' : '',
    data.hasRepeatedHeader ? ' data-table-repeated-header="true"' : '',
    data.fontFamily ? ` data-font-family="${escapeHtml(data.fontFamily)}"` : '',
    data.fontSize ? ` data-font-size="${escapeHtml(data.fontSize)}"` : '',
  ].join('');

  return `<div class="cde-wt cde-wt--wrap-${data.wrap}" data-widget-table="true" data-wrap="${data.wrap}"${styleAttrs} style="width:${width}px;margin-right:${data.marginRight ?? 16}px"><table class="cde-wt__grid" style="${tableStyles.join(';')}"><colgroup>${cols}</colgroup><tbody>${body}</tbody></table></div>`;
}

export function splitAttrsAtRow(
  attrs: WidgetTableAttrs,
  splitIndex: number,
  repeatHeader = true,
): { first: WidgetTableAttrs | null; second: WidgetTableAttrs | null } {
  const data = normalizeAttrs(attrs);
  if (splitIndex <= 0) return { first: null, second: data };
  if (splitIndex >= data.cells.length) return { first: data, second: null };

  const tableId = data.tableId ?? `table-continuation-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const first: WidgetTableAttrs = {
    withHeaderRow: data.withHeaderRow,
    wrap: data.wrap,
    marginRight: data.marginRight,
    borderStyle: data.borderStyle,
    borderColor: data.borderColor,
    borderWidth: data.borderWidth,
    backgroundColor: data.backgroundColor,
    styleId: data.styleId,
    banded: data.banded,
    tableId,
    isContinuation: data.isContinuation,
    hasRepeatedHeader: data.hasRepeatedHeader,
    fontFamily: data.fontFamily,
    fontSize: data.fontSize,
    colWidths: [...data.colWidths],
    rowHeights: data.rowHeights.slice(0, splitIndex),
    cells: data.cells.slice(0, splitIndex).map((row) => row.map((c) => ({ ...c }))),
  };

  const shouldRepeatHeader = repeatHeader && data.withHeaderRow && splitIndex > 0;
  const headerCells = shouldRepeatHeader ? [data.cells[0]!.map((c) => ({ ...c }))] : [];
  const headerHeights = shouldRepeatHeader ? [data.rowHeights[0] ?? null] : [];

  const second: WidgetTableAttrs = {
    withHeaderRow: shouldRepeatHeader,
    wrap: data.wrap,
    marginRight: data.marginRight,
    borderStyle: data.borderStyle,
    borderColor: data.borderColor,
    borderWidth: data.borderWidth,
    backgroundColor: data.backgroundColor,
    styleId: data.styleId,
    banded: data.banded,
    tableId,
    isContinuation: true,
    hasRepeatedHeader: shouldRepeatHeader,
    fontFamily: data.fontFamily,
    fontSize: data.fontSize,
    colWidths: [...data.colWidths],
    rowHeights: [...headerHeights, ...data.rowHeights.slice(splitIndex)],
    cells: [...headerCells, ...data.cells.slice(splitIndex).map((row) => row.map((c) => ({ ...c })))],
  };
  return { first, second };
}

export function canJoinTables(
  aAttrs: Partial<WidgetTableAttrs> | null | undefined,
  bAttrs: Partial<WidgetTableAttrs> | null | undefined,
): boolean {
  if (!aAttrs || !bAttrs) return false;
  // If both have the same tableId, they belong to the exact same logical table
  if (aAttrs.tableId && bAttrs.tableId && aAttrs.tableId === bAttrs.tableId) {
    return true;
  }
  // If b is marked as continuation and column counts match
  if (bAttrs.isContinuation && aAttrs.colWidths && bAttrs.colWidths && aAttrs.colWidths.length === bAttrs.colWidths.length) {
    return true;
  }
  return false;
}

export function joinTableAttrs(
  first: WidgetTableAttrs,
  second: WidgetTableAttrs,
): WidgetTableAttrs {
  const a = normalizeAttrs(first);
  const b = normalizeAttrs(second);

  // If the second table has a repeated header row, strip it so it doesn't duplicate in the joined table
  const hasDupHeader = Boolean(b.hasRepeatedHeader) && b.cells.length > 1;
  const secondCells = hasDupHeader ? b.cells.slice(1) : b.cells;
  const secondRowHeights = hasDupHeader ? b.rowHeights.slice(1) : b.rowHeights;

  return {
    ...a,
    tableId: a.tableId || b.tableId,
    isContinuation: a.isContinuation,
    hasRepeatedHeader: a.hasRepeatedHeader,
    colWidths: a.colWidths.length >= b.colWidths.length ? [...a.colWidths] : [...b.colWidths],
    rowHeights: [...a.rowHeights, ...secondRowHeights],
    cells: [
      ...a.cells.map((row) => row.map((c) => ({ ...c }))),
      ...secondCells.map((row) => row.map((c) => ({ ...c }))),
    ],
  };
}

export function evaluateTableFormulas(attrs: WidgetTableAttrs): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  const rows = next.cells.length;

  const extractNumber = (html: string): number | null => {
    const plain = html.replace(/<[^>]+>/g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '').trim();
    if (!plain) return null;
    const n = parseFloat(plain);
    return Number.isFinite(n) ? n : null;
  };

  for (let r = 0; r < rows; r += 1) {
    const row = next.cells[r]!;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c]!;
      const text = cell.contentHtml.replace(/<[^>]+>/g, '').trim();
      const match = text.match(/^=(SUM|AVERAGE|COUNT|PRODUCT|MIN|MAX)\((ABOVE|LEFT|BELOW|RIGHT)\)/i);
      if (!match) continue;

      const fn = match[1]!.toUpperCase();
      const dir = match[2]!.toUpperCase();
      const values: number[] = [];

      if (dir === 'ABOVE') {
        for (let i = 0; i < r; i += 1) {
          const v = extractNumber(next.cells[i]![c]?.contentHtml ?? '');
          if (v != null) values.push(v);
        }
      } else if (dir === 'BELOW') {
        for (let i = r + 1; i < rows; i += 1) {
          const v = extractNumber(next.cells[i]![c]?.contentHtml ?? '');
          if (v != null) values.push(v);
        }
      } else if (dir === 'LEFT') {
        for (let j = 0; j < c; j += 1) {
          const v = extractNumber(row[j]?.contentHtml ?? '');
          if (v != null) values.push(v);
        }
      } else if (dir === 'RIGHT') {
        for (let j = c + 1; j < row.length; j += 1) {
          const v = extractNumber(row[j]?.contentHtml ?? '');
          if (v != null) values.push(v);
        }
      }

      if (values.length === 0) continue;

      let res = 0;
      if (fn === 'SUM') res = values.reduce((s, v) => s + v, 0);
      else if (fn === 'AVERAGE') res = values.reduce((s, v) => s + v, 0) / values.length;
      else if (fn === 'COUNT') res = values.length;
      else if (fn === 'PRODUCT') res = values.reduce((s, v) => s * v, 1);
      else if (fn === 'MIN') res = Math.min(...values);
      else if (fn === 'MAX') res = Math.max(...values);

      const formatted = Number.isInteger(res) ? String(res) : res.toFixed(2);
      next.cells[r]![c] = {
        ...cell,
        contentHtml: formatted,
      };
    }
  }
  return next;
}

export function autoFitColWidths(attrs: WidgetTableAttrs, targetWidth?: number): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  const numCols = next.colWidths.length;
  const maxTokens = Array.from({ length: numCols }, () => 0);

  next.cells.forEach((row) => {
    row.forEach((cell, c) => {
      if (c >= numCols) return;
      const len = cell.contentHtml.replace(/<[^>]+>/g, '').trim().length;
      if (len > maxTokens[c]!) {
        maxTokens[c] = len;
      }
    });
  });

  const charPx = 8.5;
  const paddingPx = 20;
  next.colWidths = maxTokens.map((val) => {
    const estimated = Math.round(val * charPx + paddingPx);
    return Math.max(MIN_COL_WIDTH, Math.min(DEFAULT_COL_WIDTH * 2, estimated));
  });

  if (targetWidth != null && targetWidth > 0) {
    return fitColWidthsToWidth(next, targetWidth);
  }
  return next;
}

export function fitColWidthsToWidth(attrs: WidgetTableAttrs, targetWidth: number): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  const currentWidth = tablePixelWidth(next);
  if (currentWidth <= 0 || targetWidth <= 0) return next;

  const ratio = targetWidth / currentWidth;
  const cols = next.colWidths.length;
  let allocated = 0;

  next.colWidths = next.colWidths.map((w, i) => {
    if (i === cols - 1) {
      return Math.max(MIN_COL_WIDTH, targetWidth - allocated);
    }
    const nw = Math.max(MIN_COL_WIDTH, Math.round(w * ratio));
    allocated += nw;
    return nw;
  });

  return next;
}

export function distributeColsEvenly(attrs: WidgetTableAttrs): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  const numCols = next.colWidths.length;
  if (numCols === 0) return next;
  const total = tablePixelWidth(next);
  const each = Math.max(MIN_COL_WIDTH, Math.floor(total / numCols));
  next.colWidths = Array.from({ length: numCols }, () => each);
  return next;
}

export interface TableStylePreset {
  id: string;
  /** Ribbon gallery label. */
  name: string;
  headerBackground: string | null;
  headerColor: string | null;
  bodyBackground: string | null;
  bodyColor: string | null;
  /** Shading of even body rows when banding is enabled. */
  bandBackground: string | null;
  borderStyle: string | null;
  borderColor: string | null;
  borderWidth: number | null;
  cellBorderStyle: string | null;
  cellBorderColor: string | null;
  cellBorderWidth: number | null;
}

/** Word-like table gallery. `plain` removes every preset color. */
export const TABLE_STYLE_PRESETS: TableStylePreset[] = [
  {
    id: 'plain',
    name: 'Sin formato',
    headerBackground: null,
    headerColor: null,
    bodyBackground: null,
    bodyColor: null,
    bandBackground: null,
    borderStyle: null,
    borderColor: null,
    borderWidth: null,
    cellBorderStyle: null,
    cellBorderColor: null,
    cellBorderWidth: null,
  },
  {
    id: 'grid',
    name: 'Cuadrícula',
    headerBackground: '#f1f5f9',
    headerColor: '#0f172a',
    bodyBackground: '#ffffff',
    bodyColor: '#1f2937',
    bandBackground: '#f8fafc',
    borderStyle: 'solid',
    borderColor: '#94a3b8',
    borderWidth: 1,
    cellBorderStyle: 'solid',
    cellBorderColor: '#cbd5e1',
    cellBorderWidth: 1,
  },
  {
    id: 'grid-strong',
    name: 'Cuadrícula intensa',
    headerBackground: '#1f2937',
    headerColor: '#ffffff',
    bodyBackground: '#ffffff',
    bodyColor: '#111827',
    bandBackground: '#f3f4f6',
    borderStyle: 'solid',
    borderColor: '#111827',
    borderWidth: 1.5,
    cellBorderStyle: 'solid',
    cellBorderColor: '#4b5563',
    cellBorderWidth: 1,
  },
  {
    id: 'blue',
    name: 'Azul',
    headerBackground: '#1d4ed8',
    headerColor: '#ffffff',
    bodyBackground: '#ffffff',
    bodyColor: '#1e293b',
    bandBackground: '#eff6ff',
    borderStyle: 'solid',
    borderColor: '#3b82f6',
    borderWidth: 1,
    cellBorderStyle: 'solid',
    cellBorderColor: '#bfdbfe',
    cellBorderWidth: 1,
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    headerBackground: '#047857',
    headerColor: '#ffffff',
    bodyBackground: '#ffffff',
    bodyColor: '#064e3b',
    bandBackground: '#ecfdf5',
    borderStyle: 'solid',
    borderColor: '#10b981',
    borderWidth: 1,
    cellBorderStyle: 'solid',
    cellBorderColor: '#a7f3d0',
    cellBorderWidth: 1,
  },
  {
    id: 'violet',
    name: 'Violeta',
    headerBackground: '#6d28d9',
    headerColor: '#ffffff',
    bodyBackground: '#ffffff',
    bodyColor: '#2e1065',
    bandBackground: '#f5f3ff',
    borderStyle: 'solid',
    borderColor: '#8b5cf6',
    borderWidth: 1,
    cellBorderStyle: 'solid',
    cellBorderColor: '#ddd6fe',
    cellBorderWidth: 1,
  },
];

export function applyTableStylePreset(attrs: WidgetTableAttrs, styleId: string | null): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  next.styleId = styleId;
  const preset = TABLE_STYLE_PRESETS.find((p) => p.id === styleId);
  if (!preset || styleId === 'plain') {
    next.borderStyle = null;
    next.borderColor = null;
    next.borderWidth = null;
    next.backgroundColor = null;
    next.cells.forEach((row) => {
      row.forEach((c) => {
        c.backgroundColor = null;
        c.color = null;
        c.borderStyle = null;
        c.borderColor = null;
        c.borderWidth = null;
      });
    });
    return next;
  }

  next.borderStyle = preset.borderStyle;
  next.borderColor = preset.borderColor;
  next.borderWidth = preset.borderWidth;
  next.backgroundColor = preset.bodyBackground;

  next.cells.forEach((row, r) => {
    const isHeader = next.withHeaderRow && r === 0;
    const isEven = r % 2 === 0;
    row.forEach((c) => {
      if (isHeader) {
        c.backgroundColor = preset.headerBackground;
        c.color = preset.headerColor;
      } else if (next.banded && isEven && preset.bandBackground) {
        c.backgroundColor = preset.bandBackground;
        c.color = preset.bodyColor;
      } else {
        c.backgroundColor = preset.bodyBackground;
        c.color = preset.bodyColor;
      }
      c.borderStyle = preset.cellBorderStyle;
      c.borderColor = preset.cellBorderColor;
      c.borderWidth = preset.cellBorderWidth;
    });
  });

  return next;
}

export function refreshTableStyle(attrs: WidgetTableAttrs): WidgetTableAttrs {
  if (!attrs.styleId) return attrs;
  return applyTableStylePreset(attrs, attrs.styleId);
}

/** Migrate legacy TipTap table nodes across a full JSON doc into widget tables. */
export function migrateDocTables(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (doc.type === 'table') {
    if (doc.attrs && Array.isArray(doc.attrs.cells)) {
      return {
        ...doc,
        attrs: normalizeAttrs(doc.attrs),
      };
    }
    return {
      type: 'table',
      attrs: legacyTableToAttrs(doc),
    };
  }
  if (Array.isArray(doc.content)) {
    return {
      ...doc,
      content: doc.content.map(migrateDocTables),
    };
  }
  return doc;
}

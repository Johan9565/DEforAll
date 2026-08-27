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
}

export function emptyCell(): WidgetCell {
  return {
    contentHtml: '',
    backgroundColor: null,
    verticalAlign: 'top',
    rowspan: 1,
    colspan: 1,
  };
}

export function createWidgetTableAttrs(
  rows = 3,
  cols = 3,
  withHeaderRow = true,
  wrap: TableWrap = 'left',
  marginRight = 16,
): WidgetTableAttrs {
  const r = Math.max(1, rows);
  const c = Math.max(1, cols);
  return {
    withHeaderRow,
    wrap,
    marginRight,
    colWidths: Array.from({ length: c }, () => DEFAULT_COL_WIDTH),
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
    const cw = first?.getBoundingClientRect().width ?? DEFAULT_COL_WIDTH;
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

  return `<div class="cde-wt cde-wt--wrap-${data.wrap}" data-widget-table="true" data-wrap="${data.wrap}" style="width:${width}px;margin-right:${data.marginRight ?? 16}px"><table class="cde-wt__grid" style="${tableStyles.join(';')}"><colgroup>${cols}</colgroup><tbody>${body}</tbody></table></div>`;
}

export function splitAttrsAtRow(
  attrs: WidgetTableAttrs,
  splitIndex: number,
  repeatHeader = true,
): { first: WidgetTableAttrs | null; second: WidgetTableAttrs | null } {
  const data = normalizeAttrs(attrs);
  if (splitIndex <= 0) return { first: null, second: data };
  if (splitIndex >= data.cells.length) return { first: data, second: null };

  const first: WidgetTableAttrs = {
    withHeaderRow: data.withHeaderRow,
    wrap: data.wrap,
    marginRight: data.marginRight,
    borderStyle: data.borderStyle,
    borderColor: data.borderColor,
    borderWidth: data.borderWidth,
    backgroundColor: data.backgroundColor,
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
    colWidths: [...data.colWidths],
    rowHeights: [...headerHeights, ...data.rowHeights.slice(splitIndex)],
    cells: [...headerCells, ...data.cells.slice(splitIndex).map((row) => row.map((c) => ({ ...c })))],
  };
  return { first, second };
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

      const numbers: number[] = [];
      if (dir === 'ABOVE') {
        for (let i = 0; i < r; i += 1) {
          const val = extractNumber(next.cells[i]?.[c]?.contentHtml || '');
          if (val !== null) numbers.push(val);
        }
      } else if (dir === 'LEFT') {
        for (let j = 0; j < c; j += 1) {
          const val = extractNumber(row[j]?.contentHtml || '');
          if (val !== null) numbers.push(val);
        }
      } else if (dir === 'BELOW') {
        for (let i = r + 1; i < rows; i += 1) {
          const val = extractNumber(next.cells[i]?.[c]?.contentHtml || '');
          if (val !== null) numbers.push(val);
        }
      } else if (dir === 'RIGHT') {
        for (let j = c + 1; j < row.length; j += 1) {
          const val = extractNumber(row[j]?.contentHtml || '');
          if (val !== null) numbers.push(val);
        }
      }

      let res = 0;
      if (numbers.length > 0) {
        if (fn === 'SUM') {
          res = numbers.reduce((a, b) => a + b, 0);
        } else if (fn === 'AVERAGE') {
          res = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        } else if (fn === 'COUNT') {
          res = numbers.length;
        } else if (fn === 'PRODUCT') {
          res = numbers.reduce((a, b) => a * b, 1);
        } else if (fn === 'MIN') {
          res = Math.min(...numbers);
        } else if (fn === 'MAX') {
          res = Math.max(...numbers);
        }
      }

      cell.contentHtml = String(Math.round(res * 100) / 100);
    }
  }

  return next;
}

export function autoFitColWidths(attrs: WidgetTableAttrs, targetWidth = 600): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  const numCols = next.colWidths.length;
  if (numCols === 0) return next;

  const minTokens = Array.from({ length: numCols }, () => 20);
  const maxTokens = Array.from({ length: numCols }, () => 40);

  next.cells.forEach((row) => {
    row.forEach((cell, c) => {
      if (c >= numCols) return;
      const plain = cell.contentHtml.replace(/<[^>]+>/g, '').trim();
      if (!plain) return;
      const words = plain.split(/\s+/);
      const longestWord = words.reduce((m, w) => Math.max(m, w.length), 0);
      const cellMin = longestWord * 8.5 + 20;
      const cellMax = plain.length * 8.0 + 20;
      minTokens[c] = Math.max(minTokens[c]!, cellMin);
      maxTokens[c] = Math.max(maxTokens[c]!, cellMax);
    });
  });

  const sumMax = maxTokens.reduce((s, w) => s + w, 0);
  const usable = Math.max(numCols * MIN_COL_WIDTH, targetWidth);

  next.colWidths = maxTokens.map((val) => {
    const proportion = sumMax > 0 ? val / sumMax : 1 / numCols;
    return Math.max(MIN_COL_WIDTH, Math.round(usable * proportion));
  });

  return next;
}

export function distributeColsEvenly(attrs: WidgetTableAttrs): WidgetTableAttrs {
  const next = cloneAttrs(attrs);
  const numCols = next.colWidths.length;
  if (numCols === 0) return next;
  const total = tablePixelWidth(next);
  const each = Math.max(MIN_COL_WIDTH, Math.round(total / numCols));
  next.colWidths = Array.from({ length: numCols }, () => each);
  return next;
}

export function migrateDocTables(doc: {
  type?: string;
  content?: Array<Record<string, unknown>>;
}): typeof doc {
  if (!doc.content) return doc;
  return {
    ...doc,
    content: doc.content.map((node) => {
      if (node.type !== 'table') return node;
      const content = node.content as WidgetTableAttrs['cells'] | undefined;
      // Already a widget (no nested rows)
      if (!content || !Array.isArray(content) || content.length === 0) {
        return {
          type: 'table',
          attrs: normalizeAttrs(node.attrs as Partial<WidgetTableAttrs>),
        };
      }
      const first = content[0] as { type?: string };
      if (first && first.type === 'tableRow') {
        return {
          type: 'table',
          attrs: legacyTableToAttrs(node as Parameters<typeof legacyTableToAttrs>[0]),
        };
      }
      return {
        type: 'table',
        attrs: normalizeAttrs(node.attrs as Partial<WidgetTableAttrs>),
      };
    }),
  };
}

import type { JSONContent } from '@tiptap/core';
import { splitAttrsAtRow, normalizeAttrs, type WidgetTableAttrs } from '../extensions/widgetTable/model';

export type TableSplitResult = {
  table1: JSONContent | null;
  table2: JSONContent | null;
};

function widgetFromJson(tableNodeJSON: JSONContent): WidgetTableAttrs {
  return normalizeAttrs(tableNodeJSON.attrs as Partial<WidgetTableAttrs>);
}

function toJson(attrs: WidgetTableAttrs): JSONContent {
  return {
    type: 'table',
    attrs,
  };
}

/**
 * Partition a widget table by whole rows using measured DOM row heights.
 */
export function splitTableOnOverflow(
  tableNodeJSON: JSONContent,
  maxAllowedHeight: number,
  tableDom: HTMLElement,
  isTopNode = false,
): TableSplitResult {
  const attrs = widgetFromJson(tableNodeJSON);
  const rows = attrs.cells;
  if (rows.length === 0) return { table1: null, table2: null };

  const domRows = tableDom.querySelectorAll('tr');
  let currentHeight = 0;
  let splitIndex = -1;
  const count = Math.min(rows.length, domRows.length);

  for (let i = 0; i < count; i += 1) {
    const rowHeight = (domRows[i] as HTMLElement).offsetHeight;
    if (currentHeight + rowHeight > maxAllowedHeight && splitIndex === -1) {
      splitIndex = i;
    }
    if (splitIndex === -1) currentHeight += rowHeight;
  }

  if (splitIndex === 0 && isTopNode && rows.length > 1) {
    splitIndex = 1;
  }

  if (splitIndex === -1) {
    return { table1: toJson(attrs), table2: null };
  }

  const { first, second } = splitAttrsAtRow(attrs, splitIndex);
  return {
    table1: first ? toJson(first) : null,
    table2: second ? toJson(second) : null,
  };
}

export function splitTableAtLimitY(
  tableNodeJSON: JSONContent,
  tableDom: HTMLElement,
  limitY: number,
  isTopNode = false,
): TableSplitResult {
  const attrs = widgetFromJson(tableNodeJSON);
  const rows = attrs.cells;
  if (rows.length === 0) return { table1: null, table2: null };

  const domRows = tableDom.querySelectorAll('tr');
  let splitIndex = -1;
  const count = Math.min(rows.length, domRows.length);
  for (let i = 0; i < count; i += 1) {
    const bottom = (domRows[i] as HTMLElement).getBoundingClientRect().bottom;
    if (bottom > limitY) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === 0 && isTopNode && rows.length > 1) {
    splitIndex = 1;
  }

  if (splitIndex === -1) {
    return { table1: toJson(attrs), table2: null };
  }

  const { first, second } = splitAttrsAtRow(attrs, splitIndex);
  return {
    table1: first ? toJson(first) : null,
    table2: second ? toJson(second) : null,
  };
}

import { Editor, type Extensions, type JSONContent } from '@tiptap/core';
import type { Node as ProseNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { PageSize } from '../types';
import { splitTableAtLimitY } from './tableSplit';
import {
  canJoinTables,
  joinTableAttrs,
  type WidgetTableAttrs,
} from '../extensions/widgetTable/model';

export interface OverflowExtractResult {
  /** Top-level JSON nodes to prepend onto the next page. */
  moved: JSONContent[];
  /** Doc position where the cut happened (before deletion). */
  cutPos: number | null;
  /** True when the caret was in the moved region and should follow. */
  followCursor: boolean;
}

function fragmentToJson(
  fragment: import('@tiptap/pm/model').Fragment,
): JSONContent[] {
  const nodes: JSONContent[] = [];
  fragment.forEach((child) => {
    nodes.push(child.toJSON() as JSONContent);
  });
  return nodes;
}

/** True when a JSON node has no visible text / media. */
export function isEmptyJsonNode(node: JSONContent | undefined): boolean {
  if (!node) return true;
  if (node.type === 'image' || node.type === 'horizontalRule') return false;
  if (node.type === 'table') return false;
  if (!node.content || node.content.length === 0) {
    return (
      node.type === 'paragraph' ||
      node.type === 'heading' ||
      node.type === 'blockquote' ||
      !node.type
    );
  }
  return node.content.every((child) => {
    if (child.type === 'text') return !child.text || child.text.length === 0;
    if (child.type === 'hardBreak') return true;
    return isEmptyJsonNode(child);
  });
}

export function filterMeaningfulNodes(nodes: JSONContent[]): JSONContent[] {
  return nodes.filter((n) => !isEmptyJsonNode(n));
}

/**
 * Prefer the live sheet body height — metrics can disagree by a few px and leave
 * a clipped "ghost" line inside overflow:hidden.
 */
export function resolveBodyHeightPx(
  editor: Editor,
  fallbackPx: number,
): number {
  const dom = editor.view.dom as HTMLElement;
  const body = dom.closest('.cde-page-sheet__body') as HTMLElement | null;
  if (body && body.clientHeight > 0) {
    return body.clientHeight;
  }
  return fallbackPx;
}

/**
 * Real content overflow — ignore ProseMirror min-height which keeps scrollHeight
 * at the full page even when only a few lines of text exist.
 */
export function contentOverflows(
  editor: Editor,
  bodyHeightPx: number,
  slackPx = 0,
): boolean {
  return contentFreeSpacePx(editor, bodyHeightPx) < -slackPx;
}

/** Pixels of unused body height below the last content box (negative ⇒ overflow). */
export function contentFreeSpacePx(
  editor: Editor,
  bodyHeightPx: number,
): number {
  const dom = editor.view.dom as HTMLElement;
  void dom.offsetHeight;
  const body = dom.closest('.cde-page-sheet__body') as HTMLElement | null;
  const clipBottom = body
    ? body.getBoundingClientRect().bottom
    : dom.getBoundingClientRect().top + bodyHeightPx;

  let contentBottom = dom.getBoundingClientRect().top;
  const children = dom.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!(child instanceof HTMLElement)) continue;
    let bottom = child.getBoundingClientRect().bottom;
    try {
      const mb = parseFloat(window.getComputedStyle(child).marginBottom) || 0;
      bottom += mb;
    } catch {
      // ignore
    }
    contentBottom = Math.max(contentBottom, bottom);
  }

  if (dom.scrollHeight > 0 && dom.clientHeight > 0) {
    const overflowDiff = dom.scrollHeight - dom.clientHeight;
    if (overflowDiff > 0) {
      contentBottom = Math.max(contentBottom, dom.getBoundingClientRect().bottom + overflowDiff);
    }
  }

  return clipBottom - contentBottom;
}

/**
 * Position at the start of the first visual line that crosses below the page body.
 */
function findOverflowCutPos(
  view: EditorView,
  bodyHeightPx: number,
): number | null {
  const dom = view.dom as HTMLElement;
  const editorTop = dom.getBoundingClientRect().top;
  const body = dom.closest('.cde-page-sheet__body') as HTMLElement | null;
  // Inset so a line can't sit half-clipped at the overflow:hidden edge
  const inset = 6;
  const limitY = body
    ? body.getBoundingClientRect().bottom - inset
    : editorTop + bodyHeightPx - inset;
  const maxPos = view.state.doc.content.size;
  if (maxPos <= 2) return null;

  for (let p = 1; p <= maxPos; p += 1) {
    try {
      const coords = view.coordsAtPos(p);
      // Use bottom so a line can't sit half-clipped below the page body
      if (coords.bottom > limitY || coords.top > limitY) {
        const cut = snapToLineStart(view, p);
        // Refuse to cut at the very start of the doc (would move everything)
        if (cut <= 1) return null;
        return cut;
      }
    } catch {
      // skip invalid positions
    }
  }

  return null;
}

function snapToLineStart(view: EditorView, pos: number): number {
  const $pos = view.state.doc.resolve(pos);
  if (!$pos.parent.isTextblock) return pos;

  const blockStart = $pos.start();
  let lineStart = pos;
  let lineTop: number | null = null;

  try {
    lineTop = view.coordsAtPos(pos).top;
  } catch {
    return pos;
  }

  for (let p = pos; p >= blockStart; p -= 1) {
    try {
      const top = view.coordsAtPos(p).top;
      if (lineTop !== null && Math.abs(top - lineTop) > 3) break;
      lineStart = p;
    } catch {
      break;
    }
  }

  const parent = $pos.parent;
  const offsetInParent = lineStart - blockStart;
  if (offsetInParent > 0 && offsetInParent < parent.content.size) {
    const text = parent.textBetween(0, parent.content.size, '\0', '\0');
    for (let i = offsetInParent; i > 0; i -= 1) {
      const ch = text[i - 1];
      if (ch === ' ' || ch === '\u00a0' || ch === '\0') {
        const candidate = blockStart + i;
        try {
          const top = view.coordsAtPos(candidate).top;
          if (lineTop !== null && Math.abs(top - lineTop) <= 3) {
            return candidate;
          }
        } catch {
          break;
        }
        break;
      }
      if (offsetInParent - i > 40) break;
    }
  }

  return Math.max(lineStart, blockStart);
}

/**
 * Widget tables are atoms (no inner PM positions). Find a table whose DOM
 * straddles the page limit and split it by whole rows.
 */
function resolveTableDom(
  view: EditorView,
  tablePos: number,
  childIndex: number,
): HTMLElement | null {
  try {
    const nodeDom = view.nodeDOM(tablePos);
    if (nodeDom instanceof HTMLElement) {
      const table = nodeDom.tagName === 'TABLE' ? nodeDom : nodeDom.querySelector('table');
      return table instanceof HTMLElement ? table : nodeDom;
    }
  } catch {
    // ignore
  }

  if (view.dom && view.dom.children && view.dom.children[childIndex] instanceof HTMLElement) {
    const direct = view.dom.children[childIndex] as HTMLElement;
    const table = direct.tagName === 'TABLE' ? direct : direct.querySelector('table');
    return table instanceof HTMLElement ? table : direct;
  }

  if (view.dom) {
    const tables = view.dom.querySelectorAll('.cde-wt, table.cde-wt__grid, [data-widget-table]');
    if (tables.length > 0) {
      const el = (tables[childIndex] || tables[0]) as HTMLElement;
      const table = el.tagName === 'TABLE' ? el : el.querySelector('table');
      return table instanceof HTMLElement ? table : el;
    }
  }

  return null;
}

function findOverflowingTable(
  view: EditorView,
  limitY: number,
): { pos: number; node: ProseNode; childIndex: number } | null {
  const { doc } = view.state;
  let pos = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);
    if (node.type.name === 'table') {
      const tableDom = resolveTableDom(view, pos, i);
      if (tableDom) {
        const container = (tableDom.closest('.cde-wt') as HTMLElement) || tableDom;
        const rect = container.getBoundingClientRect();
        let mb = 0;
        try {
          mb = parseFloat(window.getComputedStyle(container).marginBottom) || 0;
        } catch {
          // ignore
        }
        if (rect.bottom + mb > limitY) {
          return { pos, node, childIndex: i };
        }
      }
    }
    pos += node.nodeSize;
  }
  return null;
}

function extractTableOverflow(
  editor: Editor,
  bodyHeightPx: number,
  selectionFrom: number,
): OverflowExtractResult | null {
  const { doc } = editor.state;
  const dom = editor.view.dom as HTMLElement;
  void dom.offsetHeight;
  const editorTop = dom.getBoundingClientRect().top;
  const body = dom.closest('.cde-page-sheet__body') as HTMLElement | null;
  const limitY = body
    ? body.getBoundingClientRect().bottom - 3
    : editorTop + bodyHeightPx - 3;
  const found = findOverflowingTable(editor.view, limitY);
  if (!found) return null;

  const { pos: tablePos, node: tableNode, childIndex } = found;
  const tableEnd = tablePos + tableNode.nodeSize;
  const tableDom = resolveTableDom(editor.view, tablePos, childIndex);
  if (!tableDom) return null;

  // Split only at complete rows, while preserving a shared tableId on both
  // continuations so they remain one logical table across pages.
  const isTop = tablePos <= 1;
  const split = splitTableAtLimitY(
    tableNode.toJSON() as JSONContent,
    tableDom,
    limitY,
    isTop,
  );
  if (!split.table2) return null;

  const moveFrom = tablePos;
  const trailing = filterMeaningfulNodes(
    fragmentToJson(doc.slice(tableEnd, doc.content.size).content),
  );
  const moved = split.table1
    ? filterMeaningfulNodes([split.table2, ...trailing])
    : filterMeaningfulNodes([split.table2, ...trailing]);
  if (moved.length === 0) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const storage = editor.storage as {
    table?: { row?: number; col?: number };
  };
  const activeTableRow = storage?.table?.row ?? -1;
  const followCursor =
    (split.splitIndex != null && activeTableRow >= split.splitIndex) ||
    selectionFrom >= moveFrom;

  editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;
      if (split.table1) {
        tr.replaceWith(
          tablePos,
          doc.content.size,
          editor.schema.nodeFromJSON(split.table1),
        );
      } else {
        if (moveFrom === 0) {
          const defaultNode = editor.schema.nodes.paragraph
            ? editor.schema.nodes.paragraph.create()
            : editor.schema.nodeFromJSON({ type: 'paragraph' });
          tr.replaceWith(0, doc.content.size, defaultNode);
        } else {
          tr.delete(moveFrom, doc.content.size);
        }
      }
      tr.setMeta('addToHistory', false);
      dispatch(tr);
      return true;
    })
    .run();

  return { moved, cutPos: moveFrom, followCursor };
}

/**
 * Cut overflowing content at a visual line boundary (may split a paragraph).
 * Falls back to moving whole trailing blocks only when a mid-block split isn't possible
 * AND content truly overflows (not min-height false positive).
 * Tables are partitioned by whole rows when the cut lands inside one.
 */
export function extractOverflow(
  editor: Editor,
  bodyHeightPx: number,
  selectionFrom = 0,
): OverflowExtractResult {
  const height = resolveBodyHeightPx(editor, bodyHeightPx);

  if (!contentOverflows(editor, height, 0)) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const tableResult = extractTableOverflow(
    editor,
    height,
    selectionFrom,
  );
  if (tableResult && tableResult.moved.length > 0) return tableResult;

  const cutPos = findOverflowCutPos(editor.view, height);
  if (cutPos != null && cutPos > 1) {
    const doc = editor.state.doc;
    const end = doc.content.size;
    if (cutPos < end) {
      const slice = doc.slice(cutPos, end);
      const rawNodes = fragmentToJson(slice.content);
      let moved = filterMeaningfulNodes(rawNodes);
      if (moved.length === 0 && rawNodes.length > 0) {
        moved = [{ type: 'paragraph' }];
      }
      if (moved.length > 0) {
        const followCursor = selectionFrom >= cutPos;
        const beforeSize = doc.content.size;
        editor
          .chain()
          .command(({ tr, dispatch }) => {
            if (dispatch) {
              tr.delete(cutPos, end);
              tr.setMeta('addToHistory', false);
              dispatch(tr);
            }
            return true;
          })
          .run();

        // Guard: if delete didn't shrink the doc, abort to avoid loops
        if (editor.state.doc.content.size >= beforeSize) {
          return { moved: [], cutPos: null, followCursor: false };
        }

        return { moved, cutPos, followCursor };
      }
    }
  }

  return extractOverflowBlocks(editor, height, selectionFrom);
}

/**
 * Whole-block peel — only when content really overflows and there are 2+ blocks.
 */
function extractOverflowBlocks(
  editor: Editor,
  bodyHeightPx: number,
  selectionFrom: number,
): OverflowExtractResult {
  if (!contentOverflows(editor, bodyHeightPx, 0)) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const json = editor.getJSON();
  const original = [...(json.content ?? [])];
  if (original.length <= 1) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const docSizeBefore = editor.state.doc.content.size;
  const nodes = original.slice();
  const moved: JSONContent[] = [];
  const dom = editor.view.dom as HTMLElement;

  while (nodes.length > 1 && contentOverflows(editor, bodyHeightPx, 0)) {
    const last = nodes.pop()!;
    moved.unshift(last);
    editor.commands.setContent(
      { type: 'doc', content: nodes },
      false,
      { preserveWhitespace: 'full' },
    );
    void dom.offsetHeight;
  }

  let meaningful = filterMeaningfulNodes(moved);
  if (meaningful.length === 0 && moved.length > 0) {
    meaningful = [{ type: 'paragraph' }];
  }
  if (meaningful.length === 0) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const docSizeAfter = editor.state.doc.content.size;
  const followCursor =
    selectionFrom > docSizeAfter || selectionFrom >= docSizeBefore - 1;

  return {
    moved: meaningful,
    cutPos: docSizeAfter,
    followCursor,
  };
}

/** @deprecated Prefer extractOverflow (line-aware). */
export function extractOverflowNodes(
  editor: Editor,
  bodyHeightPx: number,
): JSONContent[] {
  return extractOverflow(editor, bodyHeightPx).moved;
}

export function fillUnderflowFromNext(
  editor: Editor,
  nextNodes: JSONContent[],
  bodyHeightPx: number,
): JSONContent[] {
  if (nextNodes.length === 0) return nextNodes;

  const remaining = [...nextNodes];
  const current = [...(editor.getJSON().content ?? [])];

  while (remaining.length > 0) {
    const candidate = remaining[0]!;
    if (isEmptyJsonNode(candidate)) {
      remaining.shift();
      continue;
    }

    const trial = [...current, candidate];

    editor.commands.setContent(
      { type: 'doc', content: trial },
      false,
      { preserveWhitespace: 'full' },
    );

    if (contentOverflows(editor, bodyHeightPx)) {
      editor.commands.setContent(
        { type: 'doc', content: current },
        false,
        { preserveWhitespace: 'full' },
      );
      break;
    }

    current.push(candidate);
    remaining.shift();
  }

  return remaining;
}

/**
 * Pull leading blocks from `nextNodes` into `current` while they fit in the
 * page body. Uses an offscreen probe so inactive sheets stay untouched.
 * @deprecated Prefer refillPageFromNext (line-aware, rejoins split paragraphs).
 */
export function fillUnderflowFromContent(
  current: JSONContent,
  nextNodes: JSONContent[],
  bodyHeightPx: number,
  extensions: Extensions,
  probe: MeasureProbe,
): { filled: JSONContent; remaining: JSONContent[]; pulledCount: number } {
  const result = refillPageFromNext(
    current,
    { type: 'doc', content: nextNodes },
    bodyHeightPx,
    extensions,
    probe,
  );
  const before = (current.content ?? []).length;
  const after = (result.filled.content ?? []).length;
  return {
    filled: result.filled,
    remaining: result.remaining.content ?? [],
    pulledCount: Math.max(0, after - before),
  };
}

/** True when two top-level blocks can be merged into one flowing block. */
export function canJoinPageBlocks(a: JSONContent, b: JSONContent): boolean {
  if (!a.type || a.type !== b.type) return false;
  // Only continuation tables with matching tableId should be merged automatically across pages.
  // Distinct paragraphs must never be merged.
  if (a.type === 'table') {
    return canJoinTables(
      a.attrs as Partial<WidgetTableAttrs> | undefined,
      b.attrs as Partial<WidgetTableAttrs> | undefined,
    );
  }
  return false;
}

export function joinPageBlocks(a: JSONContent, b: JSONContent): JSONContent {
  if (a.type === 'table' && b.type === 'table') {
    return {
      type: 'table',
      attrs: joinTableAttrs(a.attrs as WidgetTableAttrs, b.attrs as WidgetTableAttrs),
    };
  }
  return {
    ...a,
    content: [...(a.content ?? []), ...(b.content ?? [])],
  };
}

export function mergeAdjacentContinuationTables(nodes: JSONContent[]): JSONContent[] {
  if (nodes.length <= 1) return nodes;
  const result: JSONContent[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const current = nodes[i]!;
    if (result.length > 0) {
      const prev = result[result.length - 1]!;
      if (canJoinPageBlocks(prev, current)) {
        result[result.length - 1] = joinPageBlocks(prev, current);
        continue;
      }
    }
    result.push(current);
  }
  return result;
}

/**
 * Rejoin a mid-paragraph or continuation table page split, then append the rest of the next page.
 */
export function joinPageBoundary(
  leftNodes: JSONContent[],
  rightNodes: JSONContent[],
): JSONContent[] {
  const left = [...leftNodes];
  const right = [...rightNodes];

  if (right.length === 0) {
    return left.length > 0 ? left : [{ type: 'paragraph' }];
  }
  if (left.length === 0) return right;

  const last = left[left.length - 1]!;
  const first = right[0]!;
  let combined: JSONContent[];
  if (canJoinPageBlocks(last, first) && !isEmptyJsonNode(last)) {
    combined = [
      ...left.slice(0, -1),
      joinPageBlocks(last, first),
      ...right.slice(1),
    ];
  } else {
    combined = [...left, ...right];
  }
  return mergeAdjacentContinuationTables(combined);
}

export function docPlainText(doc: JSONContent): string {
  let out = '';
  const walk = (node: JSONContent | undefined): void => {
    if (!node) return;
    if (typeof node.text === 'string') out += node.text;
    node.content?.forEach(walk);
  };
  walk(doc);
  return out;
}

export function docContentWeight(doc: JSONContent): number {
  let count = 0;
  const walk = (node: JSONContent | undefined): void => {
    if (!node) return;
    if (typeof node.text === 'string') count += node.text.length;
    if (node.type === 'table' && node.attrs?.cells && Array.isArray(node.attrs.cells)) {
      count += 10;
      for (const row of node.attrs.cells) {
        count += 10;
        if (Array.isArray(row)) {
          for (const cell of row) {
            count += (cell?.contentHtml?.length || 0) + 5;
          }
        }
      }
    } else if (node.type === 'image') {
      count += 50;
    } else if (node.type === 'horizontalRule') {
      count += 10;
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return count;
}

/**
 * Line-aware underflow: join the page boundary (so split paragraphs and split tables flow again),
 * then cut with the same overflow logic used when pushing content down.
 */
export function refillPageFromNext(
  current: JSONContent,
  next: JSONContent,
  bodyHeightPx: number,
  extensions: Extensions,
  probe: MeasureProbe,
): { filled: JSONContent; remaining: JSONContent; changed: boolean } {
  const nextNodes = next.content ?? [];
  if (nextNodes.length === 0) {
    return { filled: current, remaining: next, changed: false };
  }

  // Measure current page as it actually is, without stripping empty paragraphs
  const currentNodes = current.content ?? [];
  const probeEditor = new Editor({
    element: probe.mount,
    extensions,
    content: {
      type: 'doc',
      content:
        currentNodes.length > 0
          ? currentNodes
          : [{ type: 'paragraph' }],
    },
    editable: false,
    editorProps: {
      attributes: {
        class: 'cde-page-content ProseMirror',
      },
    },
  });
  try {
    void probe.root.offsetHeight;
    void (probeEditor.view.dom as HTMLElement).offsetHeight;
    const free = contentFreeSpacePx(probeEditor, bodyHeightPx);
    if (free < 18) {
      return { filled: current, remaining: next, changed: false };
    }
  } finally {
    probeEditor.destroy();
    probe.mount.replaceChildren();
  }

  const combinedNodes = joinPageBoundary(current.content ?? [], nextNodes);
  const combined: JSONContent = { type: 'doc', content: combinedNodes };
  const beforeWeight = docContentWeight(current);
  const nextWeight = docContentWeight(next);

  const { kept, overflow } = splitOverflowFromContent(
    combined,
    bodyHeightPx,
    extensions,
    probe,
  );

  const remainingNodes = mergeAdjacentContinuationTables(
    overflow.length > 0 ? overflow : [{ type: 'paragraph' }],
  );
  const remaining: JSONContent = {
    type: 'doc',
    content: remainingNodes,
  };

  const keptWeight = docContentWeight(kept);
  const remainingWeight = docContentWeight(remaining);
  // Real pull: more content on this page, or the next page shrank / vanished
  const changed =
    keptWeight > beforeWeight ||
    remainingWeight < nextWeight;

  return { filled: kept, remaining, changed };
}

export function isDocVisuallyEmpty(doc: JSONContent): boolean {
  const nodes = doc.content ?? [];
  if (nodes.length === 0) return true;
  return nodes.every((n) => isEmptyJsonNode(n));
}

export interface MeasureProbe {
  root: HTMLElement;
  mount: HTMLElement;
  destroy: () => void;
}

export function createMeasureProbe(
  pageSize: PageSize,
  host: HTMLElement,
): MeasureProbe {
  const root = document.createElement('div');
  root.className = `cde-page-sheet cde-page-sheet--${pageSize} cde-measure-probe`;
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText =
    'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;';

  const body = document.createElement('div');
  body.className = 'cde-page-sheet__body';

  const mount = document.createElement('div');
  mount.className = 'cde-page-sheet__editor-mount';

  body.appendChild(mount);
  root.appendChild(body);
  // Prefer the pages stack so font/layout context matches live sheets
  host.appendChild(root);

  return {
    root,
    mount,
    destroy: () => root.remove(),
  };
}

export function splitOverflowFromContent(
  content: JSONContent,
  bodyHeightPx: number,
  extensions: Extensions,
  probe: MeasureProbe,
): { kept: JSONContent; overflow: JSONContent[] } {
  if (isDocVisuallyEmpty(content)) {
    return { kept: content, overflow: [] };
  }

  const editor = new Editor({
    element: probe.mount,
    extensions,
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'cde-page-content ProseMirror',
      },
    },
  });

  try {
    void probe.root.offsetHeight;
    void (editor.view.dom as HTMLElement).offsetHeight;

    if (!contentOverflows(editor, bodyHeightPx)) {
      return { kept: editor.getJSON(), overflow: [] };
    }

    const overflow: JSONContent[] = [];
    let guard = 0;
    let lastWeight = docContentWeight(editor.getJSON());

    while (guard++ < 50) {
      const { moved } = extractOverflow(editor, bodyHeightPx);
      if (moved.length === 0) break;

      overflow.push(...moved);

      const nextWeight = docContentWeight(editor.getJSON());
      if (nextWeight >= lastWeight) break;
      lastWeight = nextWeight;

      if (!contentOverflows(editor, bodyHeightPx, 0)) break;
    }

    return {
      kept: editor.getJSON(),
      overflow: mergeAdjacentContinuationTables(filterMeaningfulNodes(overflow)),
    };
  } finally {
    editor.destroy();
    probe.mount.replaceChildren();
  }
}

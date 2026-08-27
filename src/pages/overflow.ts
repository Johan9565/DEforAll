import { Editor, type Extensions, type JSONContent } from '@tiptap/core';
import type { Node as ProseNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { PageSize } from '../types';
import { splitTableAtLimitY } from './tableSplit';

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
 * Real content overflow — ignore ProseMirror min-height which keeps scrollHeight
 * at the full page even when only a few lines of text exist.
 */
export function contentOverflows(
  editor: Editor,
  bodyHeightPx: number,
  slackPx = 4,
): boolean {
  const dom = editor.view.dom as HTMLElement;
  const last = dom.lastElementChild as HTMLElement | null;
  if (!last) return false;

  const top = dom.getBoundingClientRect().top;
  const bottom = last.getBoundingClientRect().bottom;
  return bottom > top + bodyHeightPx + slackPx;
}

/**
 * Position at the start of the first visual line that crosses below the page body.
 */
function findOverflowCutPos(
  view: EditorView,
  bodyHeightPx: number,
): number | null {
  const editorTop = (view.dom as HTMLElement).getBoundingClientRect().top;
  const limitY = editorTop + bodyHeightPx - 2;
  const maxPos = view.state.doc.content.size;
  if (maxPos <= 2) return null;

  for (let p = 1; p <= maxPos; p += 1) {
    try {
      const top = view.coordsAtPos(p).top;
      if (top > limitY) {
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
function findStraddlingTable(
  view: EditorView,
  limitY: number,
): { pos: number; node: ProseNode } | null {
  const { doc } = view.state;
  let pos = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);
    if (node.type.name === 'table') {
      const tableDom = resolveTableDom(view, pos, node);
      if (tableDom) {
        const rect = tableDom.getBoundingClientRect();
        if (rect.top < limitY && rect.bottom > limitY) {
          return { pos, node };
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
  const editorTop = (editor.view.dom as HTMLElement).getBoundingClientRect()
    .top;
  const limitY = editorTop + bodyHeightPx - 2;
  const found = findStraddlingTable(editor.view, limitY);
  if (!found) return null;

  const { pos: tablePos, node: tableNode } = found;
  const tableEnd = tablePos + tableNode.nodeSize;
  const tableDom = resolveTableDom(editor.view, tablePos, tableNode);
  if (!tableDom) return null;

  const isTop = tablePos <= 1;
  const { table1, table2 } = splitTableAtLimitY(
    tableNode.toJSON() as JSONContent,
    tableDom,
    limitY,
    isTop,
  );

  if (!table2) return null;

  // Nothing fits on this page — only move if there is content before the table
  if (!table1) {
    if (isTop && tableEnd >= doc.content.size) {
      return { moved: [], cutPos: null, followCursor: false };
    }
    const slice = doc.slice(tablePos, doc.content.size);
    const moved = filterMeaningfulNodes(fragmentToJson(slice.content));
    if (moved.length === 0) {
      return { moved: [], cutPos: null, followCursor: false };
    }
    const followCursor = selectionFrom >= tablePos;
    const beforeSize = doc.content.size;
    editor
      .chain()
      .command(({ tr, dispatch }) => {
        if (dispatch) {
          tr.delete(tablePos, doc.content.size);
          tr.setMeta('addToHistory', false);
          dispatch(tr);
        }
        return true;
      })
      .run();
    if (editor.state.doc.content.size >= beforeSize) {
      return { moved: [], cutPos: null, followCursor: false };
    }
    return { moved, cutPos: tablePos, followCursor };
  }

  const afterSlice = doc.slice(tableEnd, doc.content.size);
  const afterNodes = filterMeaningfulNodes(
    fragmentToJson(afterSlice.content),
  );
  const moved = filterMeaningfulNodes([table2, ...afterNodes]);
  if (moved.length === 0) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const followCursor = selectionFrom >= tablePos;
  const beforeSize = doc.content.size;

  editor
    .chain()
    .command(({ tr, dispatch, editor: ed }) => {
      if (!dispatch) return true;
      const kept = ed.schema.nodeFromJSON(table1);
      tr.replaceWith(tablePos, doc.content.size, kept);
      tr.setMeta('addToHistory', false);
      dispatch(tr);
      return true;
    })
    .run();

  if (editor.state.doc.content.size >= beforeSize) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  return { moved, cutPos: tablePos, followCursor };
}

function resolveTableDom(
  view: EditorView,
  tablePos: number,
  _tableNode: ProseNode,
): HTMLElement | null {
  const nodeDom = view.nodeDOM(tablePos);
  if (!(nodeDom instanceof HTMLElement)) return null;
  if (nodeDom.tagName === 'TABLE') return nodeDom;
  const inner = nodeDom.querySelector('table');
  return inner instanceof HTMLElement ? inner : nodeDom;
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
  if (!contentOverflows(editor, bodyHeightPx)) {
    return { moved: [], cutPos: null, followCursor: false };
  }

  const tableResult = extractTableOverflow(
    editor,
    bodyHeightPx,
    selectionFrom,
  );
  if (tableResult) return tableResult;

  const cutPos = findOverflowCutPos(editor.view, bodyHeightPx);
  if (cutPos != null && cutPos > 1) {

    const doc = editor.state.doc;
    const end = doc.content.size;
    if (cutPos < end) {
      const slice = doc.slice(cutPos, end);
      const moved = filterMeaningfulNodes(fragmentToJson(slice.content));
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

  return extractOverflowBlocks(editor, bodyHeightPx, selectionFrom);
}

/**
 * Whole-block peel — only when content really overflows and there are 2+ blocks.
 */
function extractOverflowBlocks(
  editor: Editor,
  bodyHeightPx: number,
  selectionFrom: number,
): OverflowExtractResult {
  if (!contentOverflows(editor, bodyHeightPx)) {
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

  while (nodes.length > 1 && contentOverflows(editor, bodyHeightPx)) {
    const last = nodes.pop()!;
    if (isEmptyJsonNode(last)) {
      // Drop empty trailing nodes without creating pages
      editor.commands.setContent(
        { type: 'doc', content: nodes },
        false,
        { preserveWhitespace: 'full' },
      );
      void dom.offsetHeight;
      continue;
    }

    moved.unshift(last);
    editor.commands.setContent(
      { type: 'doc', content: nodes },
      false,
      { preserveWhitespace: 'full' },
    );
    void dom.offsetHeight;

    if (nodes.length === 1 && contentOverflows(editor, bodyHeightPx)) {
      editor.commands.setContent(
        { type: 'doc', content: original },
        false,
        { preserveWhitespace: 'full' },
      );
      return { moved: [], cutPos: null, followCursor: false };
    }
  }

  const meaningful = filterMeaningfulNodes(moved);
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
    let lastSize = editor.state.doc.content.size;

    while (guard++ < 50) {
      const { moved } = extractOverflow(editor, bodyHeightPx);
      if (moved.length === 0) break;

      overflow.push(...moved);

      const nextSize = editor.state.doc.content.size;
      // No progress → stop (prevents blank-page loops)
      if (nextSize >= lastSize) break;
      lastSize = nextSize;

      if (!contentOverflows(editor, bodyHeightPx)) break;
    }

    return {
      kept: editor.getJSON(),
      overflow: filterMeaningfulNodes(overflow),
    };
  } finally {
    editor.destroy();
    probe.mount.replaceChildren();
  }
}

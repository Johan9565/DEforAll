import {
  Editor,
  generateHTML,
  generateJSON,
  getSchema,
  type Extensions,
  type JSONContent,
} from '@tiptap/core';
import type { PageData } from '../types';
import type { PageStore } from '../store/PageStore';

export interface PageLocalPos {
  pageId: string;
  pageIndex: number;
  pos: number;
}

export interface CrossPageSelection {
  from: PageLocalPos;
  to: PageLocalPos;
}

export interface DomPosContext {
  pagesContainer: HTMLElement;
  store: PageStore;
  extensions: Extensions;
  getEditor: (pageId: string) => Editor | null;
}

/** ProseMirror content.size for a page JSON doc (no Editor mount). */
export function pageContentSize(
  content: JSONContent,
  extensions: Extensions,
): number {
  const schema = getSchema(extensions);
  const docJson =
    content.type === 'doc'
      ? content
      : { type: 'doc', content: content.content ?? [content] };
  return schema.nodeFromJSON(docJson).content.size;
}

/**
 * Map a character offset to a ProseMirror position (legacy helper).
 */
export function textOffsetToPmPos(
  content: JSONContent,
  textOffset: number,
  extensions: Extensions,
): number {
  const schema = getSchema(extensions);
  const docJson =
    content.type === 'doc'
      ? content
      : { type: 'doc', content: content.content ?? [content] };
  const doc = schema.nodeFromJSON(docJson);

  let counted = 0;
  let result = 0;
  let total = 0;
  doc.descendants((node) => {
    if (node.isText) total += node.text?.length ?? 0;
    return true;
  });
  const target = Math.max(0, Math.min(textOffset, total));

  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const len = node.text?.length ?? 0;
    if (counted + len >= target) {
      result = pos + (target - counted);
      return false;
    }
    counted += len;
    return true;
  });

  return result;
}

export function measureTextOffsetInRoot(
  root: HTMLElement,
  node: Node,
  offset: number,
): number {
  try {
    if (!root.contains(node) && node !== root) return 0;
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    const frag = range.cloneContents();
    let count = 0;
    const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
    let current: Node | null;
    while ((current = walker.nextNode())) {
      count += current.textContent?.length ?? 0;
    }
    return count;
  } catch {
    return 0;
  }
}

function serializeRangeHtml(range: Range): string {
  const div = document.createElement('div');
  div.appendChild(range.cloneContents());
  return div.innerHTML;
}

/** HTML from the start of `root` up to (node, offset) — excluded from deletion. */
export function htmlBeforePoint(
  root: HTMLElement,
  node: Node,
  offset: number,
): string {
  try {
    if (!root.contains(node) && node !== root) return '';
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return serializeRangeHtml(range);
  } catch {
    return '';
  }
}

/** HTML from (node, offset) to the end of `root` — excluded from deletion. */
export function htmlAfterPoint(
  root: HTMLElement,
  node: Node,
  offset: number,
): string {
  try {
    if (!root.contains(node) && node !== root) return root.innerHTML;
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setStart(node, offset);
    return serializeRangeHtml(range);
  } catch {
    return root.innerHTML;
  }
}

function htmlToDocJson(html: string, extensions: Extensions): JSONContent {
  const trimmed = html.trim();
  if (!trimmed) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  try {
    const json = generateJSON(trimmed, extensions) as JSONContent;
    if (!json.type) {
      return { type: 'doc', content: json.content ?? [{ type: 'paragraph' }] };
    }
    if (json.type !== 'doc') {
      return { type: 'doc', content: [json] };
    }
    if (!json.content || json.content.length === 0) {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }
    return json;
  } catch {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
}

/**
 * Durable snapshot: keeps the exact HTML the user did NOT select on the
 * first/last pages. Middle pages are fully covered by the selection.
 */
export interface HeldCrossPageSnapshot {
  fromPageIndex: number;
  toPageIndex: number;
  /** Unselected HTML at the start of the first page. */
  firstKeptHtml: string;
  /** Unselected HTML at the end of the last page. */
  lastKeptHtml: string;
}

/**
 * Snapshot from the live native selection — uses DOM Range boundaries so
 * what you see highlighted is exactly what gets removed.
 */
export function snapshotCrossPageSelection(
  container: HTMLElement,
): HeldCrossPageSnapshot | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);

  const startEl =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const endEl =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;

  const startSheet = startEl?.closest('.cde-page-sheet') as HTMLElement | null;
  const endSheet = endEl?.closest('.cde-page-sheet') as HTMLElement | null;
  if (!startSheet || !endSheet) return null;
  if (!container.contains(startSheet) || !container.contains(endSheet)) {
    return null;
  }
  if (startSheet === endSheet) return null;

  let fromIndex = Number(startSheet.dataset.pageIndex);
  let toIndex = Number(endSheet.dataset.pageIndex);
  if (Number.isNaN(fromIndex) || Number.isNaN(toIndex)) return null;

  const startRoot = startSheet.querySelector<HTMLElement>(
    '.cde-page-sheet__static, .ProseMirror',
  );
  const endRoot = endSheet.querySelector<HTMLElement>(
    '.cde-page-sheet__static, .ProseMirror',
  );
  if (!startRoot || !endRoot) return null;

  let startContainer = range.startContainer;
  let startOffset = range.startOffset;
  let endContainer = range.endContainer;
  let endOffset = range.endOffset;
  let firstRoot = startRoot;
  let lastRoot = endRoot;

  if (fromIndex > toIndex) {
    [fromIndex, toIndex] = [toIndex, fromIndex];
    [startContainer, endContainer] = [endContainer, startContainer];
    [startOffset, endOffset] = [endOffset, startOffset];
    [firstRoot, lastRoot] = [lastRoot, firstRoot];
  }

  // Keep everything BEFORE the selection on the first page
  const firstKeptHtml = htmlBeforePoint(
    firstRoot,
    startContainer,
    startOffset,
  );
  // Keep everything AFTER the selection on the last page
  const lastKeptHtml = htmlAfterPoint(lastRoot, endContainer, endOffset);

  return {
    fromPageIndex: fromIndex,
    toPageIndex: toIndex,
    firstKeptHtml,
    lastKeptHtml,
  };
}

/**
 * Apply a DOM-HTML snapshot: merge kept first/last fragments, drop middles.
 */
export function deleteFromCrossPageSnapshot(
  snapshot: HeldCrossPageSnapshot,
  extensions: Extensions,
): CrossPageDeleteResult {
  const firstKept = htmlToDocJson(snapshot.firstKeptHtml, extensions);
  const lastKept = htmlToDocJson(snapshot.lastKeptHtml, extensions);

  const mergedContent = [
    ...(firstKept.content ?? []),
    ...(lastKept.content ?? []),
  ];

  const json: JSONContent = {
    type: 'doc',
    content:
      mergedContent.length > 0
        ? mergedContent
        : [{ type: 'paragraph' }],
  };

  // Cursor at the join point ≈ end of the kept first-page content
  const cursorPos = Math.max(
    1,
    pageContentSize(firstKept, extensions) -
      (firstKept.content?.length ? 0 : 0),
  );

  return {
    json,
    html: generateHTML(json, extensions),
    cursorPos: Math.min(
      cursorPos,
      pageContentSize(json, extensions),
    ),
  };
}

export function resolveHeldSnapshot(
  snapshot: HeldCrossPageSnapshot,
  store: PageStore,
): CrossPageSelection | null {
  const fromPage = store.getPageAt(snapshot.fromPageIndex);
  const toPage = store.getPageAt(snapshot.toPageIndex);
  if (!fromPage || !toPage) return null;
  if (snapshot.fromPageIndex === snapshot.toPageIndex) return null;

  // Positions are unused when deleting via HTML snapshot; placeholders only.
  return {
    from: {
      pageId: fromPage.id,
      pageIndex: snapshot.fromPageIndex,
      pos: 0,
    },
    to: {
      pageId: toPage.id,
      pageIndex: snapshot.toPageIndex,
      pos: 0,
    },
  };
}

export function resolveDomPointToPagePos(
  node: Node,
  offset: number,
  ctx: DomPosContext,
): PageLocalPos | null {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  const sheet = el?.closest('.cde-page-sheet') as HTMLElement | null;
  if (!sheet || !ctx.pagesContainer.contains(sheet)) return null;

  const pageId = sheet.dataset.pageId;
  if (!pageId) return null;

  const pageIndex = ctx.store.getPageIndex(pageId);
  const page = ctx.store.getPage(pageId);
  if (pageIndex < 0 || !page) return null;

  const editor = ctx.getEditor(pageId);
  if (editor) {
    try {
      const pos = editor.view.posAtDOM(node, offset);
      return { pageId, pageIndex, pos };
    } catch {
      // fall through
    }
  }

  const root = sheet.querySelector<HTMLElement>(
    '.cde-page-sheet__static, .ProseMirror',
  );
  if (!root) return { pageId, pageIndex, pos: 0 };

  const textOffset = measureTextOffsetInRoot(root, node, offset);
  const pos = textOffsetToPmPos(page.content, textOffset, ctx.extensions);
  return { pageId, pageIndex, pos };
}

export function captureCrossPageSelection(
  ctx: DomPosContext,
): CrossPageSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  const start = resolveDomPointToPagePos(
    range.startContainer,
    range.startOffset,
    ctx,
  );
  const end = resolveDomPointToPagePos(
    range.endContainer,
    range.endOffset,
    ctx,
  );

  if (!start || !end) return null;
  if (start.pageIndex === end.pageIndex) return null;

  if (
    start.pageIndex > end.pageIndex ||
    (start.pageIndex === end.pageIndex && start.pos > end.pos)
  ) {
    return { from: end, to: start };
  }

  return { from: start, to: end };
}

export interface CrossPageDeleteResult {
  json: JSONContent;
  html: string;
  cursorPos: number;
}

/**
 * @deprecated Prefer deleteFromCrossPageSnapshot (DOM HTML slices).
 * Kept for fallbacks that only have PM positions.
 */
export function deleteCrossPageContent(
  pages: PageData[],
  startPosInFirst: number,
  endPosInLast: number,
  extensions: Extensions,
): CrossPageDeleteResult {
  if (pages.length === 0) {
    return {
      json: { type: 'doc', content: [{ type: 'paragraph' }] },
      html: '<p></p>',
      cursorPos: 1,
    };
  }

  if (pages.length === 1) {
    const only = pages[0]!;
    const headless = new Editor({
      extensions,
      content: only.content,
      editable: true,
    });
    try {
      const max = headless.state.doc.content.size;
      const from = Math.max(0, Math.min(startPosInFirst, max));
      const to = Math.max(0, Math.min(endPosInLast, max));
      if (from !== to) {
        headless.commands.deleteRange({
          from: Math.min(from, to),
          to: Math.max(from, to),
        });
      }
      const json = headless.getJSON();
      return {
        json,
        html: headless.getHTML() || generateHTML(json, extensions),
        cursorPos: Math.min(from, to),
      };
    } finally {
      headless.destroy();
    }
  }

  const first = pages[0]!;
  const last = pages[pages.length - 1]!;

  const firstEditor = new Editor({
    extensions,
    content: first.content,
    editable: true,
  });
  let firstKept: JSONContent;
  let cursorPos = 1;
  try {
    const max = firstEditor.state.doc.content.size;
    const from = Math.max(0, Math.min(startPosInFirst, max));
    cursorPos = from;
    if (from < max) {
      firstEditor.commands.deleteRange({ from, to: max });
    }
    firstKept = firstEditor.getJSON();
  } finally {
    firstEditor.destroy();
  }

  const lastEditor = new Editor({
    extensions,
    content: last.content,
    editable: true,
  });
  let lastKept: JSONContent;
  try {
    const max = lastEditor.state.doc.content.size;
    const to = Math.max(0, Math.min(endPosInLast, max));
    if (to > 0) {
      lastEditor.commands.deleteRange({ from: 0, to });
    }
    lastKept = lastEditor.getJSON();
  } finally {
    lastEditor.destroy();
  }

  const mergedContent = [
    ...(firstKept.content ?? []),
    ...(lastKept.content ?? []),
  ];

  const json: JSONContent = {
    type: 'doc',
    content:
      mergedContent.length > 0
        ? mergedContent
        : [{ type: 'paragraph' }],
  };

  return {
    json,
    html: generateHTML(json, extensions),
    cursorPos,
  };
}

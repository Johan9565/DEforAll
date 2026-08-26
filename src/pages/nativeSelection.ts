/** Browser caret helpers for native cross-page selection. */

export interface CaretPoint {
  node: Node;
  offset: number;
}

export function caretFromPoint(
  clientX: number,
  clientY: number,
): CaretPoint | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };

  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range) {
      return { node: range.startContainer, offset: range.startOffset };
    }
  }

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos?.offsetNode) {
      return { node: pos.offsetNode, offset: pos.offset };
    }
  }

  return null;
}

export function setNativeSelectionFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): boolean {
  const start = caretFromPoint(startX, startY);
  const end = caretFromPoint(endX, endY);
  if (!start || !end) return false;

  try {
    const range = document.createRange();
    const startRange = document.createRange();
    startRange.setStart(start.node, start.offset);
    startRange.collapse(true);
    const endRange = document.createRange();
    endRange.setStart(end.node, end.offset);
    endRange.collapse(true);

    // Order start/end correctly regardless of drag direction
    const startFirst =
      startRange.compareBoundaryPoints(Range.START_TO_START, endRange) <= 0;

    if (startFirst) {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    } else {
      range.setStart(end.node, end.offset);
      range.setEnd(start.node, start.offset);
    }

    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}

export function pageSheetFromPoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
): HTMLElement | null {
  const el = document.elementFromPoint(clientX, clientY);
  const sheet = el?.closest('.cde-page-sheet') as HTMLElement | null;
  if (!sheet || !container.contains(sheet)) return null;
  return sheet;
}

export function sheetFromNode(
  node: Node | null | undefined,
  container: HTMLElement,
): HTMLElement | null {
  if (!node) return null;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  const sheet = el?.closest('.cde-page-sheet') as HTMLElement | null;
  if (!sheet || !container.contains(sheet)) return null;
  return sheet;
}

/** True when the native selection's anchor and focus live in different page sheets. */
export function selectionSpansMultipleSheets(
  container: HTMLElement,
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;

  const a = sheetFromNode(sel.anchorNode, container);
  const f = sheetFromNode(sel.focusNode, container);
  return !!a && !!f && a !== f;
}

export function cloneCurrentSelectionRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  try {
    return sel.getRangeAt(0).cloneRange();
  } catch {
    return null;
  }
}

export function restoreSelectionRange(range: Range): boolean {
  const sel = window.getSelection();
  if (!sel) return false;
  try {
    sel.removeAllRanges();
    sel.addRange(range.cloneRange());
    return true;
  } catch {
    return false;
  }
}

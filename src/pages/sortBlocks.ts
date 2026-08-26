import type { Editor } from '@tiptap/core';
import type { Node as ProseNode } from '@tiptap/pm/model';

export type SortDirection = 'asc' | 'desc';

function compareText(a: string, b: string, direction: SortDirection): number {
  const cmp = a.localeCompare(b, 'es', {
    sensitivity: 'base',
    numeric: true,
  });
  return direction === 'asc' ? cmp : -cmp;
}

function collectTopLevelBlocks(
  doc: ProseNode,
  from: number,
  to: number,
): { pos: number; node: ProseNode }[] {
  const blocks: { pos: number; node: ProseNode }[] = [];
  doc.nodesBetween(from, Math.max(to, from + 1), (node, pos, parent) => {
    if (parent === doc && node.isBlock) {
      blocks.push({ pos, node });
      return false;
    }
    return true;
  });
  return blocks;
}

function collectListItems(
  listPos: number,
  listNode: ProseNode,
): { pos: number; node: ProseNode }[] {
  const items: { pos: number; node: ProseNode }[] = [];
  let offset = listPos + 1;
  listNode.forEach((child) => {
    items.push({ pos: offset, node: child });
    offset += child.nodeSize;
  });
  return items;
}

function replaceSorted(
  editor: Editor,
  blocks: { pos: number; node: ProseNode }[],
  direction: SortDirection,
): boolean {
  if (blocks.length < 2) return false;

  const sorted = [...blocks].sort((a, b) =>
    compareText(a.node.textContent.trim(), b.node.textContent.trim(), direction),
  );

  const unchanged = sorted.every(
    (item, i) => item.pos === blocks[i]!.pos && item.node === blocks[i]!.node,
  );
  if (unchanged) return false;

  const start = blocks[0]!.pos;
  const last = blocks[blocks.length - 1]!;
  const end = last.pos + last.node.nodeSize;

  let tr = editor.state.tr.delete(start, end);
  let insertAt = start;
  for (const item of sorted) {
    tr = tr.insert(insertAt, item.node.copy(item.node.content));
    insertAt += item.node.nodeSize;
  }

  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Sort selected top-level paragraphs/headings, or list items when inside a list.
 */
export function sortSelectedBlocks(
  editor: Editor,
  direction: SortDirection,
): boolean {
  const { state } = editor;
  const { from, to } = state.selection;
  const $from = state.selection.$from;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (
      node.type.name === 'bulletList' ||
      node.type.name === 'orderedList' ||
      node.type.name === 'taskList'
    ) {
      const listPos = $from.before(depth);
      const items = collectListItems(listPos, node);
      return replaceSorted(editor, items, direction);
    }
  }

  let blocks = collectTopLevelBlocks(state.doc, from, to);

  // Single caret / one block: use adjacent siblings if user selected little;
  // require at least two blocks in the selection span.
  if (blocks.length < 2 && from !== to) {
    blocks = collectTopLevelBlocks(state.doc, from, to);
  }

  return replaceSorted(editor, blocks, direction);
}

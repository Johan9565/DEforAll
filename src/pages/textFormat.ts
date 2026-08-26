import type { Editor } from '@tiptap/core';

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'toggle';

function transformChunk(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return text.toLocaleUpperCase('es');
    case 'lower':
      return text.toLocaleLowerCase('es');
    case 'title':
      return text.replace(/\S+/gu, (word) => {
        const first = word.charAt(0).toLocaleUpperCase('es');
        const rest = word.slice(1).toLocaleLowerCase('es');
        return first + rest;
      });
    case 'sentence': {
      const lower = text.toLocaleLowerCase('es');
      const match = lower.match(/\p{L}/u);
      if (!match || match.index == null) return lower;
      const i = match.index;
      return (
        lower.slice(0, i) +
        lower.charAt(i).toLocaleUpperCase('es') +
        lower.slice(i + 1)
      );
    }
    case 'toggle': {
      let upper = 0;
      let lower = 0;
      for (const ch of text) {
        if (ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es')) {
          if (ch === ch.toLocaleUpperCase('es')) upper += 1;
          else lower += 1;
        }
      }
      return upper >= lower
        ? text.toLocaleLowerCase('es')
        : text.toLocaleUpperCase('es');
    }
    default:
      return text;
  }
}

/** Change case of the current selection while preserving marks. */
export function changeSelectionCase(editor: Editor, mode: CaseMode): boolean {
  const { state } = editor;
  const { from, to } = state.selection;
  if (from === to) return false;

  let tr = state.tr;
  const ranges: { start: number; end: number; text: string }[] = [];

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(pos, from);
    const end = Math.min(pos + node.nodeSize, to);
    if (start >= end) return;
    const textStart = start - pos;
    const textEnd = end - pos;
    ranges.push({
      start,
      end,
      text: node.text.slice(textStart, textEnd),
    });
  });

  // Apply from the end so positions stay valid
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const range = ranges[i]!;
    const next = transformChunk(range.text, mode);
    if (next === range.text) continue;
    const mappedStart = tr.mapping.map(range.start);
    const mappedEnd = tr.mapping.map(range.end);
    tr = tr.insertText(next, mappedStart, mappedEnd);
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

const FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

export function parseFontSizePx(value: string | null | undefined): number {
  if (!value) return 12;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 12;
}

export function stepFontSizePx(currentPx: number, direction: 1 | -1): number {
  const exact = FONT_SIZE_STEPS.indexOf(currentPx);
  if (exact >= 0) {
    const next = FONT_SIZE_STEPS[exact + direction];
    return next ?? currentPx;
  }
  if (direction > 0) {
    const larger = FONT_SIZE_STEPS.find((s) => s > currentPx);
    return larger ?? FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1]!;
  }
  const smaller = [...FONT_SIZE_STEPS].reverse().find((s) => s < currentPx);
  return smaller ?? FONT_SIZE_STEPS[0]!;
}

export { FONT_SIZE_STEPS };

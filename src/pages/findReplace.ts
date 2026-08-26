import {
  Editor,
  getSchema,
  type Extensions,
  type JSONContent,
} from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';

export interface SearchMatch {
  from: number;
  to: number;
}

/** Match located on a specific page of the multi-page document. */
export interface DocumentSearchMatch extends SearchMatch {
  pageId: string;
  pageIndex: number;
}

function collectMatchesInPmDoc(
  doc: PMNode,
  term: string,
  caseSensitive: boolean,
): SearchMatch[] {
  const query = term.trim();
  if (!query) return [];

  const matches: SearchMatch[] = [];
  const needle = caseSensitive ? query : query.toLocaleLowerCase('es');

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const haystack = caseSensitive
      ? node.text
      : node.text.toLocaleLowerCase('es');
    let fromIndex = 0;

    while (fromIndex < haystack.length) {
      const found = haystack.indexOf(needle, fromIndex);
      if (found < 0) break;
      matches.push({
        from: pos + found,
        to: pos + found + query.length,
      });
      fromIndex = found + Math.max(1, needle.length);
    }
  });

  return matches;
}

export function findTextMatches(
  editor: Editor,
  term: string,
  caseSensitive = false,
): SearchMatch[] {
  return collectMatchesInPmDoc(editor.state.doc, term, caseSensitive);
}

export function findTextMatchesInJSON(
  content: JSONContent,
  extensions: Extensions,
  term: string,
  caseSensitive = false,
): SearchMatch[] {
  const query = term.trim();
  if (!query) return [];

  try {
    const schema = getSchema(extensions);
    const doc = PMNode.fromJSON(schema, content);
    return collectMatchesInPmDoc(doc, term, caseSensitive);
  } catch {
    return [];
  }
}

export function selectTextMatch(editor: Editor, match: SearchMatch): void {
  editor
    .chain()
    .focus()
    .setTextSelection({ from: match.from, to: match.to })
    .scrollIntoView()
    .run();
}

export function replaceTextMatch(
  editor: Editor,
  match: SearchMatch,
  replacement: string,
): void {
  editor
    .chain()
    .focus()
    .insertContentAt({ from: match.from, to: match.to }, replacement)
    .run();
}

/** Replace all matches in one undo step (from end → start). */
export function replaceAllTextMatches(
  editor: Editor,
  term: string,
  replacement: string,
  caseSensitive = false,
): number {
  const matches = findTextMatches(editor, term, caseSensitive);
  if (matches.length === 0) return 0;

  let tr = editor.state.tr;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i]!;
    tr = tr.insertText(replacement, match.from, match.to);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return matches.length;
}

/**
 * Replace every match inside a JSON page doc (inactive sheets).
 * Returns updated JSON + how many replacements were made.
 */
export function replaceAllTextMatchesInJSON(
  content: JSONContent,
  extensions: Extensions,
  term: string,
  replacement: string,
  caseSensitive = false,
): { content: JSONContent; count: number } {
  const query = term.trim();
  if (!query) return { content, count: 0 };

  const host = document.createElement('div');
  const editor = new Editor({
    element: host,
    extensions,
    content,
    editable: false,
  });

  try {
    const count = replaceAllTextMatches(
      editor,
      query,
      replacement,
      caseSensitive,
    );
    return { content: editor.getJSON(), count };
  } finally {
    editor.destroy();
    host.remove();
  }
}

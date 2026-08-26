import type { JSONContent } from '@tiptap/core';

export type PageSize = 'letter' | 'a4';

export type DocumentContent = string | JSONContent;

export interface PageData {
  id: string;
  content: JSONContent;
  /** Pre-rendered HTML for static (inactive) sheets. */
  htmlCache: string;
}

export interface DocumentEditorUpdatePayload {
  html: string;
  json: JSONContent;
  pages: PageData[];
  pageCount: number;
}

export interface PaginationResult {
  pageCount: number;
}

export type ActivePageFocus =
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'coords'; left: number; top: number }
  | { type: 'pos'; pos: number };

export const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

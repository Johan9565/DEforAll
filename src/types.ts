import type { JSONContent } from '@tiptap/core';

export type PageSize = 'letter' | 'a4';
export type PageOrientation = 'portrait' | 'landscape';
export type PageColumns = 1 | 2 | 3;
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

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
  | { type: 'pos'; pos: number }
  | { type: 'none' };

export const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export interface PageConfig {
  orientation?: PageOrientation;
  margins?: Partial<PageMargins>;
  pageSize?: PageSize;
}

export interface DocumentRestrictions {
  /** If false, document is read-only. Defaults to true. */
  editable?: boolean;
  /** If false, cannot insert or paste images. Defaults to true. */
  allowImages?: boolean;
  /** If false, cannot insert or modify tables. Defaults to true. */
  allowTables?: boolean;
  /** If false, rulers and margin adjustments are disabled. Defaults to true. */
  allowMarginEditing?: boolean;
  /** If false, page orientation/size/columns cannot be changed. Defaults to true. */
  allowPageSettings?: boolean;
  /** If false, text formatting (bold, italic, colors, etc.) is disabled. Defaults to true. */
  allowFormatting?: boolean;
  /** If false, link insertion is disabled. Defaults to true. */
  allowLinks?: boolean;
}

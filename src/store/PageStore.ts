import type { JSONContent } from '@tiptap/core';
import { EMPTY_DOC, type PageData } from '../types';

export type PageStoreListener = () => void;

function createId(): string {
  return `page-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

function cloneDoc(content: JSONContent): JSONContent {
  return structuredClone(content);
}

export function createEmptyPage(htmlCache = '<p></p>'): PageData {
  return {
    id: createId(),
    content: cloneDoc(EMPTY_DOC),
    htmlCache,
  };
}

/**
 * Central reactive store for independent TipTap page documents.
 * Inactive pages live as JSON + HTML cache; only the active id mounts an editor.
 */
export class PageStore {
  private pages: PageData[];
  private activePageId: string | null;
  private readonly listeners = new Set<PageStoreListener>();

  constructor(initialPages?: PageData[]) {
    this.pages =
      initialPages && initialPages.length > 0
        ? initialPages.map((p) => ({
            id: p.id || createId(),
            content: cloneDoc(p.content ?? EMPTY_DOC),
            htmlCache: p.htmlCache ?? '<p></p>',
          }))
        : [createEmptyPage()];
    this.activePageId = this.pages[0]?.id ?? null;
  }

  public subscribe(listener: PageStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  public getPages(): readonly PageData[] {
    return this.pages;
  }

  public getPageCount(): number {
    return this.pages.length;
  }

  public getActivePageId(): string | null {
    return this.activePageId;
  }

  public getActiveIndex(): number {
    if (!this.activePageId) return -1;
    return this.pages.findIndex((p) => p.id === this.activePageId);
  }

  public getPage(id: string): PageData | undefined {
    return this.pages.find((p) => p.id === id);
  }

  public getPageIndex(id: string): number {
    return this.pages.findIndex((p) => p.id === id);
  }

  public getPageAt(index: number): PageData | undefined {
    return this.pages[index];
  }

  public setActivePage(id: string | null): void {
    if (this.activePageId === id) return;
    if (id !== null && !this.pages.some((p) => p.id === id)) return;
    this.activePageId = id;
    this.emit();
  }

  public setPageContent(
    id: string,
    json: JSONContent,
    html: string,
    options?: { silent?: boolean },
  ): void {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    page.content = cloneDoc(json);
    page.htmlCache = html;
    if (!options?.silent) this.emit();
  }

  public addPageAfter(
    id: string,
    seed?: Partial<PageData>,
    options?: { silent?: boolean },
  ): PageData {
    const index = this.getPageIndex(id);
    const page = createEmptyPage(seed?.htmlCache);
    if (seed?.content) page.content = cloneDoc(seed.content);
    if (seed?.htmlCache) page.htmlCache = seed.htmlCache;
    this.pages.splice(index < 0 ? this.pages.length : index + 1, 0, page);
    if (!options?.silent) this.emit();
    return page;
  }

  public prependNodeToPage(id: string, node: JSONContent, html: string): void {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    const content = [...(page.content.content ?? [])];
    content.unshift(node);
    page.content = { type: 'doc', content };
    page.htmlCache = html;
    this.emit();
  }

  public appendNodeToPage(id: string, node: JSONContent, html: string): void {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    const content = [...(page.content.content ?? [])];
    content.push(node);
    page.content = { type: 'doc', content };
    page.htmlCache = html;
    this.emit();
  }

  public removePage(id: string, options?: { silent?: boolean }): void {
    if (this.pages.length <= 1) return;
    const index = this.getPageIndex(id);
    if (index < 0) return;
    this.pages.splice(index, 1);
    if (this.activePageId === id) {
      const next = this.pages[Math.min(index, this.pages.length - 1)];
      this.activePageId = next?.id ?? null;
    }
    if (!options?.silent) this.emit();
  }

  /**
   * Collapse pages [fromIndex, toIndex] into the first page with new content.
   * Keeps the first page's id; removes the rest.
   */
  public collapsePageRange(
    fromIndex: number,
    toIndex: number,
    content: JSONContent,
    html: string,
  ): string {
    if (fromIndex < 0 || toIndex >= this.pages.length || fromIndex > toIndex) {
      return this.activePageId ?? this.pages[0]!.id;
    }

    const keep = this.pages[fromIndex]!;
    keep.content = cloneDoc(content);
    keep.htmlCache = html;

    const removeCount = toIndex - fromIndex;
    if (removeCount > 0) {
      this.pages.splice(fromIndex + 1, removeCount);
    }

    this.activePageId = keep.id;
    this.emit();
    return keep.id;
  }

  /** Drop trailing empty pages, always keeping at least one. */
  public pruneTrailingEmpty(options?: { silent?: boolean }): void {
    let changed = false;
    while (this.pages.length > 1) {
      const last = this.pages[this.pages.length - 1]!;
      const nodes = last.content.content ?? [];
      const empty =
        nodes.length === 0 ||
        (nodes.length === 1 &&
          nodes[0]?.type === 'paragraph' &&
          (!nodes[0].content || nodes[0].content.length === 0));
      if (!empty) break;
      if (this.activePageId === last.id) {
        this.activePageId = this.pages[this.pages.length - 2]!.id;
      }
      this.pages.pop();
      changed = true;
    }
    if (changed && !options?.silent) this.emit();
  }

  public replaceAll(pages: PageData[], activeId?: string | null): void {
    this.pages =
      pages.length > 0
        ? pages.map((p) => ({
            id: p.id || createId(),
            content: cloneDoc(p.content ?? EMPTY_DOC),
            htmlCache: p.htmlCache ?? '<p></p>',
          }))
        : [createEmptyPage()];
    this.activePageId =
      activeId && this.pages.some((p) => p.id === activeId)
        ? activeId
        : (this.pages[0]?.id ?? null);
    this.emit();
  }

  public combinedJSON(): JSONContent {
    const content: JSONContent[] = [];
    for (const page of this.pages) {
      content.push(...(page.content.content ?? []));
    }
    return {
      type: 'doc',
      content: content.length > 0 ? content : [{ type: 'paragraph' }],
    };
  }

  public combinedHTML(): string {
    return this.pages.map((p) => p.htmlCache).join('');
  }
}

import { Previewer } from 'pagedjs';
import type { PageSize, PaginationResult } from './types';

export type { PaginationResult };

export interface PrintPreviewOptions {
  pageSize: PageSize;
  onPaginated?: (result: PaginationResult) => void;
}

/**
 * Paged.js read-only print preview.
 * Live editing uses LivePagination instead.
 */
export class PrintPreview {
  private readonly root: HTMLElement;
  private readonly target: HTMLElement;
  private readonly pageSize: PageSize;
  private readonly onPaginated?: (result: PaginationResult) => void;
  private generation = 0;
  private pageCount = 0;
  private destroyed = false;
  private visible = false;

  constructor(options: PrintPreviewOptions) {
    this.pageSize = options.pageSize;
    this.onPaginated = options.onPaginated;

    this.root = document.createElement('div');
    this.root.className = 'cde-print-preview';
    this.root.hidden = true;

    const label = document.createElement('div');
    label.className = 'cde-pages-label';
    label.textContent = 'Vista de impresión (solo lectura)';
    this.root.appendChild(label);

    this.target = document.createElement('div');
    this.target.className = 'cde-pages';
    this.root.appendChild(this.target);
  }

  public getElement(): HTMLElement {
    return this.root;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getPageCount(): number {
    return this.pageCount;
  }

  public async show(html: string): Promise<PaginationResult> {
    this.visible = true;
    this.root.hidden = false;
    return this.render(html);
  }

  public hide(): void {
    this.visible = false;
    this.root.hidden = true;
    this.target.replaceChildren();
  }

  public async render(html: string): Promise<PaginationResult> {
    const generation = ++this.generation;
    this.target.classList.add('is-paginating');
    this.target.replaceChildren();

    const content = this.buildContentDocument(html);
    const previewer = new Previewer();
    const flow = await previewer.preview(content, [], this.target);

    if (this.destroyed || generation !== this.generation) {
      return { pageCount: this.pageCount };
    }

    this.pageCount =
      flow.total ?? this.target.querySelectorAll('.pagedjs_page').length;
    this.target.classList.remove('is-paginating');
    this.target.dataset.pageCount = String(this.pageCount);

    const result = { pageCount: this.pageCount };
    this.onPaginated?.(result);
    return result;
  }

  public destroy(): void {
    this.destroyed = true;
    this.generation += 1;
    this.root.remove();
  }

  private buildContentDocument(html: string): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cde-paged-root';

    const style = document.createElement('style');
    style.textContent = this.buildPageCss();
    root.appendChild(style);

    const body = document.createElement('div');
    body.className = 'cde-paged-content';
    body.innerHTML = html;
    root.appendChild(body);

    return root;
  }

  private buildPageCss(): string {
    const size = this.pageSize === 'a4' ? 'A4' : 'letter';
    const margin = this.pageSize === 'a4' ? '2.54cm' : '1in';

    return `
      @page {
        size: ${size};
        margin: ${margin};
        @bottom-center {
          content: counter(page);
          font-family: 'Times New Roman', Times, Georgia, serif;
          font-size: 10pt;
          color: #4b5563;
        }
      }
      .cde-paged-content {
        color: #111827;
        font-family: 'Times New Roman', Times, Georgia, serif;
        font-size: 12pt;
        line-height: 1.5;
      }
      .cde-paged-content p { margin: 0 0 0.75em; }
      .cde-paged-content h1,
      .cde-paged-content h2,
      .cde-paged-content h3 {
        margin: 1em 0 0.5em;
        line-height: 1.25;
        break-after: avoid;
      }
      .cde-paged-content ul,
      .cde-paged-content ol {
        margin: 0 0 0.75em;
        padding-left: 1.5em;
      }
      .cde-paged-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 0 0 1em;
        table-layout: fixed;
      }
      .cde-paged-content td,
      .cde-paged-content th {
        border: 1px solid #d1d5db;
        padding: 0.35em 0.5em;
        vertical-align: top;
      }
      .cde-paged-content th { background: #f9fafb; font-weight: 600; }
      .cde-paged-content a.cde-link { color: #1d4ed8; text-decoration: underline; }
      .cde-paged-content img.cde-image {
        max-width: 100%; height: auto; display: block; margin: 0.75em 0;
      }
      .cde-paged-content blockquote {
        margin: 0 0 0.75em; padding-left: 1em; border-left: 3px solid #d1d5db;
      }
      .cde-paged-content pre {
        background: #111827; color: #f9fafb;
        font-family: 'Courier New', monospace; font-size: 0.9em;
        padding: 0.75em 1em; margin: 0 0 0.75em;
      }
      .cde-paged-content hr {
        border: none; border-top: 1px solid #d1d5db; margin: 1.25em 0;
      }
      .cde-paged-content mark { border-radius: 0.15em; padding: 0.05em 0.15em; }
      .cde-paged-content ul[data-type='taskList'] {
        list-style: none; padding-left: 0.25em;
      }
      .cde-paged-content ul[data-type='taskList'] li { display: flex; gap: 0.5em; }
    `;
  }
}

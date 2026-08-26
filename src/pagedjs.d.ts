declare module 'pagedjs' {
  export class Previewer {
    preview(
      content: unknown,
      stylesheets?: string[],
      renderTo?: HTMLElement | string,
    ): Promise<{ total: number }>;
  }

  export class Chunker {
    constructor(content?: unknown, renderTo?: unknown, options?: unknown);
  }

  export function registerHandlers(...handlers: unknown[]): void;
}

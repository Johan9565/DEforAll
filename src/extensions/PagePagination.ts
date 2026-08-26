import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { PageSize, PaginationResult } from '../types';
import { measurePageMetrics, type PageMetrics } from './pageMetrics';
import {
  collectMeasuredUnits,
  estimateRenderedPageCount,
  layoutVirtualPages,
  syncVirtualSheets,
} from './virtualPageLayout';

export interface PagePaginationOptions {
  pageSize: PageSize;
  gapPx?: number;
  onPaginated?: (result: PaginationResult) => void;
}

type PagePaginationStorage = {
  pageCount: number;
  metrics: PageMetrics | null;
  scheduleRefresh: (() => void) | null;
};

const pluginKey = new PluginKey<DecorationSet>('cdePagePagination');
const paginationMetaKey = 'cdePagePagination';

function createPageSpacerWidget(
  fillHeight: number,
  gapPx: number,
): HTMLElement {
  // span (no div) para no romper <p> al insertar saltos entre líneas
  const root = document.createElement('span');
  root.className = 'cde-page-break';
  root.contentEditable = 'false';

  const fill = document.createElement('span');
  fill.className = 'cde-page-break__fill';
  fill.style.height = `${Math.max(0, Math.round(fillHeight))}px`;

  const gap = document.createElement('span');
  gap.className = 'cde-page-break__gap';
  gap.style.height = `${gapPx}px`;

  root.append(fill, gap);
  return root;
}

function dispatchDecorations(
  view: import('@tiptap/pm/view').EditorView,
  decorations: DecorationSet,
): void {
  const tr = view.state.tr
    .setMeta(pluginKey, { decorations })
    .setMeta(paginationMetaKey, true)
    .setMeta('addToHistory', false);
  view.dispatch(tr);
}

/**
 * Paginación en vivo: bloques de primer nivel + líneas en párrafos largos.
 */
export const PagePagination = Extension.create<
  PagePaginationOptions,
  PagePaginationStorage
>({
  name: 'pagePagination',

  addOptions() {
    return {
      pageSize: 'letter',
      gapPx: 24,
      onPaginated: undefined,
    };
  },

  addStorage() {
    return {
      pageCount: 1,
      metrics: null,
      scheduleRefresh: null,
    };
  },

  onTransaction({ transaction }) {
    if (transaction.docChanged && !transaction.getMeta(paginationMetaKey)) {
      this.storage.scheduleRefresh?.();
    }
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(pluginKey) as
              | { decorations: DecorationSet }
              | undefined;
            if (meta?.decorations) return meta.decorations;
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state);
          },
        },
        view(view) {
          let raf = 0;
          let lastSignature = '';
          let isApplying = false;

          const documentEl = () =>
            view.dom.closest<HTMLElement>('.cde-document');

          const getMetrics = (): PageMetrics => {
            if (!extension.storage.metrics) {
              extension.storage.metrics = measurePageMetrics(
                extension.options.pageSize,
              );
            }
            return extension.storage.metrics;
          };

          const applyLayout = (cleared = false) => {
            if (isApplying) return;

            const hasDecorations =
              (pluginKey.getState(view.state)?.find().length ?? 0) > 0;

            if (hasDecorations && !cleared) {
              isApplying = true;
              dispatchDecorations(view, DecorationSet.empty);
              isApplying = false;
              requestAnimationFrame(() => applyLayout(true));
              return;
            }

            isApplying = true;

            const metrics = getMetrics();
            const gapPx = extension.options.gapPx ?? 24;

            const units = collectMeasuredUnits(view, metrics.bodyHeightPx);
            const layout = layoutVirtualPages(units, metrics.bodyHeightPx);
            let { breaks, pageCount } = layout;

            const signature = `${pageCount}:${breaks
              .map((b) => `${b.pos}:${Math.round(b.fillHeight)}`)
              .join('|')}`;

            extension.storage.pageCount = pageCount;

            if (signature !== lastSignature) {
              lastSignature = signature;

              const decorations = DecorationSet.create(
                view.state.doc,
                breaks.map((item) =>
                  Decoration.widget(
                    item.pos,
                    () => createPageSpacerWidget(item.fillHeight, gapPx),
                    {
                      side: -1,
                      key: `vp-${item.pos}-${item.pageIndex}`,
                    },
                  ),
                ),
              );

              dispatchDecorations(view, decorations);
            }

            // Tras aplicar widgets, alinear hojas de fondo con altura real
            pageCount = Math.max(
              pageCount,
              estimateRenderedPageCount(view, metrics, gapPx),
            );
            extension.storage.pageCount = pageCount;

            const container = documentEl();
            if (container) {
              syncVirtualSheets(container, metrics, pageCount, gapPx);
              container.dataset.pageCount = String(pageCount);
            }

            extension.options.onPaginated?.({ pageCount });
            isApplying = false;
          };

          const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              requestAnimationFrame(() => applyLayout());
            });
          };

          extension.storage.scheduleRefresh = schedule;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => applyLayout());
          });

          return {
            update(v, prevState) {
              if (v.state.doc !== prevState.doc) {
                schedule();
              }
            },
            destroy() {
              cancelAnimationFrame(raf);
              extension.storage.scheduleRefresh = null;
              documentEl()
                ?.querySelector('.cde-virtual-sheets')
                ?.remove();
            },
          };
        },
      }),
    ];
  },
});

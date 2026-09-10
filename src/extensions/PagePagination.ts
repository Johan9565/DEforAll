import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { PageConfig, PageMargins, PageOrientation, PageSize, PaginationResult } from '../types';
import { measurePageMetrics, resolvePageMetrics, type PageMetrics } from './pageMetrics';
import { syncVirtualSheets } from './virtualPageLayout';

export interface PagePaginationOptions {
  pageSize: PageSize;
  orientation?: PageOrientation;
  margins?: PageMargins;
  gapPx?: number;
  getPageConfig?: (pageIndex: number) => PageConfig | undefined;
  onPaginated?: (result: PaginationResult) => void;
}

export type PagePaginationStorage = {
  pageCount: number;
  metrics: PageMetrics | null;
  scheduleRefresh: (() => void) | null;
  applyLayoutSync: (() => void) | null;
  setGapPx: ((gap: number) => void) | null;
};

export const pagePaginationPluginKey = new PluginKey<DecorationSet>('cdePagePagination');
const paginationMetaKey = 'cdePagePagination';

function createSpacerWidget(height: number, isInsideList = false): HTMLElement {
  const spacer = document.createElement(isInsideList ? 'li' : 'div');
  spacer.className = 'cde-page-break' + (isInsideList ? ' cde-page-break--list' : '');
  spacer.style.display = 'block';
  spacer.style.width = '100%';
  spacer.style.height = `${Math.max(1, Math.round(height))}px`;
  spacer.style.pointerEvents = 'none';
  spacer.style.userSelect = 'none';
  spacer.setAttribute('aria-hidden', 'true');
  if (isInsideList) {
    spacer.style.listStyle = 'none';
    spacer.style.margin = '0';
    spacer.style.padding = '0';
    spacer.style.border = 'none';
  }
  return spacer;
}

interface PageableUnit {
  pos: number;
  node: ProseMirrorNode;
  domEl: HTMLElement;
  isTable: boolean;
  isInsideList: boolean;
}

export const PagePagination = Extension.create<
  PagePaginationOptions,
  PagePaginationStorage
>({
  name: 'pagePagination',

  addOptions() {
    return {
      pageSize: 'letter',
      orientation: 'portrait',
      margins: undefined,
      gapPx: 24,
      onPaginated: undefined,
    };
  },

  addStorage() {
    return {
      pageCount: 1,
      metrics: null,
      scheduleRefresh: null,
      applyLayoutSync: null,
      setGapPx: null,
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
        key: pagePaginationPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(pagePaginationPluginKey) as
              | { decorations: DecorationSet }
              | undefined;
            if (meta?.decorations) return meta.decorations;
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return pagePaginationPluginKey.getState(state);
          },
        },
        view(view) {
          let raf = 0;
          let lastSignature = '';
          let isApplying = false;

          const stageEl = () =>
            view.dom.closest<HTMLElement>('.cde-document-stage') ||
            view.dom.closest<HTMLElement>('.cde-workspace');

          const getBaseMetrics = (): PageMetrics => {
            if (!extension.storage.metrics) {
              extension.storage.metrics = measurePageMetrics(
                extension.options.pageSize,
                extension.options.gapPx ?? 24,
                extension.options.orientation,
                extension.options.margins,
              );
            }
            return extension.storage.metrics;
          };

          const getPageMetrics = (pageIndex: number): PageMetrics => {
            const base = getBaseMetrics();
            const config = extension.options.getPageConfig?.(pageIndex);
            if (!config) return base;
            return resolvePageMetrics(base, config, extension.options.gapPx ?? 24);
          };

          interface SheetGeometry {
            pageIndex: number;
            sheetTop: number;
            contentTop: number;
            contentBottom: number;
            sheetBottom: number;
            nextSheetTop: number;
            metrics: PageMetrics;
          }

          const sheetsCache: SheetGeometry[] = [];
          const getSheetGeometry = (idx: number): SheetGeometry => {
            while (sheetsCache.length <= idx) {
              const i = sheetsCache.length;
              const m = getPageMetrics(i);
              const gap = extension.options.gapPx ?? 24;
              if (i === 0) {
                sheetsCache.push({
                  pageIndex: 0,
                  sheetTop: 0,
                  contentTop: 0,
                  contentBottom: m.bodyHeightPx,
                  sheetBottom: m.pageHeightPx,
                  nextSheetTop: m.pageHeightPx + gap,
                  metrics: m,
                });
              } else {
                const prev = sheetsCache[i - 1];
                sheetsCache.push({
                  pageIndex: i,
                  sheetTop: prev.nextSheetTop,
                  contentTop: prev.nextSheetTop,
                  contentBottom: prev.nextSheetTop + m.bodyHeightPx,
                  sheetBottom: prev.nextSheetTop + m.pageHeightPx,
                  nextSheetTop: prev.nextSheetTop + m.pageHeightPx + gap,
                  metrics: m,
                });
              }
            }
            return sheetsCache[idx];
          };

          const collectUnits = (doc: ProseMirrorNode): PageableUnit[] => {
            const units: PageableUnit[] = [];
            let pos = 0;

            for (let i = 0; i < doc.childCount; i += 1) {
              const child = doc.child(i);
              const typeName = child.type.name;

              if (
                typeName === 'bulletList' ||
                typeName === 'orderedList' ||
                typeName === 'taskList'
              ) {
                let itemPos = pos + 1;
                for (let j = 0; j < child.childCount; j += 1) {
                  const item = child.child(j);
                  const itemDom = view.nodeDOM(itemPos);
                  if (itemDom instanceof HTMLElement) {
                    units.push({
                      pos: itemPos,
                      node: item,
                      domEl: itemDom,
                      isTable: false,
                      isInsideList: true,
                    });
                  }
                  itemPos += item.nodeSize;
                }
              } else if (typeName === 'blockquote') {
                let innerPos = pos + 1;
                for (let j = 0; j < child.childCount; j += 1) {
                  const inner = child.child(j);
                  const innerDom = view.nodeDOM(innerPos);
                  if (innerDom instanceof HTMLElement) {
                    units.push({
                      pos: innerPos,
                      node: inner,
                      domEl: innerDom,
                      isTable: false,
                      isInsideList: false,
                    });
                  }
                  innerPos += inner.nodeSize;
                }
              } else {
                const dom = view.nodeDOM(pos);
                if (dom instanceof HTMLElement) {
                  units.push({
                    pos,
                    node: child,
                    domEl: dom,
                    isTable: dom.classList.contains('cde-wt') || typeName === 'table',
                    isInsideList: false,
                  });
                }
              }

              pos += child.nodeSize;
            }

            // Fallback to top-level view.dom.children if nodeDOM couldn't find items
            if (units.length === 0) {
              const domBlocks = Array.from(view.dom.children).filter(
                (el) =>
                  !el.classList.contains('cde-page-break') &&
                  !el.classList.contains('cde-virtual-sheets') &&
                  el.getAttribute('aria-hidden') !== 'true',
              ) as HTMLElement[];

              let fallbackPos = 0;
              for (let i = 0; i < doc.childCount; i += 1) {
                const child = doc.child(i);
                const domEl = domBlocks[i];
                if (domEl) {
                  units.push({
                    pos: fallbackPos,
                    node: child,
                    domEl,
                    isTable: domEl.classList.contains('cde-wt') || child.type.name === 'table',
                    isInsideList: false,
                  });
                }
                fallbackPos += child.nodeSize;
              }
            }

            return units;
          };

          const applyLayout = () => {
            if (isApplying || !view.dom) return;
            isApplying = true;
            sheetsCache.length = 0;

            const gapPx = extension.options.gapPx ?? 24;
            const doc = view.state.doc;
            const units = collectUnits(doc);

            const breaks: Array<{
              pos: number;
              spacerHeight: number;
              pageIndex: number;
              isInsideList: boolean;
            }> = [];

            let currentY = 0;
            let prevMarginBottom = 0;
            let prevDomEl: HTMLElement | null = null;
            let currentSheetIndex = 0;

            const isInline = (el: HTMLElement | null): boolean => {
              if (!el) return false;
              const d = window.getComputedStyle(el).display;
              return d.includes('inline');
            };

            for (let i = 0; i < units.length; i += 1) {
              const unit = units[i];
              const domEl = unit.domEl;

              const style = window.getComputedStyle(domEl);
              const marginTop = parseFloat(style.marginTop) || 0;
              let marginBottom = parseFloat(style.marginBottom) || 0;
              if (unit.isInsideList) {
                const innerP = domEl.querySelector('p');
                if (innerP) {
                  const pMb = parseFloat(window.getComputedStyle(innerP).marginBottom) || 0;
                  marginBottom = Math.max(marginBottom, pMb);
                }
              }

              // Margins collapse vertically between block siblings, but NOT on inline-block elements
              const effectiveMarginTop =
                i === 0
                  ? marginTop
                  : isInline(domEl) || isInline(prevDomEl)
                  ? prevMarginBottom + marginTop
                  : Math.max(prevMarginBottom, marginTop);
              currentY += effectiveMarginTop;

              while (currentY >= getSheetGeometry(currentSheetIndex).nextSheetTop) {
                currentSheetIndex += 1;
              }

              let currentSheet = getSheetGeometry(currentSheetIndex);

              if (unit.isTable) {
                const viewInstance = (domEl as unknown as {
                  __view?: { layoutPagination?: (top: number, m: PageMetrics) => number };
                }).__view;

                const firstTr = domEl.querySelector<HTMLElement>(
                  'tbody > tr:not(.cde-wt__page-spacer):not(.cde-wt__repeated-header)',
                );
                const secondTr = domEl.querySelectorAll<HTMLElement>(
                  'tbody > tr:not(.cde-wt__page-spacer):not(.cde-wt__repeated-header)',
                )[1];
                const minH = (firstTr?.offsetHeight || 30) + (secondTr?.offsetHeight || 30);

                if (currentY > currentSheet.contentTop && currentY + minH > currentSheet.contentBottom) {
                  const remainingOnSheet = Math.max(0, currentSheet.contentBottom - (currentY - effectiveMarginTop));
                  const nextSheet = getSheetGeometry(currentSheetIndex + 1);
                  const spacerHeight = remainingOnSheet + currentSheet.metrics.margins.bottom + gapPx + nextSheet.metrics.margins.top;

                  breaks.push({
                    pos: unit.pos,
                    spacerHeight,
                    pageIndex: currentSheetIndex + 1,
                    isInsideList: false,
                  });

                  currentSheetIndex += 1;
                  currentSheet = nextSheet;
                  currentY = currentSheet.contentTop;
                }

                if (viewInstance?.layoutPagination) {
                  currentY = viewInstance.layoutPagination(currentY, currentSheet.metrics);
                  while (currentY >= getSheetGeometry(currentSheetIndex).nextSheetTop) {
                    currentSheetIndex += 1;
                  }
                  currentSheet = getSheetGeometry(currentSheetIndex);
                } else {
                  currentY += domEl.offsetHeight;
                }
                prevMarginBottom = marginBottom;
                prevDomEl = domEl;
              } else {
                const h = domEl.offsetHeight;
                if (currentY > currentSheet.contentTop && currentY + h > currentSheet.contentBottom) {
                  const remainingOnSheet = Math.max(0, currentSheet.contentBottom - (currentY - effectiveMarginTop));
                  const nextSheet = getSheetGeometry(currentSheetIndex + 1);
                  const spacerHeight = remainingOnSheet + currentSheet.metrics.margins.bottom + gapPx + nextSheet.metrics.margins.top;

                  breaks.push({
                    pos: unit.pos,
                    spacerHeight,
                    pageIndex: currentSheetIndex + 1,
                    isInsideList: unit.isInsideList,
                  });

                  currentSheetIndex += 1;
                  currentSheet = nextSheet;
                  currentY = currentSheet.contentTop + h;
                  prevMarginBottom = 0;
                  prevDomEl = null;
                } else {
                  currentY += h;
                  prevMarginBottom = marginBottom;
                  prevDomEl = domEl;
                }
              }
            }

            while (currentY > getSheetGeometry(currentSheetIndex).sheetBottom) {
              currentSheetIndex += 1;
            }
            const pageCount = Math.max(1, currentSheetIndex + 1);
            extension.storage.pageCount = pageCount;

            const signature = `${pageCount}:${breaks
              .map((b) => `${b.pos}:${Math.round(b.spacerHeight)}:${b.isInsideList ? 1 : 0}`)
              .join('|')}`;

            if (signature !== lastSignature) {
              lastSignature = signature;

              const decorations = DecorationSet.create(
                view.state.doc,
                breaks.map((b) =>
                  Decoration.widget(
                    b.pos,
                    () => createSpacerWidget(b.spacerHeight, b.isInsideList),
                    {
                      side: -1,
                      key: `break-${b.pos}-${b.pageIndex}`,
                    },
                  ),
                ),
              );

              const tr = view.state.tr
                .setMeta(pagePaginationPluginKey, { decorations })
                .setMeta(paginationMetaKey, true)
                .setMeta('addToHistory', false);
              view.dispatch(tr);
            }

            const container = stageEl();
            if (container) {
              syncVirtualSheets(container, (idx) => getPageMetrics(idx), pageCount, gapPx);
              container.dataset.pageCount = String(pageCount);
            }

            extension.options.onPaginated?.({ pageCount });
            isApplying = false;
          };

          const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              applyLayout();
            });
          };

          extension.storage.scheduleRefresh = schedule;
          extension.storage.applyLayoutSync = () => {
            extension.storage.metrics = null;
            applyLayout();
          };
          extension.storage.setGapPx = (gap: number) => {
            extension.options.gapPx = gap;
            extension.storage.metrics = null;
            applyLayout();
          };

          requestAnimationFrame(() => {
            applyLayout();
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
              extension.storage.applyLayoutSync = null;
              extension.storage.setGapPx = null;
            },
          };
        },
      }),
    ];
  },
});

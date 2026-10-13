import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { PageMetrics } from './pageMetrics';
import type { HeaderFooterConfig } from '../types';

export interface VirtualBreak {
  pos: number;
  fillHeight: number;
  pageIndex: number;
}

export interface VirtualLayoutResult {
  breaks: VirtualBreak[];
  pageCount: number;
}

export interface MeasuredUnit {
  pos: number;
  height: number;
}

const MIN_FILL_PX = 0;
const LINE_TOP_EPS_PX = 3;

function measureDomHeight(view: EditorView, nodePos: number): number {
  const dom = view.nodeDOM(nodePos);
  if (!(dom instanceof HTMLElement)) return 24;
  return Math.max(dom.getBoundingClientRect().height, 1);
}

function blockMarginBottom(view: EditorView, nodePos: number): number {
  const dom = view.nodeDOM(nodePos);
  if (!(dom instanceof HTMLElement)) return 0;
  const margin = parseFloat(getComputedStyle(dom).marginBottom);
  return Number.isFinite(margin) ? margin : 0;
}

/**
 * Split a text block into visual lines using coordsAtPos.
 */
function measureTextblockLines(
  view: EditorView,
  nodePos: number,
  node: ProseMirrorNode,
): MeasuredUnit[] {
  const units: MeasuredUnit[] = [];
  const start = nodePos + 1;
  const end = nodePos + node.nodeSize - 1;

  if (node.content.size === 0) {
    units.push({
      pos: start,
      height: Math.max(measureDomHeight(view, nodePos), 16),
    });
    return units;
  }

  let lineStart = start;
  let lineTop: number | null = null;
  let lineBottom = 0;

  for (let pos = start; pos <= end; pos += 1) {
    const coords = view.coordsAtPos(pos, 1);

    if (lineTop !== null && coords.top > lineTop + LINE_TOP_EPS_PX) {
      units.push({
        pos: lineStart,
        height: Math.max(lineBottom - lineTop, 14),
      });
      lineStart = pos;
      lineTop = coords.top;
      lineBottom = coords.bottom;
      continue;
    }

    if (lineTop === null) lineTop = coords.top;
    lineBottom = Math.max(lineBottom, coords.bottom);
  }

  if (lineTop !== null) {
    let lastHeight = Math.max(lineBottom - lineTop, 14);
    lastHeight += blockMarginBottom(view, nodePos);
    units.push({ pos: lineStart, height: lastHeight });
  }

  return units.length > 0 ? units : [{ pos: start, height: 20 }];
}

function collectNodeUnits(
  view: EditorView,
  nodePos: number,
  node: ProseMirrorNode,
): MeasuredUnit[] {
  const type = node.type.name;

  if (
    type === 'bulletList' ||
    type === 'orderedList' ||
    type === 'taskList' ||
    type === 'blockquote'
  ) {
    const units: MeasuredUnit[] = [];
    let pos = nodePos + 1;
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      units.push(...collectNodeUnits(view, pos, child));
      pos += child.nodeSize;
    }
    return units;
  }

  if (type === 'listItem') {
    const units: MeasuredUnit[] = [];
    let pos = nodePos + 1;
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      units.push(...collectNodeUnits(view, pos, child));
      pos += child.nodeSize;
    }
    return units;
  }

  if (type === 'table') {
    // Tables manage their own internal row pagination in WidgetTableView
    return [{ pos: nodePos, height: measureDomHeight(view, nodePos) }];
  }

  if (node.isTextblock) {
    return measureTextblockLines(view, nodePos, node);
  }

  return [{ pos: nodePos, height: measureDomHeight(view, nodePos) }];
}

/** Measures all pageable units: lines in paragraphs, lists, blocks. */
export function collectMeasuredUnits(
  view: EditorView,
  _bodyHeightPx: number,
): MeasuredUnit[] {
  const units: MeasuredUnit[] = [];
  const doc = view.state.doc;
  let pos = 1;

  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);
    if (!node.isBlock) {
      pos += node.nodeSize;
      continue;
    }
    units.push(...collectNodeUnits(view, pos, node));
    pos += node.nodeSize;
  }

  return units;
}

export function layoutVirtualPages(
  units: MeasuredUnit[],
  bodyHeightPx: number,
): VirtualLayoutResult {
  const breaks: VirtualBreak[] = [];
  let yOnPage = 0;
  let pageIndex = 1;

  for (const unit of units) {
    const spaceLeft = bodyHeightPx - yOnPage;
    const needsBreak = yOnPage > 0 && unit.height > spaceLeft + 0.5;

    if (needsBreak) {
      breaks.push({
        pos: unit.pos,
        fillHeight: Math.max(spaceLeft, MIN_FILL_PX),
        pageIndex,
      });
      pageIndex += 1;
      yOnPage = unit.height;
    } else {
      yOnPage += unit.height;
    }

    while (yOnPage > bodyHeightPx + 0.5) {
      pageIndex += 1;
      yOnPage -= bodyHeightPx;
    }
  }

  return { breaks, pageCount: Math.max(1, pageIndex) };
}

/** Backup: count pages according to rendered DOM height. */
export function estimateRenderedPageCount(
  view: EditorView,
  metrics: PageMetrics,
  gapPx: number,
): number {
  const height = Math.max(view.dom.scrollHeight, view.dom.getBoundingClientRect().height);
  const stride = metrics.pageHeightPx + gapPx;
  return Math.max(1, Math.ceil(height / stride));
}

function formatPageNum(format: string | undefined, current: number, total: number): string {
  switch (format) {
    case 'simple':
      return String(current);
    case 'page_x_of_y':
      return `Página ${current} de ${total}`;
    case 'none':
      return '';
    case 'page_x':
    default:
      return `Página ${current}`;
  }
}

export function syncVirtualSheets(
  stageEl: HTMLElement,
  metricsResolver: PageMetrics | ((pageIndex: number) => PageMetrics),
  pageCount: number,
  gapPx: number,
  headerFooter?: HeaderFooterConfig,
): void {
  let sheetsRoot = stageEl.querySelector<HTMLElement>('.cde-virtual-sheets');

  if (!sheetsRoot) {
    sheetsRoot = document.createElement('div');
    sheetsRoot.className = 'cde-virtual-sheets';
    sheetsRoot.setAttribute('aria-hidden', 'true');
    stageEl.insertBefore(sheetsRoot, stageEl.firstChild);
  }

  sheetsRoot.replaceChildren();

  let totalHeight = 0;
  let maxWidth = 0;

  for (let i = 0; i < pageCount; i += 1) {
    const m = typeof metricsResolver === 'function' ? metricsResolver(i) : metricsResolver;
    maxWidth = Math.max(maxWidth, m.pageWidthPx);

    const sheet = document.createElement('div');
    sheet.className = `cde-virtual-sheet cde-virtual-sheet--${m.pageSize} cde-virtual-sheet--${m.orientation}`;
    sheet.style.height = `${m.pageHeightPx}px`;
    sheet.style.width = `${m.pageWidthPx}px`;
    sheet.style.marginLeft = 'auto';
    sheet.style.marginRight = 'auto';

    if (i < pageCount - 1) {
      sheet.style.marginBottom = `${gapPx}px`;
    }

    const isFirstPage = i === 0;
    const skipFirst = Boolean(headerFooter?.differentFirstPage && isFirstPage);

    // 1. Header (Encabezado)
    if (headerFooter?.showHeader && !skipFirst) {
      const headerEl = document.createElement('div');
      headerEl.className = 'cde-virtual-sheet__header';
      if (headerFooter.headerLine) headerEl.classList.add('has-line');

      const left = document.createElement('span');
      left.className = 'cde-virtual-sheet__header-left';
      left.textContent = headerFooter.headerLeft ?? '';

      const center = document.createElement('span');
      center.className = 'cde-virtual-sheet__header-center';
      center.textContent = headerFooter.headerCenter ?? '';

      const right = document.createElement('span');
      right.className = 'cde-virtual-sheet__header-right';
      right.textContent = headerFooter.headerRight ?? '';

      if (headerFooter.pageNumberPosition?.startsWith('header-')) {
        const pgText = formatPageNum(headerFooter.pageNumberFormat, i + 1, pageCount);
        if (headerFooter.pageNumberPosition === 'header-left') left.textContent = pgText;
        else if (headerFooter.pageNumberPosition === 'header-center') center.textContent = pgText;
        else if (headerFooter.pageNumberPosition === 'header-right') right.textContent = pgText;
      }

      headerEl.append(left, center, right);
      sheet.appendChild(headerEl);
    }

    // 2. Footer (Pie de página)
    if (headerFooter?.showFooter && !skipFirst) {
      const footerEl = document.createElement('div');
      footerEl.className = 'cde-virtual-sheet__footer';
      if (headerFooter.footerLine) footerEl.classList.add('has-line');

      const left = document.createElement('span');
      left.className = 'cde-virtual-sheet__footer-left';
      left.textContent = headerFooter.footerLeft ?? '';

      const center = document.createElement('span');
      center.className = 'cde-virtual-sheet__footer-center';
      center.textContent = headerFooter.footerCenter ?? '';

      const right = document.createElement('span');
      right.className = 'cde-virtual-sheet__footer-right';
      right.textContent = headerFooter.footerRight ?? '';

      const pos = headerFooter.pageNumberPosition ?? 'footer-right';
      if (pos.startsWith('footer-')) {
        const pgText = formatPageNum(headerFooter.pageNumberFormat ?? 'page_x', i + 1, pageCount);
        if (pos === 'footer-left') left.textContent = pgText;
        else if (pos === 'footer-center') center.textContent = pgText;
        else if (pos === 'footer-right') right.textContent = pgText;
      }

      footerEl.append(left, center, right);
      sheet.appendChild(footerEl);
    } else if (!headerFooter) {
      // Default fallback
      const num = document.createElement('span');
      num.className = 'cde-virtual-sheet__num';
      num.textContent = `Página ${i + 1}`;
      sheet.appendChild(num);
    } else if (!skipFirst && headerFooter.pageNumberFormat && headerFooter.pageNumberFormat !== 'none') {
      const num = document.createElement('span');
      num.className = 'cde-virtual-sheet__num';
      num.textContent = formatPageNum(headerFooter.pageNumberFormat, i + 1, pageCount);
      sheet.appendChild(num);
    }

    sheetsRoot.appendChild(sheet);

    totalHeight += m.pageHeightPx + (i < pageCount - 1 ? gapPx : 0);
  }

  stageEl.style.minHeight = `${totalHeight}px`;
  stageEl.style.width = `${maxWidth}px`;
  stageEl.style.setProperty('--ruler-half-width', `${maxWidth / 2}px`);
}

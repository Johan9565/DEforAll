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
  // ── Capa 1: hojas virtuales (fondo blanco, sombra) ───────────────────────
  let sheetsRoot = stageEl.querySelector<HTMLElement>('.cde-virtual-sheets');

  if (!sheetsRoot) {
    sheetsRoot = document.createElement('div');
    sheetsRoot.className = 'cde-virtual-sheets';
    sheetsRoot.setAttribute('aria-hidden', 'true');
    stageEl.insertBefore(sheetsRoot, stageEl.firstChild);
  }

  sheetsRoot.replaceChildren();

  // ── Capa 2: overlay de encabezados y pies (z-index superior al contenido) ─
  let hfOverlay = stageEl.querySelector<HTMLElement>('.cde-virtual-hf-overlay');

  if (!hfOverlay) {
    hfOverlay = document.createElement('div');
    hfOverlay.className = 'cde-virtual-hf-overlay';
    hfOverlay.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(hfOverlay);
  }

  hfOverlay.replaceChildren();

  let totalHeight = 0;
  let maxWidth = 0;

  // Acumulador de desplazamiento vertical para posicionar encabezados/pies
  // de manera absoluta dentro del overlay (que cubre todo el stage).
  let sheetTop = 0;

  for (let i = 0; i < pageCount; i += 1) {
    const m = typeof metricsResolver === 'function' ? metricsResolver(i) : metricsResolver;
    maxWidth = Math.max(maxWidth, m.pageWidthPx);

    // ── Hoja de fondo ────────────────────────────────────────────────────────
    const sheet = document.createElement('div');
    sheet.className = `cde-virtual-sheet cde-virtual-sheet--${m.pageSize} cde-virtual-sheet--${m.orientation}`;
    sheet.style.height = `${m.pageHeightPx}px`;
    sheet.style.width = `${m.pageWidthPx}px`;
    sheet.style.marginLeft = 'auto';
    sheet.style.marginRight = 'auto';

    const gapAfter = i < pageCount - 1 ? gapPx : 0;

    if (gapAfter > 0) {
      sheet.style.marginBottom = `${gapAfter}px`;
    }

    sheetsRoot.appendChild(sheet);

    // ── Márgenes de esta página ──────────────────────────────────────────────
    const mg = m.margins;
    // Offset horizontal: las hojas están centradas; el overlay ocupa todo el
    // ancho del stage, así que calculamos el margen izquierdo hasta el borde
    // de la hoja (stage puede ser más ancho si hay otras páginas más anchas).
    // Usamos variables CSS en el overlay o calculamos en JS con maxWidth.
    // Por simplicidad usamos calc() con variables que se actualizan al final.
    const isFirstPage = i === 0;
    const skipFirst = Boolean(headerFooter?.differentFirstPage && isFirstPage);

    // ── Encabezado (Encabezado) ──────────────────────────────────────────────
    if (headerFooter?.showHeader && !skipFirst) {
      const headerEl = document.createElement('div');
      headerEl.className = 'cde-virtual-sheet__header';
      if (headerFooter.headerLine) headerEl.classList.add('has-line');

      // Posicionamiento absoluto dentro del overlay usando métricas reales
      headerEl.style.top = `${sheetTop}px`;
      headerEl.style.height = `${mg.top}px`;
      // La hoja está centrada; offset desde el borde del stage:
      // left del overlay = (stageWidth - pageWidth) / 2 + mg.left
      // Usamos la custom property --cde-sheet-offset-left (px desde borde stage)
      // que calcularemos tras conocer maxWidth. Por ahora almacenamos como
      // data attributes y re-aplicamos al final.
      headerEl.dataset.mleft = String(mg.left);
      headerEl.dataset.mright = String(mg.right);
      headerEl.dataset.pageWidth = String(m.pageWidthPx);

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
      hfOverlay.appendChild(headerEl);
    }

    // ── Pie de página (Pie de página) ────────────────────────────────────────
    if (headerFooter?.showFooter && !skipFirst) {
      const footerEl = document.createElement('div');
      footerEl.className = 'cde-virtual-sheet__footer';
      if (headerFooter.footerLine) footerEl.classList.add('has-line');

      // El pie ocupa la zona inferior de la página (desde pageHeight - mg.bottom)
      footerEl.style.top = `${sheetTop + m.pageHeightPx - mg.bottom}px`;
      footerEl.style.height = `${mg.bottom}px`;
      footerEl.dataset.mleft = String(mg.left);
      footerEl.dataset.mright = String(mg.right);
      footerEl.dataset.pageWidth = String(m.pageWidthPx);

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
      hfOverlay.appendChild(footerEl);
    } else if (!headerFooter) {
      // Número de página por defecto (fallback sin config de encabezado/pie)
      const num = document.createElement('span');
      num.className = 'cde-virtual-sheet__num';
      // Posición absoluta respecto al overlay: esquina inferior derecha de la hoja
      num.style.top = `${sheetTop + m.pageHeightPx - mg.bottom + Math.max(mg.bottom - 20, 4)}px`;
      num.style.right = `${Math.floor((maxWidth - m.pageWidthPx) / 2) + 32}px`;
      num.textContent = `Página ${i + 1}`;
      hfOverlay.appendChild(num);
    } else if (!skipFirst && headerFooter.pageNumberFormat && headerFooter.pageNumberFormat !== 'none') {
      const num = document.createElement('span');
      num.className = 'cde-virtual-sheet__num';
      num.style.top = `${sheetTop + m.pageHeightPx - mg.bottom + Math.max(mg.bottom - 20, 4)}px`;
      num.dataset.pageWidth = String(m.pageWidthPx);
      num.textContent = formatPageNum(headerFooter.pageNumberFormat, i + 1, pageCount);
      hfOverlay.appendChild(num);
    }

    sheetTop += m.pageHeightPx + gapAfter;
    totalHeight += m.pageHeightPx + gapAfter;
  }

  stageEl.style.minHeight = `${totalHeight}px`;
  stageEl.style.width = `${maxWidth}px`;
  stageEl.style.setProperty('--ruler-half-width', `${maxWidth / 2}px`);

  // ── Aplica posicionamiento horizontal a encabezados/pies ─────────────────
  // Ahora que conocemos maxWidth podemos calcular el offset de cada hoja.
  hfOverlay.querySelectorAll<HTMLElement>(
    '.cde-virtual-sheet__header, .cde-virtual-sheet__footer',
  ).forEach((el) => {
    const pageWidth = Number(el.dataset.pageWidth ?? maxWidth);
    const mleft = Number(el.dataset.mleft ?? 0);
    const mright = Number(el.dataset.mright ?? 0);
    const sheetOffsetLeft = Math.floor((maxWidth - pageWidth) / 2);
    el.style.left = `${sheetOffsetLeft + mleft}px`;
    el.style.right = `${sheetOffsetLeft + mright}px`;
    // Limpiamos data attrs usados solo para este cálculo
    delete el.dataset.mleft;
    delete el.dataset.mright;
    delete el.dataset.pageWidth;
  });

  // Posiciona fallback .cde-virtual-sheet__num (right relativo a maxWidth)
  hfOverlay.querySelectorAll<HTMLElement>('.cde-virtual-sheet__num').forEach((el) => {
    if (el.dataset.pageWidth) {
      const pageWidth = Number(el.dataset.pageWidth);
      const sheetOffsetLeft = Math.floor((maxWidth - pageWidth) / 2);
      el.style.right = `${sheetOffsetLeft + 32}px`;
      delete el.dataset.pageWidth;
    }
  });
}

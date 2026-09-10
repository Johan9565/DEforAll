import type { PageConfig, PageMargins, PageOrientation, PageSize } from '../types';

export interface PageMetrics {
  pageSize: PageSize;
  pageWidthPx: number;
  pageHeightPx: number;
  marginPx: number;
  bodyHeightPx: number;
  bodyWidthPx: number;
  gapPx: number;
  marginJump: number;
  orientation: PageOrientation;
  margins: PageMargins;
}

export function measurePageMetrics(
  pageSize: PageSize,
  gapPx = 24,
  orientation: PageOrientation = 'portrait',
  margins?: PageMargins,
): PageMetrics {
  let pageWidthPx = pageSize === 'a4' ? 794 : 816;
  let pageHeightPx = pageSize === 'a4' ? 1123 : 1056;
  let marginPx = 96;

  if (typeof document !== 'undefined' && document.body) {
    const probe = document.createElement('div');
    probe.className = `cde-measure cde-measure--${pageSize}`;
    probe.innerHTML =
      '<div class="cde-measure__page"><div class="cde-measure__margin"></div></div>';
    probe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(probe);

    const pageBox = probe.querySelector<HTMLElement>('.cde-measure__page');
    const marginBox = probe.querySelector<HTMLElement>('.cde-measure__margin');

    if (pageBox && pageBox.offsetWidth > 0) pageWidthPx = pageBox.offsetWidth;
    if (pageBox && pageBox.offsetHeight > 0) pageHeightPx = pageBox.offsetHeight;
    if (marginBox && marginBox.offsetHeight > 0) marginPx = marginBox.offsetHeight;

    probe.remove();
  }

  if (orientation === 'landscape') [pageWidthPx, pageHeightPx] = [pageHeightPx, pageWidthPx];
  const resolvedMargins = margins ?? { top: marginPx, right: marginPx, bottom: marginPx, left: marginPx };
  const bodyHeightPx = Math.max(1, pageHeightPx - resolvedMargins.top - resolvedMargins.bottom);
  const bodyWidthPx = Math.max(1, pageWidthPx - resolvedMargins.left - resolvedMargins.right);
  const marginJump = resolvedMargins.top + resolvedMargins.bottom + gapPx;

  return {
    pageSize,
    pageWidthPx,
    pageHeightPx,
    marginPx: resolvedMargins.top,
    bodyHeightPx,
    bodyWidthPx,
    gapPx,
    marginJump,
    orientation,
    margins: resolvedMargins,
  };
}

export function resolvePageMetrics(
  baseMetrics: PageMetrics,
  config?: PageConfig,
  gapPx = 24,
): PageMetrics {
  if (!config) return baseMetrics;
  const pageSize = config.pageSize ?? baseMetrics.pageSize;
  const orientation = config.orientation ?? baseMetrics.orientation;
  const margins: PageMargins = {
    top: config.margins?.top ?? baseMetrics.margins.top,
    right: config.margins?.right ?? baseMetrics.margins.right,
    bottom: config.margins?.bottom ?? baseMetrics.margins.bottom,
    left: config.margins?.left ?? baseMetrics.margins.left,
  };
  return measurePageMetrics(pageSize, gapPx, orientation, margins);
}

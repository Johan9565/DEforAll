import type { PageSize } from '../types';

export interface PageMetrics {
  pageSize: PageSize;
  pageWidthPx: number;
  pageHeightPx: number;
  marginPx: number;
  bodyHeightPx: number;
}

export function measurePageMetrics(pageSize: PageSize): PageMetrics {
  const probe = document.createElement('div');
  probe.className = `cde-measure cde-measure--${pageSize}`;
  probe.innerHTML =
    '<div class="cde-measure__page"><div class="cde-measure__margin"></div></div>';
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);

  const pageBox = probe.querySelector<HTMLElement>('.cde-measure__page')!;
  const marginBox = probe.querySelector<HTMLElement>('.cde-measure__margin')!;

  const pageWidthPx = pageBox.offsetWidth;
  const pageHeightPx = pageBox.offsetHeight;
  const marginPx = marginBox.offsetHeight;

  probe.remove();

  return {
    pageSize,
    pageWidthPx,
    pageHeightPx,
    marginPx,
    bodyHeightPx: Math.max(1, pageHeightPx - marginPx * 2),
  };
}

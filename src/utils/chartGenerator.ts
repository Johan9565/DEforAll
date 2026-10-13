import type { Editor } from '@tiptap/core';
import { lucideSvg, ChartColumn, Plus, Trash2 } from '../icons';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartTypeDefinition {
  id: string;
  name: string;
  renderSvg: (
    title: string,
    data: ChartDataPoint[],
    palette: string[],
    width: number,
    height: number,
    showLegend: boolean,
    showLabels: boolean,
  ) => string;
}

const PALETTES = [
  { id: 'blue', name: 'Azul Corporativo', colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'] },
  { id: 'emerald', name: 'Esmeralda Finanzas', colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'] },
  { id: 'warm', name: 'Atardecer Cálido', colors: ['#dc2626', '#ea580c', '#f59e0b', '#fbbf24', '#fde68a'] },
  { id: 'purple', name: 'Púrpura Tecnológico', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e9d5ff'] },
  { id: 'dark', name: 'Titanio & Neón', colors: ['#0284c7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'] },
];

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const CHART_TYPES: ChartTypeDefinition[] = [
  // 1. COLUMNAS
  {
    id: 'column',
    name: 'Columnas verticales',
    renderSvg: (title, data, colors, width, height, _showLegend, showLabels) => {
      const topPad = title ? 45 : 25;
      const botPad = 35;
      const leftPad = 45;
      const rightPad = 25;
      const plotW = width - leftPad - rightPad;
      const plotH = height - topPad - botPad;

      const maxVal = Math.max(...data.map((d) => d.value), 10);
      const ceilMax = Math.ceil(maxVal * 1.15);

      const gridLines = [0, 0.25, 0.5, 0.75, 1]
        .map((pct) => {
          const y = topPad + plotH * (1 - pct);
          const val = Math.round(ceilMax * pct);
          return `
          <line x1="${leftPad}" y1="${y}" x2="${width - rightPad}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3 3" />
          <text x="${leftPad - 8}" y="${y + 3}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10" text-anchor="end">${val}</text>
        `;
        })
        .join('');

      const colCount = Math.max(1, data.length);
      const colStep = plotW / colCount;
      const barW = Math.min(48, colStep * 0.6);

      const bars = data
        .map((d, i) => {
          const barH = (d.value / ceilMax) * plotH;
          const x = leftPad + i * colStep + (colStep - barW) / 2;
          const y = topPad + plotH - barH;
          const c = colors[i % colors.length];

          return `
          <g>
            <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${c}" />
            ${
              showLabels
                ? `<text x="${x + barW / 2}" y="${y - 6}" fill="#1e293b" font-family="system-ui, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${d.value}</text>`
                : ''
            }
            <text x="${x + barW / 2}" y="${height - 12}" fill="#475569" font-family="system-ui, sans-serif" font-size="11" font-weight="500" text-anchor="middle">${escapeXml(d.label)}</text>
          </g>
        `;
        })
        .join('');

      const titleEl = title
        ? `<text x="${width / 2}" y="24" fill="#0f172a" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>`
        : '';

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          <rect width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
          ${titleEl}
          ${gridLines}
          ${bars}
        </svg>
      `;
    },
  },

  // 2. BARRAS HORIZONTALES
  {
    id: 'bar',
    name: 'Barras horizontales',
    renderSvg: (title, data, colors, width, height, _showLegend, showLabels) => {
      const topPad = title ? 45 : 20;
      const botPad = 25;
      const leftPad = 80;
      const rightPad = 40;
      const plotW = width - leftPad - rightPad;
      const plotH = height - topPad - botPad;

      const maxVal = Math.max(...data.map((d) => d.value), 10);
      const ceilMax = Math.ceil(maxVal * 1.15);

      const rowCount = Math.max(1, data.length);
      const rowStep = plotH / rowCount;
      const barH = Math.min(28, rowStep * 0.65);

      const bars = data
        .map((d, i) => {
          const barW = (d.value / ceilMax) * plotW;
          const y = topPad + i * rowStep + (rowStep - barH) / 2;
          const c = colors[i % colors.length];

          return `
          <g>
            <text x="${leftPad - 10}" y="${y + barH / 2 + 4}" fill="#334155" font-family="system-ui, sans-serif" font-size="11" font-weight="600" text-anchor="end">${escapeXml(d.label)}</text>
            <rect x="${leftPad}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${c}" />
            ${
              showLabels
                ? `<text x="${leftPad + barW + 8}" y="${y + barH / 2 + 4}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="11" font-weight="700">${d.value}</text>`
                : ''
            }
          </g>
        `;
        })
        .join('');

      const titleEl = title
        ? `<text x="${width / 2}" y="24" fill="#0f172a" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>`
        : '';

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          <rect width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
          ${titleEl}
          ${bars}
        </svg>
      `;
    },
  },

  // 3. LÍNEAS
  {
    id: 'line',
    name: 'Línea de tendencia',
    renderSvg: (title, data, colors, width, height, _showLegend, showLabels) => {
      const topPad = title ? 45 : 25;
      const botPad = 35;
      const leftPad = 45;
      const rightPad = 25;
      const plotW = width - leftPad - rightPad;
      const plotH = height - topPad - botPad;

      const maxVal = Math.max(...data.map((d) => d.value), 10);
      const ceilMax = Math.ceil(maxVal * 1.15);

      const gridLines = [0, 0.33, 0.66, 1]
        .map((pct) => {
          const y = topPad + plotH * (1 - pct);
          return `<line x1="${leftPad}" y1="${y}" x2="${width - rightPad}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3 3" />`;
        })
        .join('');

      const count = Math.max(1, data.length);
      const points = data.map((d, i) => {
        const x = count > 1 ? leftPad + (i / (count - 1)) * plotW : leftPad + plotW / 2;
        const y = topPad + plotH - (d.value / ceilMax) * plotH;
        return { x, y, val: d.value, label: d.label };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
      const areaD = `${pathD} L ${points[points.length - 1].x},${topPad + plotH} L ${points[0].x},${topPad + plotH} Z`;

      const dots = points
        .map(
          (p) => `
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#ffffff" stroke="${colors[0]}" stroke-width="2.5" />
        ${
          showLabels
            ? `<text x="${p.x}" y="${p.y - 10}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${p.val}</text>`
            : ''
        }
        <text x="${p.x}" y="${height - 12}" fill="#64748b" font-family="system-ui, sans-serif" font-size="10" text-anchor="middle">${escapeXml(p.label)}</text>
      `,
        )
        .join('');

      const titleEl = title
        ? `<text x="${width / 2}" y="24" fill="#0f172a" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>`
        : '';

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          <defs>
            <linearGradient id="lineAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${colors[0]}" stop-opacity="0.25" />
              <stop offset="100%" stop-color="${colors[0]}" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
          ${titleEl}
          ${gridLines}
          <path d="${areaD}" fill="url(#lineAreaGrad)" />
          <path d="${pathD}" fill="none" stroke="${colors[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          ${dots}
        </svg>
      `;
    },
  },

  // 4. CIRCULAR / PASTEL
  {
    id: 'pie',
    name: 'Circular / Pastel (Pie)',
    renderSvg: (title, data, colors, width, height, _showLegend, _showLabels) => {
      const cx = width * 0.42;
      const cy = height * 0.55;
      const radius = Math.min(width * 0.32, height * 0.36);

      const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

      let startAngle = -Math.PI / 2;
      const slices = data
        .map((d, i) => {
          const sliceAngle = (d.value / total) * 2 * Math.PI;
          const endAngle = startAngle + sliceAngle;
          const c = colors[i % colors.length];

          const x1 = cx + radius * Math.cos(startAngle);
          const y1 = cy + radius * Math.sin(startAngle);
          const x2 = cx + radius * Math.cos(endAngle);
          const y2 = cy + radius * Math.sin(endAngle);

          const largeArc = sliceAngle > Math.PI ? 1 : 0;
          const path = `M ${cx},${cy} L ${x1},${y1} A ${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`;

          startAngle = endAngle;

          return `<path d="${path}" fill="${c}" stroke="#ffffff" stroke-width="2" />`;
        })
        .join('');

      // Legend
      const legendX = width * 0.72;
      const legendStartY = height * 0.32;
      const legendItems = data
        .map((d, i) => {
          const c = colors[i % colors.length];
          const y = legendStartY + i * 22;
          const pct = Math.round((d.value / total) * 100);
          return `
          <g>
            <rect x="${legendX}" y="${y}" width="12" height="12" rx="3" fill="${c}" />
            <text x="${legendX + 18}" y="${y + 10}" fill="#334155" font-family="system-ui, sans-serif" font-size="11">
              ${escapeXml(d.label)} <tspan font-weight="700">(${pct}%)</tspan>
            </text>
          </g>
        `;
        })
        .join('');

      const titleEl = title
        ? `<text x="${width / 2}" y="24" fill="#0f172a" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>`
        : '';

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          <rect width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
          ${titleEl}
          ${slices}
          ${legendItems}
        </svg>
      `;
    },
  },

  // 5. ANILLO (DONUT)
  {
    id: 'donut',
    name: 'Gráfico de anillo (Donut)',
    renderSvg: (title, data, colors, width, height, _showLegend, _showLabels) => {
      const cx = width * 0.42;
      const cy = height * 0.55;
      const outerR = Math.min(width * 0.32, height * 0.36);
      const innerR = outerR * 0.6;

      const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

      let startAngle = -Math.PI / 2;
      const slices = data
        .map((d, i) => {
          const sliceAngle = (d.value / total) * 2 * Math.PI;
          const endAngle = startAngle + sliceAngle;
          const c = colors[i % colors.length];

          const x1 = cx + outerR * Math.cos(startAngle);
          const y1 = cy + outerR * Math.sin(startAngle);
          const x2 = cx + outerR * Math.cos(endAngle);
          const y2 = cy + outerR * Math.sin(endAngle);

          const ix1 = cx + innerR * Math.cos(endAngle);
          const iy1 = cy + innerR * Math.sin(endAngle);
          const ix2 = cx + innerR * Math.cos(startAngle);
          const iy2 = cy + innerR * Math.sin(startAngle);

          const largeArc = sliceAngle > Math.PI ? 1 : 0;
          const path = `M ${x1},${y1} A ${outerR},${outerR} 0 ${largeArc},1 ${x2},${y2} L ${ix1},${iy1} A ${innerR},${innerR} 0 ${largeArc},0 ${ix2},${iy2} Z`;

          startAngle = endAngle;

          return `<path d="${path}" fill="${c}" stroke="#ffffff" stroke-width="2" />`;
        })
        .join('');

      const legendX = width * 0.72;
      const legendStartY = height * 0.32;
      const legendItems = data
        .map((d, i) => {
          const c = colors[i % colors.length];
          const y = legendStartY + i * 22;
          const pct = Math.round((d.value / total) * 100);
          return `
          <g>
            <rect x="${legendX}" y="${y}" width="12" height="12" rx="3" fill="${c}" />
            <text x="${legendX + 18}" y="${y + 10}" fill="#334155" font-family="system-ui, sans-serif" font-size="11">
              ${escapeXml(d.label)} <tspan font-weight="700">(${pct}%)</tspan>
            </text>
          </g>
        `;
        })
        .join('');

      const titleEl = title
        ? `<text x="${width / 2}" y="24" fill="#0f172a" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>`
        : '';

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          <rect width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
          ${titleEl}
          ${slices}
          <text x="${cx}" y="${cy - 4}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="16" font-weight="800" text-anchor="middle">${total}</text>
          <text x="${cx}" y="${cy + 12}" fill="#64748b" font-family="system-ui, sans-serif" font-size="9" text-anchor="middle">TOTAL</text>
          ${legendItems}
        </svg>
      `;
    },
  },
];

export function openChartModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let chartTitle = 'Rendimiento Trimestral';
  let selectedTypeId = 'column';
  let selectedPaletteId = 'blue';
  let chartWidth = 500;
  let chartHeight = 280;
  let showLegend = true;
  let showLabels = true;

  let dataPoints: ChartDataPoint[] = [
    { label: 'Q1', value: 45 },
    { label: 'Q2', value: 72 },
    { label: 'Q3', value: 89 },
    { label: 'Q4', value: 110 },
  ];

  const getChartType = () =>
    CHART_TYPES.find((t) => t.id === selectedTypeId) ?? CHART_TYPES[0];

  const getPalette = () =>
    PALETTES.find((p) => p.id === selectedPaletteId) ?? PALETTES[0];

  const renderCurrentPreview = () => {
    const t = getChartType();
    const p = getPalette();
    return t.renderSvg(chartTitle, dataPoints, p.colors, chartWidth, chartHeight, showLegend, showLabels);
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--lg" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(ChartColumn, 18)}</span>
          <h2 class="cde-modal__title">Insertar gráfico estadístico</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body grid grid-cols-1 md:grid-cols-12 gap-5">
        <!-- Izquierda: Configuración de Tipo y Datos -->
        <div class="md:col-span-6 flex flex-col gap-3">
          <!-- Título -->
          <div>
            <label class="block text-xs font-semibold text-neutral-700 mb-1" for="cde-chart-title">
              Título del gráfico:
            </label>
            <input
              id="cde-chart-title"
              type="text"
              class="cde-modal__input w-full text-xs"
              value="${escapeXml(chartTitle)}"
              placeholder="Ej. Rendimiento Operativo y Financiero"
            />
          </div>

          <!-- Tipo de Gráfico -->
          <div>
            <span class="text-xs font-semibold text-neutral-700 block mb-1">Tipo de gráfico:</span>
            <div class="grid grid-cols-3 gap-1.5" id="cde-chart-types-grid">
              ${CHART_TYPES.map(
                (t) => `
                <button type="button" class="cde-chart-type-card p-2 rounded border text-left flex flex-col gap-1 transition-all ${
                  t.id === selectedTypeId
                    ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400 font-semibold text-blue-800'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }" data-id="${t.id}">
                  <span class="text-xs">${t.name}</span>
                </button>
              `,
              ).join('')}
            </div>
          </div>

          <!-- Tabla de Datos -->
          <div class="flex flex-col gap-2 mt-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-neutral-700">Series y valores numéricos:</span>
              <button type="button" class="cde-btn cde-btn--secondary text-xs flex items-center gap-1 py-0.5 px-2" id="cde-chart-add-row">
                ${lucideSvg(Plus, 12)} Añadir fila
              </button>
            </div>

            <div class="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1" id="cde-chart-data-list">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>

        <!-- Derecha: Paleta, Opciones y Vista previa -->
        <div class="md:col-span-6 flex flex-col gap-3">
          <span class="text-xs font-semibold text-neutral-700">Paleta de colores:</span>
          <div class="flex flex-wrap gap-2" id="cde-chart-palettes">
            ${PALETTES.map(
              (p) => `
              <button type="button" class="px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all ${
                p.id === selectedPaletteId
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500 font-semibold text-blue-800'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
              }" data-palette="${p.id}">
                <div class="flex gap-0.5">
                  ${p.colors.slice(0, 3).map((c) => `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${c}"></span>`).join('')}
                </div>
                <span>${p.name}</span>
              </button>
            `,
            ).join('')}
          </div>

          <!-- Opciones de visualización -->
          <div class="flex items-center gap-4 text-xs text-neutral-700">
            <label class="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" id="cde-chart-labels-toggle" ${showLabels ? 'checked' : ''} class="rounded border-neutral-300 text-blue-600 size-3.5" />
              <span>Mostrar valores</span>
            </label>
            <div class="flex items-center gap-2 ml-auto">
              <span>Tamaño:</span>
              <input id="cde-chart-w" type="number" min="250" max="800" value="${chartWidth}" class="cde-modal__input w-20 text-xs py-0.5" />
              <span>×</span>
              <input id="cde-chart-h" type="number" min="150" max="600" value="${chartHeight}" class="cde-modal__input w-20 text-xs py-0.5" />
            </div>
          </div>

          <!-- Vista previa -->
          <div class="mt-1">
            <span class="text-[11px] font-medium text-neutral-500 block mb-1">Vista previa en vivo:</span>
            <div class="h-48 bg-neutral-100 rounded border border-neutral-300 flex items-center justify-center p-2 overflow-hidden shadow-inner" id="cde-chart-preview-box">
              ${renderCurrentPreview()}
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-end gap-2">
        <button type="button" class="cde-btn cde-btn--secondary" id="cde-chart-cancel">Cancelar</button>
        <button type="button" class="cde-btn cde-btn--primary" id="cde-chart-insert">Insertar gráfico</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const previewBox = overlay.querySelector('#cde-chart-preview-box') as HTMLElement;
  const dataList = overlay.querySelector('#cde-chart-data-list') as HTMLElement;
  const titleInput = overlay.querySelector('#cde-chart-title') as HTMLInputElement;
  const addRowBtn = overlay.querySelector('#cde-chart-add-row') as HTMLButtonElement;
  const labelsToggle = overlay.querySelector('#cde-chart-labels-toggle') as HTMLInputElement;
  const widthInput = overlay.querySelector('#cde-chart-w') as HTMLInputElement;
  const heightInput = overlay.querySelector('#cde-chart-h') as HTMLInputElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#cde-chart-cancel') as HTMLButtonElement;
  const insertBtn = overlay.querySelector('#cde-chart-insert') as HTMLButtonElement;

  const updatePreview = () => {
    previewBox.innerHTML = renderCurrentPreview();
  };

  const renderDataRows = () => {
    dataList.innerHTML = dataPoints
      .map(
        (dp, idx) => `
      <div class="flex items-center gap-2 p-1.5 bg-neutral-50 border border-neutral-200 rounded" data-idx="${idx}">
        <input type="text" class="cde-modal__input flex-1 text-xs py-1 chart-dp-label" placeholder="Etiqueta" value="${escapeXml(dp.label)}" />
        <input type="number" class="cde-modal__input w-24 text-xs py-1 chart-dp-val" placeholder="Valor" value="${dp.value}" />
        <button type="button" class="text-neutral-400 hover:text-red-600 p-1 rounded chart-dp-del" title="Eliminar fila">
          ${lucideSvg(Trash2, 13)}
        </button>
      </div>
    `,
      )
      .join('');
  };

  renderDataRows();

  const cleanup = () => overlay.remove();

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  titleInput.addEventListener('input', () => {
    chartTitle = titleInput.value;
    updatePreview();
  });

  // Type selection
  overlay.querySelector('#cde-chart-types-grid')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cde-chart-type-card');
    if (!btn?.dataset.id) return;
    selectedTypeId = btn.dataset.id;
    overlay.querySelectorAll('.cde-chart-type-card').forEach((b) => {
      b.className =
        'cde-chart-type-card p-2 rounded border text-left flex flex-col gap-1 transition-all border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700';
    });
    btn.className =
      'cde-chart-type-card p-2 rounded border text-left flex flex-col gap-1 transition-all border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400 font-semibold text-blue-800';
    updatePreview();
  });

  // Palette selection
  overlay.querySelector('#cde-chart-palettes')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.palette) return;
    selectedPaletteId = btn.dataset.palette;
    overlay.querySelectorAll('#cde-chart-palettes button').forEach((b) => {
      b.className =
        'px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700';
    });
    btn.className =
      'px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all border-blue-600 bg-blue-50 ring-1 ring-blue-500 font-semibold text-blue-800';
    updatePreview();
  });

  labelsToggle.addEventListener('change', () => {
    showLabels = labelsToggle.checked;
    updatePreview();
  });

  addRowBtn.addEventListener('click', () => {
    dataPoints.push({ label: `Item ${dataPoints.length + 1}`, value: Math.round(Math.random() * 80 + 20) });
    renderDataRows();
    updatePreview();
  });

  dataList.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const row = target.closest<HTMLElement>('[data-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.idx ?? '0', 10);
    if (!dataPoints[idx]) return;

    if (target.classList.contains('chart-dp-label')) {
      dataPoints[idx].label = target.value;
    } else if (target.classList.contains('chart-dp-val')) {
      dataPoints[idx].value = parseFloat(target.value) || 0;
    }
    updatePreview();
  });

  dataList.addEventListener('click', (e) => {
    const delBtn = (e.target as HTMLElement).closest('.chart-dp-del');
    if (!delBtn) return;
    const row = delBtn.closest<HTMLElement>('[data-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.idx ?? '0', 10);
    if (dataPoints.length <= 1) return;
    dataPoints.splice(idx, 1);
    renderDataRows();
    updatePreview();
  });

  widthInput.addEventListener('input', () => {
    const v = parseInt(widthInput.value, 10);
    if (v > 0) {
      chartWidth = v;
      updatePreview();
    }
  });

  heightInput.addEventListener('input', () => {
    const v = parseInt(heightInput.value, 10);
    if (v > 0) {
      chartHeight = v;
      updatePreview();
    }
  });

  insertBtn.addEventListener('click', () => {
    const svgCode = renderCurrentPreview();
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgCode)}`;
    const t = getChartType();

    editor
      .chain()
      .focus()
      .setImage({
        src: dataUri,
        alt: `Gráfico: ${chartTitle || t.name}`,
        width: chartWidth,
        height: chartHeight,
        alignment: 'center',
      })
      .run();

    cleanup();
  });
}

import type { Editor } from '@tiptap/core';
import { lucideSvg, ChartColumn, Plus, Trash2 } from '../icons';
import { svgToDataUri, insertImage, escapeXml } from './imageFromUri';

// ---------------------------------------------------------------------------
// ECharts (tree-shaken + SVG renderer) — vector output, professional quality
// ---------------------------------------------------------------------------
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  FunnelChart,
  GaugeChart,
  TreemapChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  FunnelChart,
  GaugeChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  SVGRenderer,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartTypeDefinition {
  id: string;
  name: string;
  category: 'barras' | 'líneas' | 'circulares' | 'avanzados';
  /** Build an ECharts option from the modal state. */
  buildOption: (
    title: string,
    data: ChartDataPoint[],
    colors: string[],
    showLegend: boolean,
    showLabels: boolean,
  ) => echarts.EChartsCoreOption;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

export const PALETTES = [
  { id: 'blue', name: 'Azul Corporativo', colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1d4ed8', '#38bdf8'] },
  { id: 'emerald', name: 'Esmeralda Finanzas', colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#047857', '#22d3ee'] },
  { id: 'warm', name: 'Atardecer Cálido', colors: ['#dc2626', '#ea580c', '#f59e0b', '#fbbf24', '#fde68a', '#b91c1c', '#f97316'] },
  { id: 'purple', name: 'Púrpura Tecnológico', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e9d5ff', '#6d28d9', '#d946ef'] },
  { id: 'slate', name: 'Titanio Profesional', colors: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#1e293b', '#475569'] },
  { id: 'neon', name: 'Neón Moderno', colors: ['#0284c7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'] },
];

// ---------------------------------------------------------------------------
// Chart type definitions (12+)
// ---------------------------------------------------------------------------

export const CHART_TYPES: ChartTypeDefinition[] = [
  {
    id: 'column',
    name: 'Columnas',
    category: 'barras',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'axis' },
      color: colors,
      xAxis: { type: 'category', data: data.map((d) => d.label), axisLine: { lineStyle: { color: '#cbd5e1' } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } },
      series: [{
        type: 'bar',
        data: data.map((d) => d.value),
        barMaxWidth: 48,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: { show: showLabels, position: 'top', fontWeight: 700, color: '#1e293b' },
      }],
    }),
  },
  {
    id: 'bar',
    name: 'Barras horizontales',
    category: 'barras',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'axis' },
      color: colors,
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } },
      yAxis: { type: 'category', data: data.map((d) => d.label), axisLine: { lineStyle: { color: '#cbd5e1' } } },
      series: [{
        type: 'bar',
        data: data.map((d) => d.value),
        barMaxWidth: 28,
        itemStyle: { borderRadius: [0, 6, 6, 0] },
        label: { show: showLabels, position: 'right', fontWeight: 700, color: '#1e293b' },
      }],
    }),
  },
  {
    id: 'stacked',
    name: 'Columnas apiladas',
    category: 'barras',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'axis' },
      color: colors,
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.value),
        itemStyle: { borderRadius: [0, 0, 0, 0] },
        label: { show: showLabels, position: 'inside', color: '#fff', fontWeight: 700 },
      }, {
        type: 'bar',
        stack: 'total',
        data: data.map((d) => Math.round(d.value * 0.35)),
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: { show: showLabels, position: 'inside', color: '#fff', fontWeight: 700 },
      }],
    }),
  },
  {
    id: 'line',
    name: 'Líneas',
    category: 'líneas',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'axis' },
      color: colors,
      xAxis: { type: 'category', data: data.map((d) => d.label), boundaryGap: false },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: data.map((d) => d.value),
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3 },
        label: { show: showLabels, position: 'top', fontWeight: 700, color: '#1e293b' },
      }],
    }),
  },
  {
    id: 'area',
    name: 'Área suave',
    category: 'líneas',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'axis' },
      color: colors,
      xAxis: { type: 'category', data: data.map((d) => d.label), boundaryGap: false },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: data.map((d) => d.value),
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.25 },
        label: { show: showLabels, position: 'top', fontWeight: 700, color: '#1e293b' },
      }],
    }),
  },
  {
    id: 'multiLine',
    name: 'Multilínea',
    category: 'líneas',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'axis' },
      color: colors,
      xAxis: { type: 'category', data: data.map((d) => d.label), boundaryGap: false },
      yAxis: { type: 'value' },
      series: [0, 1, 2].map((s) => ({
        name: `Serie ${s + 1}`,
        type: 'line' as const,
        data: data.map((d, i) => Math.round(d.value * (1 + s * 0.18) * (1 + Math.sin(i + s) * 0.12))),
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        label: { show: showLabels && s === 0, position: 'top', fontWeight: 700, color: '#1e293b' },
      })),
    }),
  },
  {
    id: 'pie',
    name: 'Pastel',
    category: 'circulares',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0, type: 'scroll' } } : {}),
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      color: colors,
      series: [{
        type: 'pie',
        radius: ['0%', '62%'],
        center: ['50%', '48%'],
        data: data.map((d) => ({ name: d.label, value: d.value })),
        label: { show: showLabels, formatter: '{b}\n{d}%', fontWeight: 600 },
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      }],
    }),
  },
  {
    id: 'donut',
    name: 'Dona',
    category: 'circulares',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0, type: 'scroll' } } : {}),
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      color: colors,
      series: [{
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '48%'],
        data: data.map((d) => ({ name: d.label, value: d.value })),
        label: { show: showLabels, formatter: '{b}\n{d}%', fontWeight: 600 },
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
      }],
    }),
  },
  {
    id: 'rose',
    name: 'Rosa polar',
    category: 'circulares',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'item' },
      color: colors,
      series: [{
        type: 'pie',
        roseType: 'area',
        radius: ['18%', '68%'],
        center: ['50%', '48%'],
        data: data.map((d) => ({ name: d.label, value: d.value })),
        label: { show: showLabels, fontWeight: 600 },
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      }],
    }),
  },
  {
    id: 'scatter',
    name: 'Dispersión',
    category: 'avanzados',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'item' },
      color: colors,
      xAxis: { type: 'value', name: 'X', splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } },
      yAxis: { type: 'value', name: 'Y', splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } },
      series: [{
        type: 'scatter',
        data: data.map((d, i) => [i + 1, d.value]),
        symbolSize: 16,
        itemStyle: { opacity: 0.8 },
        label: { show: showLabels, formatter: (p: any) => data[p.dataIndex]?.label ?? '', position: 'top', fontWeight: 600 },
      }],
    }),
  },
  {
    id: 'radar',
    name: 'Radar',
    category: 'avanzados',
    buildOption: (title, data, colors, showLegend, showLabels) => {
      const max = Math.max(...data.map((d) => d.value), 10) * 1.15;
      return {
        ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
        ...(showLegend ? { legend: { bottom: 0 } } : {}),
        tooltip: { trigger: 'item' },
        color: colors,
        radar: {
          indicator: data.map((d) => ({ name: d.label, max })),
          radius: '62%',
          splitLine: { lineStyle: { color: '#e2e8f0' } },
          splitArea: { areaStyle: { color: ['#f8fafc', '#fff'] } },
          axisLine: { lineStyle: { color: '#cbd5e1' } },
        },
        series: [{
          type: 'radar',
          data: [{
            name: title || 'Serie',
            value: data.map((d) => d.value),
            areaStyle: { opacity: 0.22 },
            lineStyle: { width: 2.5 },
            symbolSize: 7,
            label: { show: showLabels, fontWeight: 700, color: '#1e293b' },
          }],
        }],
      };
    },
  },
  {
    id: 'funnel',
    name: 'Embudo',
    category: 'avanzados',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      color: colors,
      series: [{
        type: 'funnel',
        left: '12%',
        width: '76%',
        minSize: '12%',
        sort: 'descending',
        gap: 3,
        data: [...data].sort((a, b) => b.value - a.value).map((d) => ({ name: d.label, value: d.value })),
        label: { show: showLabels, position: 'inside', fontWeight: 700, color: '#fff' },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
      }],
    }),
  },
  {
    id: 'gauge',
    name: 'Medidor',
    category: 'avanzados',
    buildOption: (title, data, colors, _showLegend, showLabels) => {
      const val = data.reduce((s, d) => s + d.value, 0);
      const avg = data.length ? Math.round(val / data.length) : 0;
      const max = Math.max(...data.map((d) => d.value), 10) * 1.2;
      return {
        ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
        tooltip: { formatter: '{a} <br/>{b} : {c}' },
        series: [{
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max,
          progress: { show: true, width: 18, itemStyle: { color: colors[0] } },
          axisLine: { lineStyle: { width: 18, color: [[1, '#e2e8f0']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: true, length: '58%', width: 5, itemStyle: { color: '#0f172a' } },
          detail: { fontSize: 28, fontWeight: 800, color: '#0f172a', formatter: String(avg), offsetCenter: [0, '62%'] },
          title: { show: showLabels, offsetCenter: [0, '82%'], color: '#64748b', fontSize: 13 },
          data: [{ name: 'Media', value: avg }],
        }],
      };
    },
  },
  {
    id: 'treemap',
    name: 'Mapa de árbol',
    category: 'avanzados',
    buildOption: (title, data, colors, showLegend, showLabels) => ({
      ...(title ? { title: { text: title, left: 'center', textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a' } } } : {}),
      ...(showLegend ? { legend: { bottom: 0 } } : {}),
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      color: colors,
      series: [{
        type: 'treemap',
        data: data.map((d, i) => ({ name: d.label, value: d.value, itemStyle: { color: colors[i % colors.length] } })),
        label: { show: showLabels, formatter: '{b}\n{c}', fontWeight: 700, color: '#fff', fontSize: 13 },
        itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
        breadcrumb: { show: false },
      }],
    }),
  },
];

// ---------------------------------------------------------------------------
// ECharts → SVG data URI
// ---------------------------------------------------------------------------

export function echartsToSvgDataUri(option: echarts.EChartsCoreOption, width = 800, height = 500): string {
  const host = document.createElement('div');
  host.style.cssText = `width:${width}px;height:${height}px;position:absolute;left:-99999px;top:0;`;
  document.body.appendChild(host);
  try {
    const chart = echarts.init(host, undefined, { renderer: 'svg', width, height });
    chart.setOption(option);
    const svg = host.querySelector('svg');
    if (!svg) return '';
    // Ensure explicit size attrs so TipTap/CustomImage can size the node
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    const markup = new XMLSerializer().serializeToString(svg);
    chart.dispose();
    return svgToDataUri(markup);
  } finally {
    host.remove();
  }
}

function buildOptionFor(
  type: ChartTypeDefinition,
  title: string,
  data: ChartDataPoint[],
  colors: string[],
  showLegend: boolean,
  showLabels: boolean,
): echarts.EChartsCoreOption {
  return type.buildOption(title, data, colors, showLegend, showLabels);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function openChartModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let chartTitle = 'Rendimiento Trimestral';
  let selectedTypeId = 'column';
  let selectedPaletteId = 'blue';
  let chartWidth = 720;
  let chartHeight = 420;
  let showLegend = true;
  let showLabels = true;

  let dataPoints: ChartDataPoint[] = [
    { label: 'Q1', value: 45 },
    { label: 'Q2', value: 72 },
    { label: 'Q3', value: 89 },
    { label: 'Q4', value: 110 },
  ];

  const getChartType = () => CHART_TYPES.find((t) => t.id === selectedTypeId) ?? CHART_TYPES[0];
  const getPalette = () => PALETTES.find((p) => p.id === selectedPaletteId) ?? PALETTES[0];

  /** Mini SVG thumbnail for each chart type card (simplified, no echarts). */
  const typeThumb = (id: string, active: boolean): string => {
    const stroke = active ? '#2563eb' : '#64748b';
    const fill = active ? '#93c5fd' : '#cbd5e1';
    const inner = (() => {
      switch (id) {
        case 'column':
        case 'stacked':
          return `<rect x="4" y="16" width="6" height="12" fill="${fill}" rx="1"/><rect x="13" y="10" width="6" height="18" fill="${stroke}" rx="1"/><rect x="22" y="6" width="6" height="22" fill="${fill}" rx="1"/>`;
        case 'bar':
          return `<rect x="4" y="6" width="18" height="5" fill="${fill}" rx="1"/><rect x="4" y="14" width="24" height="5" fill="${stroke}" rx="1"/><rect x="4" y="22" width="12" height="5" fill="${fill}" rx="1"/>`;
        case 'line':
        case 'area':
        case 'multiLine':
          return `<polyline points="4,22 12,12 20,16 28,6" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
        case 'pie':
          return `<circle cx="16" cy="16" r="11" fill="${stroke}"/><path d="M16 16 L16 5 A11 11 0 0 1 25 20 Z" fill="${fill}"/>`;
        case 'donut':
          return `<circle cx="16" cy="16" r="11" fill="none" stroke="${stroke}" stroke-width="5"/><circle cx="16" cy="16" r="11" fill="none" stroke="${fill}" stroke-width="5" stroke-dasharray="18 52"/>`;
        case 'rose':
          return `<circle cx="16" cy="16" r="4" fill="${stroke}"/><circle cx="16" cy="16" r="9" fill="none" stroke="${fill}" stroke-width="4"/><circle cx="16" cy="16" r="13" fill="none" stroke="${stroke}" stroke-width="3"/>`;
        case 'scatter':
          return `<circle cx="8" cy="22" r="3" fill="${stroke}"/><circle cx="16" cy="12" r="3" fill="${fill}"/><circle cx="24" cy="18" r="3" fill="${stroke}"/><circle cx="12" cy="8" r="3" fill="${fill}"/>`;
        case 'radar':
          return `<polygon points="16,4 26,12 22,26 10,26 6,12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
        case 'funnel':
          return `<polygon points="4,6 28,6 22,16 10,16" fill="${stroke}"/><polygon points="10,18 22,18 18,28 14,28" fill="${fill}"/>`;
        case 'gauge':
          return `<path d="M6 22 A11 11 0 1 1 26 22" fill="none" stroke="${fill}" stroke-width="3"/><line x1="16" y1="16" x2="22" y2="10" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
        case 'treemap':
          return `<rect x="4" y="6" width="12" height="10" fill="${stroke}" rx="1"/><rect x="18" y="6" width="10" height="16" fill="${fill}" rx="1"/><rect x="4" y="18" width="12" height="10" fill="${fill}" rx="1"/>`;
        default:
          return `<rect x="6" y="8" width="20" height="16" fill="${fill}" rx="2"/>`;
      }
    })();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">${inner}</svg>`;
  };

  const renderCurrentSvg = (): string => {
    const t = getChartType();
    const p = getPalette();
    return echartsToSvgDataUri(
      buildOptionFor(t, chartTitle, dataPoints, p.colors, showLegend, showLabels),
      chartWidth,
      chartHeight,
    );
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(ChartColumn, 18)}</span>
          <h2 class="cde-modal__title">Insertar gráfico estadístico</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body">
        <div class="cde-modal-cols">
          <!-- Izquierda -->
          <div class="cde-modal-col">
            <div>
              <label class="cde-field-label" for="cde-chart-title">Título del gráfico</label>
              <input id="cde-chart-title" type="text" class="cde-modal__input" value="${escapeXml(chartTitle)}" placeholder="Ej. Rendimiento Trimestral" />
            </div>

            <div>
              <span class="cde-field-label">Tipo de gráfico</span>
              <div class="cde-grid cde-grid--types" id="cde-chart-types-grid">
                ${CHART_TYPES.map((t) => {
                  const active = t.id === selectedTypeId;
                  return `
                  <button type="button" class="cde-pick-card ${active ? 'is-active' : ''}" data-id="${t.id}">
                    ${typeThumb(t.id, active)}
                    <span class="text-xs font-medium text-neutral-700 leading-tight">${t.name}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="cde-field-label mb-0">Datos</span>
                <button type="button" class="cde-btn cde-btn--secondary text-xs py-1 px-2.5" id="cde-chart-add-row">
                  ${lucideSvg(Plus, 13)} Añadir fila
                </button>
              </div>
              <div class="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1" id="cde-chart-data-list"></div>
            </div>
          </div>

          <!-- Derecha -->
          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Paleta de colores</span>
              <div class="flex flex-wrap gap-2" id="cde-chart-palettes">
                ${PALETTES.map((p) => `
                  <button type="button" class="cde-chip ${p.id === selectedPaletteId ? 'is-active' : ''}" data-palette="${p.id}">
                    <span class="flex gap-0.5">
                      ${p.colors.slice(0, 4).map((c) => `<span class="w-2 h-2 rounded-full" style="background:${c}"></span>`).join('')}
                    </span>
                    <span>${p.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="flex items-center gap-5 flex-wrap">
              <label class="cde-check">
                <input type="checkbox" id="cde-chart-labels-toggle" ${showLabels ? 'checked' : ''} />
                <span>Mostrar valores</span>
              </label>
              <label class="cde-check">
                <input type="checkbox" id="cde-chart-legend-toggle" ${showLegend ? 'checked' : ''} />
                <span>Mostrar leyenda</span>
              </label>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-1">
                <span class="cde-field-label mb-0">Ancho</span>
                <input id="cde-chart-w" type="number" min="320" max="1200" value="${chartWidth}" class="cde-modal__input w-24" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="cde-field-label mb-0">Alto</span>
                <input id="cde-chart-h" type="number" min="200" max="800" value="${chartHeight}" class="cde-modal__input w-24" />
              </div>
            </div>

            <div class="flex-1 min-h-0">
              <span class="cde-field-label">Vista previa en vivo</span>
              <div class="cde-preview-box h-full min-h-[16rem]" id="cde-chart-preview-box"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer">
        <span class="text-xs text-neutral-400">Se insertará como imagen vectorial SVG</span>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="cde-chart-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="cde-chart-insert">Insertar gráfico</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const previewBox = overlay.querySelector('#cde-chart-preview-box') as HTMLElement;
  const dataList = overlay.querySelector('#cde-chart-data-list') as HTMLElement;
  const titleInput = overlay.querySelector('#cde-chart-title') as HTMLInputElement;

  let previewTimer: number | undefined;
  const schedulePreview = () => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      previewBox.innerHTML = `<img alt="Vista previa del gráfico" src="${renderCurrentSvg()}" />`;
    }, 180);
  };

  const renderDataList = () => {
    dataList.innerHTML = dataPoints
      .map(
        (d, i) => `
        <div class="cde-data-row" data-index="${i}">
          <input type="text" class="cde-modal__input flex-1" data-field="label" value="${escapeXml(d.label)}" placeholder="Etiqueta" />
          <input type="number" class="cde-modal__input w-24" data-field="value" value="${d.value}" />
          <button type="button" class="text-neutral-400 hover:text-red-500 p-1 rounded transition-colors" data-remove="${i}" title="Eliminar fila">
            ${lucideSvg(Trash2, 14)}
          </button>
        </div>`,
      )
      .join('');
  };

  renderDataList();
  schedulePreview();

  // --- events ---
  titleInput.addEventListener('input', () => {
    chartTitle = titleInput.value;
    schedulePreview();
  });

  dataList.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const row = target.closest('[data-index]') as HTMLElement | null;
    if (!row) return;
    const idx = Number(row.dataset.index);
    const field = target.dataset.field;
    if (field === 'label') dataPoints[idx].label = target.value;
    if (field === 'value') dataPoints[idx].value = Number(target.value) || 0;
    schedulePreview();
  });

  dataList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-remove]') as HTMLElement | null;
    if (!btn) return;
    const idx = Number(btn.dataset.remove);
    if (dataPoints.length <= 1) return;
    dataPoints.splice(idx, 1);
    renderDataList();
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-add-row')!.addEventListener('click', () => {
    // Default value = last value (or 0) — never random
    const last = dataPoints[dataPoints.length - 1];
    dataPoints.push({ label: `Item ${dataPoints.length + 1}`, value: last ? last.value : 0 });
    renderDataList();
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-types-grid')!.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null;
    if (!card) return;
    selectedTypeId = card.dataset.id!;
    overlay.querySelectorAll('.cde-pick-card').forEach((el) => {
      const id = (el as HTMLElement).dataset.id;
      const active = id === selectedTypeId;
      el.className = `cde-pick-card ${active ? 'is-active' : ''}`;
      const thumb = el.querySelector('svg');
      if (thumb) thumb.outerHTML = typeThumb(id!, active);
    });
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-palettes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-palette]') as HTMLElement | null;
    if (!btn) return;
    selectedPaletteId = btn.dataset.palette!;
    overlay.querySelectorAll('#cde-chart-palettes > button').forEach((el) => {
      const id = (el as HTMLElement).dataset.palette;
      el.className = `cde-chip ${id === selectedPaletteId ? 'is-active' : ''}`;
    });
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-labels-toggle')!.addEventListener('change', (e) => {
    showLabels = (e.target as HTMLInputElement).checked;
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-legend-toggle')!.addEventListener('change', (e) => {
    showLegend = (e.target as HTMLInputElement).checked;
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-w')!.addEventListener('change', (e) => {
    chartWidth = Math.min(1200, Math.max(320, Number((e.target as HTMLInputElement).value) || 720));
    schedulePreview();
  });

  overlay.querySelector('#cde-chart-h')!.addEventListener('change', (e) => {
    chartHeight = Math.min(800, Math.max(200, Number((e.target as HTMLInputElement).value) || 420));
    schedulePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#cde-chart-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  overlay.querySelector('#cde-chart-insert')!.addEventListener('click', () => {
    const t = getChartType();
    const p = getPalette();
    const src = echartsToSvgDataUri(
      buildOptionFor(t, chartTitle, dataPoints, p.colors, showLegend, showLabels),
      chartWidth,
      chartHeight,
    );
    if (!src) return;
    insertImage(editor, src, {
      alt: `Gráfico: ${chartTitle || t.name}`,
      width: chartWidth / 2,
      height: chartHeight / 2,
    });
    close();
  });
}

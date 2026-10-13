import type { Editor } from '@tiptap/core';
import { lucideSvg, Workflow, Plus, Trash2, ChevronDown } from '../icons';
import { svgToDataUri, insertImage, escapeXml, wrapText } from './imageFromUri';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartArtItem {
  id: string;
  title: string;
  desc: string;
}

export interface SmartArtTemplate {
  id: string;
  name: string;
  category: 'process' | 'hierarchy' | 'cycle' | 'pyramid' | 'list';
  renderSvg: (items: SmartArtItem[], palette: string[], width: number, height: number) => string;
  /** Small thumbnail SVG for the template card. */
  thumb: string;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

export const PALETTES = [
  { id: 'blue', name: 'Azul Office', colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8'] },
  { id: 'emerald', name: 'Esmeralda', colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#047857'] },
  { id: 'purple', name: 'Púrpura', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#6d28d9'] },
  { id: 'warm', name: 'Atardecer', colors: ['#dc2626', '#ea580c', '#d97706', '#f59e0b', '#b91c1c'] },
  { id: 'corporate', name: 'Multicolor', colors: ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'] },
  { id: 'slate', name: 'Profesional', colors: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#1e293b'] },
];

// ---------------------------------------------------------------------------
// Text helpers (wrap)
// ---------------------------------------------------------------------------

function textLines(
  lines: string[],
  x: number,
  y: number,
  opts: { fill?: string; size: number; weight?: number; anchor?: string } = { size: 12 },
): string {
  const { fill = '#ffffff', size, weight = 700, anchor = 'middle' } = opts;
  const lh = size * 1.25;
  const startY = y - ((lines.length - 1) * lh) / 2;
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${startY + i * lh}" fill="${fill}" font-family="system-ui, -apple-system, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(l)}</text>`,
    )
    .join('');
}

function wrapItem(item: SmartArtItem, maxChars: number): { title: string[]; desc: string[] } {
  return {
    title: wrapText(item.title, maxChars, 2),
    desc: item.desc ? wrapText(item.desc, maxChars + 2, 2) : [],
  };
}

// ---------------------------------------------------------------------------
// Template thumbnails (small, decorative)
// ---------------------------------------------------------------------------

const THUMBS: Record<string, string> = {
  'chevron-process':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><polygon points="2,10 28,10 38,20 28,30 2,30 12,20" fill="#2563eb"/><polygon points="30,10 56,10 66,20 56,30 30,30 40,20" fill="#60a5fa"/><polygon points="58,10 78,10 78,30 58,30 68,20" fill="#93c5fd"/></svg>`,
  'timeline-process':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><line x1="10" y1="20" x2="70" y2="20" stroke="#94a3b8" stroke-width="3"/><circle cx="16" cy="20" r="6" fill="#2563eb"/><circle cx="40" cy="20" r="6" fill="#60a5fa"/><circle cx="64" cy="20" r="6" fill="#93c5fd"/></svg>`,
  'hierarchy-org':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><rect x="30" y="4" width="20" height="10" rx="2" fill="#2563eb"/><rect x="8" y="26" width="16" height="10" rx="2" fill="#60a5fa"/><rect x="32" y="26" width="16" height="10" rx="2" fill="#60a5fa"/><rect x="56" y="26" width="16" height="10" rx="2" fill="#60a5fa"/><line x1="40" y1="14" x2="40" y2="20" stroke="#94a3b8" stroke-width="2"/><line x1="16" y1="20" x2="64" y2="20" stroke="#94a3b8" stroke-width="2"/><line x1="16" y1="20" x2="16" y2="26" stroke="#94a3b8" stroke-width="2"/><line x1="40" y1="20" x2="40" y2="26" stroke="#94a3b8" stroke-width="2"/><line x1="64" y1="20" x2="64" y2="26" stroke="#94a3b8" stroke-width="2"/></svg>`,
  'circular-cycle':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><circle cx="40" cy="20" r="14" fill="none" stroke="#93c5fd" stroke-width="4"/><circle cx="40" cy="6" r="5" fill="#2563eb"/><circle cx="54" cy="20" r="5" fill="#60a5fa"/><circle cx="40" cy="34" r="5" fill="#93c5fd"/><circle cx="26" cy="20" r="5" fill="#3b82f6"/></svg>`,
  'stepped-pyramid':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><polygon points="40,4 52,16 28,16" fill="#2563eb"/><polygon points="26,18 54,18 62,28 18,28" fill="#60a5fa"/><polygon points="16,30 64,30 72,38 8,38" fill="#93c5fd"/></svg>`,
  'process-list':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><rect x="10" y="6" width="60" height="8" rx="2" fill="#2563eb"/><rect x="10" y="18" width="60" height="8" rx="2" fill="#60a5fa"/><rect x="10" y="30" width="60" height="8" rx="2" fill="#93c5fd"/></svg>`,
  'horizontal-funnel':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><polygon points="6,6 74,6 60,18 20,18" fill="#2563eb"/><polygon points="20,20 60,20 50,30 30,30" fill="#60a5fa"/><rect x="32" y="32" width="16" height="6" rx="2" fill="#93c5fd"/></svg>`,
  'matrix-2x2':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><rect x="10" y="4" width="28" height="14" rx="2" fill="#2563eb"/><rect x="42" y="4" width="28" height="14" rx="2" fill="#60a5fa"/><rect x="10" y="22" width="28" height="14" rx="2" fill="#93c5fd"/><rect x="42" y="22" width="28" height="14" rx="2" fill="#3b82f6"/></svg>`,
};

// ---------------------------------------------------------------------------
// Templates (8)
// ---------------------------------------------------------------------------

export const SMART_ART_TEMPLATES: SmartArtTemplate[] = [
  {
    id: 'chevron-process',
    name: 'Proceso de flechas',
    category: 'process',
    thumb: THUMBS['chevron-process'],
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const stepW = width / count;
      const notch = Math.min(28, stepW * 0.18);
      const fs = Math.max(10, Math.min(15, stepW * 0.09));
      const paths = items
        .map((item, i) => {
          const c = colors[i % colors.length];
          const x0 = i * stepW;
          const x1 = (i + 1) * stepW;
          const ln = i === 0 ? 0 : notch;
          const rn = i === count - 1 ? 0 : notch;
          const d = `M ${x0},0 L ${x1 - rn},0 ${rn ? `L ${x1},${height / 2} L ${x1 - rn},${height}` : `L ${x1},${height}`} L ${x0},${height} ${ln ? `L ${x0 + ln},${height / 2}` : ''} Z`;
          const { title, desc } = wrapItem(item, 11);
          const cx = x0 + stepW / 2;
          return `<g>
            <path d="${d}" fill="${c}" stroke="#ffffff" stroke-width="2" />
            ${textLines(title, cx, height * 0.36, { size: fs, fill: '#ffffff', weight: 700 })}
            ${desc.length ? textLines(desc, cx, height * 0.62, { size: fs * 0.72, fill: 'rgba(255,255,255,0.88)', weight: 500 }) : ''}
          </g>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}</svg>`;
    },
  },
  {
    id: 'timeline-process',
    name: 'Línea de tiempo',
    category: 'process',
    thumb: THUMBS['timeline-process'],
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const pad = 40;
      const stepW = (width - pad * 2) / Math.max(1, count - 1);
      const y = height / 2;
      const fs = Math.max(10, Math.min(13, stepW * 0.1));
      const line = `<line x1="${pad}" y1="${y}" x2="${width - pad}" y2="${y}" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round" />`;
      const nodes = items
        .map((item, i) => {
          const cx = pad + i * stepW;
          const c = colors[i % colors.length];
          const { title, desc } = wrapItem(item, 12);
          return `<g>
            <circle cx="${cx}" cy="${y}" r="11" fill="${c}" stroke="#ffffff" stroke-width="3" />
            <circle cx="${cx}" cy="${y}" r="4" fill="#ffffff" />
            ${textLines(title, cx, y - 34, { size: fs, fill: '#0f172a', weight: 700 })}
            ${desc.length ? textLines(desc, cx, y + 34, { size: fs * 0.8, fill: '#64748b', weight: 500 }) : ''}
          </g>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${line}${nodes}</svg>`;
    },
  },
  {
    id: 'hierarchy-org',
    name: 'Jerarquía / Organigrama',
    category: 'hierarchy',
    thumb: THUMBS['hierarchy-org'],
    renderSvg: (items, colors, width, height) => {
      const root = items[0];
      const rest = items.slice(1);
      const rootW = Math.min(180, width * 0.32);
      const rootH = 44;
      const rootX = (width - rootW) / 2;
      const rootY = 8;
      const fs = 11;
      const childW = Math.min(130, (width - 24) / Math.max(1, rest.length) - 8);
      const childH = 36;
      const childY = height * 0.58;

      let connectors = '';
      const children = rest
        .map((item, i) => {
          const n = rest.length;
          const totalW = n * childW + (n - 1) * 10;
          const startX = (width - totalW) / 2;
          const cx = startX + i * (childW + 10) + childW / 2;
          const c = colors[(i + 1) % colors.length];
          connectors += `<line x1="${cx}" y1="${rootY + rootH + 6}" x2="${cx}" y2="${childY - 6}" stroke="#94a3b8" stroke-width="2" />`;
          const { title } = wrapItem(item, 12);
          return `<g>
            <rect x="${cx - childW / 2}" y="${childY}" width="${childW}" height="${childH}" rx="6" fill="${c}" stroke="#ffffff" stroke-width="2" />
            ${textLines(title, cx, childY + childH / 2, { size: fs, fill: '#ffffff', weight: 600 })}
          </g>`;
        })
        .join('');

      const midY = rootY + rootH + 6 + (childY - rootY - rootH - 12) / 2;
      const firstCx = rest.length
        ? (width - (rest.length * childW + (rest.length - 1) * 10)) / 2 + childW / 2
        : width / 2;
      const lastCx = rest.length
        ? (width - (rest.length * childW + (rest.length - 1) * 10)) / 2 + (rest.length - 1) * (childW + 10) + childW / 2
        : width / 2;
      const bus = rest.length
        ? `<line x1="${firstCx}" y1="${midY}" x2="${lastCx}" y2="${midY}" stroke="#94a3b8" stroke-width="2" />`
        : '';
      const rootConnect = `<line x1="${width / 2}" y1="${rootY + rootH}" x2="${width / 2}" y2="${midY}" stroke="#94a3b8" stroke-width="2" />`;

      const rootTitle = wrapItem(root, 14).title;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect x="${rootX}" y="${rootY}" width="${rootW}" height="${rootH}" rx="8" fill="${colors[0]}" stroke="#ffffff" stroke-width="2" />
        ${textLines(rootTitle, width / 2, rootY + rootH / 2, { size: fs + 1, fill: '#ffffff', weight: 700 })}
        ${rootConnect}${bus}${connectors}${children}
      </svg>`;
    },
  },
  {
    id: 'circular-cycle',
    name: 'Ciclo circular',
    category: 'cycle',
    thumb: THUMBS['circular-cycle'],
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.32;
      const nodeR = Math.min(width, height) * 0.11;
      const fs = 10;
      // arc arrows between nodes
      const nodes = items
        .map((item, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const nx = cx + R * Math.cos(angle);
          const ny = cy + R * Math.sin(angle);
          const c = colors[i % colors.length];
          const { title } = wrapItem(item, 8);
          return `<g>
            <circle cx="${nx}" cy="${ny}" r="${nodeR}" fill="${c}" stroke="#ffffff" stroke-width="3" />
            ${textLines(title, nx, ny, { size: fs, fill: '#ffffff', weight: 700 })}
          </g>`;
        })
        .join('');
      // ring
      const ring = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-dasharray="6 6" />`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${ring}${nodes}</svg>`;
    },
  },
  {
    id: 'stepped-pyramid',
    name: 'Pirámide escalonada',
    category: 'pyramid',
    thumb: THUMBS['stepped-pyramid'],
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const layerH = height / count;
      const fs = 11;
      // draw from top (last item) to bottom (first item)
      const layers = items
        .map((item, i) => {
          // i=0 at bottom (widest)
          const level = count - 1 - i;
          const y1 = level * layerH;
          const y2 = y1 + layerH - 3;
          const w1 = ((level + 1) / count) * width * 0.86;
          const w2 = ((level + 2) / count) * width * 0.86;
          const x1 = (width - w1) / 2;
          const x2 = (width - w2) / 2;
          const c = colors[i % colors.length];
          const { title } = wrapItem(item, 16);
          return `<g>
            <polygon points="${x1},${y1} ${x1 + w1},${y1} ${x2 + w2},${y2} ${x2},${y2}" fill="${c}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
            ${textLines(title, width / 2, (y1 + y2) / 2, { size: fs, fill: '#ffffff', weight: 700 })}
          </g>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${layers}</svg>`;
    },
  },
  {
    id: 'process-list',
    name: 'Lista de proceso',
    category: 'list',
    thumb: THUMBS['process-list'],
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const rowH = height / count;
      const fs = 12;
      const rows = items
        .map((item, i) => {
          const y = i * rowH;
          const c = colors[i % colors.length];
          const { title, desc } = wrapItem(item, 22);
          return `<g>
            <rect x="8" y="${y + 4}" width="${width - 16}" height="${rowH - 8}" rx="6" fill="${c}" stroke="#ffffff" stroke-width="2" />
            <rect x="8" y="${y + 4}" width="6" height="${rowH - 8}" rx="3" fill="rgba(255,255,255,0.35)" />
            ${textLines(title, 22, y + rowH * 0.36, { size: fs, fill: '#ffffff', weight: 700, anchor: 'start' })}
            ${desc.length ? textLines(desc, 22, y + rowH * 0.68, { size: fs * 0.78, fill: 'rgba(255,255,255,0.85)', weight: 500, anchor: 'start' }) : ''}
          </g>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rows}</svg>`;
    },
  },
  {
    id: 'horizontal-funnel',
    name: 'Embudo horizontal',
    category: 'process',
    thumb: THUMBS['horizontal-funnel'],
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const rowH = height / count;
      const fs = 11;
      const rows = items
        .map((item, i) => {
          const y = i * rowH;
          const c = colors[i % colors.length];
          const inset = i * (width * 0.08);
          const w = width - inset * 2 - 16;
          const x = 8 + inset;
          const { title } = wrapItem(item, 18);
          return `<g>
            <rect x="${x}" y="${y + 5}" width="${w}" height="${rowH - 10}" rx="5" fill="${c}" stroke="#ffffff" stroke-width="2" />
            ${textLines(title, x + w / 2, y + rowH / 2, { size: fs, fill: '#ffffff', weight: 700 })}
          </g>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rows}</svg>`;
    },
  },
  {
    id: 'matrix-2x2',
    name: 'Matriz 2×2',
    category: 'list',
    thumb: THUMBS['matrix-2x2'],
    renderSvg: (items, colors, width, height) => {
      const cells = items.slice(0, 4);
      const pad = 10;
      const cellW = (width - pad * 3) / 2;
      const cellH = (height - pad * 3) / 2;
      const fs = 11;
      const rects = cells
        .map((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = pad + col * (cellW + pad);
          const y = pad + row * (cellH + pad);
          const c = colors[i % colors.length];
          const { title, desc } = wrapItem(item, 14);
          return `<g>
            <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" fill="${c}" stroke="#ffffff" stroke-width="2" />
            ${textLines(title, x + cellW / 2, y + cellH * 0.38, { size: fs, fill: '#ffffff', weight: 700 })}
            ${desc.length ? textLines(desc, x + cellW / 2, y + cellH * 0.68, { size: fs * 0.8, fill: 'rgba(255,255,255,0.88)', weight: 500 }) : ''}
          </g>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rects}</svg>`;
    },
  },
];

// ---------------------------------------------------------------------------
// Mermaid (lazy)
// ---------------------------------------------------------------------------

let mermaidPromise: Promise<any> | null = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = (m as any).default ?? m;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        fontFamily: 'Inter, system-ui, sans-serif',
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export async function mermaidToSvgDataUri(code: string): Promise<string> {
  const mermaid = await getMermaid();
  const { svg } = await mermaid.render('mmd-' + Math.random().toString(36).slice(2), code);
  return svgToDataUri(svg);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todas',
  process: 'Proceso',
  hierarchy: 'Jerarquía',
  cycle: 'Ciclo',
  pyramid: 'Pirámide',
  list: 'Listas',
};

const MERMAID_SNIPPETS = [
  { id: 'flowchart', name: 'Diagrama de flujo', code: 'flowchart LR\n  A[Inicio] --> B{¿Decisión?}\n  B -->|Sí| C[Acción]\n  B -->|No| D[Fin]\n  C --> D' },
  { id: 'sequence', name: 'Secuencia', code: 'sequenceDiagram\n  participant U as Usuario\n  participant S as Sistema\n  U->>S: Solicitar\n  S-->>U: Responder' },
  { id: 'class', name: 'Clases', code: 'classDiagram\n  class Animal {\n    +String nombre\n    +comer()\n  }\n  class Perro\n  Animal <|-- Perro' },
  { id: 'state', name: 'Estados', code: 'stateDiagram-v2\n  [*] --> Activo\n  Activo --> Inactivo\n  Inactivo --> [*]' },
  { id: 'journey', name: 'Journey', code: 'journey\n  title Experiencia de usuario\n  section Descubrimiento\n    Visitar web: 3: Usuario\n    Registrarse: 4: Usuario' },
  { id: 'gantt', name: 'Gantt', code: 'gantt\n  title Proyecto\n  dateFormat YYYY-MM-DD\n  section Fase 1\n  Tarea A: 2024-01-01, 30d\n  Tarea B: 2024-02-01, 45d' },
  { id: 'mindmap', name: 'Mapa mental', code: 'mindmap\n  root((Idea))\n    Investigación\n    Diseño\n    Desarrollo' },
  { id: 'timeline', name: 'Timeline', code: 'timeline\n  title Historia\n  2020 : Inicio\n  2022 : Crecimiento\n  2024 : Expansión' },
];

export function openSmartArtModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let mode: 'templates' | 'mermaid' = 'templates';
  let selectedTemplateId = 'chevron-process';
  let selectedPaletteId = 'blue';
  let selectedMermaidId = 'flowchart';
  let mermaidCode = MERMAID_SNIPPETS[0].code;
  let artWidth = 720;
  let artHeight = 280;

  let items: SmartArtItem[] = [
    { id: '1', title: 'Fase 1', desc: 'Inicio' },
    { id: '2', title: 'Fase 2', desc: 'Desarrollo' },
    { id: '3', title: 'Fase 3', desc: 'Revisión' },
    { id: '4', title: 'Fase 4', desc: 'Entrega' },
  ];

  const getTemplate = () => SMART_ART_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? SMART_ART_TEMPLATES[0];
  const getPalette = () => PALETTES.find((p) => p.id === selectedPaletteId) ?? PALETTES[0];

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Workflow, 18)}</span>
          <h2 class="cde-modal__title">Insertar SmartArt / Diagrama</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body flex flex-col gap-4">
        <!-- Mode switch -->
        <div class="flex gap-2" id="cde-sa-mode">
          <button type="button" class="cde-chip is-active" data-mode="templates">Plantillas SmartArt</button>
          <button type="button" class="cde-chip" data-mode="mermaid">Diagramas Mermaid</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
          <!-- Left -->
          <div class="md:col-span-6 flex flex-col gap-3" id="cde-sa-left"></div>
          <!-- Right -->
          <div class="md:col-span-6 flex flex-col gap-3">
            <div id="cde-sa-palette-wrap">
              <span class="text-xs font-semibold text-neutral-700 block mb-1.5">Paleta:</span>
              <div class="flex flex-wrap gap-2" id="cde-sa-palettes">
                ${PALETTES.map((p) => `
                  <button type="button" class="px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all ${
                    p.id === selectedPaletteId
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500 font-semibold text-blue-800'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                  }" data-palette="${p.id}">
                    <div class="flex gap-0.5">
                      ${p.colors.slice(0, 4).map((c) => `<span class="w-2.5 h-2.5 rounded-full" style="background:${c}"></span>`).join('')}
                    </div>
                    <span>${p.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="flex flex-col">
                <span class="text-xs font-semibold text-neutral-700 mb-1">Ancho</span>
                <input id="cde-sa-w" type="number" min="320" max="1200" value="${artWidth}" class="cde-modal__input w-20 text-xs" />
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold text-neutral-700 mb-1">Alto</span>
                <input id="cde-sa-h" type="number" min="160" max="800" value="${artHeight}" class="cde-modal__input w-20 text-xs" />
              </div>
            </div>

            <div class="mt-1">
              <span class="text-[11px] font-medium text-neutral-500 block mb-1">Vista previa:</span>
              <div class="cde-preview-box h-56 bg-neutral-100 rounded border border-neutral-300 p-3 shadow-inner" id="cde-sa-preview-box"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-end gap-2">
        <button type="button" class="cde-btn cde-btn--secondary" id="cde-sa-cancel">Cancelar</button>
        <button type="button" class="cde-btn cde-btn--primary" id="cde-sa-insert">Insertar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const leftCol = overlay.querySelector('#cde-sa-left') as HTMLElement;
  const previewBox = overlay.querySelector('#cde-sa-preview-box') as HTMLElement;
  const paletteWrap = overlay.querySelector('#cde-sa-palette-wrap') as HTMLElement;

  const updatePreview = async () => {
    if (mode === 'templates') {
      const t = getTemplate();
      const p = getPalette();
      const src = svgToDataUri(t.renderSvg(items, p.colors, artWidth, artHeight));
      previewBox.innerHTML = `<img alt="Vista previa" src="${src}" />`;
    } else {
      previewBox.innerHTML = `<div class="text-xs text-neutral-500 animate-pulse">Generando diagrama…</div>`;
      try {
        const src = await mermaidToSvgDataUri(mermaidCode);
        previewBox.innerHTML = `<img alt="Vista previa del diagrama" src="${src}" />`;
      } catch {
        previewBox.innerHTML = `<div class="text-xs text-red-500">Error al generar el diagrama Mermaid.</div>`;
      }
    }
  };

  const renderLeft = () => {
    if (mode === 'templates') {
      paletteWrap.style.display = '';
      leftCol.innerHTML = `
        <div>
          <span class="text-xs font-semibold text-neutral-700 block mb-1.5">Categoría:</span>
          <div class="flex gap-1.5 flex-wrap" id="cde-sa-cats">
            ${Object.entries(CATEGORY_LABELS).map(([id, label]) => `
              <button type="button" class="cde-chip" data-cat="${id}">${label}</button>
            `).join('')}
          </div>
        </div>
        <div>
          <span class="text-xs font-semibold text-neutral-700 block mb-1.5">Plantilla:</span>
          <div class="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1" id="cde-sa-templates">
            ${SMART_ART_TEMPLATES.map((t) => `
              <button type="button" class="cde-sa-tpl-card p-2 rounded border text-left flex flex-col gap-1 transition-all ${
                t.id === selectedTemplateId
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }" data-tpl="${t.id}" data-cat="${t.category}">
                ${t.thumb}
                <span class="text-xs font-semibold text-neutral-800">${t.name}</span>
                <span class="text-[10px] text-neutral-500 uppercase tracking-wider">${CATEGORY_LABELS[t.category] ?? t.category}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-semibold text-neutral-700">Elementos:</span>
            <button type="button" class="cde-btn cde-btn--secondary text-xs flex items-center gap-1 py-0.5 px-2" id="cde-sa-add">
              ${lucideSvg(Plus, 12)} Añadir
            </button>
          </div>
          <div class="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1" id="cde-sa-items"></div>
        </div>
      `;
      renderItems();
    } else {
      paletteWrap.style.display = 'none';
      leftCol.innerHTML = `
        <div>
          <span class="text-xs font-semibold text-neutral-700 block mb-1.5">Tipo de diagrama:</span>
          <div class="grid grid-cols-2 gap-1.5" id="cde-sa-mermaid-types">
            ${MERMAID_SNIPPETS.map((s) => `
              <button type="button" class="cde-sa-mmd-btn px-2.5 py-1.5 rounded border text-xs transition-all ${
                s.id === selectedMermaidId
                  ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                  : 'border-neutral-200 bg-white text-neutral-700'
              }" data-mmd="${s.id}">${s.name}</button>
            `).join('')}
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-700 mb-1" for="cde-sa-mermaid-code">Código Mermaid:</label>
          <textarea id="cde-sa-mermaid-code" rows="10" class="cde-modal__input w-full text-xs font-mono">${escapeXml(mermaidCode)}</textarea>
        </div>
      `;
    }
  };

  const renderItems = () => {
    const list = leftCol.querySelector('#cde-sa-items') as HTMLElement | null;
    if (!list) return;
    list.innerHTML = items
      .map(
        (it, i) => `
        <div class="flex items-center gap-1.5" data-index="${i}">
          <input type="text" class="cde-modal__input flex-1 text-xs py-1" data-field="title" value="${escapeXml(it.title)}" placeholder="Título" />
          <input type="text" class="cde-modal__input flex-1 text-xs py-1" data-field="desc" value="${escapeXml(it.desc)}" placeholder="Descripción" />
          <button type="button" class="text-neutral-400 hover:text-blue-500 p-0.5" data-up="${i}" title="Subir"><span style="display:inline-block;transform:rotate(180deg)">${lucideSvg(ChevronDown, 12)}</span></button>
          <button type="button" class="text-neutral-400 hover:text-blue-500 p-0.5" data-down="${i}" title="Bajar">${lucideSvg(ChevronDown, 12)}</button>
          <button type="button" class="text-neutral-400 hover:text-red-500 p-0.5" data-remove="${i}" title="Eliminar">${lucideSvg(Trash2, 13)}</button>
        </div>`,
      )
      .join('');
  };

  renderLeft();
  updatePreview();

  // --- events ---
  overlay.querySelector('#cde-sa-mode')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-mode]') as HTMLElement | null;
    if (!btn) return;
    mode = btn.dataset.mode as any;
    overlay.querySelectorAll('#cde-sa-mode [data-mode]').forEach((el) => {
      const id = (el as HTMLElement).dataset.mode;
      el.className = `px-4 py-1.5 rounded text-xs border transition-all ${
        id === mode
          ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold'
          : 'border-neutral-200 bg-white text-neutral-700'
      }`;
    });
    renderLeft();
    updatePreview();
  });

  leftCol.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tpl = target.closest('[data-tpl]') as HTMLElement | null;
    if (tpl) {
      selectedTemplateId = tpl.dataset.tpl!;
      renderLeft();
      updatePreview();
      return;
    }
    const cat = target.closest('[data-cat]') as HTMLElement | null;
    if (cat) {
      const c = cat.dataset.cat!;
      leftCol.querySelectorAll('.cde-sa-cat-btn').forEach((el) => {
        el.className = `cde-sa-cat-btn px-2.5 py-1 rounded-full text-xs border transition-all ${
          (el as HTMLElement).dataset.cat === c
            ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold'
            : 'border-neutral-200 bg-white text-neutral-700'
        }`;
      });
      leftCol.querySelectorAll('.cde-sa-tpl-card').forEach((el) => {
        const tc = (el as HTMLElement).dataset.cat;
        (el as HTMLElement).style.display = c === 'all' || tc === c ? '' : 'none';
      });
      return;
    }
    const addBtn = target.closest('#cde-sa-add');
    if (addBtn) {
      items.push({ id: String(Date.now()), title: `Fase ${items.length + 1}`, desc: '' });
      renderItems();
      updatePreview();
      return;
    }
    const rm = target.closest('[data-remove]') as HTMLElement | null;
    if (rm) {
      const i = Number(rm.dataset.remove);
      if (items.length > 1) items.splice(i, 1);
      renderItems();
      updatePreview();
      return;
    }
    const up = target.closest('[data-up]') as HTMLElement | null;
    if (up) {
      const i = Number(up.dataset.up);
      if (i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
      renderItems();
      updatePreview();
      return;
    }
    const down = target.closest('[data-down]') as HTMLElement | null;
    if (down) {
      const i = Number(down.dataset.down);
      if (i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
      renderItems();
      updatePreview();
      return;
    }
    const mmd = target.closest('[data-mmd]') as HTMLElement | null;
    if (mmd) {
      selectedMermaidId = mmd.dataset.mmd!;
      const snip = MERMAID_SNIPPETS.find((s) => s.id === selectedMermaidId);
      if (snip) {
        mermaidCode = snip.code;
        const ta = leftCol.querySelector('#cde-sa-mermaid-code') as HTMLTextAreaElement | null;
        if (ta) ta.value = mermaidCode;
      }
      leftCol.querySelectorAll('.cde-sa-mmd-btn').forEach((el) => {
        const id = (el as HTMLElement).dataset.mmd;
        el.className = `cde-sa-mmd-btn px-2.5 py-1.5 rounded border text-xs transition-all ${
          id === selectedMermaidId
            ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
            : 'border-neutral-200 bg-white text-neutral-700'
        }`;
      });
      updatePreview();
    }
  });

  leftCol.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.id === 'cde-sa-mermaid-code') {
      mermaidCode = target.value;
      window.clearTimeout((updatePreview as any)._t);
      (updatePreview as any)._t = window.setTimeout(() => updatePreview(), 500);
      return;
    }
    const row = (target as HTMLElement).closest('[data-index]') as HTMLElement | null;
    if (!row) return;
    const idx = Number(row.dataset.index);
    const field = (target as HTMLInputElement).dataset.field;
    if (field === 'title') items[idx].title = target.value;
    if (field === 'desc') items[idx].desc = target.value;
    updatePreview();
  });

  overlay.querySelector('#cde-sa-palettes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-palette]') as HTMLElement | null;
    if (!btn) return;
    selectedPaletteId = btn.dataset.palette!;
    overlay.querySelectorAll('[data-palette]').forEach((el) => {
      const id = (el as HTMLElement).dataset.palette;
      el.className = `px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all ${
        id === selectedPaletteId
          ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500 font-semibold text-blue-800'
          : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
      }`;
    });
    updatePreview();
  });

  (overlay.querySelector('#cde-sa-w') as HTMLInputElement).addEventListener('change', (e) => {
    artWidth = Math.min(1200, Math.max(320, Number((e.target as HTMLInputElement).value) || 720));
    updatePreview();
  });

  (overlay.querySelector('#cde-sa-h') as HTMLInputElement).addEventListener('change', (e) => {
    artHeight = Math.min(800, Math.max(160, Number((e.target as HTMLInputElement).value) || 280));
    updatePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#cde-sa-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  overlay.querySelector('#cde-sa-insert')!.addEventListener('click', async () => {
    if (mode === 'templates') {
      const t = getTemplate();
      const p = getPalette();
      const src = svgToDataUri(t.renderSvg(items, p.colors, artWidth, artHeight));
      insertImage(editor, src, {
        alt: `SmartArt: ${t.name}`,
        width: artWidth / 2,
        height: artHeight / 2,
      });
      close();
    } else {
      const btn = overlay.querySelector('#cde-sa-insert') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Generando…';
      try {
        const src = await mermaidToSvgDataUri(mermaidCode);
        insertImage(editor, src, { alt: 'Diagrama Mermaid', width: artWidth / 2 });
        close();
      } catch {
        btn.disabled = false;
        btn.textContent = 'Insertar';
      }
    }
  });
}

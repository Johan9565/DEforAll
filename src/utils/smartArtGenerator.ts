import type { Editor } from '@tiptap/core';
import { lucideSvg, Workflow, Plus, Trash2 } from '../icons';

export interface SmartArtItem {
  id: string;
  title: string;
  desc: string;
}

export interface SmartArtTemplate {
  id: string;
  name: string;
  category: 'process' | 'hierarchy' | 'cycle' | 'list' | 'pyramid';
  renderSvg: (items: SmartArtItem[], palette: string[], width: number, height: number) => string;
}

const PALETTES = [
  { id: 'blue', name: 'Azul Office', colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'] },
  { id: 'emerald', name: 'Esmeralda', colors: ['#059669', '#10b981', '#34d399', '#6ee7b7'] },
  { id: 'purple', name: 'Púrpura Neón', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'] },
  { id: 'warm', name: 'Atardecer', colors: ['#dc2626', '#ea580c', '#d97706', '#f59e0b'] },
  { id: 'corporate', name: 'Multicolor', colors: ['#2563eb', '#059669', '#d97706', '#7c3aed'] },
];

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const SMART_ART_TEMPLATES: SmartArtTemplate[] = [
  // 1. CHEVRONS PROCESS
  {
    id: 'chevron-process',
    name: 'Proceso de flechas continuas',
    category: 'process',
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const stepW = width / count;
      const notch = Math.min(24, stepW * 0.2);

      const paths = items
        .map((item, i) => {
          const c = colors[i % colors.length];
          const xStart = i * stepW;
          const xEnd = (i + 1) * stepW;
          const leftNotch = i === 0 ? 0 : notch;
          const rightNotch = i === count - 1 ? 0 : notch;

          const d = `
          M ${xStart},0 
          L ${xEnd - rightNotch},0 
          ${rightNotch ? `L ${xEnd},${height / 2} L ${xEnd - rightNotch},${height}` : `L ${xEnd},${height}`}
          L ${xStart},${height}
          ${leftNotch ? `L ${xStart + leftNotch},${height / 2}` : ''}
          Z
        `;

          const textX = xStart + (stepW + (leftNotch - rightNotch)) / 2;

          return `
          <g>
            <path d="${d}" fill="${c}" stroke="#ffffff" stroke-width="2" />
            <text x="${textX}" y="${height * 0.38}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="middle">
              ${escapeXml(item.title)}
            </text>
            <text x="${textX}" y="${height * 0.62}" fill="rgba(255,255,255,0.85)" font-family="system-ui, sans-serif" font-size="10" text-anchor="middle" dominant-baseline="middle">
              ${escapeXml(item.desc)}
            </text>
          </g>
        `;
        })
        .join('');

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}</svg>`;
    },
  },

  // 2. TIMELINE HORIZONTAL
  {
    id: 'timeline-process',
    name: 'Línea de tiempo con nodos',
    category: 'process',
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const spacing = width / count;
      const midY = height * 0.45;

      const line = `<line x1="30" y1="${midY}" x2="${width - 30}" y2="${midY}" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round" />`;

      const nodes = items
        .map((item, i) => {
          const c = colors[i % colors.length];
          const cx = (i + 0.5) * spacing;
          return `
          <g>
            <circle cx="${cx}" cy="${midY}" r="18" fill="${c}" stroke="#ffffff" stroke-width="3" />
            <text x="${cx}" y="${midY}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="11" font-weight="800" text-anchor="middle" dominant-baseline="middle">${i + 1}</text>
            <text x="${cx}" y="${midY + 34}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">${escapeXml(item.title)}</text>
            <text x="${cx}" y="${midY + 48}" fill="#64748b" font-family="system-ui, sans-serif" font-size="10" text-anchor="middle">${escapeXml(item.desc)}</text>
          </g>
        `;
        })
        .join('');

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${line}${nodes}</svg>`;
    },
  },

  // 3. ORGANIGRAMA / JERARQUÍA
  {
    id: 'hierarchy-org',
    name: 'Organigrama jerárquico',
    category: 'hierarchy',
    renderSvg: (items, colors, width, height) => {
      if (items.length === 0) return '';
      const root = items[0];
      const children = items.slice(1);
      const cRoot = colors[0];

      const rootW = 160;
      const rootH = 50;
      const rootX = (width - rootW) / 2;
      const rootY = 15;

      let childBoxes = '';
      let connectors = '';

      if (children.length > 0) {
        const childW = Math.min(140, (width - (children.length + 1) * 16) / children.length);
        const childH = 46;
        const totalW = children.length * childW + (children.length - 1) * 16;
        const startX = (width - totalW) / 2;
        const childY = height - childH - 15;

        // Connector lines
        const midBusY = rootY + rootH + 20;
        connectors += `<line x1="${width / 2}" y1="${rootY + rootH}" x2="${width / 2}" y2="${midBusY}" stroke="#94a3b8" stroke-width="2" />`;

        if (children.length > 1) {
          const firstX = startX + childW / 2;
          const lastX = startX + totalW - childW / 2;
          connectors += `<line x1="${firstX}" y1="${midBusY}" x2="${lastX}" y2="${midBusY}" stroke="#94a3b8" stroke-width="2" />`;
        }

        children.forEach((c, i) => {
          const col = colors[(i + 1) % colors.length];
          const x = startX + i * (childW + 16);
          connectors += `<line x1="${x + childW / 2}" y1="${midBusY}" x2="${x + childW / 2}" y2="${childY}" stroke="#94a3b8" stroke-width="2" />`;
          childBoxes += `
            <g>
              <rect x="${x}" y="${childY}" width="${childW}" height="${childH}" rx="6" fill="#ffffff" stroke="${col}" stroke-width="2" />
              <rect x="${x}" y="${childY}" width="${childW}" height="6" rx="2" fill="${col}" />
              <text x="${x + childW / 2}" y="${childY + 22}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="11" font-weight="700" text-anchor="middle">${escapeXml(c.title)}</text>
              <text x="${x + childW / 2}" y="${childY + 36}" fill="#64748b" font-family="system-ui, sans-serif" font-size="9" text-anchor="middle">${escapeXml(c.desc)}</text>
            </g>
          `;
        });
      }

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          ${connectors}
          <!-- Root Box -->
          <g>
            <rect x="${rootX}" y="${rootY}" width="${rootW}" height="${rootH}" rx="8" fill="${cRoot}" />
            <text x="${width / 2}" y="${rootY + 20}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="700" text-anchor="middle">${escapeXml(root.title)}</text>
            <text x="${width / 2}" y="${rootY + 35}" fill="rgba(255,255,255,0.85)" font-family="system-ui, sans-serif" font-size="10" text-anchor="middle">${escapeXml(root.desc)}</text>
          </g>
          ${childBoxes}
        </svg>
      `;
    },
  },

  // 4. CICLO CONTINUO
  {
    id: 'cycle-circular',
    name: 'Ciclo circular continuo',
    category: 'cycle',
    renderSvg: (items, colors, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.35;
      const count = Math.max(1, items.length);

      const nodes = items
        .map((item, i) => {
          const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          const c = colors[i % colors.length];
          const nodeR = 36;

          return `
          <g>
            <circle cx="${x}" cy="${y}" r="${nodeR}" fill="${c}" stroke="#ffffff" stroke-width="3" />
            <text x="${x}" y="${y - 4}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="11" font-weight="700" text-anchor="middle">${escapeXml(item.title)}</text>
            <text x="${x}" y="${y + 10}" fill="rgba(255,255,255,0.85)" font-family="system-ui, sans-serif" font-size="9" text-anchor="middle">${escapeXml(item.desc)}</text>
          </g>
        `;
        })
        .join('');

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="6" stroke-dasharray="8 6" />
          ${nodes}
        </svg>
      `;
    },
  },

  // 5. PIRÁMIDE ESCALONADA
  {
    id: 'pyramid-levels',
    name: 'Pirámide jerárquica por niveles',
    category: 'pyramid',
    renderSvg: (items, colors, width, height) => {
      const count = Math.max(1, items.length);
      const layerH = (height - 30) / count;
      const cx = width / 2;
      const topW = 40;
      const botW = width - 60;

      const layers = items
        .map((item, i) => {
          const c = colors[i % colors.length];
          const yTop = 15 + i * layerH;
          const yBot = yTop + layerH - 3;
          const w1 = topW + (botW - topW) * (i / count);
          const w2 = topW + (botW - topW) * ((i + 1) / count);

          const p = `
          ${cx - w1 / 2},${yTop} 
          ${cx + w1 / 2},${yTop} 
          ${cx + w2 / 2},${yBot} 
          ${cx - w2 / 2},${yBot}
        `;

          return `
          <g>
            <polygon points="${p}" fill="${c}" stroke="#ffffff" stroke-width="2" />
            <text x="${cx}" y="${(yTop + yBot) / 2}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle">
              ${escapeXml(item.title)} ${item.desc ? `· ${escapeXml(item.desc)}` : ''}
            </text>
          </g>
        `;
        })
        .join('');

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${layers}</svg>`;
    },
  },
];

export function openSmartArtModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let selectedTemplateId = 'chevron-process';
  let selectedPaletteId = 'blue';
  let artWidth = 480;
  let artHeight = 160;

  let items: SmartArtItem[] = [
    { id: '1', title: 'Fase 1', desc: 'Planificación' },
    { id: '2', title: 'Fase 2', desc: 'Desarrollo' },
    { id: '3', title: 'Fase 3', desc: 'Pruebas QA' },
    { id: '4', title: 'Fase 4', desc: 'Despliegue' },
  ];

  const getTemplate = () =>
    SMART_ART_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? SMART_ART_TEMPLATES[0];

  const getPalette = () =>
    PALETTES.find((p) => p.id === selectedPaletteId) ?? PALETTES[0];

  const renderCurrentPreview = () => {
    const tpl = getTemplate();
    const pal = getPalette();
    return tpl.renderSvg(items, pal.colors, artWidth, artHeight);
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--lg" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Workflow, 18)}</span>
          <h2 class="cde-modal__title">Insertar elemento gráfico SmartArt</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body grid grid-cols-1 md:grid-cols-12 gap-5">
        <!-- Izquierda: Plantillas y Lista de Elementos -->
        <div class="md:col-span-6 flex flex-col gap-3">
          <span class="text-xs font-semibold text-neutral-700">Tipo de diagrama SmartArt:</span>

          <div class="grid grid-cols-2 gap-2" id="smartart-templates-grid">
            ${SMART_ART_TEMPLATES.map(
              (t) => `
              <button type="button" class="cde-smartart-card p-2 rounded border text-left flex flex-col gap-1 transition-all ${
                t.id === selectedTemplateId
                  ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }" data-id="${t.id}">
                <span class="text-xs font-bold text-neutral-800">${t.name}</span>
                <span class="text-[10px] text-neutral-500 uppercase tracking-wider">${t.category}</span>
              </button>
            `,
            ).join('')}
          </div>

          <!-- Gestor de Elementos -->
          <div class="mt-2 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-neutral-700">Pasos y contenidos:</span>
              <button type="button" class="cde-btn cde-btn--secondary text-xs flex items-center gap-1 py-0.5 px-2" id="smartart-add-item">
                ${lucideSvg(Plus, 12)} Añadir paso
              </button>
            </div>

            <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1" id="smartart-items-list">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>

        <!-- Derecha: Paleta y Vista Previa -->
        <div class="md:col-span-6 flex flex-col gap-3">
          <span class="text-xs font-semibold text-neutral-700">Combinación de colores:</span>
          <div class="flex flex-wrap gap-2" id="smartart-palettes">
            ${PALETTES.map(
              (p) => `
              <button type="button" class="px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all ${
                p.id === selectedPaletteId
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500 font-semibold'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
              }" data-palette="${p.id}">
                <div class="flex gap-0.5">
                  ${p.colors.map((c) => `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${c}"></span>`).join('')}
                </div>
                <span>${p.name}</span>
              </button>
            `,
            ).join('')}
          </div>

          <!-- Dimensiones -->
          <div class="flex items-center gap-3 text-xs text-neutral-700">
            <div>
              <label class="block font-medium mb-1">Ancho (px):</label>
              <input id="smartart-w" type="number" min="200" max="800" value="${artWidth}" class="cde-modal__input w-24" />
            </div>
            <div>
              <label class="block font-medium mb-1">Alto (px):</label>
              <input id="smartart-h" type="number" min="100" max="600" value="${artHeight}" class="cde-modal__input w-24" />
            </div>
          </div>

          <!-- Vista previa -->
          <div class="mt-1">
            <span class="text-[11px] font-medium text-neutral-500 block mb-1">Vista previa en tiempo real:</span>
            <div class="h-48 bg-neutral-100 rounded border border-neutral-300 flex items-center justify-center p-3 overflow-hidden shadow-inner" id="smartart-preview-box">
              ${renderCurrentPreview()}
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-end gap-2">
        <button type="button" class="cde-btn cde-btn--secondary" id="smartart-cancel">Cancelar</button>
        <button type="button" class="cde-btn cde-btn--primary" id="smartart-insert">Insertar SmartArt</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const previewBox = overlay.querySelector('#smartart-preview-box') as HTMLElement;
  const itemsContainer = overlay.querySelector('#smartart-items-list') as HTMLElement;
  const addItemBtn = overlay.querySelector('#smartart-add-item') as HTMLButtonElement;
  const widthInput = overlay.querySelector('#smartart-w') as HTMLInputElement;
  const heightInput = overlay.querySelector('#smartart-h') as HTMLInputElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#smartart-cancel') as HTMLButtonElement;
  const insertBtn = overlay.querySelector('#smartart-insert') as HTMLButtonElement;

  const updatePreview = () => {
    previewBox.innerHTML = renderCurrentPreview();
  };

  const renderItemsList = () => {
    itemsContainer.innerHTML = items
      .map(
        (it, idx) => `
      <div class="flex items-center gap-2 p-1.5 bg-neutral-50 border border-neutral-200 rounded" data-idx="${idx}">
        <span class="text-xs font-bold text-neutral-400 w-4">${idx + 1}</span>
        <input type="text" class="cde-modal__input flex-1 text-xs py-1 smartart-item-title" placeholder="Título" value="${escapeXml(it.title)}" />
        <input type="text" class="cde-modal__input flex-1 text-xs py-1 smartart-item-desc" placeholder="Descripción" value="${escapeXml(it.desc)}" />
        <button type="button" class="text-neutral-400 hover:text-red-600 p-1 rounded smartart-item-del" title="Eliminar paso">
          ${lucideSvg(Trash2, 13)}
        </button>
      </div>
    `,
      )
      .join('');
  };

  renderItemsList();

  const cleanup = () => overlay.remove();

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  // Template select
  overlay.querySelector('#smartart-templates-grid')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cde-smartart-card');
    if (!btn?.dataset.id) return;
    selectedTemplateId = btn.dataset.id;
    overlay.querySelectorAll('.cde-smartart-card').forEach((b) => {
      b.className =
        'cde-smartart-card p-2 rounded border text-left flex flex-col gap-1 transition-all border-neutral-200 bg-white hover:border-neutral-300';
    });
    btn.className =
      'cde-smartart-card p-2 rounded border text-left flex flex-col gap-1 transition-all border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400';
    updatePreview();
  });

  // Palette select
  overlay.querySelector('#smartart-palettes')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.palette) return;
    selectedPaletteId = btn.dataset.palette;
    overlay.querySelectorAll('#smartart-palettes button').forEach((b) => {
      b.className =
        'px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700';
    });
    btn.className =
      'px-2.5 py-1 rounded text-xs flex items-center gap-2 border transition-all border-blue-600 bg-blue-50 ring-1 ring-blue-500 font-semibold text-blue-800';
    updatePreview();
  });

  // Add Item
  addItemBtn.addEventListener('click', () => {
    const newIdx = items.length + 1;
    items.push({ id: String(Date.now()), title: `Paso ${newIdx}`, desc: 'Detalle' });
    renderItemsList();
    updatePreview();
  });

  // Items container events (title/desc changes, delete)
  itemsContainer.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const row = target.closest<HTMLElement>('[data-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.idx ?? '0', 10);
    if (!items[idx]) return;

    if (target.classList.contains('smartart-item-title')) {
      items[idx].title = target.value;
    } else if (target.classList.contains('smartart-item-desc')) {
      items[idx].desc = target.value;
    }
    updatePreview();
  });

  itemsContainer.addEventListener('click', (e) => {
    const delBtn = (e.target as HTMLElement).closest('.smartart-item-del');
    if (!delBtn) return;
    const row = delBtn.closest<HTMLElement>('[data-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.idx ?? '0', 10);
    if (items.length <= 1) return; // keep at least 1
    items.splice(idx, 1);
    renderItemsList();
    updatePreview();
  });

  widthInput.addEventListener('input', () => {
    const v = parseInt(widthInput.value, 10);
    if (v > 0) {
      artWidth = v;
      updatePreview();
    }
  });

  heightInput.addEventListener('input', () => {
    const v = parseInt(heightInput.value, 10);
    if (v > 0) {
      artHeight = v;
      updatePreview();
    }
  });

  insertBtn.addEventListener('click', () => {
    const svgCode = renderCurrentPreview();
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgCode)}`;
    const tpl = getTemplate();

    editor
      .chain()
      .focus()
      .setImage({
        src: dataUri,
        alt: `SmartArt: ${tpl.name}`,
        width: artWidth,
        height: artHeight,
        alignment: 'center',
      })
      .run();

    cleanup();
  });
}

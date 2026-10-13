import type { Editor } from '@tiptap/core';
import { lucideSvg, Shapes, Check } from '../icons';

export interface ShapeDefinition {
  id: string;
  name: string;
  category: 'basic' | 'arrows' | 'callouts' | 'flowchart';
  renderSvg: (options: ShapeRenderOptions) => string;
}

export interface ShapeRenderOptions {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  textColor?: string;
}

const PRESET_COLORS = [
  '#2563eb', // Azul Office
  '#0284c7', // Azul cielo
  '#0d9488', // Verde azulado
  '#16a34a', // Verde esmeralda
  '#d97706', // Ámbar
  '#dc2626', // Rojo
  '#9333ea', // Púrpura
  '#475569', // Pizarra
  '#0f172a', // Grafito oscuro
  '#ffffff', // Blanco
];

const PRESET_STROKE_COLORS = [
  '#1e40af',
  '#0369a1',
  '#0f766e',
  '#15803d',
  '#b45309',
  '#b91c1c',
  '#7e22ce',
  '#334155',
  '#cbd5e1',
  'transparent',
];

function textElement(text: string | undefined, x: number, y: number, color = '#ffffff'): string {
  if (!text?.trim()) return '';
  return `<text x="${x}" y="${y}" fill="${color}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(text.trim())}</text>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const SHAPES: ShapeDefinition[] = [
  // --- BÁSICAS ---
  {
    id: 'rect',
    name: 'Rectángulo',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const w = width - sw * 2;
      const h = height - sw * 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect x="${sw}" y="${sw}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'rounded-rect',
    name: 'Rectángulo redondeado',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const rx = Math.min(width, height) * 0.2;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect x="${sw}" y="${sw}" width="${width - sw * 2}" height="${height - sw * 2}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'circle',
    name: 'Círculo / Elipse',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const rx = (width - sw * 2) / 2;
      const ry = (height - sw * 2) / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'triangle',
    name: 'Triángulo',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const p1 = `${width / 2},${sw}`;
      const p2 = `${width - sw},${height - sw}`;
      const p3 = `${sw},${height - sw}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <polygon points="${p1} ${p2} ${p3}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />
        ${textElement(text, width / 2, height * 0.65, textColor)}
      </svg>`;
    },
  },
  {
    id: 'diamond',
    name: 'Rombo / Diamante',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const p1 = `${width / 2},${sw}`;
      const p2 = `${width - sw},${height / 2}`;
      const p3 = `${width / 2},${height - sw}`;
      const p4 = `${sw},${height / 2}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <polygon points="${p1} ${p2} ${p3} ${p4}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'star',
    name: 'Estrella de 5 puntas',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const cx = width / 2;
      const cy = height / 2;
      const outerR = Math.min(cx, cy) - strokeWidth;
      const innerR = outerR * 0.45;
      const points: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
        ${textElement(text, width / 2, height / 2 + 3, textColor)}
      </svg>`;
    },
  },
  {
    id: 'hexagon',
    name: 'Hexágono',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const w = width - sw * 2;
      const h = height - sw * 2;
      const dx = w * 0.25;
      const points = [
        `${sw + dx},${sw}`,
        `${sw + w - dx},${sw}`,
        `${sw + w},${sw + h / 2}`,
        `${sw + w - dx},${sw + h}`,
        `${sw + dx},${sw + h}`,
        `${sw},${sw + h / 2}`,
      ].join(' ');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'heart',
    name: 'Corazón',
    category: 'basic',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${width}" height="${height}">
        <path d="M 50,85 C 20,60 5,40 5,25 C 5,10 20,5 35,5 C 43,5 48,10 50,15 C 52,10 57,5 65,5 C 80,5 95,10 95,25 C 95,40 80,60 50,85 Z"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth * (100 / width)}" stroke-linejoin="round" />
        ${textElement(text, 50, 45, textColor)}
      </svg>`;
    },
  },
  // --- FLECHAS ---
  {
    id: 'arrow-right',
    name: 'Flecha derecha',
    category: 'arrows',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const yMid = height / 2;
      const shaftH = height * 0.4;
      const headW = width * 0.35;
      const shaftY = (height - shaftH) / 2;
      const p = [
        `${sw},${shaftY}`,
        `${width - headW},${shaftY}`,
        `${width - headW},${sw}`,
        `${width - sw},${yMid}`,
        `${width - headW},${height - sw}`,
        `${width - headW},${shaftY + shaftH}`,
        `${sw},${shaftY + shaftH}`,
      ].join(' ');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <polygon points="${p}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />
        ${textElement(text, (width - headW) / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'arrow-double',
    name: 'Flecha doble',
    category: 'arrows',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const headW = width * 0.25;
      const shaftH = height * 0.35;
      const shaftY = (height - shaftH) / 2;
      const p = [
        `${sw},${height / 2}`,
        `${headW},${sw}`,
        `${headW},${shaftY}`,
        `${width - headW},${shaftY}`,
        `${width - headW},${sw}`,
        `${width - sw},${height / 2}`,
        `${width - headW},${height - sw}`,
        `${width - headW},${shaftY + shaftH}`,
        `${headW},${shaftY + shaftH}`,
        `${headW},${height - sw}`,
      ].join(' ');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <polygon points="${p}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  // --- LLAMADAS / BOCADILLOS ---
  {
    id: 'callout-rounded',
    name: 'Bocadillo de diálogo',
    category: 'callouts',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const bodyH = height * 0.75;
      const r = 10;
      const p = `M ${sw + r},${sw} 
        H ${width - sw - r} 
        Q ${width - sw},${sw} ${width - sw},${sw + r} 
        V ${bodyH - r} 
        Q ${width - sw},${bodyH} ${width - sw - r},${bodyH} 
        H ${width * 0.4} 
        L ${width * 0.25},${height - sw} 
        L ${width * 0.28},${bodyH} 
        H ${sw + r} 
        Q ${sw},${bodyH} ${sw},${bodyH - r} 
        V ${sw + r} 
        Q ${sw},${sw} ${sw + r},${sw} Z`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <path d="${p}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />
        ${textElement(text, width / 2, bodyH / 2, textColor)}
      </svg>`;
    },
  },
  // --- DIAGRAMA DE FLUJO ---
  {
    id: 'flow-process',
    name: 'Proceso (Flujo)',
    category: 'flowchart',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect x="${sw}" y="${sw}" width="${width - sw * 2}" height="${height - sw * 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="4" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
  {
    id: 'flow-terminator',
    name: 'Inicio / Fin (Terminador)',
    category: 'flowchart',
    renderSvg: ({ width, height, fill, stroke, strokeWidth, text, textColor }) => {
      const sw = strokeWidth;
      const rx = height / 2 - sw;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect x="${sw}" y="${sw}" width="${width - sw * 2}" height="${height - sw * 2}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
        ${textElement(text, width / 2, height / 2, textColor)}
      </svg>`;
    },
  },
];

export function openShapeModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let selectedShapeId = 'rounded-rect';
  let fillColor = '#2563eb';
  let strokeColor = '#1e40af';
  let strokeWidth = 2;
  let textLabel = '';
  let textColor = '#ffffff';
  let shapeWidth = 200;
  let shapeHeight = 110;

  const getActiveShape = () => SHAPES.find((s) => s.id === selectedShapeId) ?? SHAPES[0];

  const renderCurrentPreview = () => {
    const shape = getActiveShape();
    return shape.renderSvg({
      width: shapeWidth,
      height: shapeHeight,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth,
      text: textLabel,
      textColor,
    });
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--lg" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Shapes, 18)}</span>
          <h2 class="cde-modal__title">Insertar formas</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body grid grid-cols-1 md:grid-cols-12 gap-5">
        <!-- Columna izquierda: Galería de formas -->
        <div class="md:col-span-7 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-neutral-700">Seleccionar forma:</span>
            <div class="flex gap-1 text-[11px]" id="shape-category-tabs">
              <button type="button" class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium" data-cat="all">Todas</button>
              <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="basic">Básicas</button>
              <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="arrows">Flechas</button>
              <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="flowchart">Flujo</button>
            </div>
          </div>

          <div class="cde-shape-grid grid grid-cols-4 gap-2.5 p-2 bg-neutral-50 border border-neutral-200 rounded max-h-60 overflow-y-auto" id="shape-items-grid">
            ${SHAPES.map(
              (s) => `
              <button type="button" class="cde-shape-card p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all ${
                s.id === selectedShapeId
                  ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }" data-shape-id="${s.id}" title="${s.name}">
                <div class="w-10 h-8 flex items-center justify-center pointer-events-none">
                  ${s.renderSvg({ width: 36, height: 28, fill: '#3b82f6', stroke: '#1d4ed8', strokeWidth: 1.5 })}
                </div>
                <span class="text-[10px] text-neutral-700 truncate w-full text-center">${s.name}</span>
              </button>
            `,
            ).join('')}
          </div>

          <!-- Texto dentro de la forma -->
          <div>
            <label class="block text-xs font-semibold text-neutral-700 mb-1" for="cde-shape-text">
              Texto dentro de la forma (opcional):
            </label>
            <input
              id="cde-shape-text"
              type="text"
              class="cde-modal__input w-full"
              placeholder="Ej: Paso 1, Decisión, Total, etc."
              value="${escapeXml(textLabel)}"
            />
          </div>

          <!-- Dimensiones -->
          <div class="flex items-center gap-4 text-xs text-neutral-700">
            <div>
              <label class="block font-medium mb-1">Ancho (px):</label>
              <input id="cde-shape-w" type="number" min="50" max="600" value="${shapeWidth}" class="cde-modal__input w-24" />
            </div>
            <div>
              <label class="block font-medium mb-1">Alto (px):</label>
              <input id="cde-shape-h" type="number" min="40" max="400" value="${shapeHeight}" class="cde-modal__input w-24" />
            </div>
          </div>
        </div>

        <!-- Columna derecha: Estilo y Vista previa -->
        <div class="md:col-span-5 flex flex-col gap-3">
          <span class="text-xs font-semibold text-neutral-700">Estilo y colores:</span>

          <!-- Relleno -->
          <div>
            <span class="text-[11px] font-medium text-neutral-600 block mb-1">Color de relleno:</span>
            <div class="flex flex-wrap gap-1.5" id="fill-palette">
              ${PRESET_COLORS.map(
                (c) => `
                <button type="button" class="w-5 h-5 rounded-full border border-neutral-300 transition-transform hover:scale-110 flex items-center justify-center ${
                  c === fillColor ? 'ring-2 ring-blue-500 scale-110' : ''
                }" style="background-color: ${c}" data-color="${c}">
                  ${c === fillColor ? `<span class="${c === '#ffffff' ? 'text-neutral-800' : 'text-white'} text-[10px]">${lucideSvg(Check, 10)}</span>` : ''}
                </button>
              `,
              ).join('')}
            </div>
          </div>

          <!-- Trazo / Borde -->
          <div>
            <span class="text-[11px] font-medium text-neutral-600 block mb-1">Color de borde:</span>
            <div class="flex flex-wrap gap-1.5" id="stroke-palette">
              ${PRESET_STROKE_COLORS.map(
                (c) => `
                <button type="button" class="w-5 h-5 rounded-full border border-neutral-300 transition-transform hover:scale-110 flex items-center justify-center ${
                  c === strokeColor ? 'ring-2 ring-blue-500 scale-110' : ''
                }" style="background-color: ${c === 'transparent' ? '#ffffff' : c}; background-image: ${
                  c === 'transparent' ? 'linear-gradient(45deg, #f87171 50%, transparent 50%)' : 'none'
                }" data-stroke="${c}">
                  ${c === strokeColor ? `<span class="${c === '#ffffff' || c === 'transparent' ? 'text-neutral-800' : 'text-white'} text-[10px]">${lucideSvg(Check, 10)}</span>` : ''}
                </button>
              `,
              ).join('')}
            </div>
          </div>

          <!-- Color de texto -->
          <div>
            <span class="text-[11px] font-medium text-neutral-600 block mb-1">Color de fuente:</span>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" name="textColor" value="#ffffff" ${textColor === '#ffffff' ? 'checked' : ''} /> Blanco
              </label>
              <label class="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" name="textColor" value="#0f172a" ${textColor === '#0f172a' ? 'checked' : ''} /> Oscuro
              </label>
              <label class="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" name="textColor" value="#fbbf24" ${textColor === '#fbbf24' ? 'checked' : ''} /> Dorado
              </label>
            </div>
          </div>

          <!-- Caja de vista previa -->
          <div class="mt-1">
            <span class="text-[11px] font-medium text-neutral-500 block mb-1">Vista previa interactiva:</span>
            <div class="h-36 bg-neutral-100 rounded border border-neutral-300 flex items-center justify-center p-3 overflow-hidden shadow-inner" id="shape-preview-box">
              ${renderCurrentPreview()}
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-end gap-2">
        <button type="button" class="cde-btn cde-btn--secondary" id="cde-shape-cancel">Cancelar</button>
        <button type="button" class="cde-btn cde-btn--primary" id="cde-shape-insert">Insertar forma</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const previewBox = overlay.querySelector('#shape-preview-box') as HTMLElement;
  const textInput = overlay.querySelector('#cde-shape-text') as HTMLInputElement;
  const widthInput = overlay.querySelector('#cde-shape-w') as HTMLInputElement;
  const heightInput = overlay.querySelector('#cde-shape-h') as HTMLInputElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#cde-shape-cancel') as HTMLButtonElement;
  const insertBtn = overlay.querySelector('#cde-shape-insert') as HTMLButtonElement;
  const shapeGrid = overlay.querySelector('#shape-items-grid') as HTMLElement;

  const updatePreview = () => {
    previewBox.innerHTML = renderCurrentPreview();
  };

  const cleanup = () => {
    overlay.remove();
  };

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  // Shape selection
  shapeGrid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cde-shape-card');
    if (!btn) return;
    const shapeId = btn.dataset.shapeId;
    if (!shapeId) return;
    selectedShapeId = shapeId;

    shapeGrid.querySelectorAll('.cde-shape-card').forEach((b) => {
      b.className =
        'cde-shape-card p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all border-neutral-200 bg-white hover:border-neutral-300';
    });
    btn.className =
      'cde-shape-card p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400';

    updatePreview();
  });

  // Category filter
  overlay.querySelector('#shape-category-tabs')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    const cat = btn.dataset.cat;
    overlay.querySelectorAll('#shape-category-tabs button').forEach((b) => {
      b.className = 'px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100';
    });
    btn.className = 'px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium';

    const cards = shapeGrid.querySelectorAll<HTMLElement>('.cde-shape-card');
    cards.forEach((card) => {
      const s = SHAPES.find((sh) => sh.id === card.dataset.shapeId);
      if (!s) return;
      if (cat === 'all' || s.category === cat) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });

  // Fill palette
  overlay.querySelector('#fill-palette')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.color) return;
    fillColor = btn.dataset.color;
    overlay.querySelectorAll('#fill-palette button').forEach((b) => {
      b.classList.remove('ring-2', 'ring-blue-500', 'scale-110');
      b.innerHTML = '';
    });
    btn.classList.add('ring-2', 'ring-blue-500', 'scale-110');
    btn.innerHTML = `<span class="${fillColor === '#ffffff' ? 'text-neutral-800' : 'text-white'} text-[10px]">${lucideSvg(Check, 10)}</span>`;
    updatePreview();
  });

  // Stroke palette
  overlay.querySelector('#stroke-palette')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.stroke) return;
    strokeColor = btn.dataset.stroke;
    overlay.querySelectorAll('#stroke-palette button').forEach((b) => {
      b.classList.remove('ring-2', 'ring-blue-500', 'scale-110');
      b.innerHTML = '';
    });
    btn.classList.add('ring-2', 'ring-blue-500', 'scale-110');
    btn.innerHTML = `<span class="${strokeColor === '#ffffff' || strokeColor === 'transparent' ? 'text-neutral-800' : 'text-white'} text-[10px]">${lucideSvg(Check, 10)}</span>`;
    updatePreview();
  });

  // Text color radio
  overlay.querySelectorAll('input[name="textColor"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      textColor = (e.target as HTMLInputElement).value;
      updatePreview();
    });
  });

  // Text input & dimensions
  textInput.addEventListener('input', () => {
    textLabel = textInput.value;
    updatePreview();
  });

  widthInput.addEventListener('input', () => {
    const val = parseInt(widthInput.value, 10);
    if (val > 0) {
      shapeWidth = val;
      updatePreview();
    }
  });

  heightInput.addEventListener('input', () => {
    const val = parseInt(heightInput.value, 10);
    if (val > 0) {
      shapeHeight = val;
      updatePreview();
    }
  });

  insertBtn.addEventListener('click', () => {
    const svgCode = renderCurrentPreview();
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgCode)}`;
    const shape = getActiveShape();

    editor
      .chain()
      .focus()
      .setImage({
        src: dataUri,
        alt: `Forma: ${shape.name}`,
        width: shapeWidth,
        height: shapeHeight,
        alignment: 'center',
      })
      .run();

    cleanup();
  });
}

import type { Editor } from '@tiptap/core';
import { lucideSvg, Shapes } from '../icons';
import { svgToDataUri, insertImage, escapeXml, wrapText } from './imageFromUri';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShapeRenderOptions {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  textColor?: string;
}

export interface ShapeDefinition {
  id: string;
  name: string;
  category: 'basic' | 'arrows' | 'callouts' | 'flowchart' | 'banners';
  /** Path / primitive body in a normalized 0-100 × 0-100 viewBox (before text). */
  body: (o: ShapeRenderOptions) => string;
  /** Where to center text (in 0-100 space). */
  textAt?: [number, number];
  /** Max chars per line for text wrap. */
  maxChars?: number;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

export const FILL_COLORS = [
  '#2563eb', '#0284c7', '#0d9488', '#16a34a', '#d97706',
  '#dc2626', '#9333ea', '#475569', '#0f172a', '#ffffff',
];

export const STROKE_COLORS = [
  '#1e40af', '#0369a1', '#0f766e', '#15803d', '#b45309',
  '#b91c1c', '#7e22ce', '#334155', '#cbd5e1', 'transparent',
];

// ---------------------------------------------------------------------------
// Shape catalog (45+)
// ---------------------------------------------------------------------------

export const SHAPES: ShapeDefinition[] = [
  // --- BÁSICAS ---
  {
    id: 'rect', name: 'Rectángulo', category: 'basic', textAt: [50, 50], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<rect x="${sw}" y="${sw}" width="${100 - sw * 2}" height="${100 - sw * 2}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'rounded-rect', name: 'Rectángulo redondeado', category: 'basic', textAt: [50, 50], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<rect x="${sw}" y="${sw}" width="${100 - sw * 2}" height="${100 - sw * 2}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'square', name: 'Cuadrado', category: 'basic', textAt: [50, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<rect x="12" y="12" width="76" height="76" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'circle', name: 'Círculo', category: 'basic', textAt: [50, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<ellipse cx="50" cy="50" rx="${48 - sw}" ry="${48 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'ellipse', name: 'Elipse', category: 'basic', textAt: [50, 50], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<ellipse cx="50" cy="50" rx="${48 - sw}" ry="${32 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'triangle', name: 'Triángulo', category: 'basic', textAt: [50, 58], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="50,8 92,88 8,88" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'diamond', name: 'Rombo', category: 'basic', textAt: [50, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="50,6 94,50 50,94 6,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'pentagon', name: 'Pentágono', category: 'basic', textAt: [50, 52], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="50,6 93,38 76,90 24,90 7,38" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'hexagon', name: 'Hexágono', category: 'basic', textAt: [50, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="28,8 72,8 92,50 72,92 28,92 8,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'octagon', name: 'Octágono', category: 'basic', textAt: [50, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'star5', name: 'Estrella 5 puntas', category: 'basic', textAt: [50, 54], maxChars: 8,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="50,6 61,38 95,38 68,58 78,90 50,70 22,90 32,58 5,38 39,38" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'star6', name: 'Estrella 6 puntas', category: 'basic', textAt: [50, 52], maxChars: 8,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="50,6 65,28 90,28 75,50 90,72 65,72 50,94 35,72 10,72 25,50 10,28 35,28" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'heart', name: 'Corazón', category: 'basic', textAt: [50, 52], maxChars: 8,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M50 88 C20 65 6 45 6 30 C6 16 18 8 30 8 C38 8 46 12 50 20 C54 12 62 8 70 8 C82 8 94 16 94 30 C94 45 80 65 50 88 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'cloud', name: 'Nube', category: 'basic', textAt: [50, 52], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M28 78 C14 78 6 68 6 56 C6 44 16 36 28 36 C30 22 42 12 56 12 C72 12 84 24 84 40 C92 42 98 50 98 60 C98 70 90 78 78 78 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'shield', name: 'Escudo', category: 'basic', textAt: [50, 48], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M50 6 L88 22 V52 C88 74 70 90 50 96 C30 90 12 74 12 52 V22 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'cross', name: 'Cruz / Suma', category: 'basic', textAt: [50, 50], maxChars: 6,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M38 8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },

  // --- FLECHAS ---
  {
    id: 'arrow-right', name: 'Flecha derecha', category: 'arrows', textAt: [40, 50], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M6 30 H60 V12 L94 50 L60 88 V70 H6 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'arrow-left', name: 'Flecha izquierda', category: 'arrows', textAt: [60, 50], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M94 30 H40 V12 L6 50 L40 88 V70 H94 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'arrow-up', name: 'Flecha arriba', category: 'arrows', textAt: [50, 62], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M30 94 V40 H12 L50 6 L88 40 H70 V94 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'arrow-down', name: 'Flecha abajo', category: 'arrows', textAt: [50, 38], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M30 6 V60 H12 L50 94 L88 60 H70 V6 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'arrow-right-plain', name: 'Flecha simple', category: 'arrows', textAt: [42, 50], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M8 42 H55 V25 L90 50 L55 75 V58 H8 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'chevron-right', name: 'Chevron >', category: 'arrows', textAt: [42, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="8,12 52,50 8,88 30,88 74,50 30,12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'chevron-process', name: 'Chevron proceso', category: 'arrows', textAt: [46, 50], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="4,18 50,18 96,50 50,82 4,82 34,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'double-arrow', name: 'Doble flecha', category: 'arrows', textAt: [50, 50], maxChars: 8,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M6 30 H38 V14 L62 50 L38 86 V70 H6 Z M42 30 H74 V14 L98 50 L74 86 V70 H42 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },

  // --- LLAMADAS / CALLOUTS ---
  {
    id: 'callout-round', name: 'Bocadillo redondo', category: 'callouts', textAt: [50, 42], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M12 12 H88 Q96 12 96 20 V58 Q96 66 88 66 H48 L28 90 L32 66 H12 Q4 66 4 58 V20 Q4 12 12 12 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'callout-square', name: 'Bocadillo rectangular', category: 'callouts', textAt: [50, 40], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M6 10 H94 V62 H42 L24 90 L28 62 H6 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'callout-think', name: 'Bocadillo pensamiento', category: 'callouts', textAt: [50, 40], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M14 10 H86 Q94 10 94 18 V52 Q94 60 86 60 H14 Q6 60 6 52 V18 Q6 10 14 10 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
       <circle cx="32" cy="72" r="7" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.7}" />
       <circle cx="20" cy="86" r="4.5" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.7}" />`,
  },
  {
    id: 'callout-rect', name: 'Nota rectangular', category: 'callouts', textAt: [50, 50], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<rect x="6" y="14" width="88" height="72" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
       <path d="M6 22 L18 6 L26 14 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linejoin="round" />`,
  },
  {
    id: 'callout-bubble', name: 'Globo de diálogo', category: 'callouts', textAt: [50, 42], maxChars: 13,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<ellipse cx="50" cy="42" rx="44" ry="32" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
       <polygon points="38,68 30,94 56,72" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linejoin="round" />`,
  },

  // --- FLUJO ---
  {
    id: 'flow-process', name: 'Proceso', category: 'flowchart', textAt: [50, 50], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<rect x="8" y="22" width="84" height="56" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'flow-terminator', name: 'Inicio / Fin', category: 'flowchart', textAt: [50, 50], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<rect x="8" y="26" width="84" height="48" rx="24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'flow-decision', name: 'Decisión', category: 'flowchart', textAt: [50, 50], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="50,8 92,50 50,92 8,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'flow-data', name: 'Datos / Entrada', category: 'flowchart', textAt: [50, 50], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="22,22 92,22 78,78 8,78" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'flow-document', name: 'Documento', category: 'flowchart', textAt: [50, 46], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M10 18 H90 V72 Q72 88 50 78 Q28 68 10 78 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'flow-connector', name: 'Conector', category: 'flowchart', textAt: [50, 50], maxChars: 8,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<circle cx="50" cy="50" r="32" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'flow-preparation', name: 'Preparación', category: 'flowchart', textAt: [50, 50], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="22,18 78,18 96,50 78,82 22,82 4,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'flow-stored-data', name: 'Datos almacenados', category: 'flowchart', textAt: [50, 50], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M18 22 H82 Q96 22 96 36 V64 Q96 78 82 78 H18 Q4 78 4 64 V36 Q4 22 18 22 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },
  {
    id: 'flow-display', name: 'Salida', category: 'flowchart', textAt: [48, 50], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M22 22 H82 L96 50 L82 78 H22 Q10 78 10 64 V36 Q10 22 22 22 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'flow-manual-input', name: 'Entrada manual', category: 'flowchart', textAt: [50, 52], maxChars: 11,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<polygon points="16,24 92,18 92,82 16,82" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'flow-database', name: 'Base de datos', category: 'flowchart', textAt: [50, 52], maxChars: 10,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<ellipse cx="50" cy="22" rx="34" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
       <path d="M16 22 V78 Q16 90 50 90 Q84 90 84 78 V22" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
       <ellipse cx="50" cy="22" rx="34" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`,
  },

  // --- BANNERS ---
  {
    id: 'banner-ribbon', name: 'Cinta horizontal', category: 'banners', textAt: [50, 50], maxChars: 16,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M4 32 H96 V68 H68 L60 88 L52 68 H4 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'banner-ribbon-top', name: 'Cinta superior', category: 'banners', textAt: [50, 48], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M8 28 L18 8 H82 L92 28 H68 V88 H32 V28 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'banner-pennant', name: 'Bandera / Pennant', category: 'banners', textAt: [48, 42], maxChars: 12,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M22 8 H78 V92 L50 72 L22 92 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'banner-plate', name: 'Placa / Etiqueta', category: 'banners', textAt: [50, 50], maxChars: 16,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M6 28 L22 8 H78 L94 28 V72 L78 92 H22 L6 72 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
  },
  {
    id: 'banner-scroll', name: 'Pergamino', category: 'banners', textAt: [50, 50], maxChars: 14,
    body: ({ fill, stroke, strokeWidth: sw }) =>
      `<path d="M12 18 Q4 18 4 28 V72 Q4 82 12 82 H88 Q96 82 96 72 V28 Q96 18 88 18 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />
       <circle cx="12" cy="50" r="8" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.8}" />
       <circle cx="88" cy="50" r="8" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.8}" />`,
  },
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function renderShapeSvg(shape: ShapeDefinition, opts: ShapeRenderOptions): string {
  const { width, height, text, textColor = '#ffffff' } = opts;
  const body = shape.body(opts);

  let textSvg = '';
  if (text?.trim()) {
    const [cx, cy] = shape.textAt ?? [50, 50];
    const maxChars = shape.maxChars ?? 12;
    // font-size scales with the smaller dimension
    const fs = Math.max(9, Math.min(22, Math.min(width, height) * 0.11));
    const lines = wrapText(text.trim(), maxChars, 3);
    const lineHeight = fs * 1.25;
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;
    textSvg = lines
      .map(
        (line, i) =>
          `<text x="${cx}" y="${startY + i * lineHeight}" fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="${fs}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`,
      )
      .join('');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
    ${body}
    ${textSvg}
  </svg>`;
}

function thumbFor(shape: ShapeDefinition, active: boolean): string {
  const fill = active ? '#2563eb' : '#94a3b8';
  const stroke = active ? '#1e40af' : '#64748b';
  return renderShapeSvg(shape, {
    width: 36,
    height: 36,
    fill,
    stroke,
    strokeWidth: 2,
    textColor: '#ffffff',
  });
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todas',
  basic: 'Básicas',
  arrows: 'Flechas',
  callouts: 'Llamadas',
  flowchart: 'Flujo',
  banners: 'Banners',
};

export function openShapeModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let selectedShapeId = 'rounded-rect';
  let activeCategory = 'all';
  let shapeWidth = 220;
  let shapeHeight = 120;
  let fill = '#2563eb';
  let stroke = '#1e40af';
  let strokeWidth = 2;
  let text = '';
  let textColor: 'white' | 'dark' | 'gold' = 'white';

  const TEXT_COLORS = { white: '#ffffff', dark: '#0f172a', gold: '#fbbf24' };

  const getShape = () => SHAPES.find((s) => s.id === selectedShapeId) ?? SHAPES[0];

  const renderPreview = (): string =>
    svgToDataUri(
      renderShapeSvg(getShape(), {
        width: shapeWidth,
        height: shapeHeight,
        fill,
        stroke,
        strokeWidth,
        text,
        textColor: TEXT_COLORS[textColor],
      }),
    );

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Shapes, 18)}</span>
          <h2 class="cde-modal__title">Insertar forma</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body">
        <div class="cde-modal-cols">
          <!-- Left: categories + shapes -->
          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Categoría</span>
              <div class="flex gap-1.5 flex-wrap" id="cde-shape-cats">
                ${Object.entries(CATEGORY_LABELS)
                  .map(
                    ([id, label]) => `
                  <button type="button" class="cde-chip ${id === activeCategory ? 'is-active' : ''}" data-cat="${id}">${label}</button>`,
                  )
                  .join('')}
              </div>
            </div>

            <div class="cde-grid cde-grid--shapes flex-1" id="cde-shape-grid"></div>

            <div>
              <label class="cde-field-label" for="cde-shape-text">Texto (opcional)</label>
              <input id="cde-shape-text" type="text" class="cde-modal__input" value="${escapeXml(text)}" placeholder="Ej. Aprobado, Importante…" />
            </div>
          </div>

          <!-- Right: style + preview -->
          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Relleno</span>
              <div class="flex flex-wrap gap-2 items-center" id="cde-shape-fills">
                ${FILL_COLORS.map(
                  (c) => `
                  <button type="button" class="cde-swatch ${c === fill ? 'is-active' : ''}" data-fill="${c}" style="background:${c}"></button>`,
                ).join('')}
                <label class="cde-swatch-custom" title="Color personalizado">
                  <input type="color" id="cde-shape-fill-custom" value="${fill}" />
                </label>
              </div>
            </div>

            <div>
              <span class="cde-field-label">Borde</span>
              <div class="flex flex-wrap gap-2 items-center" id="cde-shape-strokes">
                ${STROKE_COLORS.map(
                  (c) => `
                  <button type="button" class="cde-swatch ${c === stroke ? 'is-active' : ''}" data-stroke="${c}" style="background:${c === 'transparent' ? 'repeating-linear-gradient(45deg,#fee2e2 0 4px,#fff 4px 8px)' : c}"></button>`,
                ).join('')}
                <label class="cde-swatch-custom" title="Color de borde">
                  <input type="color" id="cde-shape-stroke-custom" value="${stroke}" />
                </label>
              </div>
            </div>

            <div>
              <span class="cde-field-label">Grosor de borde: ${strokeWidth}px</span>
              <input type="range" id="cde-shape-stroke-w" min="0" max="8" step="1" value="${strokeWidth}" />
            </div>

            <div>
              <span class="cde-field-label">Color del texto</span>
              <div class="flex gap-1.5 flex-wrap" id="cde-shape-text-colors">
                ${(['white', 'dark', 'gold'] as const)
                  .map(
                    (t) => `
                  <button type="button" class="cde-chip ${t === textColor ? 'is-active' : ''}" data-tcolor="${t}">${t === 'white' ? 'Blanco' : t === 'dark' ? 'Oscuro' : 'Dorado'}</button>`,
                  )
                  .join('')}
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-1">
                <span class="cde-field-label mb-0">Ancho</span>
                <input id="cde-shape-w" type="number" min="60" max="800" value="${shapeWidth}" class="cde-modal__input w-24" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="cde-field-label mb-0">Alto</span>
                <input id="cde-shape-h" type="number" min="40" max="600" value="${shapeHeight}" class="cde-modal__input w-24" />
              </div>
            </div>

            <div class="flex-1 min-h-0">
              <span class="cde-field-label">Vista previa</span>
              <div class="cde-preview-box h-full min-h-[12rem]" id="cde-shape-preview-box"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer">
        <span class="text-xs text-neutral-400">Se insertará como imagen SVG vectorial</span>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="cde-shape-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="cde-shape-insert">Insertar forma</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#cde-shape-grid') as HTMLElement;
  const previewBox = overlay.querySelector('#cde-shape-preview-box') as HTMLElement;

  const updatePreview = () => {
    previewBox.innerHTML = `<img alt="Vista previa de la forma" src="${renderPreview()}" />`;
  };

  const renderGrid = () => {
    const list = activeCategory === 'all' ? SHAPES : SHAPES.filter((s) => s.category === activeCategory);
    grid.innerHTML = list
      .map((s) => {
        const active = s.id === selectedShapeId;
        return `
        <button type="button" class="cde-pick-card cde-shape-cell ${active ? 'is-active' : ''}" data-shape="${s.id}" title="${s.name}">
          ${thumbFor(s, active)}
          <span class="text-xs text-neutral-600 leading-tight">${s.name}</span>
        </button>`;
      })
      .join('');
  };

  renderGrid();
  updatePreview();

  // --- events ---
  overlay.querySelector('#cde-shape-cats')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-cat]') as HTMLElement | null;
    if (!btn) return;
    activeCategory = btn.dataset.cat!;
    overlay.querySelectorAll('#cde-shape-cats [data-cat]').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.cat === activeCategory ? ' is-active' : '');
    });
    renderGrid();
  });

  grid.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-shape]') as HTMLElement | null;
    if (!cell) return;
    selectedShapeId = cell.dataset.shape!;
    renderGrid();
    updatePreview();
  });

  (overlay.querySelector('#cde-shape-text') as HTMLInputElement).addEventListener('input', (e) => {
    text = (e.target as HTMLInputElement).value;
    updatePreview();
  });

  overlay.querySelector('#cde-shape-fills')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-fill]') as HTMLElement | null;
    if (!btn) return;
    fill = btn.dataset.fill!;
    overlay.querySelectorAll('[data-fill]').forEach((el) => {
      el.className = 'cde-swatch' + ((el as HTMLElement).dataset.fill === fill ? ' is-active' : '');
    });
    updatePreview();
  });

  overlay.querySelector('#cde-shape-fill-custom')!.addEventListener('input', (e) => {
    fill = (e.target as HTMLInputElement).value;
    overlay.querySelectorAll('[data-fill]').forEach((el) => {
      el.className = 'cde-swatch';
    });
    updatePreview();
  });

  overlay.querySelector('#cde-shape-strokes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-stroke]') as HTMLElement | null;
    if (!btn) return;
    stroke = btn.dataset.stroke!;
    overlay.querySelectorAll('[data-stroke]').forEach((el) => {
      el.className = 'cde-swatch' + ((el as HTMLElement).dataset.stroke === stroke ? ' is-active' : '');
    });
    updatePreview();
  });

  overlay.querySelector('#cde-shape-stroke-custom')!.addEventListener('input', (e) => {
    stroke = (e.target as HTMLInputElement).value;
    overlay.querySelectorAll('[data-stroke]').forEach((el) => {
      el.className = 'cde-swatch';
    });
    updatePreview();
  });

  (overlay.querySelector('#cde-shape-stroke-w') as HTMLInputElement).addEventListener('input', (e) => {
    strokeWidth = Number((e.target as HTMLInputElement).value);
    const label = overlay.querySelector('#cde-shape-stroke-w')!.previousElementSibling;
    if (label) label.textContent = 'Grosor de borde: ' + strokeWidth + 'px';
    updatePreview();
  });

  overlay.querySelector('#cde-shape-text-colors')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-tcolor]') as HTMLElement | null;
    if (!btn) return;
    textColor = btn.dataset.tcolor as any;
    overlay.querySelectorAll('[data-tcolor]').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.tcolor === textColor ? ' is-active' : '');
    });
    updatePreview();
  });

  (overlay.querySelector('#cde-shape-w') as HTMLInputElement).addEventListener('change', (e) => {
    shapeWidth = Math.min(800, Math.max(60, Number((e.target as HTMLInputElement).value) || 220));
    updatePreview();
  });

  (overlay.querySelector('#cde-shape-h') as HTMLInputElement).addEventListener('change', (e) => {
    shapeHeight = Math.min(600, Math.max(40, Number((e.target as HTMLInputElement).value) || 120));
    updatePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#cde-shape-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  overlay.querySelector('#cde-shape-insert')!.addEventListener('click', () => {
    const src = renderPreview();
    if (!src) return;
    insertImage(editor, src, {
      alt: `Forma: ${getShape().name}`,
      width: shapeWidth,
      height: shapeHeight,
    });
    close();
  });
}

import { lucideSvg, Shapes } from '../icons';
import type { ShapeAttrs } from '../extensions/illustration/ShapeNode';
import { SHAPES, FILL_COLORS, STROKE_COLORS, CATEGORY_LABELS, renderShapeSvg } from './shapeGenerator';
import { escapeXml, svgToDataUri } from './imageFromUri';

/**
 * Shape editor modal. Receives current attrs and calls onUpdate with new attrs.
 */
export function openShapeEditorModal(
  current: ShapeAttrs,
  onUpdate: (attrs: Partial<ShapeAttrs>) => void,
): void {
  document.querySelectorAll('.cde-modal-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let shapeId = current.shapeId || 'rounded-rect';
  let width = current.width || 220;
  let height = current.height || 120;
  let fill = current.fill || '#2563eb';
  let stroke = current.stroke || '#1e40af';
  let strokeWidth = current.strokeWidth ?? 2;
  let text = current.text || '';
  let textColor = current.textColor || '#ffffff';
  let activeCategory = 'all';

  const TEXT_COLORS: Record<string, string> = { white: '#ffffff', dark: '#0f172a', gold: '#fbbf24' };

  const getShape = () => SHAPES.find((s) => s.id === shapeId) ?? SHAPES[0];

  const thumbFor = (id: string, active: boolean): string => {
    const shape = SHAPES.find((s) => s.id === id);
    if (!shape) return '';
    return renderShapeSvg(shape, {
      width: 36, height: 36,
      fill: active ? '#2563eb' : '#94a3b8',
      stroke: active ? '#1e40af' : '#64748b',
      strokeWidth: 2,
      textColor: '#ffffff',
    });
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2.5">
          <span class="text-blue-600">${lucideSvg(Shapes, 20)}</span>
          <h2 class="cde-modal__title">${current.shapeId ? 'Editar forma' : 'Nueva forma'}</h2>
        </div>
        <button type="button" class="cde-modal__close" title="Cerrar">&times;</button>
      </div>

      <div class="cde-modal__body">
        <div class="cde-modal-cols">
          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Categoría</span>
              <div class="flex gap-1.5 flex-wrap" id="se-cats">
                ${Object.entries(CATEGORY_LABELS).map(([id, label]) => `
                  <button type="button" class="cde-chip ${id === activeCategory ? 'is-active' : ''}" data-cat="${id}">${label}</button>
                `).join('')}
              </div>
            </div>
            <div class="cde-grid cde-grid--shapes flex-1" id="se-grid"></div>
            <div>
              <label class="cde-field-label" for="se-text">Texto</label>
              <input id="se-text" class="cde-modal__input" value="${escapeXml(text)}" placeholder="Texto opcional" />
            </div>
          </div>

          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Relleno</span>
              <div class="flex flex-wrap gap-2 items-center" id="se-fills">
                ${FILL_COLORS.map((c) => `
                  <button type="button" class="cde-swatch ${c === fill ? 'is-active' : ''}" data-fill="${c}" style="background:${c}"></button>
                `).join('')}
                <label class="cde-swatch-custom"><input type="color" id="se-fill-custom" value="${fill}" /></label>
              </div>
            </div>
            <div>
              <span class="cde-field-label">Borde</span>
              <div class="flex flex-wrap gap-2 items-center" id="se-strokes">
                ${STROKE_COLORS.map((c) => `
                  <button type="button" class="cde-swatch ${c === stroke ? 'is-active' : ''}" data-stroke="${c}" style="background:${c === 'transparent' ? 'repeating-linear-gradient(45deg,#fee2e2 0 4px,#fff 4px 8px)' : c}"></button>
                `).join('')}
                <label class="cde-swatch-custom"><input type="color" id="se-stroke-custom" value="${stroke}" /></label>
              </div>
            </div>
            <div>
              <span class="cde-field-label">Grosor: <span id="se-sw-val">${strokeWidth}</span>px</span>
              <input type="range" id="se-sw" min="0" max="8" step="1" value="${strokeWidth}" />
            </div>
            <div>
              <span class="cde-field-label">Color del texto</span>
              <div class="flex gap-1.5" id="se-tcolors">
                ${Object.entries(TEXT_COLORS).map(([k]) => `
                  <button type="button" class="cde-chip ${k === textColor ? 'is-active' : ''}" data-tc="${k}">${k === 'white' ? 'Blanco' : k === 'dark' ? 'Oscuro' : 'Dorado'}</button>
                `).join('')}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-1"><span class="cde-field-label mb-0">Ancho</span>
                <input id="se-w" type="number" min="60" max="800" value="${width}" class="cde-modal__input w-24" /></div>
              <div class="flex flex-col gap-1"><span class="cde-field-label mb-0">Alto</span>
                <input id="se-h" type="number" min="40" max="600" value="${height}" class="cde-modal__input w-24" /></div>
            </div>
            <div class="flex-1 min-h-0">
              <span class="cde-field-label">Vista previa</span>
              <div class="cde-preview-box h-full min-h-[12rem]" id="se-preview"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer">
        <span class="text-xs text-neutral-400">Se insertará como forma editable</span>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="se-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="se-save">${current.shapeId ? 'Guardar cambios' : 'Insertar forma'}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const preview = overlay.querySelector('#se-preview') as HTMLElement;
  const grid = overlay.querySelector('#se-grid') as HTMLElement;

  const updatePreview = () => {
    const shape = getShape();
    const svg = renderShapeSvg(shape, {
      width, height, fill, stroke, strokeWidth,
      text, textColor: TEXT_COLORS[textColor] || textColor,
    });
    preview.innerHTML = `<img alt="Vista previa" src="${svgToDataUri(svg)}" />`;
  };

  const renderGrid = () => {
    const list = activeCategory === 'all' ? SHAPES : SHAPES.filter((s) => s.category === activeCategory);
    grid.innerHTML = list.map((s) => {
      const active = s.id === shapeId;
      return `
        <button type="button" class="cde-pick-card ${active ? 'is-active' : ''}" data-shape="${s.id}" title="${s.name}">
          ${thumbFor(s.id, active)}
          <span class="text-xs text-neutral-600 leading-tight">${s.name}</span>
        </button>`;
    }).join('');
  };

  renderGrid();
  updatePreview();

  // Events
  overlay.querySelector('#se-cats')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-cat]') as HTMLElement | null;
    if (!btn) return;
    activeCategory = btn.dataset.cat!;
    overlay.querySelectorAll('#se-cats [data-cat]').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.cat === activeCategory ? ' is-active' : '');
    });
    renderGrid();
  });

  grid.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-shape]') as HTMLElement | null;
    if (!cell) return;
    shapeId = cell.dataset.shape!;
    renderGrid();
    updatePreview();
  });

  (overlay.querySelector('#se-text') as HTMLInputElement).addEventListener('input', (e) => {
    text = (e.target as HTMLInputElement).value;
    updatePreview();
  });

  overlay.querySelector('#se-fills')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-fill]') as HTMLElement | null;
    if (!btn) return;
    fill = btn.dataset.fill!;
    overlay.querySelectorAll('[data-fill]').forEach((el) => {
      el.className = 'cde-swatch' + ((el as HTMLElement).dataset.fill === fill ? ' is-active' : '');
    });
    updatePreview();
  });

  overlay.querySelector('#se-fill-custom')!.addEventListener('input', (e) => {
    fill = (e.target as HTMLInputElement).value;
    overlay.querySelectorAll('[data-fill]').forEach((el) => { el.className = 'cde-swatch'; });
    updatePreview();
  });

  overlay.querySelector('#se-strokes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-stroke]') as HTMLElement | null;
    if (!btn) return;
    stroke = btn.dataset.stroke!;
    overlay.querySelectorAll('[data-stroke]').forEach((el) => {
      el.className = 'cde-swatch' + ((el as HTMLElement).dataset.stroke === stroke ? ' is-active' : '');
    });
    updatePreview();
  });

  overlay.querySelector('#se-stroke-custom')!.addEventListener('input', (e) => {
    stroke = (e.target as HTMLInputElement).value;
    overlay.querySelectorAll('[data-stroke]').forEach((el) => { el.className = 'cde-swatch'; });
    updatePreview();
  });

  (overlay.querySelector('#se-sw') as HTMLInputElement).addEventListener('input', (e) => {
    strokeWidth = Number((e.target as HTMLInputElement).value);
    const val = overlay.querySelector('#se-sw-val');
    if (val) val.textContent = String(strokeWidth);
    updatePreview();
  });

  overlay.querySelector('#se-tcolors')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-tc]') as HTMLElement | null;
    if (!btn) return;
    textColor = btn.dataset.tc!;
    overlay.querySelectorAll('[data-tc]').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.tc === textColor ? ' is-active' : '');
    });
    updatePreview();
  });

  (overlay.querySelector('#se-w') as HTMLInputElement).addEventListener('change', (e) => {
    width = Math.min(800, Math.max(60, Number((e.target as HTMLInputElement).value) || 220));
    updatePreview();
  });

  (overlay.querySelector('#se-h') as HTMLInputElement).addEventListener('change', (e) => {
    height = Math.min(600, Math.max(40, Number((e.target as HTMLInputElement).value) || 120));
    updatePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#se-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  overlay.querySelector('#se-save')!.addEventListener('click', () => {
    onUpdate({ shapeId, width, height, fill, stroke, strokeWidth, text, textColor });
    close();
  });
}

import { lucideSvg, ChartColumn, Plus, Trash2 } from '../icons';
import type { ChartAttrs } from '../extensions/illustration/ChartNode';
import { CHART_TYPES, PALETTES } from './chartGenerator';
import { escapeXml } from './imageFromUri';

/**
 * Opens the chart editor modal. Receives current attrs and calls onUpdate with new attrs.
 * Does NOT insert anything into the document — the ChartNode handles that.
 */
export function openChartEditorModal(
  current: ChartAttrs,
  onUpdate: (attrs: Partial<ChartAttrs>) => void,
): void {
  // Close any existing modal first (prevent overlap)
  document.querySelectorAll('.cde-modal-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let chartType = current.chartType || 'column';
  let title = current.title ?? '';
  let data = (current.data ?? []).map((d) => ({ ...d }));
  let paletteId = current.paletteId || 'blue';
  let showLegend = current.showLegend !== false;
  let showLabels = current.showLabels !== false;
  let width = current.width || 720;
  let height = current.height || 420;

  const typeThumb = (id: string, active: boolean): string => {
    const stroke = active ? '#2563eb' : '#64748b';
    const fill = active ? '#93c5fd' : '#cbd5e1';
    const inner = (() => {
      switch (id) {
        case 'column': case 'stacked':
          return `<rect x="4" y="16" width="6" height="12" fill="${fill}" rx="1"/><rect x="13" y="10" width="6" height="18" fill="${stroke}" rx="1"/><rect x="22" y="6" width="6" height="22" fill="${fill}" rx="1"/>`;
        case 'bar':
          return `<rect x="4" y="6" width="18" height="5" fill="${fill}" rx="1"/><rect x="4" y="14" width="24" height="5" fill="${stroke}" rx="1"/><rect x="4" y="22" width="12" height="5" fill="${fill}" rx="1"/>`;
        case 'line': case 'area': case 'multiLine':
          return `<polyline points="4,22 12,12 20,16 28,6" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
        case 'pie':
          return `<circle cx="16" cy="16" r="11" fill="${stroke}"/><path d="M16 16 L16 5 A11 11 0 0 1 25 20 Z" fill="${fill}"/>`;
        case 'donut':
          return `<circle cx="16" cy="16" r="11" fill="none" stroke="${stroke}" stroke-width="5"/><circle cx="16" cy="16" r="11" fill="none" stroke="${fill}" stroke-width="5" stroke-dasharray="18 52"/>`;
        case 'rose':
          return `<circle cx="16" cy="16" r="4" fill="${stroke}"/><circle cx="16" cy="16" r="9" fill="none" stroke="${fill}" stroke-width="4"/>`;
        case 'scatter':
          return `<circle cx="8" cy="22" r="3" fill="${stroke}"/><circle cx="16" cy="12" r="3" fill="${fill}"/><circle cx="24" cy="18" r="3" fill="${stroke}"/>`;
        case 'radar':
          return `<polygon points="16,4 26,12 22,26 10,26 6,12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
        case 'funnel':
          return `<polygon points="4,6 28,6 22,16 10,16" fill="${stroke}"/><polygon points="10,18 22,18 18,28 14,28" fill="${fill}"/>`;
        case 'gauge':
          return `<path d="M6 22 A11 11 0 1 1 26 22" fill="none" stroke="${fill}" stroke-width="3"/><line x1="16" y1="16" x2="22" y2="10" stroke="${stroke}" stroke-width="2.5"/>`;
        case 'treemap':
          return `<rect x="4" y="6" width="12" height="10" fill="${stroke}" rx="1"/><rect x="18" y="6" width="10" height="16" fill="${fill}" rx="1"/><rect x="4" y="18" width="12" height="10" fill="${fill}" rx="1"/>`;
        default:
          return `<rect x="6" y="8" width="20" height="16" fill="${fill}" rx="2"/>`;
      }
    })();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28">${inner}</svg>`;
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2.5">
          <span class="text-blue-600">${lucideSvg(ChartColumn, 20)}</span>
          <h2 class="cde-modal__title">${current.chartType ? 'Editar gráfico' : 'Nuevo gráfico'}</h2>
        </div>
        <button type="button" class="cde-modal__close" title="Cerrar">&times;</button>
      </div>

      <div class="cde-modal__body">
        <div class="cde-modal-cols">
          <div class="cde-modal-col">
            <div>
              <label class="cde-field-label" for="ce-title">Título</label>
              <input id="ce-title" class="cde-modal__input" value="${escapeXml(title)}" placeholder="Ej. Rendimiento Trimestral" />
            </div>

            <div>
              <span class="cde-field-label">Tipo de gráfico</span>
              <div class="cde-grid cde-grid--types" id="ce-types">
                ${CHART_TYPES.map((t) => `
                  <button type="button" class="cde-pick-card ${t.id === chartType ? 'is-active' : ''}" data-id="${t.id}">
                    ${typeThumb(t.id, t.id === chartType)}
                    <span class="text-xs font-medium text-neutral-700">${t.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="cde-field-label mb-0">Datos</span>
                <button type="button" class="cde-btn cde-btn--secondary text-xs py-1 px-2.5" id="ce-add">
                  ${lucideSvg(Plus, 13)} Añadir fila
                </button>
              </div>
              <div class="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1" id="ce-data"></div>
            </div>
          </div>

          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Paleta</span>
              <div class="flex flex-wrap gap-2" id="ce-palettes">
                ${PALETTES.map((p) => `
                  <button type="button" class="cde-chip ${p.id === paletteId ? 'is-active' : ''}" data-palette="${p.id}">
                    <span class="flex gap-0.5">${p.colors.slice(0, 4).map((c) => `<span class="w-2 h-2 rounded-full" style="background:${c}"></span>`).join('')}</span>
                    <span>${p.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="flex items-center gap-5">
              <label class="cde-check"><input type="checkbox" id="ce-legend" ${showLegend ? 'checked' : ''} /> <span>Mostrar leyenda</span></label>
              <label class="cde-check"><input type="checkbox" id="ce-labels" ${showLabels ? 'checked' : ''} /> <span>Mostrar valores</span></label>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-1">
                <span class="cde-field-label mb-0">Ancho</span>
                <input id="ce-w" type="number" min="320" max="1200" value="${width}" class="cde-modal__input w-24" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="cde-field-label mb-0">Alto</span>
                <input id="ce-h" type="number" min="200" max="800" value="${height}" class="cde-modal__input w-24" />
              </div>
            </div>

            <div class="flex-1 min-h-0">
              <span class="cde-field-label">Vista previa</span>
              <div class="cde-preview-box h-full min-h-[16rem]" id="ce-preview"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer">
        <span class="text-xs text-neutral-400">Se insertará como gráfico editable</span>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="ce-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="ce-save">${current.chartType ? 'Guardar cambios' : 'Insertar gráfico'}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const preview = overlay.querySelector('#ce-preview') as HTMLElement;
  const dataList = overlay.querySelector('#ce-data') as HTMLElement;

  let previewTimer: number | undefined;
  const schedulePreview = () => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      const t = CHART_TYPES.find((x) => x.id === chartType) ?? CHART_TYPES[0];
      const p = PALETTES.find((x) => x.id === paletteId) ?? PALETTES[0];
      const option = t.buildOption(title, data, p.colors, showLegend, showLabels);
      import('./chartGenerator').then(({ echartsToSvgDataUri }) => {
        const src = echartsToSvgDataUri(option, width, height);
        preview.innerHTML = src ? `<img alt="Vista previa" src="${src}" />` : '';
      });
    }, 150);
  };

  const renderData = () => {
    dataList.innerHTML = data.map((d, i) => `
      <div class="cde-data-row" data-index="${i}">
        <input type="text" class="cde-modal__input flex-1" data-field="label" value="${escapeXml(d.label)}" placeholder="Etiqueta" />
        <input type="number" class="cde-modal__input w-24" data-field="value" value="${d.value}" />
        <button type="button" class="text-neutral-400 hover:text-red-500 p-1 rounded transition-colors" data-remove="${i}" title="Eliminar">
          ${lucideSvg(Trash2, 14)}
        </button>
      </div>
    `).join('');
  };

  renderData();
  schedulePreview();

  // Events
  (overlay.querySelector('#ce-title') as HTMLInputElement).addEventListener('input', (e) => {
    title = (e.target as HTMLInputElement).value;
    schedulePreview();
  });

  overlay.querySelector('#ce-types')!.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null;
    if (!card) return;
    chartType = card.dataset.id!;
    overlay.querySelectorAll('#ce-types .cde-pick-card').forEach((el) => {
      const id = (el as HTMLElement).dataset.id;
      const active = id === chartType;
      el.className = 'cde-pick-card' + (active ? ' is-active' : '');
      const thumb = el.querySelector('svg');
      if (thumb) thumb.outerHTML = typeThumb(id!, active);
    });
    schedulePreview();
  });

  dataList.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const row = target.closest('[data-index]') as HTMLElement | null;
    if (!row) return;
    const idx = Number(row.dataset.index);
    if (target.dataset.field === 'label') data[idx].label = target.value;
    if (target.dataset.field === 'value') data[idx].value = Number(target.value) || 0;
    schedulePreview();
  });

  dataList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-remove]') as HTMLElement | null;
    if (!btn) return;
    const idx = Number(btn.dataset.remove);
    if (data.length <= 1) return;
    data.splice(idx, 1);
    renderData();
    schedulePreview();
  });

  overlay.querySelector('#ce-add')!.addEventListener('click', () => {
    const last = data[data.length - 1];
    data.push({ label: 'Item ' + (data.length + 1), value: last ? last.value : 0 });
    renderData();
    schedulePreview();
  });

  overlay.querySelector('#ce-palettes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-palette]') as HTMLElement | null;
    if (!btn) return;
    paletteId = btn.dataset.palette!;
    overlay.querySelectorAll('#ce-palettes .cde-chip').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.palette === paletteId ? ' is-active' : '');
    });
    schedulePreview();
  });

  (overlay.querySelector('#ce-legend') as HTMLInputElement).addEventListener('change', (e) => {
    showLegend = (e.target as HTMLInputElement).checked;
    schedulePreview();
  });

  (overlay.querySelector('#ce-labels') as HTMLInputElement).addEventListener('change', (e) => {
    showLabels = (e.target as HTMLInputElement).checked;
    schedulePreview();
  });

  (overlay.querySelector('#ce-w') as HTMLInputElement).addEventListener('change', (e) => {
    width = Math.min(1200, Math.max(320, Number((e.target as HTMLInputElement).value) || 720));
    schedulePreview();
  });

  (overlay.querySelector('#ce-h') as HTMLInputElement).addEventListener('change', (e) => {
    height = Math.min(800, Math.max(200, Number((e.target as HTMLInputElement).value) || 420));
    schedulePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#ce-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  overlay.querySelector('#ce-save')!.addEventListener('click', () => {
    onUpdate({ chartType, title, data, paletteId, showLegend, showLabels, width, height });
    close();
  });
}

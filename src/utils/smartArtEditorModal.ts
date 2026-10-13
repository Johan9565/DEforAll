import { lucideSvg, Workflow, Plus, Trash2, ChevronDown } from '../icons';
import type { SmartArtAttrs } from '../extensions/illustration/SmartArtNode';
import { SMART_ART_TEMPLATES, PALETTES, CATEGORY_LABELS } from './smartArtGenerator';
import { escapeXml, svgToDataUri } from './imageFromUri';

export function openSmartArtEditorModal(
  current: SmartArtAttrs,
  onUpdate: (attrs: Partial<SmartArtAttrs>) => void,
): void {
  document.querySelectorAll('.cde-modal-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let templateId = current.templateId || 'chevron-process';
  let items = (current.items ?? []).map((i) => ({ ...i }));
  if (!items.length) {
    items = [
      { id: '1', title: 'Fase 1', desc: 'Inicio' },
      { id: '2', title: 'Fase 2', desc: 'Desarrollo' },
      { id: '3', title: 'Fase 3', desc: 'Revisión' },
      { id: '4', title: 'Fase 4', desc: 'Entrega' },
    ];
  }
  let paletteId = current.paletteId || 'blue';
  let width = current.width || 720;
  let height = current.height || 280;
  let activeCategory = 'all';

  const getTpl = () => SMART_ART_TEMPLATES.find((t) => t.id === templateId) ?? SMART_ART_TEMPLATES[0];
  const getPal = () => PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2.5">
          <span class="text-blue-600">${lucideSvg(Workflow, 20)}</span>
          <h2 class="cde-modal__title">${current.templateId ? 'Editar SmartArt' : 'Nuevo SmartArt'}</h2>
        </div>
        <button type="button" class="cde-modal__close" title="Cerrar">&times;</button>
      </div>

      <div class="cde-modal__body">
        <div class="cde-modal-cols">
          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Categoría</span>
              <div class="flex gap-1.5 flex-wrap" id="sa-cats">
                ${Object.entries(CATEGORY_LABELS).map(([id, label]) => `
                  <button type="button" class="cde-chip ${id === activeCategory ? 'is-active' : ''}" data-cat="${id}">${label}</button>
                `).join('')}
              </div>
            </div>
            <div>
              <span class="cde-field-label">Plantilla</span>
              <div class="cde-grid cde-grid--presets" id="sa-tpls">
                ${SMART_ART_TEMPLATES.map((t) => `
                  <button type="button" class="cde-pick-card ${t.id === templateId ? 'is-active' : ''}" data-tpl="${t.id}" data-cat="${t.category}">
                    ${t.thumb}
                    <span class="text-xs font-medium text-neutral-700">${t.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="cde-field-label mb-0">Elementos</span>
                <button type="button" class="cde-btn cde-btn--secondary text-xs py-1 px-2.5" id="sa-add">
                  ${lucideSvg(Plus, 13)} Añadir
                </button>
              </div>
              <div class="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1" id="sa-items"></div>
            </div>
          </div>

          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Paleta</span>
              <div class="flex flex-wrap gap-2" id="sa-palettes">
                ${PALETTES.map((p) => `
                  <button type="button" class="cde-chip ${p.id === paletteId ? 'is-active' : ''}" data-palette="${p.id}">
                    <span class="flex gap-0.5">${p.colors.slice(0, 4).map((c) => `<span class="w-2 h-2 rounded-full" style="background:${c}"></span>`).join('')}</span>
                    <span>${p.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-1"><span class="cde-field-label mb-0">Ancho</span>
                <input id="sa-w" type="number" min="320" max="1200" value="${width}" class="cde-modal__input w-24" /></div>
              <div class="flex flex-col gap-1"><span class="cde-field-label mb-0">Alto</span>
                <input id="sa-h" type="number" min="160" max="800" value="${height}" class="cde-modal__input w-24" /></div>
            </div>
            <div class="flex-1 min-h-0">
              <span class="cde-field-label">Vista previa</span>
              <div class="cde-preview-box h-full min-h-[16rem]" id="sa-preview"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer">
        <span class="text-xs text-neutral-400">Se insertará como SmartArt editable</span>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="sa-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="sa-save">${current.templateId ? 'Guardar cambios' : 'Insertar SmartArt'}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const preview = overlay.querySelector('#sa-preview') as HTMLElement;
  const itemsEl = overlay.querySelector('#sa-items') as HTMLElement;

  const updatePreview = () => {
    const tpl = getTpl();
    const pal = getPal();
    const svg = tpl.renderSvg(items, pal.colors, width, height);
    preview.innerHTML = `<img alt="Vista previa" src="${svgToDataUri(svg)}" />`;
  };

  const renderItems = () => {
    itemsEl.innerHTML = items.map((it, i) => `
      <div class="cde-data-row" data-index="${i}">
        <input type="text" class="cde-modal__input flex-1" data-field="title" value="${escapeXml(it.title)}" placeholder="Título" />
        <input type="text" class="cde-modal__input flex-1" data-field="desc" value="${escapeXml(it.desc)}" placeholder="Descripción" />
        <button type="button" class="text-neutral-400 hover:text-blue-500 p-1 rounded transition-colors" data-up="${i}" title="Subir">
          <span style="display:inline-block;transform:rotate(180deg)">${lucideSvg(ChevronDown, 12)}</span>
        </button>
        <button type="button" class="text-neutral-400 hover:text-blue-500 p-1 rounded transition-colors" data-down="${i}" title="Bajar">${lucideSvg(ChevronDown, 12)}</button>
        <button type="button" class="text-neutral-400 hover:text-red-500 p-1 rounded transition-colors" data-remove="${i}" title="Eliminar">${lucideSvg(Trash2, 13)}</button>
      </div>
    `).join('');
  };

  renderItems();
  updatePreview();

  // Events
  overlay.querySelector('#sa-cats')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-cat]') as HTMLElement | null;
    if (!btn) return;
    activeCategory = btn.dataset.cat!;
    overlay.querySelectorAll('#sa-cats [data-cat]').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.cat === activeCategory ? ' is-active' : '');
    });
    overlay.querySelectorAll('#sa-tpls [data-tpl]').forEach((el) => {
      const tc = (el as HTMLElement).dataset.cat;
      (el as HTMLElement).style.display = activeCategory === 'all' || tc === activeCategory ? '' : 'none';
    });
  });

  overlay.querySelector('#sa-tpls')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-tpl]') as HTMLElement | null;
    if (!btn) return;
    templateId = btn.dataset.tpl!;
    overlay.querySelectorAll('#sa-tpls [data-tpl]').forEach((el) => {
      el.className = 'cde-pick-card' + ((el as HTMLElement).dataset.tpl === templateId ? ' is-active' : '');
    });
    updatePreview();
  });

  itemsEl.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const row = target.closest('[data-index]') as HTMLElement | null;
    if (!row) return;
    const idx = Number(row.dataset.index);
    if (target.dataset.field === 'title') items[idx].title = target.value;
    if (target.dataset.field === 'desc') items[idx].desc = target.value;
    updatePreview();
  });

  itemsEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const rm = t.closest('[data-remove]') as HTMLElement | null;
    if (rm) {
      const i = Number(rm.dataset.remove);
      if (items.length > 1) items.splice(i, 1);
      renderItems();
      updatePreview();
      return;
    }
    const up = t.closest('[data-up]') as HTMLElement | null;
    if (up) {
      const i = Number(up.dataset.up);
      if (i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
      renderItems();
      updatePreview();
      return;
    }
    const down = t.closest('[data-down]') as HTMLElement | null;
    if (down) {
      const i = Number(down.dataset.down);
      if (i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
      renderItems();
      updatePreview();
    }
  });

  overlay.querySelector('#sa-add')!.addEventListener('click', () => {
    items.push({ id: String(Date.now()), title: 'Fase ' + (items.length + 1), desc: '' });
    renderItems();
    updatePreview();
  });

  overlay.querySelector('#sa-palettes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-palette]') as HTMLElement | null;
    if (!btn) return;
    paletteId = btn.dataset.palette!;
    overlay.querySelectorAll('#sa-palettes .cde-chip').forEach((el) => {
      el.className = 'cde-chip' + ((el as HTMLElement).dataset.palette === paletteId ? ' is-active' : '');
    });
    updatePreview();
  });

  (overlay.querySelector('#sa-w') as HTMLInputElement).addEventListener('change', (e) => {
    width = Math.min(1200, Math.max(320, Number((e.target as HTMLInputElement).value) || 720));
    updatePreview();
  });

  (overlay.querySelector('#sa-h') as HTMLInputElement).addEventListener('change', (e) => {
    height = Math.min(800, Math.max(160, Number((e.target as HTMLInputElement).value) || 280));
    updatePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#sa-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  overlay.querySelector('#sa-save')!.addEventListener('click', () => {
    onUpdate({ templateId, items, paletteId, width, height });
    close();
  });
}

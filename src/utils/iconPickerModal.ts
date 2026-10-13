import type { Editor } from '@tiptap/core';
import { lucideSvg, Smile, Search } from '../icons';
import { svgToDataUri, insertImage, escapeXml } from './imageFromUri';
import { icons as lucideIcons } from '@iconify-json/lucide';
import { icons as tablerIcons } from '@iconify-json/tabler';
import { getIconData, iconToSVG, type IconifyIcon } from '@iconify/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IconifyJSONLike {
  prefix: string;
  icons: Record<string, IconifyIcon>;
}

interface IconSetSource {
  id: 'lucide' | 'tabler';
  name: string;
  icons: IconifyJSONLike;
}

const SETS: IconSetSource[] = [
  { id: 'lucide', name: 'Lucide', icons: (lucideIcons as any) },
  { id: 'tabler', name: 'Tabler', icons: (tablerIcons as any) },
];

// ---------------------------------------------------------------------------
// Iconify → SVG data URI
// ---------------------------------------------------------------------------

export function iconToSvgDataUri(
  set: IconifyJSONLike,
  name: string,
  opts: { size?: number; color?: string; bg?: 'none' | 'circle' | 'square' } = {},
): string {
  const { size = 48, color = '#2563eb', bg = 'none' } = opts;
  const icon = getIconData(set as any, name);
  if (!icon) return '';

  const innerSize = bg === 'none' ? size : Math.round(size * 0.56);
  const { attributes, body } = iconToSVG(icon, { width: innerSize, height: innerSize });
  const attrs = Object.entries(attributes)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "'")}"`)
    .join(' ');
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" ${attrs} color="${color}">${body}</svg>`;
  const inner = iconSvg.replace(/<svg[^>]*>|<\/svg>/g, '');

  if (bg === 'none') {
    return svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="color:${color}">${inner}</svg>`,
    );
  }

  const pad = (size - innerSize) / 2;
  const rx = bg === 'circle' ? size / 2 : Math.round(size * 0.22);
  return svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${rx}" fill="${color}1a" stroke="${color}40" stroke-width="1.5" />
      <g transform="translate(${pad},${pad})" style="color:${color}">${inner}</g>
    </svg>`,
  );
}

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

interface IconIndexEntry {
  set: 'lucide' | 'tabler';
  name: string;
  search: string;
}

function buildIndex(): IconIndexEntry[] {
  const out: IconIndexEntry[] = [];
  for (const s of SETS) {
    const names = Object.keys(s.icons.icons ?? {});
    for (const n of names) {
      out.push({ set: s.id, name: n, search: n.toLowerCase().replace(/-/g, ' ') });
    }
  }
  return out;
}

const ICON_INDEX = buildIndex();

function filterIcons(setId: 'lucide' | 'tabler' | 'all', term: string, limit = 240): IconIndexEntry[] {
  const t = term.trim().toLowerCase();
  const out: IconIndexEntry[] = [];
  for (const e of ICON_INDEX) {
    if (setId !== 'all' && e.set !== setId) continue;
    if (t && !e.search.includes(t)) continue;
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Preset colors
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#2563eb',
  '#0f172a',
  '#059669',
  '#dc2626',
  '#7c3aed',
  '#ea580c',
  '#0891b2',
  '#d97706',
  '#ffffff',
];

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function openIconPickerModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let selectedSet: 'lucide' | 'tabler' | 'all' = 'lucide';
  let selectedName = 'sparkles';
  let selectedSetForIcon: 'lucide' | 'tabler' = 'lucide';
  let iconColor = '#2563eb';
  let customColor = '#2563eb';
  let iconSize = 64;
  let bgStyle: 'none' | 'circle' | 'square' = 'circle';
  let searchTerm = '';

  const getSetSource = (id: 'lucide' | 'tabler') => SETS.find((s) => s.id === id)!;

  const renderPreviewSvg = (): string =>
    iconToSvgDataUri(getSetSource(selectedSetForIcon).icons, selectedName, {
      size: iconSize,
      color: iconColor,
      bg: bgStyle,
    });

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Smile, 18)}</span>
          <h2 class="cde-modal__title">Insertar icono</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body">
        <div class="cde-modal-cols">
          <!-- Left: search + grid -->
          <div class="cde-modal-col">
            <div class="cde-search-wrap">
              <span class="cde-search-icon">${lucideSvg(Search, 15)}</span>
              <input id="cde-icon-search" type="text" class="cde-modal__input"
                placeholder="Buscar icono (ej. user, cloud, chart, home…)" value="${escapeXml(searchTerm)}" />
            </div>

            <div class="flex gap-1.5 flex-wrap items-center" id="cde-icon-sets">
              <button type="button" class="cde-chip is-active" data-set="lucide">Lucide</button>
              <button type="button" class="cde-chip" data-set="tabler">Tabler</button>
              <button type="button" class="cde-chip" data-set="all">Todos</button>
              <span class="text-xs text-neutral-400 ml-1" id="cde-icon-count"></span>
            </div>

            <div class="cde-grid cde-grid--icons flex-1" id="cde-icon-grid"></div>
          </div>

          <!-- Right: options + preview -->
          <div class="cde-modal-col">
            <div>
              <span class="cde-field-label">Color</span>
              <div class="flex flex-wrap gap-2 items-center" id="cde-icon-colors">
                ${PRESET_COLORS.map(
                  (c) => `
                  <button type="button" class="cde-swatch ${c === iconColor ? 'is-active' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`,
                ).join('')}
                <label class="cde-swatch-custom" title="Color personalizado">
                  <input type="color" id="cde-icon-custom-color" value="${customColor}" />
                </label>
              </div>
            </div>

            <div>
              <span class="cde-field-label">Fondo</span>
              <div class="flex gap-1.5 flex-wrap" id="cde-icon-bg">
                ${(['none', 'circle', 'square'] as const)
                  .map((b) => {
                    const label = b === 'none' ? 'Sin fondo' : b === 'circle' ? 'Círculo' : 'Cuadrado';
                    return `<button type="button" class="cde-chip ${b === bgStyle ? 'is-active' : ''}" data-bg="${b}">${label}</button>`;
                  })
                  .join('')}
              </div>
            </div>

            <div>
              <span class="cde-field-label">Tamaño</span>
              <div class="flex gap-1.5 flex-wrap" id="cde-icon-sizes">
                ${[16, 24, 32, 48, 64, 96, 128]
                  .map(
                    (s) => `
                  <button type="button" class="cde-chip ${s === iconSize ? 'is-active' : ''}" data-size="${s}">${s}px</button>`,
                  )
                  .join('')}
              </div>
            </div>

            <div class="flex-1 min-h-0">
              <span class="cde-field-label">Vista previa</span>
              <div class="cde-preview-box h-full min-h-[12rem]" id="cde-icon-preview-box"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer">
        <span class="text-xs text-neutral-400">Se insertará como imagen SVG vectorial</span>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="cde-icon-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="cde-icon-insert">Insertar icono</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#cde-icon-grid') as HTMLElement;
  const previewBox = overlay.querySelector('#cde-icon-preview-box') as HTMLElement;
  const countEl = overlay.querySelector('#cde-icon-count') as HTMLElement;
  const searchInput = overlay.querySelector('#cde-icon-search') as HTMLInputElement;

  const updatePreview = () => {
    previewBox.innerHTML = `<img alt="Vista previa del icono" src="${renderPreviewSvg()}" />`;
  };

  const renderGrid = () => {
    const entries = filterIcons(selectedSet, searchTerm);
    countEl.textContent = `${entries.length}${entries.length >= 240 ? '+' : ''} iconos`;
    grid.innerHTML = entries
      .map((e) => {
        const active = e.name === selectedName && e.set === selectedSetForIcon;
        const src = iconToSvgDataUri(getSetSource(e.set).icons, e.name, { size: 22, color: active ? '#2563eb' : '#334155' });
        return `
          <button type="button" class="cde-pick-card cde-icon-cell ${active ? 'is-active' : ''}" data-name="${e.name}" data-iconset="${e.set}" title="${e.name}">
            <img src="${src}" alt="" width="22" height="22" />
          </button>`;
      })
      .join('');
  };

  renderGrid();
  updatePreview();

  // --- events ---
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value;
    renderGrid();
  });

  overlay.querySelector('#cde-icon-sets')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-set]') as HTMLElement | null;
    if (!btn) return;
    selectedSet = btn.dataset.set as any;
    overlay.querySelectorAll('#cde-icon-sets [data-set]').forEach((el) => {
      el.className = `cde-chip ${(el as HTMLElement).dataset.set === selectedSet ? 'is-active' : ''}`;
    });
    renderGrid();
  });

  grid.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-name]') as HTMLElement | null;
    if (!cell) return;
    selectedName = cell.dataset.name!;
    selectedSetForIcon = cell.dataset.iconset as any;
    renderGrid();
    updatePreview();
  });

  overlay.querySelector('#cde-icon-colors')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-color]') as HTMLElement | null;
    if (!btn) return;
    iconColor = btn.dataset.color!;
    customColor = iconColor;
    overlay.querySelectorAll('[data-color]').forEach((el) => {
      el.className = `cde-swatch ${(el as HTMLElement).dataset.color === iconColor ? 'is-active' : ''}`;
    });
    updatePreview();
  });

  overlay.querySelector('#cde-icon-custom-color')!.addEventListener('input', (e) => {
    iconColor = (e.target as HTMLInputElement).value;
    customColor = iconColor;
    overlay.querySelectorAll('[data-color]').forEach((el) => {
      el.className = 'cde-swatch';
    });
    updatePreview();
  });

  overlay.querySelector('#cde-icon-bg')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-bg]') as HTMLElement | null;
    if (!btn) return;
    bgStyle = btn.dataset.bg as any;
    overlay.querySelectorAll('[data-bg]').forEach((el) => {
      el.className = `cde-chip ${(el as HTMLElement).dataset.bg === bgStyle ? 'is-active' : ''}`;
    });
    updatePreview();
  });

  overlay.querySelector('#cde-icon-sizes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-size]') as HTMLElement | null;
    if (!btn) return;
    iconSize = Number(btn.dataset.size);
    overlay.querySelectorAll('[data-size]').forEach((el) => {
      el.className = `cde-chip ${Number((el as HTMLElement).dataset.size) === iconSize ? 'is-active' : ''}`;
    });
    updatePreview();
  });

  const close = () => overlay.remove();
  overlay.querySelector('.cde-modal__close')!.addEventListener('click', close);
  overlay.querySelector('#cde-icon-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  overlay.querySelector('#cde-icon-insert')!.addEventListener('click', () => {
    const src = renderPreviewSvg();
    if (!src) return;
    insertImage(editor, src, {
      alt: `Icono: ${selectedName}`,
      width: iconSize,
      height: iconSize,
    });
    close();
  });
}

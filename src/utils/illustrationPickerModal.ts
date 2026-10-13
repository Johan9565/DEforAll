import type { Editor } from '@tiptap/core';
import { lucideSvg, Box, LucideImage } from '../icons';
import { optimizeImage } from './imageOptimizer';
import { svgToDataUri, insertImage } from './imageFromUri';

export interface IllustrationPreset {
  id: string;
  name: string;
  description: string;
  renderSvg: (theme: ColorTheme, width: number, height: number) => string;
}

export interface ColorTheme {
  primary: string;
  light: string;
  dark: string;
  accent: string;
  shadow: string;
}

const THEMES: Record<string, ColorTheme> = {
  blue: {
    primary: '#2563eb',
    light: '#60a5fa',
    dark: '#1d4ed8',
    accent: '#93c5fd',
    shadow: 'rgba(37, 99, 235, 0.25)',
  },
  emerald: {
    primary: '#059669',
    light: '#34d399',
    dark: '#047857',
    accent: '#a7f3d0',
    shadow: 'rgba(5, 150, 105, 0.25)',
  },
  purple: {
    primary: '#7c3aed',
    light: '#a78bfa',
    dark: '#6d28d9',
    accent: '#ddd6fe',
    shadow: 'rgba(124, 58, 237, 0.25)',
  },
  graphite: {
    primary: '#334155',
    light: '#64748b',
    dark: '#1e293b',
    accent: '#cbd5e1',
    shadow: 'rgba(30, 41, 59, 0.3)',
  },
  gold: {
    primary: '#d97706',
    light: '#fbbf24',
    dark: '#b45309',
    accent: '#fef3c7',
    shadow: 'rgba(217, 119, 6, 0.25)',
  },
  rose: {
    primary: '#e11d48',
    light: '#fb7185',
    dark: '#be123c',
    accent: '#fecdd3',
    shadow: 'rgba(225, 29, 72, 0.25)',
  },
};

export const ILLUSTRATION_PRESETS: IllustrationPreset[] = [
  {
    id: 'cube',
    name: 'Cubo Isométrico',
    description: 'Geometría cúbica tridimensional con iluminación facetada y sombra proyectada.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <linearGradient id="cTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${t.light}" />
            <stop offset="100%" stop-color="${t.accent}" />
          </linearGradient>
          <linearGradient id="cLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${t.primary}" />
            <stop offset="100%" stop-color="${t.dark}" />
          </linearGradient>
          <linearGradient id="cRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${t.dark}" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <radialGradient id="cShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <!-- Sombra base -->
        <ellipse cx="150" cy="245" rx="85" ry="24" fill="url(#cShadow)" />
        <!-- Cara izquierda -->
        <polygon points="150,140 70,95 70,195 150,240" fill="url(#cLeft)" />
        <!-- Cara derecha -->
        <polygon points="150,140 230,95 230,195 150,240" fill="url(#cRight)" />
        <!-- Cara superior -->
        <polygon points="150,45 230,95 150,140 70,95" fill="url(#cTop)" />
        <!-- Bisel / Iluminación aristas -->
        <line x1="150" y1="45" x2="150" y2="240" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
      </svg>
    `,
  },
  {
    id: 'sphere',
    name: 'Esfera con Brillo',
    description: 'Esfera realista con punto de luz especular y reflejo de luz ambiental.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <radialGradient id="sphGrad" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="15%" stop-color="${t.light}" />
            <stop offset="55%" stop-color="${t.primary}" />
            <stop offset="85%" stop-color="${t.dark}" />
            <stop offset="100%" stop-color="#090d16" />
          </radialGradient>
          <radialGradient id="sphShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="150" cy="250" rx="90" ry="22" fill="url(#sphShadow)" />
        <circle cx="150" cy="145" r="90" fill="url(#sphGrad)" />
      </svg>
    `,
  },
  {
    id: 'cylinder',
    name: 'Cilindro Metálico',
    description: 'Cilindro con acabado pulido, gradiente lateral continuo y tapa elíptica.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <linearGradient id="cylBody" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${t.dark}" />
            <stop offset="25%" stop-color="${t.light}" />
            <stop offset="60%" stop-color="${t.primary}" />
            <stop offset="100%" stop-color="${t.dark}" />
          </linearGradient>
          <linearGradient id="cylTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${t.accent}" />
            <stop offset="100%" stop-color="${t.primary}" />
          </linearGradient>
          <radialGradient id="cylShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="150" cy="250" rx="80" ry="20" fill="url(#cylShadow)" />
        <!-- Cuerpo -->
        <path d="M 80,90 L 80,210 A 70,25 0 0,0 220,210 L 220,90 Z" fill="url(#cylBody)" />
        <!-- Tapa superior -->
        <ellipse cx="150" cy="90" rx="70" ry="25" fill="url(#cylTop)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
      </svg>
    `,
  },
  {
    id: 'pyramid',
    name: 'Pirámide Facetada',
    description: 'Estructura piramidal con vértice central y caras iluminadas con contraste.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <radialGradient id="pyrShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="150" cy="250" rx="90" ry="22" fill="url(#pyrShadow)" />
        <!-- Cara izquierda -->
        <polygon points="150,50 65,225 150,245" fill="${t.primary}" />
        <!-- Cara derecha -->
        <polygon points="150,50 150,245 235,210" fill="${t.dark}" />
        <!-- Iluminación arista -->
        <line x1="150" y1="50" x2="150" y2="245" stroke="${t.light}" stroke-width="2" />
      </svg>
    `,
  },
  {
    id: 'torus',
    name: 'Toroide / Anillo',
    description: 'Anillo toroidal tridimensional con curvatura suave y volumen cilíndrico.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <radialGradient id="torShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
          <linearGradient id="torGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${t.light}" />
            <stop offset="40%" stop-color="${t.primary}" />
            <stop offset="100%" stop-color="${t.dark}" />
          </linearGradient>
        </defs>
        <ellipse cx="150" cy="240" rx="95" ry="25" fill="url(#torShadow)" />
        <!-- Parte trasera del anillo -->
        <path d="M 60,140 C 60,80 240,80 240,140 C 240,105 60,105 60,140 Z" fill="${t.dark}" />
        <!-- Cuerpo frontal -->
        <ellipse cx="150" cy="150" rx="85" ry="42" fill="none" stroke="url(#torGrad)" stroke-width="40" stroke-linecap="round" />
        <ellipse cx="150" cy="150" rx="85" ry="42" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4" stroke-dasharray="120 400" />
      </svg>
    `,
  },
  {
    id: 'laptop',
    name: 'Estación Tech',
    description: 'Dispositivo portátil isométrico con pantalla iluminada y teclado tridimensional.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <linearGradient id="scrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="${t.dark}" />
          </linearGradient>
          <radialGradient id="lapShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="150" cy="250" rx="100" ry="25" fill="url(#lapShadow)" />
        <!-- Base del portátil -->
        <polygon points="150,185 240,140 150,225 60,180" fill="${t.dark}" />
        <polygon points="150,192 240,147 240,140 150,185" fill="#0f172a" />
        <polygon points="150,192 60,187 60,180 150,185" fill="#1e293b" />
        <polygon points="150,180 230,140 150,215 70,175" fill="${t.primary}" opacity="0.6" />
        <!-- Pantalla erguida -->
        <polygon points="150,185 240,140 240,55 150,100" fill="#1e293b" />
        <polygon points="150,185 60,140 60,55 150,100" fill="#0f172a" />
        <polygon points="147,175 66,135 66,65 147,105" fill="url(#scrGrad)" />
        <line x1="75" y1="110" x2="135" y2="80" stroke="${t.light}" stroke-width="2.5" />
        <line x1="75" y1="125" x2="120" y2="100" stroke="${t.accent}" stroke-width="2" />
      </svg>
    `,
  },
  {
    id: 'data-stack',
    name: 'Arquitectura de Datos',
    description: 'Cubo de almacenamiento y servidores apilados con leds de estado y sombras.',
    renderSvg: (t, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${w}" height="${h}">
        <defs>
          <radialGradient id="dShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${t.shadow}" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="150" cy="265" rx="85" ry="20" fill="url(#dShadow)" />
        ${[0, 1, 2]
          .map((i) => {
            const dy = i * 45;
            return `
            <g transform="translate(0, ${dy})">
              <polygon points="150,100 80,65 80,95 150,130" fill="${t.primary}" />
              <polygon points="150,100 220,65 220,95 150,130" fill="${t.dark}" />
              <polygon points="150,35 220,65 150,100 80,65" fill="${t.light}" />
              <circle cx="95" cy="88" r="2.5" fill="#34d399" />
              <circle cx="105" cy="93" r="2.5" fill="${t.accent}" />
            </g>
          `;
          })
          .join('')}
      </svg>
    `,
  },
];

export function openIllustrationPickerModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let selectedPresetId = 'cube';
  let activeThemeKey = 'blue';
  let modelWidth = 260;
  let modelHeight = 260;
  let uploadedDataUrl: string | null = null;
  let activeTab: 'presets' | 'upload' = 'presets';

  const getSelectedPreset = () =>
    ILLUSTRATION_PRESETS.find((p) => p.id === selectedPresetId) ?? ILLUSTRATION_PRESETS[0];

  const renderCurrentPreview = () => {
    if (activeTab === 'upload' && uploadedDataUrl) {
      return `<img src="${uploadedDataUrl}" alt="Ilustración" class="max-h-full max-w-full object-contain" />`;
    }
    const preset = getSelectedPreset();
    const theme = THEMES[activeThemeKey] ?? THEMES.blue;
    return preset.renderSvg(theme, modelWidth, modelHeight);
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--xl" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Box, 18)}</span>
          <h2 class="cde-modal__title">Insertar ilustración</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body grid grid-cols-1 md:grid-cols-12 gap-5">
        <!-- Izquierda: Catálogo de Presets / Pestañas -->
        <div class="md:col-span-7 flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2">
            <div class="flex gap-2 text-xs" id="m3d-tabs">
              <button type="button" class="px-3 py-1 rounded-t border-b-2 border-blue-600 text-blue-700 font-semibold" data-tab="presets">
                Ilustraciones prediseñadas
              </button>
              <button type="button" class="px-3 py-1 text-neutral-600 hover:text-neutral-900" data-tab="upload">
                Subir desde este equipo…
              </button>
            </div>
          </div>

          <!-- Vista de Presets -->
          <div id="m3d-presets-view" class="flex flex-col gap-2">
            <span class="text-xs font-semibold text-neutral-700">Seleccionar ilustración:</span>
            <div class="grid grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1 bg-neutral-50 rounded border border-neutral-200" id="m3d-grid">
              ${ILLUSTRATION_PRESETS.map(
                (p) => `
                <button type="button" class="cde-m3d-card p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  p.id === selectedPresetId
                    ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }" data-id="${p.id}" title="${p.description}">
                  <div class="w-14 h-14 flex items-center justify-center pointer-events-none">
                    ${p.renderSvg(THEMES.blue, 54, 54)}
                  </div>
                  <span class="text-[10px] font-medium text-neutral-700 truncate w-full text-center">${p.name}</span>
                </button>
              `,
              ).join('')}
            </div>
          </div>

          <!-- Vista de Upload -->
          <div id="m3d-upload-view" class="hidden flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-lg p-6 bg-neutral-50 gap-3">
            <span class="text-neutral-400">${lucideSvg(LucideImage, 36)}</span>
            <p class="text-xs text-neutral-600 text-center">
              Selecciona una imagen o ilustración (PNG, JPG, SVG, WebP)
            </p>
            <input type="file" id="m3d-file-input" accept="image/*" class="hidden" />
            <button type="button" class="cde-btn cde-btn--secondary text-xs" id="m3d-browse-btn">
              Examinar archivos…
            </button>
          </div>

          <!-- Dimensiones -->
          <div class="flex items-center gap-4 text-xs text-neutral-700 pt-1">
            <div>
              <label class="block font-medium mb-1">Ancho (px):</label>
              <input id="cde-m3d-w" type="number" min="80" max="600" value="${modelWidth}" class="cde-modal__input w-24" />
            </div>
            <div>
              <label class="block font-medium mb-1">Alto (px):</label>
              <input id="cde-m3d-h" type="number" min="80" max="600" value="${modelHeight}" class="cde-modal__input w-24" />
            </div>
          </div>
        </div>

        <!-- Derecha: Temas y Previsualización -->
        <div class="md:col-span-5 flex flex-col gap-3">
          <span class="text-xs font-semibold text-neutral-700">Iluminación y estilo:</span>

          <!-- Temas de color -->
          <div class="flex flex-wrap gap-2" id="m3d-themes">
            ${Object.entries(THEMES).map(
              ([key, val]) => `
              <button type="button" class="px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 border transition-all ${
                key === activeThemeKey
                  ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
              }" data-theme="${key}">
                <span class="w-3 h-3 rounded-full" style="background-color: ${val.primary}"></span>
                ${capitalize(key)}
              </button>
            `,
            ).join('')}
          </div>

          <!-- Vista previa -->
          <div>
            <span class="text-[11px] font-medium text-neutral-500 block mb-1">Vista previa en vivo:</span>
            <div class="cde-preview-box h-56 bg-neutral-100 rounded border border-neutral-300 p-3 shadow-inner" id="m3d-preview-box">
              ${renderCurrentPreview()}
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-end gap-2">
        <button type="button" class="cde-btn cde-btn--secondary" id="cde-m3d-cancel">Cancelar</button>
        <button type="button" class="cde-btn cde-btn--primary" id="cde-m3d-insert">Insertar ilustración</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const previewBox = overlay.querySelector('#m3d-preview-box') as HTMLElement;
  const presetsView = overlay.querySelector('#m3d-presets-view') as HTMLElement;
  const uploadView = overlay.querySelector('#m3d-upload-view') as HTMLElement;
  const fileInput = overlay.querySelector('#m3d-file-input') as HTMLInputElement;
  const browseBtn = overlay.querySelector('#m3d-browse-btn') as HTMLButtonElement;
  const widthInput = overlay.querySelector('#cde-m3d-w') as HTMLInputElement;
  const heightInput = overlay.querySelector('#cde-m3d-h') as HTMLInputElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#cde-m3d-cancel') as HTMLButtonElement;
  const insertBtn = overlay.querySelector('#cde-m3d-insert') as HTMLButtonElement;
  const gridEl = overlay.querySelector('#m3d-grid') as HTMLElement;

  const updatePreview = () => {
    previewBox.innerHTML = renderCurrentPreview();
  };

  const cleanup = () => overlay.remove();

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  // Tab switch
  overlay.querySelector('#m3d-tabs')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.tab) return;
    activeTab = btn.dataset.tab as any;

    overlay.querySelectorAll('#m3d-tabs button').forEach((b) => {
      b.className = 'px-3 py-1 text-neutral-600 hover:text-neutral-900';
    });
    btn.className = 'px-3 py-1 rounded-t border-b-2 border-blue-600 text-blue-700 font-semibold';

    if (activeTab === 'presets') {
      presetsView.classList.remove('hidden');
      uploadView.classList.add('hidden');
    } else {
      presetsView.classList.add('hidden');
      uploadView.classList.remove('hidden');
    }
    updatePreview();
  });

  // Upload
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const opt = await optimizeImage(file);
    uploadedDataUrl = opt.dataUrl;
    updatePreview();
  });

  // Preset selection
  gridEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cde-m3d-card');
    if (!btn?.dataset.id) return;
    selectedPresetId = btn.dataset.id;
    gridEl.querySelectorAll('.cde-m3d-card').forEach((b) => {
      b.className =
        'cde-m3d-card p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all border-neutral-200 bg-white hover:border-neutral-300';
    });
    btn.className =
      'cde-m3d-card p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400';
    updatePreview();
  });

  // Themes
  overlay.querySelector('#m3d-themes')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.theme) return;
    activeThemeKey = btn.dataset.theme;
    overlay.querySelectorAll('#m3d-themes button').forEach((b) => {
      b.className =
        'px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 border transition-all border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300';
    });
    btn.className =
      'px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 border transition-all border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500';
    updatePreview();
  });

  widthInput.addEventListener('input', () => {
    const v = parseInt(widthInput.value, 10);
    if (v > 0) {
      modelWidth = v;
      updatePreview();
    }
  });

  heightInput.addEventListener('input', () => {
    const v = parseInt(heightInput.value, 10);
    if (v > 0) {
      modelHeight = v;
      updatePreview();
    }
  });

  insertBtn.addEventListener('click', () => {
    // En modo upload sin archivo seleccionado, no insertar el preset silenciosamente
    if (activeTab === 'upload' && !uploadedDataUrl) {
      fileInput.click();
      return;
    }

    let finalSrc: string;
    let altTitle: string;

    if (activeTab === 'upload' && uploadedDataUrl) {
      finalSrc = uploadedDataUrl;
      altTitle = 'Ilustración personalizada';
    } else {
      const svgCode = renderCurrentPreview();
      finalSrc = svgToDataUri(svgCode);
      const preset = getSelectedPreset();
      altTitle = `Ilustración: ${preset.name}`;
    }

    insertImage(editor, finalSrc, {
      alt: altTitle,
      width: modelWidth,
      height: modelHeight,
    });

    cleanup();
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

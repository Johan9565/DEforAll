import type { Editor } from '@tiptap/core';
import {
  lucideSvg,
  Smile,
  Check,
  FileText,
  Lock,
  LockOpen,
  LucideImage,
  LucideTable,
  LucideLink,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Code,
  Search,
  Eye,
  Check as IconCheck,
  Sparkles,
  Trash2,
  Calendar,
  Globe,
  Zap,
  Box,
  ChartColumn,
  ChartPie,
  ChartLine,
  ExternalLink,
  Workflow,
  Plus,
  Layers,
  Star,
  Heart,
  ArrowRight,
  Printer,
  type IconNode,
} from '../icons';

export interface IconEntry {
  id: string;
  name: string;
  tags: string[];
  category: string;
  node: IconNode;
}

const CATALOG: IconEntry[] = [
  // Negocios y Documentos
  { id: 'file-text', name: 'Documento', tags: ['archivo', 'texto', 'doc', 'documento'], category: 'negocios', node: FileText },
  { id: 'calendar', name: 'Calendario', tags: ['fecha', 'hora', 'agenda', 'evento'], category: 'negocios', node: Calendar },
  { id: 'chart-col', name: 'Columnas', tags: ['grafico', 'barras', 'metricas', 'finanzas'], category: 'negocios', node: ChartColumn },
  { id: 'chart-pie', name: 'Circular', tags: ['grafico', 'torta', 'porcentaje', 'cuotas'], category: 'negocios', node: ChartPie },
  { id: 'chart-line', name: 'Tendencia', tags: ['linea', 'crecimiento', 'ventas', 'kpi'], category: 'negocios', node: ChartLine },
  { id: 'table', name: 'Tabla', tags: ['datos', 'filas', 'columnas', 'matriz'], category: 'negocios', node: LucideTable },
  { id: 'printer', name: 'Impresora', tags: ['imprimir', 'papel', 'informe'], category: 'negocios', node: Printer },

  // Tecnología y Redes
  { id: 'globe', name: 'Internet / Web', tags: ['mundo', 'red', 'tierra', 'sitio'], category: 'tecnologia', node: Globe },
  { id: 'zap', name: 'Rayo / Energía', tags: ['electricidad', 'rapido', 'velocidad', 'energia'], category: 'tecnologia', node: Zap },
  { id: 'box', name: 'Caja / Módulo', tags: ['paquete', 'componente', 'contenedor', 'cubo'], category: 'tecnologia', node: Box },
  { id: 'workflow', name: 'Flujo de trabajo', tags: ['proceso', 'automatizacion', 'diagrama'], category: 'tecnologia', node: Workflow },
  { id: 'code', name: 'Código', tags: ['programacion', 'desarrollo', 'etiquetas'], category: 'tecnologia', node: Code },
  { id: 'settings', name: 'Configuración', tags: ['ajustes', 'engranaje', 'preferencias'], category: 'tecnologia', node: Settings },
  { id: 'layers', name: 'Capas', tags: ['niveles', 'arquitectura', 'stack'], category: 'tecnologia', node: Layers },

  // Seguridad y Protección
  { id: 'lock', name: 'Bloqueado', tags: ['candado', 'seguridad', 'privado', 'clave'], category: 'seguridad', node: Lock },
  { id: 'lock-open', name: 'Desbloqueado', tags: ['abierto', 'acceso', 'publico'], category: 'seguridad', node: LockOpen },
  { id: 'shield', name: 'Escudo', tags: ['defensa', 'proteccion', 'seguro'], category: 'seguridad', node: Shield },
  { id: 'shield-check', name: 'Verificado', tags: ['aprobado', 'escudo', 'cumplimiento', 'valido'], category: 'seguridad', node: ShieldCheck },
  { id: 'shield-alert', name: 'Alerta', tags: ['peligro', 'aviso', 'advertencia', 'riesgo'], category: 'seguridad', node: ShieldAlert },

  // Multimedia e Interfaz
  { id: 'image', name: 'Imagen', tags: ['foto', 'cuadro', 'galeria'], category: 'multimedia', node: LucideImage },
  { id: 'sparkles', name: 'Destellos', tags: ['magia', 'nuevo', 'ia', 'brillo', 'estrellas'], category: 'multimedia', node: Sparkles },
  { id: 'smile', name: 'Sonrisa', tags: ['feliz', 'cara', 'satisfaccion', 'usuario'], category: 'multimedia', node: Smile },
  { id: 'star', name: 'Estrella', tags: ['favorito', 'calificacion', 'premio'], category: 'multimedia', node: Star },
  { id: 'heart', name: 'Corazón', tags: ['amor', 'salud', 'favorito', 'me gusta'], category: 'multimedia', node: Heart },
  { id: 'eye', name: 'Vista / Ojo', tags: ['ver', 'mostrar', 'previsualizar'], category: 'multimedia', node: Eye },

  // Navegación y Acciones
  { id: 'search', name: 'Búsqueda', tags: ['lupa', 'buscar', 'encontrar'], category: 'acciones', node: Search },
  { id: 'link', name: 'Enlace', tags: ['vinculo', 'url', 'conectar'], category: 'acciones', node: LucideLink },
  { id: 'external-link', name: 'Enlace externo', tags: ['abrir', 'ventana', 'salida'], category: 'acciones', node: ExternalLink },
  { id: 'arrow-right', name: 'Flecha derecha', tags: ['siguiente', 'avance', 'continuar'], category: 'acciones', node: ArrowRight },
  { id: 'check', name: 'Comprobado', tags: ['ok', 'listo', 'completado', 'exito'], category: 'acciones', node: IconCheck },
  { id: 'plus', name: 'Añadir', tags: ['mas', 'nuevo', 'crear', 'agregar'], category: 'acciones', node: Plus },
  { id: 'trash', name: 'Papelera', tags: ['eliminar', 'borrar', 'quitar'], category: 'acciones', node: Trash2 },
];

const PRESET_ICON_COLORS = [
  '#2563eb', // Azul Office
  '#0f172a', // Grafito
  '#059669', // Esmeralda
  '#dc2626', // Rojo
  '#7c3aed', // Púrpura
  '#ea580c', // Naranja
  '#0891b2', // Cian
  '#d97706', // Ámbar
];

export function openIconPickerModal(editor: Editor): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let selectedIconId = 'sparkles';
  let iconColor = '#2563eb';
  let iconSize = 48;
  let bgStyle: 'none' | 'circle' | 'square' | string = 'circle';
  let searchTerm = '';
  let activeCategory = 'all';

  const getSelectedEntry = () => CATALOG.find((c) => c.id === selectedIconId) ?? CATALOG[0];

  const renderIconSvgString = (sizePx: number, colorHex: string, bg: string) => {
    const entry = getSelectedEntry();
    const innerSize = bg === 'none' ? sizePx : Math.round(sizePx * 0.58);
    const innerSvg = lucideSvg(entry.node, innerSize, 'icon-symbol');

    if (bg === 'none') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" style="color:${colorHex}">
        ${innerSvg.replace(/<svg[^>]*>|<\/svg>/g, '')}
      </svg>`;
    }

    const pad = (sizePx - innerSize) / 2;
    const rx = bg === 'circle' ? sizePx / 2 : Math.round(sizePx * 0.2);
    const bgFill = `${colorHex}1a`; // 10% opacity tint
    const bgStroke = `${colorHex}40`; // 25% opacity border

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}">
      <rect x="1" y="1" width="${sizePx - 2}" height="${sizePx - 2}" rx="${rx}" fill="${bgFill}" stroke="${bgStroke}" stroke-width="1.5" />
      <g transform="translate(${pad}, ${pad})" style="color:${colorHex}">
        ${innerSvg.replace(/<svg[^>]*>|<\/svg>/g, '')}
      </g>
    </svg>`;
  };

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--lg" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(Smile, 18)}</span>
          <h2 class="cde-modal__title">Insertar iconos</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <div class="cde-modal__body grid grid-cols-1 md:grid-cols-12 gap-5">
        <!-- Izquierda: Catálogo y Búsqueda -->
        <div class="md:col-span-7 flex flex-col gap-3">
          <!-- Búsqueda -->
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-neutral-400 pointer-events-none">${lucideSvg(Search, 14)}</span>
            <input
              id="cde-icon-search"
              type="text"
              class="cde-modal__input w-full pl-8"
              placeholder="Buscar por nombre o palabra clave (ej. gráfico, nube, candado)..."
            />
          </div>

          <!-- Filtro de Categorías -->
          <div class="flex flex-wrap gap-1 text-[11px]" id="cde-icon-categories">
            <button type="button" class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium" data-cat="all">Todos</button>
            <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="negocios">Negocios</button>
            <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="tecnologia">Tecnología</button>
            <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="seguridad">Seguridad</button>
            <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="multimedia">Multimedia</button>
            <button type="button" class="px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100" data-cat="acciones">Acciones</button>
          </div>

          <!-- Grid de Iconos -->
          <div class="grid grid-cols-5 gap-2 p-2 bg-neutral-50 border border-neutral-200 rounded max-h-64 overflow-y-auto" id="cde-icon-grid">
            ${CATALOG.map(
              (c) => `
              <button type="button" class="cde-icon-btn p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all ${
                c.id === selectedIconId
                  ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }" data-id="${c.id}" title="${c.name}">
                <span class="text-neutral-700">${lucideSvg(c.node, 22)}</span>
                <span class="text-[10px] text-neutral-600 truncate w-full text-center">${c.name}</span>
              </button>
            `,
            ).join('')}
          </div>
        </div>

        <!-- Derecha: Personalización y Preview -->
        <div class="md:col-span-5 flex flex-col gap-3.5">
          <span class="text-xs font-semibold text-neutral-700">Aspecto del icono:</span>

          <!-- Color -->
          <div>
            <span class="text-[11px] font-medium text-neutral-600 block mb-1">Color:</span>
            <div class="flex flex-wrap gap-1.5" id="cde-icon-colors">
              ${PRESET_ICON_COLORS.map(
                (col) => `
                <button type="button" class="w-5 h-5 rounded-full border border-neutral-300 transition-transform hover:scale-110 flex items-center justify-center ${
                  col === iconColor ? 'ring-2 ring-blue-500 scale-110' : ''
                }" style="background-color: ${col}" data-color="${col}">
                  ${col === iconColor ? `<span class="text-white text-[10px]">${lucideSvg(Check, 10)}</span>` : ''}
                </button>
              `,
              ).join('')}
            </div>
          </div>

          <!-- Estilo de insignia / fondo -->
          <div>
            <span class="text-[11px] font-medium text-neutral-600 block mb-1">Estilo de fondo:</span>
            <div class="flex gap-2 text-xs" id="cde-icon-bg-styles">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="iconBg" value="none" ${bgStyle === 'none' ? 'checked' : ''} />
                <span>Sin fondo</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="iconBg" value="circle" ${bgStyle === 'circle' ? 'checked' : ''} />
                <span>Círculo suave</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="iconBg" value="square" ${bgStyle === 'square' ? 'checked' : ''} />
                <span>Cuadrado</span>
              </label>
            </div>
          </div>

          <!-- Tamaño -->
          <div>
            <span class="text-[11px] font-medium text-neutral-600 block mb-1">Tamaño:</span>
            <div class="flex items-center gap-2">
              <select id="cde-icon-size-select" class="cde-modal__input text-xs">
                <option value="24">24 px (Pequeño inline)</option>
                <option value="32">32 px (Mediano)</option>
                <option value="48" selected>48 px (Estándar)</option>
                <option value="64">64 px (Grande)</option>
                <option value="96">96 px (Destacado)</option>
              </select>
            </div>
          </div>

          <!-- Vista previa -->
          <div>
            <span class="text-[11px] font-medium text-neutral-500 block mb-1">Vista previa:</span>
            <div class="h-32 bg-neutral-100 rounded border border-neutral-300 flex items-center justify-center p-3 shadow-inner" id="cde-icon-preview">
              ${renderIconSvgString(iconSize, iconColor, bgStyle)}
            </div>
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-end gap-2">
        <button type="button" class="cde-btn cde-btn--secondary" id="cde-icon-cancel">Cancelar</button>
        <button type="button" class="cde-btn cde-btn--primary" id="cde-icon-insert">Insertar icono</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const searchInput = overlay.querySelector('#cde-icon-search') as HTMLInputElement;
  const gridEl = overlay.querySelector('#cde-icon-grid') as HTMLElement;
  const previewEl = overlay.querySelector('#cde-icon-preview') as HTMLElement;
  const sizeSelect = overlay.querySelector('#cde-icon-size-select') as HTMLSelectElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#cde-icon-cancel') as HTMLButtonElement;
  const insertBtn = overlay.querySelector('#cde-icon-insert') as HTMLButtonElement;

  const updatePreview = () => {
    previewEl.innerHTML = renderIconSvgString(iconSize, iconColor, bgStyle);
  };

  const cleanup = () => overlay.remove();

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  // Filter icons
  const filterIcons = () => {
    const q = searchTerm.toLowerCase().trim();
    const cards = gridEl.querySelectorAll<HTMLElement>('.cde-icon-btn');
    cards.forEach((card) => {
      const id = card.dataset.id;
      const entry = CATALOG.find((c) => c.id === id);
      if (!entry) return;
      const matchesCat = activeCategory === 'all' || entry.category === activeCategory;
      const matchesQuery =
        !q ||
        entry.name.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q));

      card.style.display = matchesCat && matchesQuery ? 'flex' : 'none';
    });
  };

  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value;
    filterIcons();
  });

  // Category switch
  overlay.querySelector('#cde-icon-categories')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.cat) return;
    activeCategory = btn.dataset.cat;
    overlay.querySelectorAll('#cde-icon-categories button').forEach((b) => {
      b.className = 'px-2 py-0.5 rounded text-neutral-600 hover:bg-neutral-100';
    });
    btn.className = 'px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium';
    filterIcons();
  });

  // Selection
  gridEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cde-icon-btn');
    if (!btn?.dataset.id) return;
    selectedIconId = btn.dataset.id;
    gridEl.querySelectorAll('.cde-icon-btn').forEach((b) => {
      b.className =
        'cde-icon-btn p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all border-neutral-200 bg-white hover:border-neutral-300';
    });
    btn.className =
      'cde-icon-btn p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-400';
    updatePreview();
  });

  // Color selection
  overlay.querySelector('#cde-icon-colors')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.color) return;
    iconColor = btn.dataset.color;
    overlay.querySelectorAll('#cde-icon-colors button').forEach((b) => {
      b.classList.remove('ring-2', 'ring-blue-500', 'scale-110');
      b.innerHTML = '';
    });
    btn.classList.add('ring-2', 'ring-blue-500', 'scale-110');
    btn.innerHTML = `<span class="text-white text-[10px]">${lucideSvg(Check, 10)}</span>`;
    updatePreview();
  });

  // Background style
  overlay.querySelectorAll('input[name="iconBg"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      bgStyle = (e.target as HTMLInputElement).value as any;
      updatePreview();
    });
  });

  // Size select
  sizeSelect.addEventListener('change', () => {
    iconSize = parseInt(sizeSelect.value, 10) || 48;
    updatePreview();
  });

  // Insert
  insertBtn.addEventListener('click', () => {
    const svgCode = renderIconSvgString(iconSize, iconColor, bgStyle);
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgCode)}`;
    const entry = getSelectedEntry();

    editor
      .chain()
      .focus()
      .setImage({
        src: dataUri,
        alt: `Icono: ${entry.name}`,
        width: iconSize,
        height: iconSize,
        alignment: 'center',
      })
      .run();

    cleanup();
  });
}

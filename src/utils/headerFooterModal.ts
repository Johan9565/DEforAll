import type { HeaderFooterConfig } from '../types';
import { lucideSvg, PanelTop, PanelBottom, Hash } from '../icons';

export interface HeaderFooterModalOptions {
  config: HeaderFooterConfig;
  initialTab?: 'header' | 'footer' | 'pageNumber';
  onApply: (updated: HeaderFooterConfig) => void;
  onClose?: () => void;
}

export function openHeaderFooterModal({
  config,
  initialTab = 'header',
  onApply,
  onClose,
}: HeaderFooterModalOptions): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  let currentConfig: HeaderFooterConfig = { ...config };
  let activeTab: 'header' | 'footer' | 'pageNumber' = initialTab;

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--md" role="dialog" aria-modal="true">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(PanelTop, 18)}</span>
          <h2 class="cde-modal__title">Encabezado y pie de página</h2>
        </div>
        <button type="button" class="cde-modal__close">&times;</button>
      </div>

      <!-- Pestañas -->
      <div class="flex border-b border-neutral-200 px-5 pt-2 gap-4 text-xs font-semibold" id="cde-hf-tabs">
        <button type="button" class="py-2 flex items-center gap-1.5 transition-all ${
          activeTab === 'header' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-neutral-500 hover:text-neutral-800'
        }" data-tab="header">
          ${lucideSvg(PanelTop, 14)} Encabezado
        </button>
        <button type="button" class="py-2 flex items-center gap-1.5 transition-all ${
          activeTab === 'footer' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-neutral-500 hover:text-neutral-800'
        }" data-tab="footer">
          ${lucideSvg(PanelBottom, 14)} Pie de página
        </button>
        <button type="button" class="py-2 flex items-center gap-1.5 transition-all ${
          activeTab === 'pageNumber' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-neutral-500 hover:text-neutral-800'
        }" data-tab="pageNumber">
          ${lucideSvg(Hash, 14)} Número de página
        </button>
      </div>

      <div class="cde-modal__body space-y-4" id="cde-hf-body">
        <!-- RENDERED BY TAB -->
      </div>

      <div class="cde-modal__footer flex items-center justify-between">
        <label class="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer select-none">
          <input type="checkbox" id="cde-hf-diff-first" class="rounded border-neutral-300 text-blue-600 size-4" ${
            currentConfig.differentFirstPage ? 'checked' : ''
          } />
          <span class="font-medium">Primera página diferente (portada)</span>
        </label>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="cde-hf-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="cde-hf-apply">Aplicar cambios</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const bodyEl = overlay.querySelector('#cde-hf-body') as HTMLElement;
  const diffFirstCheck = overlay.querySelector('#cde-hf-diff-first') as HTMLInputElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#cde-hf-cancel') as HTMLButtonElement;
  const applyBtn = overlay.querySelector('#cde-hf-apply') as HTMLButtonElement;

  const renderTabContent = () => {
    if (activeTab === 'header') {
      bodyEl.innerHTML = `
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" id="cde-hf-show-header" class="rounded border-neutral-300 text-blue-600 size-4" ${
              currentConfig.showHeader ? 'checked' : ''
            } />
            <span class="text-xs font-bold text-neutral-800">Mostrar encabezado en las páginas</span>
          </label>

          <div class="space-y-2.5 pt-1">
            <div>
              <label class="block text-xs font-medium text-neutral-600 mb-1">Texto a la izquierda:</label>
              <input type="text" id="cde-header-left" class="cde-modal__input w-full text-xs" placeholder="Ej: Título del Documento / Organización" value="${
                escapeXml(currentConfig.headerLeft ?? '')
              }" />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-600 mb-1">Texto al centro:</label>
              <input type="text" id="cde-header-center" class="cde-modal__input w-full text-xs" placeholder="Ej: Sección o Capítulo" value="${
                escapeXml(currentConfig.headerCenter ?? '')
              }" />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-600 mb-1">Texto a la derecha:</label>
              <input type="text" id="cde-header-right" class="cde-modal__input w-full text-xs" placeholder="Ej: Fecha / Versión" value="${
                escapeXml(currentConfig.headerRight ?? '')
              }" />
            </div>

            <label class="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input type="checkbox" id="cde-header-line" class="rounded border-neutral-300 text-blue-600 size-4" ${
                currentConfig.headerLine ? 'checked' : ''
              } />
              <span class="text-xs text-neutral-700">Línea divisoria inferior decorativa</span>
            </label>
          </div>
        </div>
      `;
    } else if (activeTab === 'footer') {
      bodyEl.innerHTML = `
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" id="cde-hf-show-footer" class="rounded border-neutral-300 text-blue-600 size-4" ${
              currentConfig.showFooter ? 'checked' : ''
            } />
            <span class="text-xs font-bold text-neutral-800">Mostrar pie de página</span>
          </label>

          <div class="space-y-2.5 pt-1">
            <div>
              <label class="block text-xs font-medium text-neutral-600 mb-1">Texto a la izquierda:</label>
              <input type="text" id="cde-footer-left" class="cde-modal__input w-full text-xs" placeholder="Ej: Confidencial / Todos los derechos reservados" value="${
                escapeXml(currentConfig.footerLeft ?? '')
              }" />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-600 mb-1">Texto al centro:</label>
              <input type="text" id="cde-footer-center" class="cde-modal__input w-full text-xs" placeholder="Ej: Dirección / Enlace web" value="${
                escapeXml(currentConfig.footerCenter ?? '')
              }" />
            </div>

            <div>
              <label class="block text-xs font-medium text-neutral-600 mb-1">Texto a la derecha:</label>
              <input type="text" id="cde-footer-right" class="cde-modal__input w-full text-xs" placeholder="Ej: Nota al pie" value="${
                escapeXml(currentConfig.footerRight ?? '')
              }" />
            </div>

            <label class="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input type="checkbox" id="cde-footer-line" class="rounded border-neutral-300 text-blue-600 size-4" ${
                currentConfig.footerLine ? 'checked' : ''
              } />
              <span class="text-xs text-neutral-700">Línea divisoria superior decorativa</span>
            </label>
          </div>
        </div>
      `;
    } else if (activeTab === 'pageNumber') {
      const fmt = currentConfig.pageNumberFormat ?? 'page_x';
      const pos = currentConfig.pageNumberPosition ?? 'footer-right';

      bodyEl.innerHTML = `
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-neutral-700 mb-1.5">Formato de numeración:</label>
            <div class="space-y-1.5 text-xs text-neutral-700">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pgFmt" value="page_x" ${fmt === 'page_x' ? 'checked' : ''} />
                <span>Página X (Ej. "Página 1")</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pgFmt" value="page_x_of_y" ${fmt === 'page_x_of_y' ? 'checked' : ''} />
                <span>Página X de Y (Ej. "Página 1 de 5")</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pgFmt" value="simple" ${fmt === 'simple' ? 'checked' : ''} />
                <span>Número simple (Ej. "1")</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pgFmt" value="none" ${fmt === 'none' ? 'checked' : ''} />
                <span class="text-neutral-500">Sin número de página</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-neutral-700 mb-1.5">Posición en la hoja:</label>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="bg-neutral-50 p-2.5 rounded border border-neutral-200 space-y-1.5">
                <span class="font-bold text-neutral-800 block text-[11px]">En el pie de página (inferior):</span>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pgPos" value="footer-right" ${pos === 'footer-right' ? 'checked' : ''} />
                  <span>Derecha</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pgPos" value="footer-center" ${pos === 'footer-center' ? 'checked' : ''} />
                  <span>Centro</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pgPos" value="footer-left" ${pos === 'footer-left' ? 'checked' : ''} />
                  <span>Izquierda</span>
                </label>
              </div>

              <div class="bg-neutral-50 p-2.5 rounded border border-neutral-200 space-y-1.5">
                <span class="font-bold text-neutral-800 block text-[11px]">En el encabezado (superior):</span>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pgPos" value="header-right" ${pos === 'header-right' ? 'checked' : ''} />
                  <span>Derecha</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pgPos" value="header-center" ${pos === 'header-center' ? 'checked' : ''} />
                  <span>Centro</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pgPos" value="header-left" ${pos === 'header-left' ? 'checked' : ''} />
                  <span>Izquierda</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  };

  const syncInputsToState = () => {
    if (activeTab === 'header') {
      const show = overlay.querySelector('#cde-hf-show-header') as HTMLInputElement | null;
      const left = overlay.querySelector('#cde-header-left') as HTMLInputElement | null;
      const center = overlay.querySelector('#cde-header-center') as HTMLInputElement | null;
      const right = overlay.querySelector('#cde-header-right') as HTMLInputElement | null;
      const line = overlay.querySelector('#cde-header-line') as HTMLInputElement | null;
      if (show) currentConfig.showHeader = show.checked;
      if (left) currentConfig.headerLeft = left.value;
      if (center) currentConfig.headerCenter = center.value;
      if (right) currentConfig.headerRight = right.value;
      if (line) currentConfig.headerLine = line.checked;
    } else if (activeTab === 'footer') {
      const show = overlay.querySelector('#cde-hf-show-footer') as HTMLInputElement | null;
      const left = overlay.querySelector('#cde-footer-left') as HTMLInputElement | null;
      const center = overlay.querySelector('#cde-footer-center') as HTMLInputElement | null;
      const right = overlay.querySelector('#cde-footer-right') as HTMLInputElement | null;
      const line = overlay.querySelector('#cde-footer-line') as HTMLInputElement | null;
      if (show) currentConfig.showFooter = show.checked;
      if (left) currentConfig.footerLeft = left.value;
      if (center) currentConfig.footerCenter = center.value;
      if (right) currentConfig.footerRight = right.value;
      if (line) currentConfig.footerLine = line.checked;
    } else if (activeTab === 'pageNumber') {
      const fmtRadio = overlay.querySelector('input[name="pgFmt"]:checked') as HTMLInputElement | null;
      const posRadio = overlay.querySelector('input[name="pgPos"]:checked') as HTMLInputElement | null;
      if (fmtRadio) currentConfig.pageNumberFormat = fmtRadio.value as any;
      if (posRadio) currentConfig.pageNumberPosition = posRadio.value as any;
    }
    currentConfig.differentFirstPage = diffFirstCheck.checked;
  };

  renderTabContent();

  const cleanup = () => {
    overlay.remove();
    onClose?.();
  };

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  // Tab switching
  overlay.querySelector('#cde-hf-tabs')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn?.dataset.tab) return;
    syncInputsToState();
    activeTab = btn.dataset.tab as any;

    overlay.querySelectorAll('#cde-hf-tabs button').forEach((b) => {
      b.className = 'py-2 flex items-center gap-1.5 transition-all text-neutral-500 hover:text-neutral-800';
    });
    btn.className = 'py-2 flex items-center gap-1.5 transition-all border-b-2 border-blue-600 text-blue-700';

    renderTabContent();
  });

  applyBtn.addEventListener('click', () => {
    syncInputsToState();
    onApply(currentConfig);
    cleanup();
  });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

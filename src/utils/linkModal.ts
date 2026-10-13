import type { Editor } from '@tiptap/core';
import { lucideSvg, LucideLink, ExternalLink, Unlink, Globe } from '../icons';

export interface LinkModalOptions {
  editor: Editor;
  onClose?: () => void;
}

/**
 * Modern Word-style modal dialog for inserting and editing hyperlinks.
 * Replaces window.prompt with a rich, accessible, user-friendly interface.
 */
export function openLinkModal({ editor, onClose }: LinkModalOptions): void {
  const isLinkActive = editor.isActive('link');
  const currentAttrs = editor.getAttributes('link') as {
    href?: string;
    target?: string;
    title?: string;
  };

  const { from, to } = editor.state.selection;
  const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
  const initialUrl = currentAttrs.href ?? 'https://';
  const initialText = selectedText || (isLinkActive ? selectedText : '');
  const initialTargetBlank = currentAttrs.target === '_blank';
  const initialTitle = currentAttrs.title ?? '';

  const overlay = document.createElement('div');
  overlay.className = 'cde-modal-overlay';
  overlay.tabIndex = -1;

  overlay.innerHTML = `
    <div class="cde-modal cde-modal--md" role="dialog" aria-modal="true" aria-labelledby="link-modal-title">
      <div class="cde-modal__header">
        <div class="flex items-center gap-2">
          <span class="text-blue-600">${lucideSvg(LucideLink, 18)}</span>
          <h2 id="link-modal-title" class="cde-modal__title">
            ${isLinkActive ? 'Modificar hipervínculo' : 'Insertar hipervínculo'}
          </h2>
        </div>
        <button type="button" class="cde-modal__close" aria-label="Cerrar">&times;</button>
      </div>

      <div class="cde-modal__body space-y-4">
        <!-- Texto para mostrar -->
        <div>
          <label class="block text-xs font-semibold text-neutral-700 mb-1" for="cde-link-text">
            Texto para mostrar:
          </label>
          <input
            id="cde-link-text"
            type="text"
            class="cde-modal__input w-full"
            placeholder="Texto descriptivo del enlace"
            value="${escapeHtml(initialText)}"
          />
          <p class="text-[11px] text-neutral-500 mt-1">
            Si se deja en blanco, se mostrará la dirección URL directamente en el documento.
          </p>
        </div>

        <!-- Dirección URL -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-semibold text-neutral-700" for="cde-link-url">
              Dirección web (URL):
            </label>
            <div class="flex items-center gap-1">
              <button type="button" class="cde-proto-btn" data-prefix="https://">https://</button>
              <button type="button" class="cde-proto-btn" data-prefix="mailto:">mailto:</button>
              <button type="button" class="cde-proto-btn" data-prefix="tel:">tel:</button>
            </div>
          </div>
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-neutral-400 pointer-events-none">${lucideSvg(Globe, 14)}</span>
            <input
              id="cde-link-url"
              type="text"
              class="cde-modal__input w-full pl-8"
              placeholder="https://ejemplo.com o mailto:correo@ejemplo.com"
              value="${escapeHtml(initialUrl)}"
            />
          </div>
        </div>

        <!-- Opciones avanzadas -->
        <div class="bg-neutral-50 border border-neutral-200 rounded p-3 space-y-2.5 text-xs text-neutral-700">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="cde-link-target"
              type="checkbox"
              class="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 size-4"
              ${initialTargetBlank ? 'checked' : ''}
            />
            <span class="flex items-center gap-1.5 font-medium">
              ${lucideSvg(ExternalLink, 13)} Abrir en una pestaña nueva (target="_blank")
            </span>
          </label>

          <div>
            <label class="block text-[11px] font-medium text-neutral-600 mb-1" for="cde-link-title">
              Información emergente en pantalla (Tooltip opcional):
            </label>
            <input
              id="cde-link-title"
              type="text"
              class="cde-modal__input w-full text-xs py-1"
              placeholder="Texto descriptivo al posar el cursor"
              value="${escapeHtml(initialTitle)}"
            />
          </div>
        </div>
      </div>

      <div class="cde-modal__footer flex items-center justify-between">
        <div>
          ${
            isLinkActive
              ? `<button type="button" class="cde-btn cde-btn--danger flex items-center gap-1.5" id="cde-link-unlink">
                  ${lucideSvg(Unlink, 13)} Quitar vínculo
                </button>`
              : '<span></span>'
          }
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="cde-btn cde-btn--secondary" id="cde-link-cancel">Cancelar</button>
          <button type="button" class="cde-btn cde-btn--primary" id="cde-link-submit">
            ${isLinkActive ? 'Actualizar' : 'Insertar vínculo'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const textInput = overlay.querySelector('#cde-link-text') as HTMLInputElement;
  const urlInput = overlay.querySelector('#cde-link-url') as HTMLInputElement;
  const targetCheck = overlay.querySelector('#cde-link-target') as HTMLInputElement;
  const titleInput = overlay.querySelector('#cde-link-title') as HTMLInputElement;
  const closeBtn = overlay.querySelector('.cde-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#cde-link-cancel') as HTMLButtonElement;
  const submitBtn = overlay.querySelector('#cde-link-submit') as HTMLButtonElement;
  const unlinkBtn = overlay.querySelector('#cde-link-unlink') as HTMLButtonElement | null;
  const protoBtns = Array.from(overlay.querySelectorAll<HTMLButtonElement>('.cde-proto-btn'));

  const cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onClose?.();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    } else if (e.key === 'Enter' && (document.activeElement === urlInput || document.activeElement === textInput)) {
      e.preventDefault();
      applyLink();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  protoBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix ?? '';
      let cur = urlInput.value.trim();
      cur = cur.replace(/^(https?:\/\/|mailto:|tel:)/i, '');
      urlInput.value = `${prefix}${cur}`;
      urlInput.focus();
    });
  });

  if (unlinkBtn) {
    unlinkBtn.addEventListener('click', () => {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      cleanup();
    });
  }

  const applyLink = () => {
    let url = urlInput.value.trim();
    if (!url || url === 'https://' || url === 'http://') {
      if (isLinkActive) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      }
      cleanup();
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      url = `https://${url}`;
    }

    const displayText = textInput.value.trim() || url;
    const target = targetCheck.checked ? '_blank' : null;
    const title = titleInput.value.trim() || null;

    const linkAttrs: { href: string; target?: string | null; title?: string | null } = {
      href: url,
      target,
      title,
    };

    if (selectedText && displayText !== selectedText) {
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent({
          type: 'text',
          text: displayText,
          marks: [{ type: 'link', attrs: linkAttrs }],
        })
        .run();
    } else if (!selectedText && !isLinkActive) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: displayText,
          marks: [{ type: 'link', attrs: linkAttrs }],
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink(linkAttrs)
        .run();
    }

    cleanup();
  };

  submitBtn.addEventListener('click', applyLink);

  // Focus behavior
  setTimeout(() => {
    if (!selectedText && !isLinkActive) {
      textInput.focus();
    } else {
      urlInput.focus();
      urlInput.select();
    }
  }, 40);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

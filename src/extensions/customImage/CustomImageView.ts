import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';
import type { NodeView } from '@tiptap/pm/view';
import { NodeSelection } from '@tiptap/pm/state';
import { getFilterCss, IMAGE_FILTERS } from '../../utils/imageEffects';
import { openFilerobotModal } from '../../utils/filerobotEditor';
import { optimizeImage } from '../../utils/imageOptimizer';
import {
  lucideSvg,
  Crop,
  Sliders,
  Palette,
  AlignCenter,
  WrapText,
  Sparkles,
  Trash2,
} from '../../icons';

export class CustomImageView implements NodeView {
  public dom: HTMLElement;
  private box: HTMLElement;
  private img: HTMLImageElement;
  private quickBar: HTMLElement | null = null;
  private handles: HTMLElement[] = [];
  private badge: HTMLElement | null = null;

  private node: ProseMirrorNode;
  private editor: Editor;
  private getPos: () => number | undefined;

  constructor(node: ProseMirrorNode, editor: Editor, getPos: () => number | undefined) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.box = document.createElement('div');
    this.box.className = 'cde-image-box';
    this.img = document.createElement('img');
    this.img.className = 'cde-image';

    this.box.appendChild(this.img);
    this.dom.appendChild(this.box);

    this.renderAttributes();

    // Event listeners
    this.box.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchNodeSelection();
    });

    this.box.addEventListener('contextmenu', () => {
      this.dispatchNodeSelection();
    });

    // Double-click to open full Filerobot Image Editor
    this.box.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!this.editor.isEditable) return;
      openFilerobotModal({
        src: this.node.attrs.src,
        onSave: (savedSrc) => {
          this.updateAttrs({ src: savedSrc });
        },
      });
    });
  }

  public dispatchNodeSelection(): void {
    const pos = this.getPos();
    if (typeof pos !== 'number' || this.editor.isDestroyed) return;
    try {
      const tr = this.editor.state.tr.setSelection(
        NodeSelection.create(this.editor.state.doc, pos),
      );
      this.editor.view.dispatch(tr);
    } catch {
      // Fall through
    }
  }

  private renderAttributes(): void {
    const attrs = this.node.attrs;
    const align = attrs.alignment || 'center';
    const wrap = attrs.wrap || 'none';

    this.dom.className = `cde-image-container cde-image-container--${align} cde-image-container--wrap-${wrap}`;

    this.img.src = attrs.src || '';
    this.img.alt = attrs.alt || '';
    if (attrs.title) this.img.title = attrs.title;

    if (attrs.width) {
      this.img.style.width = typeof attrs.width === 'number' ? `${attrs.width}px` : attrs.width;
    } else {
      this.img.style.width = '';
    }

    if (attrs.height) {
      this.img.style.height = typeof attrs.height === 'number' ? `${attrs.height}px` : attrs.height;
    } else {
      this.img.style.height = 'auto';
    }

    this.img.style.filter = getFilterCss(attrs.filter);
  }

  public selectNode(): void {
    this.box.classList.add('is-selected');
    this.attachHandles();
    this.attachQuickBar();
  }

  public deselectNode(): void {
    this.box.classList.remove('is-selected');
    this.removeHandles();
    this.removeQuickBar();
    this.removeBadge();
  }

  private attachHandles(): void {
    this.removeHandles();
    const dirs = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    dirs.forEach((dir) => {
      const handle = document.createElement('div');
      handle.className = `cde-img-handle cde-img-handle--${dir}`;
      handle.dataset.dir = dir;
      handle.addEventListener('mousedown', (e) => this.startResize(e, dir));
      this.box.appendChild(handle);
      this.handles.push(handle);
    });
  }

  private removeHandles(): void {
    this.handles.forEach((h) => h.remove());
    this.handles = [];
  }

  private attachQuickBar(): void {
    this.removeQuickBar();
    if (!this.editor.isEditable) return;

    const bar = document.createElement('div');
    bar.className = 'cde-img-quick-bar';
    bar.tabIndex = -1;

    // 1. Editor avanzado (Filerobot)
    const editBtn = this.createQuickBtn(
      `${lucideSvg(Sliders, 13)}<span>Editar</span>`,
      'Editar imagen con Filerobot (recortar, filtros, anotar, redimensionar)',
      () => {
        openFilerobotModal({
          src: this.node.attrs.src,
          onSave: (savedSrc) => {
            this.updateAttrs({ src: savedSrc });
          },
        });
      },
    );

    // 2. Recortar (Crop)
    const cropBtn = this.createQuickBtn(
      `${lucideSvg(Crop, 13)}<span>Recortar</span>`,
      'Recortar imagen con Filerobot',
      () => {
        openFilerobotModal({
          src: this.node.attrs.src,
          defaultTab: 'Adjust',
          defaultTool: 'Crop',
          onSave: (croppedSrc) => {
            this.updateAttrs({ src: croppedSrc });
          },
        });
      },
    );

    // 2. Filtros
    const filterBtn = this.createQuickBtn(
      `${lucideSvg(Palette, 13)}<span>Filtros</span>`,
      'Aplicar efectos y filtros',
      () => {
        this.showFilterDropdown(filterBtn);
      },
    );

    // 3. Alineación
    const alignBtn = this.createQuickBtn(
      `${lucideSvg(AlignCenter, 13)}<span>Alinear</span>`,
      'Alinear imagen',
      () => {
        const nextAlign =
          this.node.attrs.alignment === 'center'
            ? 'right'
            : this.node.attrs.alignment === 'right'
              ? 'left'
              : 'center';
        this.updateAttrs({ alignment: nextAlign });
      },
    );

    // 4. Ajustar texto (Flotar)
    const wrapBtn = this.createQuickBtn(
      `${lucideSvg(WrapText, 13)}<span>Ajustar</span>`,
      'Ajustar texto alrededor de la imagen',
      () => {
        const nextWrap =
          this.node.attrs.wrap === 'none'
            ? 'left'
            : this.node.attrs.wrap === 'left'
              ? 'right'
              : 'none';
        this.updateAttrs({ wrap: nextWrap });
      },
    );

    // 5. Optimizar
    const optBtn = this.createQuickBtn(
      `${lucideSvg(Sparkles, 13)}<span>Optimizar</span>`,
      'Reducir tamaño del documento sin perder calidad',
      async () => {
        optBtn.innerHTML = `${lucideSvg(Sparkles, 13)}<span>...</span>`;
        const result = await optimizeImage(this.node.attrs.src);
        this.updateAttrs({ src: result.dataUrl });
        optBtn.innerHTML = `${lucideSvg(Sparkles, 13)}<span>-${result.savedPercent}%</span>`;
        setTimeout(() => {
          optBtn.innerHTML = `${lucideSvg(Sparkles, 13)}<span>Optimizar</span>`;
        }, 1800);
      },
    );

    // 6. Eliminar
    const delBtn = this.createQuickBtn(
      lucideSvg(Trash2, 13),
      'Eliminar imagen',
      () => {
        const pos = this.getPos();
        if (typeof pos === 'number') {
          this.editor.commands.deleteRange({ from: pos, to: pos + this.node.nodeSize });
        }
      },
      true,
    );

    bar.append(
      editBtn,
      cropBtn,
      filterBtn,
      this.createSep(),
      alignBtn,
      wrapBtn,
      this.createSep(),
      optBtn,
      delBtn,
    );

    this.box.appendChild(bar);
    this.quickBar = bar;
  }

  private createQuickBtn(
    contentHtml: string,
    title: string,
    onClick: (e: MouseEvent) => void,
    isDanger = false,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cde-img-quick-btn${isDanger ? ' is-danger' : ''}`;
    btn.innerHTML = contentHtml;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick(e);
    });
    return btn;
  }

  private createSep(): HTMLElement {
    const sep = document.createElement('div');
    sep.className = 'cde-img-quick-sep';
    return sep;
  }

  private showFilterDropdown(anchor: HTMLElement): void {
    const existing = document.querySelector('.cde-img-filter-popover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.className = 'cde-img-filter-popover cde-ctx-menu';
    popover.style.position = 'fixed';
    popover.style.zIndex = '13000';

    const rect = anchor.getBoundingClientRect();
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 6}px`;

    IMAGE_FILTERS.forEach((f) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cde-ctx-menu__item';
      item.innerHTML = `<span class="cde-ctx-menu__lead"><span class="cde-ctx-menu__icon">${lucideSvg(Palette, 14)}</span><span class="cde-ctx-menu__label">${f.label}</span></span>`;
      item.addEventListener('click', () => {
        this.updateAttrs({ filter: f.id });
        popover.remove();
      });
      popover.appendChild(item);
    });

    const closeHandler = (e: MouseEvent) => {
      if (!popover.contains(e.target as Node)) {
        popover.remove();
        document.removeEventListener('mousedown', closeHandler, true);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closeHandler, true);
    }, 10);

    document.body.appendChild(popover);
  }

  private removeQuickBar(): void {
    if (this.quickBar) {
      this.quickBar.remove();
      this.quickBar = null;
    }
  }

  private startResize(event: MouseEvent, dir: string): void {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startW = this.img.offsetWidth;
    const startH = this.img.offsetHeight;
    const aspect = startW / (startH || 1);

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newW = startW;
      let newH = startH;

      if (dir.includes('e')) newW = startW + dx;
      if (dir.includes('w')) newW = startW - dx;
      if (dir.includes('s')) newH = startH + dy;
      if (dir.includes('n')) newH = startH - dy;

      if (dir === 'se' || dir === 'nw' || dir === 'ne' || dir === 'sw') {
        newW = Math.max(60, newW);
        newH = Math.round(newW / aspect);
      } else if (dir === 'e' || dir === 'w') {
        newW = Math.max(60, newW);
        newH = Math.round(newW / aspect);
      } else {
        newH = Math.max(40, newH);
        newW = Math.round(newH * aspect);
      }

      this.img.style.width = `${newW}px`;
      this.img.style.height = `${newH}px`;
      this.showBadge(`${newW} × ${newH} px`);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.removeBadge();

      const finalW = Math.round(this.img.offsetWidth);
      const finalH = Math.round(this.img.offsetHeight);
      this.updateAttrs({ width: finalW, height: finalH });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private showBadge(text: string): void {
    if (!this.badge) {
      this.badge = document.createElement('div');
      this.badge.className = 'cde-img-badge';
      this.box.appendChild(this.badge);
    }
    this.badge.textContent = text;
  }

  private removeBadge(): void {
    if (this.badge) {
      this.badge.remove();
      this.badge = null;
    }
  }

  private updateAttrs(attrs: Record<string, any>): void {
    const pos = this.getPos();
    if (typeof pos !== 'number' || this.editor.isDestroyed) return;
    this.editor.view.dispatch(
      this.editor.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        ...attrs,
      }),
    );
  }

  public update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderAttributes();
    return true;
  }

  public destroy(): void {
    this.removeHandles();
    this.removeQuickBar();
    this.removeBadge();
  }
}

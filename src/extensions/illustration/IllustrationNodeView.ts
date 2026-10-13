import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';
import type { NodeView } from '@tiptap/pm/view';
import { NodeSelection } from '@tiptap/pm/state';

/**
 * Generic NodeView for editable illustration nodes (charts, shapes, smartart).
 * Renders an SVG preview from node attrs and opens an editor modal on double-click.
 */
export class IllustrationNodeView implements NodeView {
  public dom: HTMLElement;
  private box: HTMLElement;
  private preview: HTMLElement;
  private badge: HTMLElement | null = null;

  protected node: ProseMirrorNode;
  protected editor: Editor;
  protected getPos: () => number | undefined;

  /** Returns SVG markup for the given attrs. */
  private renderSvg: (attrs: Record<string, any>) => string;
  /** Opens the editor modal; calls onUpdate with new attrs. */
  private openEditor: (attrs: Record<string, any>, onUpdate: (attrs: Record<string, any>) => void) => void;
  /** Label shown in the badge. */
  private label: string;

  constructor(
    node: ProseMirrorNode,
    editor: Editor,
    getPos: () => number | undefined,
    config: {
      renderSvg: (attrs: Record<string, any>) => string;
      openEditor: (attrs: Record<string, any>, onUpdate: (attrs: Record<string, any>) => void) => void;
      label: string;
    },
  ) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.renderSvg = config.renderSvg;
    this.openEditor = config.openEditor;
    this.label = config.label;

    this.dom = document.createElement('div');
    this.dom.className = 'cde-illus-node';

    this.box = document.createElement('div');
    this.box.className = 'cde-illus-box';

    this.preview = document.createElement('div');
    this.preview.className = 'cde-illus-preview';

    this.box.appendChild(this.preview);
    this.dom.appendChild(this.box);

    this.renderPreview();

    // Click → select node
    this.box.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchNodeSelection();
    });

    this.box.addEventListener('contextmenu', () => {
      this.dispatchNodeSelection();
    });

    // Double-click → open editor
    this.box.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!this.editor.isEditable) return;
      this.openEditor({ ...this.node.attrs }, (newAttrs) => {
        this.updateAttrs(newAttrs);
      });
    });
  }

  private renderPreview(): void {
    const attrs = this.node.attrs as Record<string, any>;
    const width = Number(attrs.width) || 480;
    const height = Number(attrs.height) || 280;

    this.preview.innerHTML = this.renderSvg(attrs);
    this.preview.style.width = width + 'px';
    this.preview.style.height = height + 'px';

    const svg = this.preview.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    }
  }

  public dispatchNodeSelection(): void {
    const pos = this.getPos();
    if (typeof pos !== 'number' || this.editor.isDestroyed) return;
    try {
      const tr = this.editor.state.tr.setSelection(NodeSelection.create(this.editor.state.doc, pos));
      this.editor.view.dispatch(tr);
    } catch {
      // ignore
    }
  }

  public selectNode(): void {
    this.box.classList.add('is-selected');
    this.showBadge();
  }

  public deselectNode(): void {
    this.box.classList.remove('is-selected');
    this.removeBadge();
  }

  private showBadge(): void {
    this.removeBadge();
    this.badge = document.createElement('div');
    this.badge.className = 'cde-illus-badge';
    this.badge.innerHTML = `<span>${this.label}</span><span class="cde-illus-badge-hint">Doble clic para editar</span>`;
    this.box.appendChild(this.badge);
  }

  private removeBadge(): void {
    this.badge?.remove();
    this.badge = null;
  }

  private updateAttrs(attrs: Record<string, any>): void {
    const pos = this.getPos();
    if (typeof pos !== 'number') return;
    const { state, view } = this.editor;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
    // re-render happens via update()
  }

  public update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderPreview();
    return true;
  }

  public destroy(): void {
    this.removeBadge();
  }

  public ignoreMutation(): boolean {
    return true;
  }
}

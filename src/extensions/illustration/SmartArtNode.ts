import { Node } from '@tiptap/core';
import { IllustrationNodeView } from './IllustrationNodeView';
import { SMART_ART_TEMPLATES, PALETTES as SA_PALETTES } from '../../utils/smartArtGenerator';
import { svgToDataUri } from '../../utils/imageFromUri';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    smartart: {
      insertSmartArt: (options: SmartArtAttrs) => ReturnType;
      updateSmartArt: (options: Partial<SmartArtAttrs>) => ReturnType;
    };
  }
}

export interface SmartArtAttrs {
  templateId: string;
  items: { id: string; title: string; desc: string }[];
  paletteId: string;
  width: number;
  height: number;
}

export function smartArtAttrsToSvg(attrs: SmartArtAttrs): string {
  const tpl = SMART_ART_TEMPLATES.find((t) => t.id === attrs.templateId) ?? SMART_ART_TEMPLATES[0];
  const palette = SA_PALETTES.find((p) => p.id === attrs.paletteId) ?? SA_PALETTES[0];
  return tpl.renderSvg(
    attrs.items?.length ? attrs.items : [{ id: '1', title: 'Paso 1', desc: '' }],
    palette.colors,
    attrs.width || 720,
    attrs.height || 280,
  );
}

export function smartArtAttrsToDataUri(attrs: SmartArtAttrs): string {
  return svgToDataUri(smartArtAttrsToSvg(attrs));
}

export const SmartArtNode = Node.create({
  name: 'smartart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      templateId: { default: 'chevron-process' },
      items: {
        default: [
          { id: '1', title: 'Fase 1', desc: 'Inicio' },
          { id: '2', title: 'Fase 2', desc: 'Desarrollo' },
          { id: '3', title: 'Fase 3', desc: 'Revisión' },
          { id: '4', title: 'Fase 4', desc: 'Entrega' },
        ],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-sa-items') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-sa-items': JSON.stringify(attrs.items) }),
      },
      paletteId: { default: 'blue' },
      width: { default: 720 },
      height: { default: 280 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="smartart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'smartart', ...HTMLAttributes }];
  },

  addNodeView() {
    return (props) =>
      new IllustrationNodeView(props.node, props.editor as any, props.getPos as any, {
        label: 'SmartArt',
        renderSvg: (attrs) => smartArtAttrsToSvg(attrs as SmartArtAttrs),
        openEditor: (attrs, onUpdate) => {
          import('../../utils/smartArtEditorModal').then((m) => {
            m.openSmartArtEditorModal(attrs as SmartArtAttrs, onUpdate);
          });
        },
      });
  },

  addCommands() {
    return {
      insertSmartArt:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
      updateSmartArt:
        (options) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const pos = selection.from;
          const node = state.doc.nodeAt(pos);
          if (node?.type.name !== this.name) return false;
          if (dispatch) {
            dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...options }));
          }
          return true;
        },
    };
  },
});

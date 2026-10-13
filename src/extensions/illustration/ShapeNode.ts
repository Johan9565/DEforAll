import { Node } from '@tiptap/core';
import { IllustrationNodeView } from './IllustrationNodeView';
import { SHAPES, renderShapeSvg } from '../../utils/shapeGenerator';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    shape: {
      insertShape: (options: ShapeAttrs) => ReturnType;
      updateShape: (options: Partial<ShapeAttrs>) => ReturnType;
    };
  }
}

export interface ShapeAttrs {
  shapeId: string;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  textColor: string;
}

export function shapeAttrsToSvg(attrs: ShapeAttrs): string {
  const shape = SHAPES.find((s) => s.id === attrs.shapeId) ?? SHAPES[0];
  return renderShapeSvg(shape, {
    width: attrs.width || 220,
    height: attrs.height || 120,
    fill: attrs.fill || '#2563eb',
    stroke: attrs.stroke || '#1e40af',
    strokeWidth: attrs.strokeWidth ?? 2,
    text: attrs.text,
    textColor: attrs.textColor || '#ffffff',
  });
}

export const ShapeNode = Node.create({
  name: 'shape',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      shapeId: { default: 'rounded-rect' },
      width: { default: 220 },
      height: { default: 120 },
      fill: { default: '#2563eb' },
      stroke: { default: '#1e40af' },
      strokeWidth: { default: 2 },
      text: { default: '' },
      textColor: { default: '#ffffff' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="shape"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'shape', ...HTMLAttributes }];
  },

  addNodeView() {
    return (props) =>
      new IllustrationNodeView(props.node, props.editor as any, props.getPos as any, {
        label: 'Forma',
        renderSvg: (attrs) => shapeAttrsToSvg(attrs as ShapeAttrs),
        openEditor: (attrs, onUpdate) => {
          import('../../utils/shapeEditorModal').then((m) => {
            m.openShapeEditorModal(attrs as ShapeAttrs, onUpdate);
          });
        },
      });
  },

  addCommands() {
    return {
      insertShape:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
      updateShape:
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

import { Node, mergeAttributes } from '@tiptap/core';
import { CustomImageView } from './CustomImageView';

export interface CustomImageOptions {
  inline?: boolean;
  allowBase64?: boolean;
  HTMLAttributes?: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customImage: {
      /**
       * Add an image with support for dimensions, alignment, text wrap, and filters.
       */
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: number | string;
        height?: number | string;
        alignment?: 'left' | 'center' | 'right';
        wrap?: 'none' | 'left' | 'right';
        filter?: string;
      }) => ReturnType;
      /**
       * Update current selected image attributes.
       */
      updateImage: (options: {
        src?: string;
        alt?: string;
        title?: string;
        width?: number | string | null;
        height?: number | string | null;
        alignment?: 'left' | 'center' | 'right';
        wrap?: 'none' | 'left' | 'right';
        filter?: string;
      }) => ReturnType;
    };
  }
}

export const CustomImage = Node.create<CustomImageOptions>({
  name: 'image',

  addOptions() {
    return {
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline ?? false;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: (attributes) => ({ src: attributes.src }),
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute('alt'),
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt } : {}),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) => (attributes.title ? { title: attributes.title } : {}),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute('width') || element.style.width;
          return w ? parseInt(w, 10) || w : null;
        },
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const h = element.getAttribute('height') || element.style.height;
          return h ? parseInt(h, 10) || h : null;
        },
        renderHTML: (attributes) => (attributes.height ? { height: attributes.height } : {}),
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.alignment || 'center' }),
      },
      wrap: {
        default: 'none',
        parseHTML: (element) => element.getAttribute('data-wrap') || 'none',
        renderHTML: (attributes) => ({ 'data-wrap': attributes.wrap || 'none' }),
      },
      filter: {
        default: 'none',
        parseHTML: (element) => element.getAttribute('data-filter') || 'none',
        renderHTML: (attributes) => ({ 'data-filter': attributes.filter || 'none' }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
      {
        tag: 'div[data-type="image"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes ?? {}, HTMLAttributes)];
  },

  addNodeView() {
    return (props) =>
      new CustomImageView(props.node, props.editor as any, props.getPos as any);
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
      updateImage:
        (options) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const pos = selection.from;
          const node = state.doc.nodeAt(pos);
          if (node?.type.name !== this.name) return false;
          if (dispatch) {
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...options,
              }),
            );
          }
          return true;
        },
    };
  },
});

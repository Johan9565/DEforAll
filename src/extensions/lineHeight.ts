import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string | null) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

/**
 * line-height on paragraph / heading (Word-like line spacing).
 */
export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string | null) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let changed = false;
          const types: string[] = this.options.types;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!types.includes(node.type.name)) return;
            if (node.attrs.lineHeight === lineHeight) return;
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              lineHeight,
            });
            changed = true;
          });

          // Collapsed caret still updates the current block
          if (!changed && from === to) {
            const $pos = state.selection.$from;
            for (let d = $pos.depth; d > 0; d -= 1) {
              const node = $pos.node(d);
              if (types.includes(node.type.name)) {
                const pos = $pos.before(d);
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  lineHeight,
                });
                changed = true;
                break;
              }
            }
          }

          if (changed && dispatch) dispatch(tr.scrollIntoView());
          return changed;
        },
      unsetLineHeight:
        () =>
        ({ commands }) =>
          commands.setLineHeight(null),
    };
  },
});

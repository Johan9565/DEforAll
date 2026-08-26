import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const MAX_INDENT = 8;
const INDENT_PX = 24;

function clampIndent(value: number): number {
  return Math.max(0, Math.min(MAX_INDENT, value));
}

/**
 * Paragraph/heading left indent. Inside lists, sinks/lifts list items.
 */
export const Indent = Extension.create({
  name: 'indent',

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
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-indent');
              if (raw != null) return clampIndent(Number.parseInt(raw, 10) || 0);
              const ml = element.style.marginLeft;
              if (ml) {
                const px = Number.parseFloat(ml);
                if (Number.isFinite(px)) return clampIndent(Math.round(px / INDENT_PX));
              }
              return 0;
            },
            renderHTML: (attributes) => {
              const indent = clampIndent(Number(attributes.indent) || 0);
              if (!indent) return {};
              return {
                'data-indent': String(indent),
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ editor, state, tr, dispatch }) => {
          if (editor.can().sinkListItem('listItem')) {
            return editor.commands.sinkListItem('listItem');
          }
          if (editor.can().sinkListItem('taskItem')) {
            return editor.commands.sinkListItem('taskItem');
          }

          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!this.options.types.includes(node.type.name)) return;
            const next = clampIndent((node.attrs.indent ?? 0) + 1);
            if (next === (node.attrs.indent ?? 0)) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          });
          if (changed && dispatch) dispatch(tr.scrollIntoView());
          return changed;
        },
      outdent:
        () =>
        ({ editor, state, tr, dispatch }) => {
          if (editor.can().liftListItem('listItem')) {
            return editor.commands.liftListItem('listItem');
          }
          if (editor.can().liftListItem('taskItem')) {
            return editor.commands.liftListItem('taskItem');
          }

          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!this.options.types.includes(node.type.name)) return;
            const next = clampIndent((node.attrs.indent ?? 0) - 1);
            if (next === (node.attrs.indent ?? 0)) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          });
          if (changed && dispatch) dispatch(tr.scrollIntoView());
          return changed;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    };
  },
});

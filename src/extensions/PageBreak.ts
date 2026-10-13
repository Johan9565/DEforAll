import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

/**
 * Explicit page break node. Inserting this forces the pagination
 * system to start a new page at this position.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
      { tag: 'hr[data-page-break]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        'data-page-break': 'true',
        class: 'cde-page-break-node',
        contenteditable: 'false',
      }),
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

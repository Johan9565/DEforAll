import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Typography from '@tiptap/extension-typography';
import { FontSize } from './fontSize';
import { Indent } from './indent';
import { LineHeight } from './lineHeight';
import { WidgetTable } from './widgetTable/WidgetTable';

/**
 * Free/open-source TipTap extensions useful for a formal document editor.
 * TipTap Pro extensions are intentionally excluded.
 */
export function createDocumentExtensions(options?: {
  placeholder?: string;
}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    TextStyle,
    Color,
    FontSize,
    Indent,
    LineHeight,
    FontFamily.configure({
      types: ['textStyle'],
    }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class: 'cde-link',
        rel: 'noopener noreferrer nofollow',
      },
    }),
    Image.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'cde-image',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    WidgetTable,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Typography,
    Placeholder.configure({
      placeholder:
        options?.placeholder ?? 'Comienza a redactar tu documento...',
    }),
    CharacterCount,
  ];
}

import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src'],
      exclude: ['src/main.ts'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(rootDir, 'src/index.ts'),
      name: 'CustomDocEditor',
      formats: ['es', 'umd'],
      fileName: (format) => `custom-doc-editor.${format}.js`,
    },
    rollupOptions: {
      external: [/^@tiptap\//],
      output: {
        assetFileNames: 'custom-doc-editor.[ext]',
        globals: {
          '@tiptap/core': 'TiptapCore',
          '@tiptap/starter-kit': 'TiptapStarterKit',
          '@tiptap/extension-table': 'TiptapTable',
          '@tiptap/extension-table-row': 'TiptapTableRow',
          '@tiptap/extension-table-cell': 'TiptapTableCell',
          '@tiptap/extension-table-header': 'TiptapTableHeader',
          '@tiptap/extension-text-align': 'TiptapTextAlign',
          '@tiptap/extension-underline': 'TiptapUnderline',
          '@tiptap/extension-link': 'TiptapLink',
          '@tiptap/extension-image': 'TiptapImage',
          '@tiptap/extension-placeholder': 'TiptapPlaceholder',
          '@tiptap/extension-character-count': 'TiptapCharacterCount',
          '@tiptap/extension-text-style': 'TiptapTextStyle',
          '@tiptap/extension-color': 'TiptapColor',
          '@tiptap/extension-font-family': 'TiptapFontFamily',
          '@tiptap/extension-highlight': 'TiptapHighlight',
          '@tiptap/extension-subscript': 'TiptapSubscript',
          '@tiptap/extension-superscript': 'TiptapSuperscript',
          '@tiptap/extension-task-list': 'TiptapTaskList',
          '@tiptap/extension-task-item': 'TiptapTaskItem',
          '@tiptap/extension-typography': 'TiptapTypography',
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});

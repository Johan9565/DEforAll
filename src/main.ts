import { DocumentEditor } from './DocumentEditor';
import { TEST_DOCUMENT_10_PAGES } from './testDocument';

const container = document.querySelector<HTMLDivElement>('#app');

if (!container) {
  throw new Error('Sandbox mount point #app not found');
}

const editor = new DocumentEditor({
  element: container,
  pageSize: 'letter',
  pagination: true,
  initialContent: TEST_DOCUMENT_10_PAGES,
  onUpdate: ({ html, pageCount }) => {
    console.log(
      `Actualizado · ${pageCount} pág. ·`,
      html.slice(0, 100) + '…',
    );
  },
  onPaginated: ({ pageCount }) => {
    console.log('✅ Paginación completada — Páginas:', pageCount);
  },
});

(window as unknown as { documentEditor: DocumentEditor }).documentEditor =
  editor;

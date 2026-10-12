import { DocumentEditor } from './DocumentEditor';
import { COMPLEX_SAMPLE_DOCUMENT } from './sampleDocument';

const container = document.querySelector<HTMLDivElement>('#app');

if (!container) {
  throw new Error('Sandbox mount point #app not found');
}

const editor = new DocumentEditor({
  element: container,
  pageSize: 'letter',
  pagination: true,
  initialContent: COMPLEX_SAMPLE_DOCUMENT,
  onUpdate: ({ html, pageCount }) => {
    console.log(
      `Actualizado · ${pageCount} pág. ·`,
      html.slice(0, 100) + '…',
    );
  },
  onPaginated: ({ pageCount }) => {
    console.log('Páginas:', pageCount);
  },
});

(window as unknown as { documentEditor: DocumentEditor }).documentEditor =
  editor;

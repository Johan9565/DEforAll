# @deforall/custom-doc-editor

Editor de documentos tipado sobre [TipTap](https://tiptap.dev) + paginación real con [Paged.js](https://pagedjs.org), listo para Livewire, Vue u otros frameworks.

## Requisitos

- Node.js 18+
- TipTap v2 como peer dependency (instalado en el consumidor o vía `devDependencies` del sandbox)
- `pagedjs` se instala como dependency de esta librería

## Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL de Vite (normalmente `http://localhost:5173`). El sandbox monta el editor y la vista paginada.

```bash
npm run build
```

Genera en `dist/`:

- `custom-doc-editor.es.js` — ESM
- `custom-doc-editor.umd.js` — UMD (`CustomDocEditor` global)
- `custom-doc-editor.css` — estilos de hoja + toolbar + Paged.js
- `index.d.ts` — tipos TypeScript

## Uso

### ESM (Vue, bundlers, Livewire + Vite)

```ts
import { DocumentEditor } from '@deforall/custom-doc-editor';
import '@deforall/custom-doc-editor/styles';

const editor = new DocumentEditor({
  element: document.getElementById('editor')!,
  pageSize: 'letter', // o 'a4'
  toolbar: true,
  pagination: true, // default: TipTap edita + Paged.js pagina
  initialContent: '<p>Hola</p>',
  onUpdate: ({ html, json }) => {
    // sincroniza con Livewire / store
  },
  onPaginated: ({ pageCount }) => {
    console.log(pageCount);
  },
});

editor.getHTML();
editor.getPageCount();
await editor.refreshPagination();
editor.destroy();
```

### UMD (script clásico)

```html
<link rel="stylesheet" href="/vendor/custom-doc-editor.css" />
<script src="/path/to/tiptap-globals.js"></script>
<script src="/vendor/custom-doc-editor.umd.js"></script>
<script>
  const { DocumentEditor } = CustomDocEditor;
  const editor = new DocumentEditor({
    element: document.getElementById('editor'),
  });
</script>
```

> En UMD, TipTap queda externalizado: el host debe exponer los globals configurados en `vite.config.ts`, o preferir el build ESM.

## Paginación — Páginas virtuales por medición

Con `pagination: true` (default):

1. **Árbol continuo** — ProseMirror mantiene un solo documento; el cursor no se rompe.
2. **Medición por líneas** — recorre todo el árbol (párrafos, ítems de lista, celdas…) y mide líneas con `coordsAtPos`. Sin saltos forzados por bloque contenedor.
3. **WidgetDecoration** — cuando la altura acumulada supera el área útil (Carta: 11in − 2×1in márgenes), inyecta un espaciador (`fill` + `gap`) que empuja el contenido a la siguiente hoja virtual.
4. **Hojas de fondo** — `.cde-virtual-sheet` (8.5×11 / A4) se sincronizan detrás del flujo editable.
5. **Paged.js** — botón `PDF` para vista de impresión exacta.

Desactiva con `pagination: false`.

## API

| Método / opción | Descripción |
| --- | --- |
| `element` | Contenedor host (se convierte en `.cde-workspace`) |
| `pageSize` | `'letter'` (default) o `'a4'` |
| `toolbar` | `true` (default) muestra la barra de formato |
| `pagination` | `true` (default) activa Paged.js |
| `initialContent` | HTML string o JSON TipTap |
| `extensions` | Extensiones TipTap adicionales |
| `onUpdate` | Callback `{ html, json }` |
| `onPaginated` | Callback `{ pageCount }` tras cada render Paged.js |
| `getHTML()` / `getJSON()` | Lectura del documento |
| `getPageCount()` | Número de páginas actuales |
| `getCharacterCount()` / `getWordCount()` | Contadores del documento |
| `togglePrintPreview()` | Alterna edición en vivo ↔ Paged.js (solo lectura) |
| `refreshPagination()` | Recalcula hojas en vivo |
| `setContent(content)` | Reemplaza el contenido |
| `focus()` / `isEmpty()` / `destroy()` | Control del ciclo de vida |
| `getEditor()` | Instancia TipTap subyacente |
| `getToolbar()` | Instancia de `Toolbar` o `null` |
| `getLivePagination()` | *(eliminado)* — usar `PagePagination` vía `editor.storage.pagePagination` |
| `getPrintPreview()` | Preview Paged.js o `null` |

### Toolbar

Incluye historial, marcas, sub/superíndice, color, resaltado, títulos, cita/código/HR, listas (incl. tareas), alineación, enlace, imagen, fuentes y tablas. Muestra palabras/caracteres y páginas. Se oculta al imprimir.

### Extensiones TipTap (open source)

Incluidas de forma gratuita (sin TipTap Pro):

- StarterKit (negrita, cursiva, tachado, código, headings, listas, cita, code block, HR, historial…)
- Underline, TextAlign, Table (+ row/cell/header)
- Link, Image, Placeholder, CharacterCount
- TextStyle, Color, FontFamily, Highlight
- Subscript, Superscript
- TaskList / TaskItem
- Typography

**No incluidas** (requieren TipTap Pro o setup extra): Collaboration, Mentions UI, AI, Comments, etc.

## Estructura

```
src/
├── extensions/
│   ├── index.ts
│   ├── PagePagination.ts      # Plugin ProseMirror
│   ├── virtualPageLayout.ts   # Medición + hojas virtuales
│   └── pageMetrics.ts
├── styles/
│   ├── document.css
│   ├── toolbar.css
│   └── paged.css
├── DocumentEditor.ts
├── Pagination.ts           # PrintPreview (Paged.js)
├── Toolbar.ts
├── types.ts
├── index.ts
└── main.ts
```

## Próximos pasos

- Extensión “Cuadro de Clasificación”
- Integración de ejemplo Laravel / Livewire

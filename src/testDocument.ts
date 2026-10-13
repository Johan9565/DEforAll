/**
 * Documento de prueba de 10+ páginas con TODAS las opciones del editor.
 * Usa nodos EDITABLES para gráficos, formas y SmartArt (doble-clic para editar).
 */

const chartNode = (
  type: string,
  title: string,
  data: { label: string; value: number }[],
  palette = 'blue',
  w = 720,
  h = 420,
) =>
  `<div data-type="chart" data-chart-type="${type}" data-title="${title}" data-chart-data='${JSON.stringify(data)}' data-palette-id="${palette}" data-show-legend="true" data-show-labels="true" data-width="${w}" data-height="${h}"></div>`;

const shapeNode = (
  shapeId: string,
  label: string,
  fill: string,
  stroke = '#1e40af',
  w = 220,
  h = 120,
) =>
  `<div data-type="shape" data-shape-id="${shapeId}" data-width="${w}" data-height="${h}" data-fill="${fill}" data-stroke="${stroke}" data-stroke-width="2" data-text="${label}" data-text-color="#ffffff"></div>`;

const smartArtNode = (
  templateId: string,
  items: { id: string; title: string; desc: string }[],
  palette = 'blue',
  w = 720,
  h = 280,
) =>
  `<div data-type="smartart" data-template-id="${templateId}" data-sa-items='${JSON.stringify(items)}' data-palette-id="${palette}" data-width="${w}" data-height="${h}"></div>`;

const svgIcon = (name: string, color: string) =>
  `<img src="data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <rect x="1" y="1" width="46" height="46" rx="12" fill="${color}1a" stroke="${color}40" stroke-width="1.5"/>
      <circle cx="24" cy="24" r="10" fill="none" stroke="${color}" stroke-width="2.5"/>
      <path d="M24 18 v12 M18 24 h12" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  )}" alt="${name}" width="48" height="48" />`;

export const TEST_DOCUMENT_10_PAGES = `
<!-- ══════════ PÁGINA 1 — Portada + formato de texto ══════════ -->
<h1 style="text-align: center; color: #1e3a8a; font-size: 28px; font-weight: 800; margin-bottom: 4px;">
  DOCUMENTO DE PRUEBA INTEGRAL — 10 PÁGINAS
</h1>
<p style="text-align: center; font-size: 13px; color: #475569; margin-top: 0; margin-bottom: 20px;">
  <em>Verificación de paginación, canvas y nodos editables · v2.0</em>
</p>

<h2 style="color: #1e40af; font-size: 20px;">1. Formato de texto completo</h2>
<p style="text-align: justify; line-height: 1.7;">
  Este párrafo prueba <strong>negrita</strong>, <em>cursiva</em>, <u>subrayado</u>, <s>tachado</s>,
  <sup>superíndice</sup>, <sub>subíndice</sub>, y combinaciones como
  <strong><em>negrita cursiva</em></strong> y <strong><u>negrita subrayada</u></strong>.
</p>
<p style="text-align: justify; line-height: 1.7;">
  Colores: <span style="color: #dc2626;">rojo</span>, <span style="color: #2563eb;">azul</span>,
  <span style="color: #059669;">verde</span>, <span style="color: #7c3aed;">púrpura</span>,
  <span style="color: #d97706;">ámbar</span>.
  Resaltados: <mark style="background-color: #fef08a;">amarillo</mark>,
  <mark style="background-color: #bbf7d0;">verde</mark>,
  <mark style="background-color: #bfdbfe;">azul</mark>.
</p>
<p style="text-align: justify; line-height: 1.7;">
  Tamaños: <span style="font-size: 11px;">11px</span>, <span style="font-size: 14px;">14px</span>,
  <span style="font-size: 18px;">18px</span>, <span style="font-size: 22px;">22px</span>.
  Familias: <span style="font-family: Georgia, serif;">Georgia</span>,
  <span style="font-family: 'Courier New', monospace;">Courier</span>,
  <span style="font-family: Arial, sans-serif;">Arial</span>.
</p>

<h3 style="color: #334155; font-size: 16px;">1.1 Listas</h3>
<ul style="line-height: 1.8; margin: 8px 0;">
  <li>Primer elemento de lista desordenada</li>
  <li>Segundo elemento con <strong>negrita</strong> y <em>cursiva</em></li>
  <li>Tercer elemento con <span style="color: #2563eb;">color azul</span></li>
  <li>Cuarto elemento para forzar contenido</li>
</ul>
<ol style="line-height: 1.8; margin: 8px 0;">
  <li>Primer paso del procedimiento</li>
  <li>Segundo paso con detalles</li>
  <li>Tercer paso con <u>énfasis</u></li>
  <li>Cuarto paso de verificación</li>
  <li>Quinto paso de cierre</li>
</ol>

<!-- ══════════ PÁGINA 2 — Tablas + enlaces ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">2. Tablas y enlaces</h2>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px;">
  <thead>
    <tr style="background-color: #1e40af; color: #ffffff;">
      <th style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left;">Departamento</th>
      <th style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left;">Responsable</th>
      <th style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: center;">Presupuesto</th>
      <th style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: center;">Estado</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Ingeniería</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Ana García</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">€125.000</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;"><span style="color: #059669; font-weight: 600;">Activo</span></td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Marketing</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Carlos López</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">€89.500</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;"><span style="color: #d97706; font-weight: 600;">En curso</span></td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Finanzas</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">María Rodríguez</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">€210.000</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;"><span style="color: #059669; font-weight: 600;">Activo</span></td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Operaciones</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Juan Martínez</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">€67.200</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;"><span style="color: #dc2626; font-weight: 600;">Retrasado</span></td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Recursos Humanos</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Laura Sánchez</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">€45.800</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;"><span style="color: #059669; font-weight: 600;">Activo</span></td>
    </tr>
  </tbody>
</table>
<p style="text-align: justify; line-height: 1.7;">
  Enlaces: <a href="https://www.example.com" class="cde-link">Example.com</a>,
  <a href="https://github.com" class="cde-link">GitHub</a>,
  <a href="https://developer.mozilla.org" class="cde-link">MDN Web Docs</a>,
  <a href="https://www.w3.org" class="cde-link">W3C</a>.
</p>
<blockquote style="border-left: 4px solid #2563eb; padding-left: 14px; margin: 16px 0; color: #1e293b; font-style: italic; background-color: #f8fafc; padding-top: 8px; padding-bottom: 8px;">
  «Las tablas bien formateadas son esenciales para la comunicación profesional de datos.»
  <br><strong style="font-style: normal; color: #334155; font-size: 11px;">— Manual de Estilo Editorial</strong>
</blockquote>

<!-- ══════════ PÁGINA 3 — Iconos + Formas editables ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">3. Iconos y formas editables</h2>
<p style="text-align: center; margin: 16px 0;">
  ${svgIcon('check', '#2563eb')}
  ${svgIcon('star', '#d97706')}
  ${svgIcon('heart', '#dc2626')}
  ${svgIcon('shield', '#059669')}
  ${svgIcon('zap', '#7c3aed')}
  ${svgIcon('globe', '#0891b2')}
</p>

<h3 style="color: #334155; font-size: 16px;">3.1 Formas editables (doble-clic para editar)</h3>
${shapeNode('rounded-rect', 'Aprobado', '#2563eb')}
${shapeNode('rounded-rect', 'Pendiente', '#d97706')}

<h3 style="color: #334155; font-size: 16px;">3.2 Más formas</h3>
${shapeNode('circle', 'Éxito', '#059669')}
${shapeNode('hexagon', 'Revisión', '#7c3aed')}

<p style="text-align: justify; line-height: 1.7;">
  Estas formas son <strong>nodos editables</strong>. Haz doble clic en cualquier forma
  para abrir el editor y cambiar color, texto, tamaño o tipo de forma.
</p>

<!-- ══════════ PÁGINA 4 — Gráficos editables ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">4. Gráficos editables (doble-clic para editar)</h2>
${chartNode('column', 'Rendimiento Trimestral', [
  { label: 'Q1', value: 45 },
  { label: 'Q2', value: 72 },
  { label: 'Q3', value: 89 },
  { label: 'Q4', value: 110 },
], 'blue')}

${chartNode('bar', 'Distribución de Ventas', [
  { label: 'Producto A', value: 320 },
  { label: 'Producto B', value: 210 },
  { label: 'Producto C', value: 180 },
  { label: 'Producto D', value: 95 },
], 'emerald')}

${chartNode('pie', 'Cuota de Mercado', [
  { label: 'Nuestra empresa', value: 35 },
  { label: 'Competidor A', value: 25 },
  { label: 'Competidor B', value: 20 },
  { label: 'Otros', value: 20 },
], 'purple')}

<!-- ══════════ PÁGINA 5 — SmartArt editable ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">5. SmartArt editable (doble-clic para editar)</h2>

<h3 style="color: #334155; font-size: 16px;">5.1 Proceso de flechas</h3>
${smartArtNode('chevron-process', [
  { id: '1', title: 'Planificación', desc: 'Definir objetivos' },
  { id: '2', title: 'Diseño', desc: 'Crear prototipo' },
  { id: '3', title: 'Desarrollo', desc: 'Implementar' },
  { id: '4', title: 'Entrega', desc: 'Lanzamiento' },
], 'blue')}

<h3 style="color: #334155; font-size: 16px;">5.2 Jerarquía organizacional</h3>
${smartArtNode('hierarchy-org', [
  { id: '1', title: 'Dirección General', desc: '' },
  { id: '2', title: 'Ingeniería', desc: '' },
  { id: '3', title: 'Marketing', desc: '' },
  { id: '4', title: 'Finanzas', desc: '' },
], 'emerald')}

<h3 style="color: #334155; font-size: 16px;">5.3 Ciclo de mejora continua</h3>
${smartArtNode('circular-cycle', [
  { id: '1', title: 'Plan', desc: '' },
  { id: '2', title: 'Do', desc: '' },
  { id: '3', title: 'Check', desc: '' },
  { id: '4', title: 'Act', desc: '' },
], 'purple')}

<!-- ══════════ PÁGINA 6 — Más gráficos ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">6. Visualizaciones adicionales</h2>

${chartNode('line', 'Tendencia Anual', [
  { label: 'Ene', value: 45 },
  { label: 'Feb', value: 52 },
  { label: 'Mar', value: 68 },
  { label: 'Abr', value: 75 },
  { label: 'May', value: 82 },
  { label: 'Jun', value: 91 },
], 'warm')}

${chartNode('donut', 'Distribución de Costes', [
  { label: 'Personal', value: 45 },
  { label: 'Tecnología', value: 25 },
  { label: 'Marketing', value: 15 },
  { label: 'Otros', value: 15 },
], 'slate')}

<!-- ══════════ PÁGINA 7 — Formas + SmartArt mixto ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">7. Combinación de elementos</h2>

<h3 style="color: #334155; font-size: 16px;">7.1 Formas de estado</h3>
${shapeNode('rounded-rect', 'Éxito', '#059669')}
${shapeNode('rounded-rect', 'Advertencia', '#d97706')}
${shapeNode('rounded-rect', 'Error', '#dc2626')}

<h3 style="color: #334155; font-size: 16px;">7.2 SmartArt de proceso</h3>
${smartArtNode('process-list', [
  { id: '1', title: 'Inicio', desc: 'Solicitud recibida' },
  { id: '2', title: 'Análisis', desc: 'Evaluación de requisitos' },
  { id: '3', title: 'Desarrollo', desc: 'Implementación' },
  { id: '4', title: 'Pruebas', desc: 'QA y validación' },
  { id: '5', title: 'Entrega', desc: 'Producción' },
], 'neon')}

<!-- ══════════ PÁGINA 8 — Listas de tareas + citas ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">8. Listas de tareas y citas</h2>
<ul data-type="taskList" style="line-height: 2.0; margin: 12px 0;">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled></label> <span>Completar revisión del documento</span></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled></label> <span>Validar tablas de datos</span></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled></label> <span>Revisar gráficos editables</span></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled></label> <span>Verificar paginación</span></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled></label> <span>Aprobar versión final</span></li>
</ul>

<h3 style="color: #334155; font-size: 16px;">8.1 Bloques de cita</h3>
<blockquote style="border-left: 4px solid #7c3aed; padding-left: 14px; margin: 12px 0; color: #1e293b; font-style: italic; background-color: #faf5ff; padding-top: 8px; padding-bottom: 8px;">
  «La calidad nunca es un accidente; es siempre el resultado de un esfuerzo inteligente.»
  <br><strong style="font-style: normal; color: #6b21a8; font-size: 11px;">— John Ruskin</strong>
</blockquote>
<blockquote style="border-left: 4px solid #d97706; padding-left: 14px; margin: 12px 0; color: #1e293b; font-style: italic; background-color: #fffbeb; padding-top: 8px; padding-bottom: 8px;">
  «La simplicidad es la sofisticación suprema.»
  <br><strong style="font-style: normal; color: #92400e; font-size: 11px;">— Leonardo da Vinci</strong>
</blockquote>

<!-- ══════════ PÁGINA 9 — Contenido mixto ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">9. Contenido mixto denso</h2>
<h3 style="color: #334155; font-size: 16px;">9.1 Párrafos con formato</h3>
<p style="text-align: justify; line-height: 1.7;">
  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
  ut labore et dolore magna aliqua. <strong>Ut enim ad minim veniam</strong>, quis nostrud
  exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
  <span style="color: #2563eb; font-weight: 600;">Duis aute irure dolor</span> in reprehenderit
  in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
</p>
<p style="text-align: justify; line-height: 1.7;">
  Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
  anim id est laborum. <em>Sed ut perspiciatis unde omnis iste natus error sit voluptatem
  accusantium doloremque laudantium</em>, totam rem aperiam, eaque ipsa quae ab illo
  inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
</p>

<h3 style="color: #334155; font-size: 16px;">9.2 Tabla compacta</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px;">
  <thead>
    <tr style="background-color: #334155; color: #ffffff;">
      <th style="border: 1px solid #94a3b8; padding: 6px 8px;">ID</th>
      <th style="border: 1px solid #94a3b8; padding: 6px 8px;">Concepto</th>
      <th style="border: 1px solid #94a3b8; padding: 6px 8px;">Categoría</th>
      <th style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right;">Importe</th>
      <th style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: center;">IVA</th>
      <th style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right;">Total</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">001</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Licencias</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Tecnología</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€2.400</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">21%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€2.904</td></tr>
    <tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">002</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Consultoría</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Servicios</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€5.800</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">21%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€7.018</td></tr>
    <tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">003</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Equipamiento</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Inversión</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€12.000</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">21%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€14.520</td></tr>
    <tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">004</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Formación</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">RRHH</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€1.200</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">21%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€1.452</td></tr>
    <tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">005</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Marketing</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Comercial</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€3.600</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">21%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">€4.356</td></tr>
  </tbody>
</table>

<!-- ══════════ PÁGINA 10 — Resumen ══════════ -->
<div data-type="page-break"></div>

<h2 style="color: #1e40af; font-size: 20px;">10. Resumen de verificación</h2>
<h3 style="color: #334155; font-size: 16px;">10.1 Checklist</h3>
<ul style="line-height: 1.9; margin: 12px 0;">
  <li>✅ Formato de texto: negrita, cursiva, subrayado, tachado, sub/superíndice</li>
  <li>✅ Colores de texto y resaltados</li>
  <li>✅ Listas: ordenadas, desordenadas, de tareas</li>
  <li>✅ Tablas con cabeceras y filas alternas</li>
  <li>✅ Enlaces externos</li>
  <li>✅ Bloques de cita</li>
  <li>✅ Iconos vectoriales</li>
  <li>✅ <strong>Formas editables</strong> (doble-clic)</li>
  <li>✅ <strong>Gráficos editables</strong> (doble-clic)</li>
  <li>✅ <strong>SmartArt editable</strong> (doble-clic)</li>
  <li>✅ Saltos de página explícitos</li>
  <li>✅ Encabezados H1/H2/H3</li>
</ul>
<h3 style="color: #334155; font-size: 16px;">10.2 Instrucciones</h3>
<ol style="line-height: 1.8; margin: 12px 0;">
  <li>Verificar que el documento se divide en <strong>10+ páginas</strong></li>
  <li>Comprobar que la <strong>numeración de páginas</strong> es correcta</li>
  <li>Hacer <strong>doble-clic</strong> en gráficos, formas y SmartArt para editarlos</li>
  <li>Confirmar que el <strong>canvas</strong> no se corta ni se desborda</li>
  <li>Verificar que los <strong>encabezados y pies</strong> aparecen en cada página</li>
</ol>
<blockquote style="border-left: 4px solid #2563eb; padding-left: 14px; margin: 20px 0; color: #1e293b; font-style: italic; background-color: #eff6ff; padding-top: 10px; padding-bottom: 10px;">
  «Documento de prueba con nodos editables para validar la integridad del editor.»
  <br><strong style="font-style: normal; color: #1e40af; font-size: 11px;">— Sistema de Verificación</strong>
</blockquote>
<p style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
  <em>— Fin del documento de prueba —</em>
</p>
`;

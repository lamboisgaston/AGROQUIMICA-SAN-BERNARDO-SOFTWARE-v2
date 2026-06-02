const PDFDocument = require('pdfkit');

const PAGE = {
  margin: 22,
  width: 595.28,
  height: 841.89
};

const COLORS = {
  ink: '#1f2933',
  muted: '#677381',
  line: '#d8dee6',
  softLine: '#edf1f5',
  header: '#f4f6f8',
  panel: '#fafbfc',
  accent: '#2f3a45'
};

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function clean(value, fallback = '') {
  if (isBlank(value)) return fallback;
  if (typeof value === 'object') return fallback;
  return String(value)
    .replace(/[{}[\]"]/g, '')
    .replace(/\b(null|undefined)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function displayValue(value, fallback = '—') {
  return clean(value, fallback);
}

function formatDate(value) {
  if (isBlank(value)) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('es-AR');
  const text = String(value).slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? clean(value) : parsed.toLocaleDateString('es-AR');
}

function valueAt(...values) {
  return values.find((value) => !isBlank(value) && (value instanceof Date || typeof value !== 'object'));
}

function ensureSpace(doc, height = 40) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function resetStroke(doc) {
  doc.strokeColor(COLORS.line).lineWidth(0.6).fillColor(COLORS.ink);
}

function title(doc, main, sub, metaRows = []) {
  ensureSpace(doc, 78);
  doc.fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(16.5)
    .text(main, { align: 'center', characterSpacing: 0.5 });
  doc.moveDown(0.1);
  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9.2)
    .text(sub, { align: 'center', characterSpacing: 0.8 });
  doc.moveDown(0.45);

  if (metaRows.length) {
    const gap = 14;
    const width = (contentWidth(doc) - gap) / 2;
    const y = doc.y;
    metaRows.slice(0, 2).forEach(([label, value], index) => {
      const x = doc.page.margins.left + index * (width + gap);
      doc.roundedRect(x, y, width, 24, 4).fillAndStroke(COLORS.panel, COLORS.line);
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.8).text(clean(label).toUpperCase(), x + 8, y + 4, { width: width - 16 });
      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.2).text(displayValue(value), x + 8, y + 14, { width: width - 16 });
    });
    doc.y = y + 29;
  }
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 28);
  doc.moveDown(0.12);
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  const y = doc.y;
  doc.roundedRect(x, y, width, 15, 3).fill(COLORS.header);
  doc.fillColor(COLORS.accent)
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .text(clean(text).toUpperCase(), x + 8, y + 4, { width: width - 16, characterSpacing: 0.35 });
  doc.y = y + 17;
  resetStroke(doc);
}

function fichaGrid(doc, rows, columns = 2, options = {}) {
  const visibleRows = rows.map(([label, value]) => [label, displayValue(value)]);
  const gapX = options.gapX || 8;
  const gapY = options.gapY || 4;
  const width = contentWidth(doc);
  const colWidth = (width - gapX * (columns - 1)) / columns;
  const labelHeight = 8;
  const lineGap = 0;
  const rowHeights = [];
  for (let i = 0; i < visibleRows.length; i += columns) {
    const group = visibleRows.slice(i, i + columns);
    const maxValueHeight = Math.max(...group.map(([, value]) => doc.font('Helvetica').fontSize(options.fontSize || 8.1).heightOfString(value, { width: colWidth - 14, lineGap })));
    rowHeights.push(Math.max(options.minHeight || 22, labelHeight + maxValueHeight + 10));
  }
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + gapY * Math.max(0, rowHeights.length - 1) + (options.padY || 0);
  ensureSpace(doc, totalHeight + 6);

  const startX = doc.page.margins.left;
  let y = doc.y;
  visibleRows.forEach(([label, value], index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = startX + col * (colWidth + gapX);
    const cellY = y + rowHeights.slice(0, row).reduce((sum, height) => sum + height + gapY, 0);
    doc.roundedRect(x, cellY, colWidth, rowHeights[row], 3).fillAndStroke(COLORS.panel, COLORS.softLine);
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.4).text(clean(label).toUpperCase(), x + 7, cellY + 5, { width: colWidth - 14 });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(options.fontSize || 8.1).text(value, x + 7, cellY + 13, { width: colWidth - 14, lineGap });
  });
  doc.y = y + totalHeight + 2;
  resetStroke(doc);
}

function numeroRegistroDesdeResolucion(resolucion = '', tipoRegistro = '') {
  const texto = clean(resolucion);
  const tipo = clean(tipoRegistro);
  if (!texto) return '';
  if (tipo && texto.toLowerCase().startsWith(tipo.toLowerCase())) return texto.slice(tipo.length).trim();
  return texto;
}

function registroCompleto(producto = {}) {
  const numero = clean(producto.numeroRegistro);
  if (!numero) return '';
  return [clean(producto.tipoRegistro), numero].filter(Boolean).join(' ');
}


function habilitacionCompleta(producto = {}) {
  const completa = clean(producto.habilitacionCompleta);
  if (completa) return completa;
  const organismo = clean(producto.habilitacionHabitual);
  const tipo = clean(producto.tipoRegistro);
  const numero = clean(producto.numeroRegistro);
  return [organismo, tipo && tipo.toLowerCase() !== organismo.toLowerCase() ? tipo : '', numero ? `N° ${numero}` : ''].filter(Boolean).join(' ');
}

function productoSeleccionado(datos = {}) {
  const producto = datos.producto && typeof datos.producto === 'object' ? datos.producto : {};
  const tipoRegistro = valueAt(producto.tipoRegistro, datos.tipoRegistro);
  const resolucionSenasa = valueAt(producto.resolucionSenasa, datos.resolucionSenasa, datos.registroResolucion);
  const numeroRegistro = valueAt(producto.numeroRegistro, datos.numeroRegistro, datos.resolucionNumero, numeroRegistroDesdeResolucion(resolucionSenasa, tipoRegistro));
  return {
    nombre: valueAt(producto.nombre, datos.productoNombre, datos.nombre),
    principioActivo: valueAt(producto.principioActivo, datos.principioActivo),
    concentracion: valueAt(producto.concentracion, datos.concentracion),
    habilitacionHabitual: valueAt(producto.habilitacionHabitual, datos.habilitacionHabitual, producto.organismoHabilitante, datos.organismoHabilitante, producto.organismoRegulador, datos.organismoRegulador),
    habilitacionCompleta: valueAt(producto.habilitacionCompleta, datos.habilitacionCompleta),
    tipoRegistro,
    numeroRegistro,
    disposicionRegistro: valueAt(producto.disposicionRegistro, datos.disposicionRegistro),
    fechaResolucionSenasa: valueAt(producto.fechaResolucionSenasa, datos.fechaResolucionSenasa),
    fechaVencimientoRegistro: valueAt(producto.fechaVencimientoRegistro, datos.fechaVencimientoRegistro),
    empresaTitularRegistro: valueAt(producto.empresaTitularRegistro, datos.empresaTitularRegistro)
  };
}

function splitLines(doc, text, width) {
  return doc.heightOfString(displayValue(text), { width, lineGap: 1 });
}

function renderTable(doc, titleText, columns, rows) {
  sectionTitle(doc, titleText);
  const safeRows = rows.length ? rows : [{}];
  const tableWidth = contentWidth(doc);
  const x = doc.page.margins.left;
  const widths = columns.map((col) => Math.round(tableWidth * col.ratio));
  widths[widths.length - 1] += tableWidth - widths.reduce((sum, width) => sum + width, 0);

  function drawHeader() {
    ensureSpace(doc, 26);
    const y = doc.y;
    doc.roundedRect(x, y, tableWidth, 16, 2).fillAndStroke(COLORS.header, COLORS.line);
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(6.5);
    let cursorX = x;
    columns.forEach((col, index) => {
      doc.text(col.label, cursorX + 4, y + 4, { width: widths[index] - 8, height: 10 });
      cursorX += widths[index];
      if (index < columns.length - 1) doc.moveTo(cursorX, y + 3).lineTo(cursorX, y + 13).strokeColor(COLORS.line).lineWidth(0.45).stroke();
    });
    doc.y = y + 16;
    resetStroke(doc);
  }

  drawHeader();
  safeRows.forEach((row, rowIndex) => {
    const values = columns.map((col) => displayValue(row[col.key]));
    const heights = values.map((value, index) => splitLines(doc, value, widths[index] - 10));
    const rowHeight = Math.max(17, ...heights.map((height) => height + 7));
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    doc.rect(x, y, tableWidth, rowHeight).fillAndStroke(rowIndex % 2 ? '#ffffff' : COLORS.panel, COLORS.line);
    doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.ink);
    let cursorX = x;
    values.forEach((value, index) => {
      doc.text(value, cursorX + 4, y + 3, { width: widths[index] - 8, lineGap: 0 });
      cursorX += widths[index];
      if (index < columns.length - 1) doc.moveTo(cursorX, y).lineTo(cursorX, y + rowHeight).strokeColor(COLORS.softLine).lineWidth(0.5).stroke();
    });
    doc.y = y + rowHeight;
    resetStroke(doc);
  });
  doc.moveDown(0.12);
}

const PRODUCTOS_A_APLICAR_COLUMNS = [
  { key: 'productoComercial', label: 'Producto', ratio: 0.15 },
  { key: 'principioActivo', label: 'Principio activo', ratio: 0.15 },
  { key: 'concentracion', label: 'Concentración', ratio: 0.11 },
  { key: 'habilitacionRegistro', label: 'Habilitación / Registro', ratio: 0.18 },
  { key: 'areaSector', label: 'Área / sector', ratio: 0.16 },
  { key: 'frecuencia', label: 'Frecuencia', ratio: 0.12 },
  { key: 'metodo', label: 'Método', ratio: 0.13 }
];

function productoAAplicarRow(datos = {}) {
  const producto = productoSeleccionado(datos);
  if (!clean(producto.nombre) && !clean(producto.principioActivo) && !clean(producto.numeroRegistro)) return null;
  return {
    productoComercial: producto.nombre,
    principioActivo: producto.principioActivo,
    concentracion: producto.concentracion,
    habilitacionRegistro: habilitacionCompleta(producto) || registroCompleto(producto),
    areaSector: valueAt(datos.areaSector, datos.area, datos.sector),
    frecuencia: datos.frecuencia,
    metodo: valueAt(datos.metodo, datos.metodologia)
  };
}

function productosAAplicarAviso(datos = {}) {
  const vistos = new Set();
  const fuentes = Array.isArray(datos.productosPrevistos) && datos.productosPrevistos.length
    ? datos.productosPrevistos
    : ['roedores', 'insectosExternos', 'insectosInternos', 'otrasPlagas'].map((key) => datos[key]);
  return fuentes
    .map((item) => productoAAplicarRow(item))
    .filter(Boolean)
    .filter((row) => {
      const firma = [row.productoComercial, row.principioActivo, row.concentracion, row.habilitacionRegistro, row.areaSector, row.frecuencia, row.metodo].join('|');
      if (vistos.has(firma)) return false;
      vistos.add(firma);
      return true;
    });
}

function productosUtilizadosInforme(datos = {}) {
  const row = productoAAplicarRow(datos.ejecucion);
  return row ? [row] : [];
}

function renderProductosAAplicar(doc, rows, titleText = 'Productos a aplicar') {
  renderTable(doc, titleText, PRODUCTOS_A_APLICAR_COLUMNS, rows);
}

function headerMetaRows(documento, datos) {
  return [
    ['Circular Nº', valueAt(documento.numeroCircular, datos.numeroCircular)],
    ['Fecha recepción', formatDate(valueAt(documento.fechaRecepcion, datos.fechaRecepcion))]
  ];
}

function header(documento, datos, doc) {
  const cliente = datos.cliente || {};
  const establecimiento = datos.establecimiento || {};
  const dbCliente = documento.cliente || {};
  const cfg = dbCliente.senasaConfiguracion || {};
  sectionTitle(doc, 'Datos del establecimiento');
  fichaGrid(doc, [
    ['Establecimiento Nº Oficial', valueAt(establecimiento.establecimientoOficial, cfg.establecimientoOficial)],
    ['Razón social', valueAt(cliente.nombre, dbCliente.nombre)],
    ['Domicilio', valueAt(cliente.domicilio, cliente.direccion, dbCliente.direccion)],
    ['Tel/Fax', valueAt(cliente.telefono, dbCliente.telefono)],
    ['Localidad', valueAt(cliente.localidad, cfg.localidad)],
    ['Dpto/Partido', valueAt(establecimiento.departamentoPartido, cfg.departamentoPartido)],
    ['Provincia', valueAt(cliente.provincia, cfg.provincia)],
    ['Supervisor', valueAt(establecimiento.supervisor, cfg.supervisor)],
    ['Responsable por S.I.V.', valueAt(establecimiento.responsableSiv, cfg.responsableSiv)]
  ], 3, { fontSize: 7.6, gapX: 6, gapY: 3, minHeight: 20 });
}


function dotted(value, fallback = '........................') {
  return displayValue(value, fallback);
}
function avisoPeriodo(seccion = {}, datos = {}) {
  return `${dotted(valueAt(seccion.periodoDesde, datos.periodoDesde))} y el ${dotted(valueAt(seccion.periodoHasta, datos.periodoHasta))}`;
}
function avisoProductoTexto(seccion = {}) {
  const producto = productoSeleccionado(seccion);
  return {
    nombre: dotted(producto.nombre),
    principio: dotted(producto.principioActivo),
    registro: dotted(valueAt(producto.numeroRegistro, seccion.resolucionSenasa)),
    metodologia: dotted(valueAt(seccion.metodologia, seccion.metodo)),
    frecuencia1: dotted(valueAt(seccion.frecuenciaGrupo1, seccion.frecuenciaVerificacion, seccion.frecuenciaHoras, seccion.frecuencia)),
    sectores1: dotted(seccion.sectoresGrupo1),
    frecuencia2: dotted(seccion.frecuenciaGrupo2),
    sectores2: dotted(seccion.sectoresGrupo2)
  };
}
function avisoSectionTitle(doc, text) {
  ensureSpace(doc, 22);
  doc.moveDown(0.35);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000').text(clean(text).toUpperCase(), { align: 'left' });
  doc.moveDown(0.25);
}
function avisoBox(doc, paragraphs = []) {
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  const normalized = paragraphs.filter(Boolean).map((line) => clean(line));
  const heights = normalized.map((line) => doc.font('Helvetica').fontSize(9.2).heightOfString(line, { width: width - 12, align: 'justify', lineGap: 2 }));
  const boxHeight = Math.max(34, heights.reduce((sum, height) => sum + height, 0) + normalized.length * 5 + 8);
  ensureSpace(doc, boxHeight + 10);
  const y = doc.y;
  doc.rect(x, y, width, boxHeight).strokeColor('#000').lineWidth(0.7).stroke();
  let cursorY = y + 6;
  normalized.forEach((line, index) => {
    doc.font('Helvetica').fontSize(9.2).fillColor('#000').text(line, x + 6, cursorY, { width: width - 12, align: 'justify', lineGap: 2 });
    cursorY += heights[index] + 5;
  });
  doc.y = y + boxHeight + 7;
  resetStroke(doc);
}
function avisoFirmas(doc) {
  ensureSpace(doc, 70);
  const y = Math.max(doc.y + 38, doc.page.height - doc.page.margins.bottom - 42);
  const left = doc.page.margins.left + 18;
  const right = doc.page.width - doc.page.margins.right - 178;
  doc.strokeColor('#000').lineWidth(0.7).moveTo(left, y).lineTo(left + 150, y).stroke();
  doc.moveTo(right, y).lineTo(right + 150, y).stroke();
  doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#000').text('Responsable Técnico MIP', left + 10, y + 6, { width: 150, align: 'center' });
  doc.text('Recibido SIV', right + 10, y + 6, { width: 150, align: 'center' });
  doc.y = y + 25;
  resetStroke(doc);
}

function renderAviso(documento, datos, doc) {
  const cliente = datos.cliente || {};
  const establecimiento = datos.establecimiento || {};
  const dbCliente = documento.cliente || {};
  const cfg = dbCliente.senasaConfiguracion || {};
  const r = avisoProductoTexto(datos.roedores || {});
  const ie = avisoProductoTexto(datos.insectosExternos || {});
  const ii = avisoProductoTexto(datos.insectosInternos || {});
  const ov = avisoProductoTexto(datos.otrasPlagas?.voladoras || datos.otrasPlagas || {});
  const oc = avisoProductoTexto(datos.otrasPlagas?.caminadoras || {});

  doc.page.margins.top = 36;
  doc.page.margins.left = 56;
  doc.page.margins.right = 56;
  doc.page.margins.bottom = 40;
  doc.y = doc.page.margins.top;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(12.5).text('PLANILLA DE AVISO', { align: 'center' });
  doc.moveDown(0.35);
  doc.fontSize(12.5).text('PROGRAMA DE ACTIVIDADES MIP', { align: 'center' });
  doc.moveDown(0.25);
  doc.fontSize(9.5).text(`CIRCULAR N.º ${dotted(valueAt(documento.numeroCircular, datos.numeroCircular), '........')}`, { align: 'center' });
  doc.moveDown(1.6);
  doc.font('Helvetica').fontSize(10).text(`FECHA DE RECEPCIÓN: ${dotted(formatDate(valueAt(documento.fechaRecepcion, datos.fechaRecepcion)), '__/__________/20__')}`, { align: 'right' });
  doc.moveDown(1.2);

  avisoSectionTitle(doc, 'ESTABLECIMIENTO');
  avisoBox(doc, [
    `Establecimiento Nº Oficial   ${dotted(valueAt(establecimiento.establecimientoOficial, cfg.establecimientoOficial), '')}                 Razón Social ${dotted(valueAt(cliente.nombre, dbCliente.nombre), '')}`,
    `Domicilio: ${dotted(valueAt(cliente.domicilio, cliente.direccion, dbCliente.direccion), '')}        Tel/Fax: ${dotted(valueAt(cliente.telefono, dbCliente.telefono), '')}`,
    `Localidad: ${dotted(valueAt(cliente.localidad, cfg.localidad), '')}        Dpto/Partido: ${dotted(valueAt(establecimiento.departamentoPartido, cfg.departamentoPartido), '')}        Provincia: ${dotted(valueAt(cliente.provincia, cfg.provincia), '')}`,
    `Supervisor: ${dotted(valueAt(establecimiento.supervisor, cfg.supervisor), '')}        Responsable por el S.I.V. ${dotted(valueAt(establecimiento.responsableSiv, cfg.responsableSiv), '')}`
  ]);

  avisoSectionTitle(doc, 'ROEDORES');
  avisoBox(doc, [
    `En el periodo comprendido del mes de ${dotted(datos.periodoDesde)} , se empleará como cebo rodenticida el producto: ${r.nombre}; cuyo principio activo es: ${r.principio}, aprobado por SENASA por la Resolución Nº ${r.registro}.`,
    `Las actividades de verificación y reposición se efectuarán con una frecuencia de ${r.frecuencia1}, en los sectores identificados en el plano de referencia con las letras ${r.sectores1} en tanto que en los sectores identificados con las letras ${r.sectores2} la frecuencia de verificación y reposición será de ${r.frecuencia2}.`
  ]);

  avisoSectionTitle(doc, 'INSECTOS');
  avisoBox(doc, [
    `SECTORES EXTERNOS: Periodo comprendido entre el ${avisoPeriodo(datos.insectosExternos || {}, datos)}. Se empleará como insecticida para sectores externos el producto ${ie.nombre}. Cuyo principio activo es: ${ie.principio}. Y se encuentra aprobado por SENASA por Resolución Nº ${ie.registro}.`,
    `Las actividades se efectuarán con una frecuencia de ${ie.frecuencia1} horas, en los sectores identificados en el plano de referencia con las letras ${ie.sectores1} en tanto que los sectores identificados con las letras ${ie.sectores2} la frecuencia será de ${ie.frecuencia2} Horas.`,
    `SECTORES INTERNOS: Período comprendido entre el ${avisoPeriodo(datos.insectosInternos || {}, datos)}. En sectores internos se utilizará en la sección identificada en el plano de referencia, usando el producto insecticida para uso interior ${ii.nombre} cuyo principio activo es: ${ii.principio}. Y se encuentra aprobado por SENASA por Resolución Nº ${ii.registro}.`,
    `La actividad se efectuará el día ${dotted(datos.insectosInternos?.diaActividad)} a las ${dotted(datos.insectosInternos?.horaActividad)} horas y se dejará actuar por un lapso de ${dotted(datos.insectosInternos?.lapsoHoras)} horas.`,
    'Para proceder luego al lavado y desinfección de la sección'
  ]);

  avisoSectionTitle(doc, 'OTRAS PLAGAS');
  avisoBox(doc, [
    `SECTORES EXTERNOS ESPECIES VIVAS: Periodo comprendido entre el ${avisoPeriodo(datos.otrasPlagas?.voladoras || {}, datos)}.`,
    `Se empleará para sectores externos la siguiente metodología/sistema de control ${ov.metodologia}. Que se encuentra desarrollado en el MIP.`,
    `Las actividades de control y verificación se efectuarán con una frecuencia de ${ov.frecuencia1}, en los sectores identificados en el plano de referencia con las letras ${ov.sectores1} en tanto que los sectores identificados con las letras ${ov.sectores2} la frecuencia será de ${ov.frecuencia2}.`,
    `SECTORES EXTERNOS ESPECIES CAMINADORAS: Periodo comprendido entre el ${avisoPeriodo(datos.otrasPlagas?.caminadoras || {}, datos)}.`,
    `Se empleará para sectores externos la siguiente metodología/sistema de control ${oc.metodologia}. Que se encuentra desarrollado en el MIP.`,
    `Las actividades de control y verificación se efectuarán con una frecuencia de ${oc.frecuencia1}, en los sectores identificados en el plano de referencia con las letras ${oc.sectores1} en tanto que los sectores identificados con las letras ${oc.sectores2} la frecuencia será de ${oc.frecuencia2}.`
  ]);

  avisoSectionTitle(doc, 'AREAS EXTERNAS Y ESPACIOS VERDES');
  avisoBox(doc, [
    `Periodo comprendido entre el ${avisoPeriodo(datos.areasExternas || {}, datos)}.`,
    'Mantenimiento general de las áreas externas – (Acumulo de Basura, Chatarra, Malezas, etc.)',
    `Las actividades de control y verificación se efectuarán con una frecuencia de ${dotted(valueAt(datos.areasExternas?.frecuenciaGrupo1, datos.areasExternas?.frecuencia))}, en los sectores identificados en el plano de referencia con las ${dotted(valueAt(datos.areasExternas?.sectoresGrupo1, datos.areasExternas?.sectoresMantenidos))}.`,
    `Integridad del cerco perimetral y murete Las actividades de control y verificación se efectuarán con una frecuencia de ${dotted(datos.areasExternas?.frecuenciaGrupo2)}, en los sectores identificados en el plano de referencia con las letras ${dotted(datos.areasExternas?.sectoresGrupo2)}.`
  ]);

  avisoSectionTitle(doc, 'HERMETICIDAD');
  avisoBox(doc, [
    `Periodo comprendido entre el ${avisoPeriodo(datos.hermeticidad || {}, datos)}.`,
    'Las actividades de control y verificación del correcto funcionamiento de cortinas de aire, cierre automático de puertas, extractores de aire, cierres sinfónicos, mosquiteros, burletes y fuelles, electrocutores, etc.',
    `Se efectuarán con una frecuencia de ${dotted(valueAt(datos.hermeticidad?.frecuenciaGrupo1, datos.hermeticidad?.frecuencia))}, en los sectores identificados en el plano de referencia con las ${dotted(valueAt(datos.hermeticidad?.sectoresGrupo1, datos.hermeticidad?.sectoresEvaluados))}.`
  ]);
  avisoSectionTitle(doc, 'FIRMAS');
  avisoFirmas(doc);
}
const ROEDORES_COLUMNS = [
  { key: 'casilla', label: 'Casilla Nº', ratio: 0.11 },
  { key: 'roedoresVivos', label: 'Vivos', ratio: 0.10 },
  { key: 'roedoresMuertos', label: 'Muertos', ratio: 0.10 },
  { key: 'materiaFecal', label: 'Materia fecal', ratio: 0.13 },
  { key: 'consumoCebo', label: 'Consumo cebo', ratio: 0.13 },
  { key: 'observaciones', label: 'Observaciones', ratio: 0.22 },
  { key: 'medidaCorrectiva', label: 'Medida correctiva', ratio: 0.21 }
];

const OTRAS_COLUMNS = [
  { key: 'sector', label: 'Sector Nº', ratio: 0.11 },
  { key: 'voladorasVivas', label: 'Voladoras vivas', ratio: 0.13 },
  { key: 'voladorasMuertas', label: 'Voladoras muertas', ratio: 0.14 },
  { key: 'caminadorasVivas', label: 'Caminadoras vivas', ratio: 0.14 },
  { key: 'caminadorasMuertas', label: 'Caminadoras muertas', ratio: 0.15 },
  { key: 'observaciones', label: 'Observaciones', ratio: 0.17 },
  { key: 'medidaCorrectiva', label: 'Medida correctiva', ratio: 0.16 }
];

const SIMPLE_COLUMNS = [
  { key: 'sector', label: 'Sector', ratio: 0.18 },
  { key: 'tipo', label: 'Elemento / novedad', ratio: 0.28 },
  { key: 'observaciones', label: 'Observaciones', ratio: 0.27 },
  { key: 'medidaCorrectiva', label: 'Medida correctiva', ratio: 0.27 }
];

function normalizedSimpleRows(rows = [], key) {
  return rows.map((row) => ({
    sector: row.sector,
    tipo: key === 'hermeticidad' ? row.elemento : row.tipoNovedad,
    observaciones: row.observaciones,
    medidaCorrectiva: row.medidaCorrectiva
  }));
}

function renderInforme(documento, datos, doc) {
  title(doc, 'INFORME', 'CONTROL DE PLAGAS', headerMetaRows(documento, datos));
  header(documento, datos, doc);
  sectionTitle(doc, 'Ejecución real');
  fichaGrid(doc, [
    ['Aviso MIP vinculado', datos.avisoVinculadoId ? `Aviso MIP #${datos.avisoVinculadoId}` : '—'],
    ['Fecha real', formatDate(valueAt(datos.fechaActividad, documento.periodoDesde))],
    ['Hora real', datos.horaActividad],
    ['Sectores recorridos', datos.ejecucion?.sectoresRecorridos],
    ['Casillas revisadas', datos.ejecucion?.casillasRevisadas],
    ['Trampas revisadas', datos.ejecucion?.trampasRevisadas],
    ['Actividad detectada / hallazgos', datos.ejecucion?.actividadDetectada],
    ['Productos utilizados', datos.ejecucion?.productosUtilizados],
    ['Observaciones', datos.ejecucion?.observaciones],
    ['Medidas correctivas', datos.ejecucion?.medidasCorrectivas]
  ], 2);
  renderProductosAAplicar(doc, productosUtilizadosInforme(datos), 'Productos utilizados');
  renderTable(doc, 'Roedores', ROEDORES_COLUMNS, Array.isArray(datos.roedores?.filas) ? datos.roedores.filas : []);
  renderTable(doc, 'Otras plagas', OTRAS_COLUMNS, Array.isArray(datos.otrasPlagas?.filas) ? datos.otrasPlagas.filas : []);
  renderTable(doc, 'Áreas externas y espacios verdes', SIMPLE_COLUMNS, normalizedSimpleRows(Array.isArray(datos.areasExternas?.filas) ? datos.areasExternas.filas : [], 'areasExternas'));
  renderTable(doc, 'Hermeticidad', SIMPLE_COLUMNS, normalizedSimpleRows(Array.isArray(datos.hermeticidad?.filas) ? datos.hermeticidad.filas : [], 'hermeticidad'));
  sectionTitle(doc, 'Verificación');
  fichaGrid(doc, [
    ['Acompañamiento', [formatDate(datos.verificacion?.fechaAcompanamiento), datos.verificacion?.horaDesde, datos.verificacion?.horaHasta].map(clean).filter(Boolean).join(' · ')],
    ['Responsable control', datos.verificacion?.responsableControl],
    ['Incrementar actividades', datos.verificacion?.incrementarActividades],
    ['Detalle de sectores', datos.verificacion?.detalleSectores],
    ['Observaciones finales', datos.verificacion?.observacionesFinales]
  ], 2);
}

function signatures(doc) {
  ensureSpace(doc, 42);
  doc.moveDown(0.35);
  const y = doc.y + 10;
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const col = width / 3;
  ['Responsable Técnico MIP', 'V°B° Inspección Veterinaria', 'Firma y sello'].forEach((label, index) => {
    const x = left + index * col + 10;
    doc.moveTo(x, y).lineTo(x + col - 20, y).strokeColor(COLORS.muted).lineWidth(0.7).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(label, x, y + 7, { width: col - 20, align: 'center' });
  });
  doc.y = y + 22;
  resetStroke(doc);
}

function renderSenasaPdf(documento, writableStream) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
  doc.pipe(writableStream);
  const datos = documento?.datosJson && typeof documento.datosJson === 'object' && !Array.isArray(documento.datosJson) ? documento.datosJson : {};

  doc.font('Helvetica');
  resetStroke(doc);
  if (documento.tipoDocumento === 'AVISO_MIP') renderAviso(documento, datos, doc);
  else {
    renderInforme(documento, datos, doc);
    signatures(doc);
  }

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted).text(`Página ${i + 1} de ${pages.count}`, PAGE.margin, doc.page.height - doc.page.margins.bottom - 8, { align: 'right', width: doc.page.width - PAGE.margin * 2 });
  }

  doc.end();
}

module.exports = { renderSenasaPdf };

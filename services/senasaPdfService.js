const PDFDocument = require('pdfkit');

const PAGE = {
  margin: 38,
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

function line(value = '—') {
  return displayValue(value);
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
  ensureSpace(doc, 105);
  doc.fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(19)
    .text(main, { align: 'center', characterSpacing: 0.5 });
  doc.moveDown(0.25);
  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(11)
    .text(sub, { align: 'center', characterSpacing: 0.8 });
  doc.moveDown(0.9);

  if (metaRows.length) {
    const gap = 14;
    const width = (contentWidth(doc) - gap) / 2;
    const y = doc.y;
    metaRows.slice(0, 2).forEach(([label, value], index) => {
      const x = doc.page.margins.left + index * (width + gap);
      doc.roundedRect(x, y, width, 36, 6).fillAndStroke(COLORS.panel, COLORS.line);
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.6).text(clean(label).toUpperCase(), x + 12, y + 8, { width: width - 24 });
      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10).text(displayValue(value), x + 12, y + 19, { width: width - 24 });
    });
    doc.y = y + 48;
  }
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 38);
  doc.moveDown(0.35);
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  const y = doc.y;
  doc.roundedRect(x, y, width, 24, 4).fill(COLORS.header);
  doc.fillColor(COLORS.accent)
    .font('Helvetica-Bold')
    .fontSize(9.4)
    .text(clean(text).toUpperCase(), x + 10, y + 7, { width: width - 20, characterSpacing: 0.6 });
  doc.y = y + 31;
  resetStroke(doc);
}

function fichaGrid(doc, rows, columns = 2, options = {}) {
  const visibleRows = rows.map(([label, value]) => [label, displayValue(value)]);
  const gapX = options.gapX || 14;
  const gapY = options.gapY || 8;
  const width = contentWidth(doc);
  const colWidth = (width - gapX * (columns - 1)) / columns;
  const labelHeight = 10;
  const lineGap = 1;
  const rowHeights = [];
  for (let i = 0; i < visibleRows.length; i += columns) {
    const group = visibleRows.slice(i, i + columns);
    const maxValueHeight = Math.max(...group.map(([, value]) => doc.font('Helvetica').fontSize(options.fontSize || 9.2).heightOfString(value, { width: colWidth - 20, lineGap })));
    rowHeights.push(Math.max(42, labelHeight + maxValueHeight + 19));
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
    doc.roundedRect(x, cellY, colWidth, rowHeights[row], 5).fillAndStroke(COLORS.panel, COLORS.softLine);
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.2).text(clean(label).toUpperCase(), x + 10, cellY + 8, { width: colWidth - 20 });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(options.fontSize || 9.2).text(value, x + 10, cellY + 20, { width: colWidth - 20, lineGap });
  });
  doc.y += totalHeight + 4;
  resetStroke(doc);
}

function documentoPendiente(value) {
  return displayValue(value);
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
    tipoRegistro,
    numeroRegistro,
    disposicionRegistro: valueAt(producto.disposicionRegistro, datos.disposicionRegistro),
    fechaResolucionSenasa: valueAt(producto.fechaResolucionSenasa, datos.fechaResolucionSenasa),
    fechaVencimientoRegistro: valueAt(producto.fechaVencimientoRegistro, datos.fechaVencimientoRegistro),
    empresaTitularRegistro: valueAt(producto.empresaTitularRegistro, datos.empresaTitularRegistro)
  };
}

function productoNombre(datos = {}) {
  return valueAt(datos.producto?.nombre, datos.productoNombre, datos.nombre);
}

function productoTecnicoRows(datos = {}) {
  const producto = productoSeleccionado(datos);
  return [
    ['Producto', documentoPendiente(producto.nombre)],
    ['Principio activo', documentoPendiente(producto.principioActivo)],
    ['Concentración', documentoPendiente(producto.concentracion)],
    ['Habilitación', documentoPendiente(producto.habilitacionHabitual)],
    ['Registro', documentoPendiente(registroCompleto(producto))],
    ['Disposición', documentoPendiente(producto.disposicionRegistro)],
    ['Fecha', documentoPendiente(formatDate(producto.fechaResolucionSenasa))],
    ['Vencimiento', documentoPendiente(formatDate(producto.fechaVencimientoRegistro))],
    ['Titular', documentoPendiente(producto.empresaTitularRegistro)]
  ];
}

function productoTecnicoBox(doc, datos = {}) {
  fichaGrid(doc, productoTecnicoRows(datos), 3, { fontSize: 8.8, gapX: 10, gapY: 7 });
}

function paragraph(doc, text) {
  ensureSpace(doc, 45);
  doc.font('Helvetica').fontSize(9.6).fillColor(COLORS.ink).text(displayValue(text), {
    align: 'justify',
    lineGap: 2,
    width: contentWidth(doc)
  });
  doc.moveDown(0.4);
}

function textBlock(doc, label, values) {
  const joined = values.map((item) => clean(item)).filter(Boolean).join(' · ');
  fichaGrid(doc, [[label, joined]], 1, { fontSize: 9.2, gapY: 4 });
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
    doc.roundedRect(x, y, tableWidth, 20, 3).fillAndStroke(COLORS.header, COLORS.line);
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(7.2);
    let cursorX = x;
    columns.forEach((col, index) => {
      doc.text(col.label, cursorX + 5, y + 6, { width: widths[index] - 10, height: 12 });
      cursorX += widths[index];
      if (index < columns.length - 1) doc.moveTo(cursorX, y + 4).lineTo(cursorX, y + 16).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    });
    doc.y = y + 20;
    resetStroke(doc);
  }

  drawHeader();
  safeRows.forEach((row, rowIndex) => {
    const values = columns.map((col) => displayValue(row[col.key]));
    const heights = values.map((value, index) => splitLines(doc, value, widths[index] - 10));
    const rowHeight = Math.max(22, ...heights.map((height) => height + 10));
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    doc.rect(x, y, tableWidth, rowHeight).fillAndStroke(rowIndex % 2 ? '#ffffff' : COLORS.panel, COLORS.line);
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.ink);
    let cursorX = x;
    values.forEach((value, index) => {
      doc.text(value, cursorX + 5, y + 5, { width: widths[index] - 10, lineGap: 1 });
      cursorX += widths[index];
      if (index < columns.length - 1) doc.moveTo(cursorX, y).lineTo(cursorX, y + rowHeight).strokeColor(COLORS.softLine).lineWidth(0.5).stroke();
    });
    doc.y = y + rowHeight;
    resetStroke(doc);
  });
  doc.moveDown(0.35);
}

const PRODUCTOS_APLICADOS_COLUMNS = [
  { key: 'productoComercial', label: 'Producto comercial', ratio: 0.25 },
  { key: 'principioActivo', label: 'Principio activo', ratio: 0.25 },
  { key: 'concentracion', label: 'Concentración', ratio: 0.16 },
  { key: 'habilitacion', label: 'Habilitación', ratio: 0.34 }
];

function productoAplicadoRow(datos = {}) {
  const producto = productoSeleccionado(datos);
  if (!clean(producto.nombre) && !clean(producto.principioActivo) && !clean(producto.numeroRegistro)) return null;
  return {
    productoComercial: producto.nombre,
    principioActivo: producto.principioActivo,
    concentracion: producto.concentracion,
    habilitacion: [producto.habilitacionHabitual, producto.tipoRegistro, producto.numeroRegistro ? `N° ${producto.numeroRegistro}` : ''].map(clean).filter(Boolean).join(' ')
  };
}

function productosAplicadosAviso(datos = {}) {
  const vistos = new Set();
  return ['roedores', 'insectosExternos', 'insectosInternos', 'otrasPlagas']
    .map((key) => productoAplicadoRow(datos[key]))
    .filter(Boolean)
    .filter((row) => {
      const firma = [row.productoComercial, row.principioActivo, row.concentracion, row.habilitacion].join('|');
      if (vistos.has(firma)) return false;
      vistos.add(firma);
      return true;
    });
}

function productosAplicadosInforme(datos = {}) {
  const row = productoAplicadoRow(datos.ejecucion);
  return row ? [row] : [];
}

function renderProductosAplicados(doc, rows) {
  if (!rows.length) return;
  renderTable(doc, 'Productos aplicados', PRODUCTOS_APLICADOS_COLUMNS, rows);
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
  ], 3, { fontSize: 8.9, gapX: 10, gapY: 7 });
}

function renderAviso(documento, datos, doc) {
  title(doc, 'PLANILLA DE AVISO', 'PROGRAMA DE ACTIVIDADES MIP', headerMetaRows(documento, datos));
  header(documento, datos, doc);

  sectionTitle(doc, 'Planificación general');
  fichaGrid(doc, [
    ['Periodo desde', formatDate(valueAt(datos.periodoDesde, documento.periodoDesde))],
    ['Periodo hasta', formatDate(valueAt(datos.periodoHasta, documento.periodoHasta))],
    ['Frecuencia general', datos.planificacion?.frecuenciaGeneral],
    ['Horarios previstos', datos.planificacion?.horariosPrevistos],
    ['Tipo de control', datos.planificacion?.tipoControl],
    ['Metodología', datos.planificacion?.metodologia],
    ['Cronograma', datos.planificacion?.cronograma],
    ['Criterios de control', datos.planificacion?.criteriosControl]
  ], 2);

  renderProductosAplicados(doc, productosAplicadosAviso(datos));

  sectionTitle(doc, 'Roedores');
  const desde = formatDate(valueAt(datos.roedores?.periodoDesde, datos.periodoDesde, documento.periodoDesde));
  const hasta = formatDate(valueAt(datos.roedores?.periodoHasta, datos.periodoHasta, documento.periodoHasta));
  paragraph(doc, `En el periodo comprendido entre ${line(desde)} y ${line(hasta)}, se empleará como cebo rodenticida el producto ${line(productoNombre(datos.roedores))}.`);
  productoTecnicoBox(doc, datos.roedores);
  fichaGrid(doc, [
    ['Frecuencia de verificación / reposición', datos.roedores?.frecuenciaVerificacion],
    ['Sectores grupo 1', [datos.roedores?.sectoresGrupo1, datos.roedores?.frecuenciaGrupo1].map(clean).filter(Boolean).join(' · ')],
    ['Sectores grupo 2', [datos.roedores?.sectoresGrupo2, datos.roedores?.frecuenciaGrupo2].map(clean).filter(Boolean).join(' · ')]
  ], 3, { fontSize: 8.8, gapX: 10, gapY: 7 });

  sectionTitle(doc, 'Insectos');
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9.2).text('Sectores externos');
  doc.moveDown(0.25);
  fichaGrid(doc, [
    ['Periodo', [formatDate(datos.insectosExternos?.periodoDesde || datos.periodoDesde), formatDate(datos.insectosExternos?.periodoHasta || datos.periodoHasta)].map(clean).filter(Boolean).join(' · ')]
  ], 1, { fontSize: 8.9 });
  productoTecnicoBox(doc, datos.insectosExternos);
  fichaGrid(doc, [
    ['Frecuencia y sectores', [datos.insectosExternos?.frecuenciaHoras ? `cada ${datos.insectosExternos.frecuenciaHoras} horas` : '', datos.insectosExternos?.sectoresGrupo1, datos.insectosExternos?.sectoresGrupo2].map(clean).filter(Boolean).join(' · ')]
  ], 1, { fontSize: 8.9 });
  doc.moveDown(0.2).fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9.2).text('Sectores internos');
  doc.moveDown(0.25);
  fichaGrid(doc, [
    ['Periodo', [formatDate(datos.insectosInternos?.periodoDesde || datos.periodoDesde), formatDate(datos.insectosInternos?.periodoHasta || datos.periodoHasta)].map(clean).filter(Boolean).join(' · ')]
  ], 1, { fontSize: 8.9 });
  productoTecnicoBox(doc, datos.insectosInternos);
  fichaGrid(doc, [
    ['Aplicación', [datos.insectosInternos?.colorSeccionPlano, datos.insectosInternos?.dia, datos.insectosInternos?.hora, datos.insectosInternos?.sectores, datos.insectosInternos?.observaciones].map(clean).filter(Boolean).join(' · ')]
  ], 1, { fontSize: 8.9 });

  sectionTitle(doc, 'Otras plagas');
  fichaGrid(doc, [
    ['Especies / sectores', [datos.otrasPlagas?.especiesVoladoras, datos.otrasPlagas?.especiesCaminadoras, datos.otrasPlagas?.sectores].map(clean).filter(Boolean).join(' · ')]
  ], 1, { fontSize: 8.9 });
  productoTecnicoBox(doc, datos.otrasPlagas);
  textBlock(doc, 'Frecuencia', [datos.otrasPlagas?.frecuencia]);

  sectionTitle(doc, 'Áreas externas y espacios verdes');
  fichaGrid(doc, [
    ['Sectores', datos.areasExternas?.sectores],
    ['Actividades / observaciones', [datos.areasExternas?.actividades, datos.areasExternas?.observaciones].map(clean).filter(Boolean).join(' · ')]
  ], 2, { fontSize: 8.9 });

  sectionTitle(doc, 'Hermeticidad');
  fichaGrid(doc, [
    ['Sectores', datos.hermeticidad?.sectores],
    ['Elementos / observaciones', [datos.hermeticidad?.elementos, datos.hermeticidad?.observaciones].map(clean).filter(Boolean).join(' · ')]
  ], 2, { fontSize: 8.9 });
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
  renderProductosAplicados(doc, productosAplicadosInforme(datos));
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
  ensureSpace(doc, 72);
  doc.moveDown(1.2);
  const y = doc.y + 18;
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const col = width / 3;
  ['Responsable Técnico MIP', 'V°B° Inspección Veterinaria', 'Firma y sello'].forEach((label, index) => {
    const x = left + index * col + 10;
    doc.moveTo(x, y).lineTo(x + col - 20, y).strokeColor(COLORS.muted).lineWidth(0.7).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(label, x, y + 7, { width: col - 20, align: 'center' });
  });
  doc.y = y + 30;
  resetStroke(doc);
}

function renderSenasaPdf(documento, writableStream) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
  doc.pipe(writableStream);
  const datos = documento?.datosJson && typeof documento.datosJson === 'object' && !Array.isArray(documento.datosJson) ? documento.datosJson : {};

  doc.font('Helvetica');
  resetStroke(doc);
  if (documento.tipoDocumento === 'AVISO_MIP') renderAviso(documento, datos, doc);
  else renderInforme(documento, datos, doc);
  signatures(doc);

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7.3).fillColor(COLORS.muted).text(`Página ${i + 1} de ${pages.count}`, PAGE.margin, doc.page.height - 28, { align: 'right', width: doc.page.width - PAGE.margin * 2 });
  }

  doc.end();
}

module.exports = { renderSenasaPdf };

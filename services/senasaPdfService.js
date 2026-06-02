const PDFDocument = require('pdfkit');

const PAGE = {
  margin: 42,
  width: 595.28,
  height: 841.89
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

function line(value = '................................') {
  return clean(value, '................................');
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

function horizontalRule(doc) {
  const y = doc.y;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#777').lineWidth(0.5).stroke();
  doc.strokeColor('black').lineWidth(1);
}

function title(doc, main, sub) {
  doc.font('Helvetica-Bold').fontSize(16).text(main, { align: 'center' });
  doc.moveDown(0.2).fontSize(13).text(sub, { align: 'center' });
  doc.moveDown(0.4);
  horizontalRule(doc);
  doc.moveDown(0.6);
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 35);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('black').text(clean(text).toUpperCase());
  doc.moveDown(0.2);
  horizontalRule(doc);
  doc.moveDown(0.35);
}

function labelValue(doc, label, value, options = {}) {
  const width = options.width || 510;
  ensureSpace(doc, 18);
  doc.font('Helvetica-Bold').fontSize(9.5).text(`${label}: `, { continued: true, width });
  doc.font('Helvetica').text(line(value), { width });
}

function boxedRows(doc, rows) {
  ensureSpace(doc, 20 + rows.length * 18);
  const startY = doc.y;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  rows.forEach((row) => labelValue(doc, row[0], row[1], { width: width - 16 }));
  const height = doc.y - startY + 8;
  doc.rect(x, startY - 5, width, height).strokeColor('#777').lineWidth(0.6).stroke();
  doc.strokeColor('black').lineWidth(1);
  doc.moveDown(0.3);
}

function documentoPendiente(value) {
  return clean(value, '—');
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
    ['Tipo de registro', documentoPendiente(producto.tipoRegistro)],
    ['Registro / Resolución', documentoPendiente(registroCompleto(producto))],
    ['Disposición', documentoPendiente(producto.disposicionRegistro)],
    ['Fecha', documentoPendiente(formatDate(producto.fechaResolucionSenasa))],
    ['Vencimiento', documentoPendiente(formatDate(producto.fechaVencimientoRegistro))],
    ['Titular', documentoPendiente(producto.empresaTitularRegistro)]
  ];
}

function productoTecnicoBox(doc, datos = {}) {
  boxedRows(doc, productoTecnicoRows(datos));
}

function paragraph(doc, text) {
  ensureSpace(doc, 45);
  doc.font('Helvetica').fontSize(10).text(clean(text), {
    align: 'justify',
    lineGap: 2,
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
  });
}

function textBlock(doc, label, values) {
  const joined = values.map((item) => clean(item)).filter(Boolean).join(' · ');
  labelValue(doc, label, joined || '');
}

function splitLines(doc, text, width) {
  return doc.heightOfString(clean(text), { width, lineGap: 1 });
}

function renderTable(doc, titleText, columns, rows) {
  sectionTitle(doc, titleText);
  const safeRows = rows.length ? rows : [{}];
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;
  const widths = columns.map((col) => Math.round(tableWidth * col.ratio));
  widths[widths.length - 1] += tableWidth - widths.reduce((sum, width) => sum + width, 0);

  function drawHeader() {
    ensureSpace(doc, 30);
    const y = doc.y;
    doc.rect(x, y, tableWidth, 22).fillAndStroke('#eeeeee', '#777');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(7.5);
    let cursorX = x;
    columns.forEach((col, index) => {
      doc.text(col.label, cursorX + 3, y + 5, { width: widths[index] - 6, height: 14 });
      cursorX += widths[index];
      if (index < columns.length - 1) doc.moveTo(cursorX, y).lineTo(cursorX, y + 22).strokeColor('#777').stroke();
    });
    doc.y = y + 22;
  }

  drawHeader();
  safeRows.forEach((row) => {
    const values = columns.map((col) => line(row[col.key]));
    const heights = values.map((value, index) => splitLines(doc, value, widths[index] - 6));
    const rowHeight = Math.max(24, ...heights.map((height) => height + 10));
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    doc.rect(x, y, tableWidth, rowHeight).strokeColor('#777').lineWidth(0.5).stroke();
    doc.strokeColor('black').lineWidth(1);
    doc.font('Helvetica').fontSize(7.8).fillColor('black');
    let cursorX = x;
    values.forEach((value, index) => {
      doc.text(value, cursorX + 3, y + 5, { width: widths[index] - 6, lineGap: 1 });
      cursorX += widths[index];
      if (index < columns.length - 1) doc.moveTo(cursorX, y).lineTo(cursorX, y + rowHeight).strokeColor('#777').stroke();
    });
    doc.y = y + rowHeight;
  });
  doc.moveDown(0.5);
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

function header(documento, datos, doc) {
  const cliente = datos.cliente || {};
  const establecimiento = datos.establecimiento || {};
  const dbCliente = documento.cliente || {};
  const cfg = dbCliente.senasaConfiguracion || {};
  boxedRows(doc, [
    ['Circular Nº', valueAt(documento.numeroCircular, datos.numeroCircular)],
    ['Fecha de recepción', formatDate(valueAt(documento.fechaRecepcion, datos.fechaRecepcion))],
    ['Establecimiento Nº Oficial', valueAt(establecimiento.establecimientoOficial, cfg.establecimientoOficial)],
    ['Razón social', valueAt(cliente.nombre, dbCliente.nombre)],
    ['Domicilio', valueAt(cliente.domicilio, cliente.direccion, dbCliente.direccion)],
    ['Tel/Fax', valueAt(cliente.telefono, dbCliente.telefono)],
    ['Localidad', valueAt(cliente.localidad, cfg.localidad)],
    ['Dpto/Partido', valueAt(establecimiento.departamentoPartido, cfg.departamentoPartido)],
    ['Provincia', valueAt(cliente.provincia, cfg.provincia)],
    ['Supervisor', valueAt(establecimiento.supervisor, cfg.supervisor)],
    ['Responsable por S.I.V.', valueAt(establecimiento.responsableSiv, cfg.responsableSiv)]
  ]);
}

function renderAviso(documento, datos, doc) {
  title(doc, 'PLANILLA DE AVISO', 'PROGRAMA DE ACTIVIDADES MIP');
  header(documento, datos, doc);

  sectionTitle(doc, 'Planificación general');
  boxedRows(doc, [
    ['Periodo desde', formatDate(valueAt(datos.periodoDesde, documento.periodoDesde))],
    ['Periodo hasta', formatDate(valueAt(datos.periodoHasta, documento.periodoHasta))],
    ['Frecuencia general', datos.planificacion?.frecuenciaGeneral],
    ['Horarios previstos', datos.planificacion?.horariosPrevistos],
    ['Tipo de control', datos.planificacion?.tipoControl],
    ['Metodología', datos.planificacion?.metodologia],
    ['Cronograma', datos.planificacion?.cronograma],
    ['Criterios de control', datos.planificacion?.criteriosControl]
  ]);

  renderProductosAplicados(doc, productosAplicadosAviso(datos));

  sectionTitle(doc, 'Roedores');
  const desde = formatDate(valueAt(datos.roedores?.periodoDesde, datos.periodoDesde, documento.periodoDesde));
  const hasta = formatDate(valueAt(datos.roedores?.periodoHasta, datos.periodoHasta, documento.periodoHasta));
  paragraph(doc, `En el periodo comprendido entre ${line(desde)} y ${line(hasta)}, se empleará como cebo rodenticida el producto ${line(productoNombre(datos.roedores))}.`);
  productoTecnicoBox(doc, datos.roedores);
  textBlock(doc, 'Frecuencia de verificación / reposición', [datos.roedores?.frecuenciaVerificacion]);
  textBlock(doc, 'Sectores grupo 1', [datos.roedores?.sectoresGrupo1, datos.roedores?.frecuenciaGrupo1]);
  textBlock(doc, 'Sectores grupo 2', [datos.roedores?.sectoresGrupo2, datos.roedores?.frecuenciaGrupo2]);

  sectionTitle(doc, 'Insectos');
  doc.font('Helvetica-Bold').fontSize(9.5).text('Sectores externos');
  textBlock(doc, 'Periodo', [formatDate(datos.insectosExternos?.periodoDesde || datos.periodoDesde), formatDate(datos.insectosExternos?.periodoHasta || datos.periodoHasta)]);
  productoTecnicoBox(doc, datos.insectosExternos);
  textBlock(doc, 'Frecuencia y sectores', [datos.insectosExternos?.frecuenciaHoras ? `cada ${datos.insectosExternos.frecuenciaHoras} horas` : '', datos.insectosExternos?.sectoresGrupo1, datos.insectosExternos?.sectoresGrupo2]);
  doc.moveDown(0.3).font('Helvetica-Bold').fontSize(9.5).text('Sectores internos');
  textBlock(doc, 'Periodo', [formatDate(datos.insectosInternos?.periodoDesde || datos.periodoDesde), formatDate(datos.insectosInternos?.periodoHasta || datos.periodoHasta)]);
  productoTecnicoBox(doc, datos.insectosInternos);
  textBlock(doc, 'Aplicación', [datos.insectosInternos?.colorSeccionPlano, datos.insectosInternos?.dia, datos.insectosInternos?.hora, datos.insectosInternos?.sectores, datos.insectosInternos?.observaciones]);

  sectionTitle(doc, 'Otras plagas');
  textBlock(doc, 'Especies / sectores', [datos.otrasPlagas?.especiesVoladoras, datos.otrasPlagas?.especiesCaminadoras, datos.otrasPlagas?.sectores]);
  productoTecnicoBox(doc, datos.otrasPlagas);
  textBlock(doc, 'Frecuencia', [datos.otrasPlagas?.frecuencia]);

  sectionTitle(doc, 'Áreas externas y espacios verdes');
  textBlock(doc, 'Sectores', [datos.areasExternas?.sectores]);
  textBlock(doc, 'Actividades / observaciones', [datos.areasExternas?.actividades, datos.areasExternas?.observaciones]);

  sectionTitle(doc, 'Hermeticidad');
  textBlock(doc, 'Sectores', [datos.hermeticidad?.sectores]);
  textBlock(doc, 'Elementos / observaciones', [datos.hermeticidad?.elementos, datos.hermeticidad?.observaciones]);
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
  title(doc, 'INFORME', 'CONTROL DE PLAGAS');
  header(documento, datos, doc);
  sectionTitle(doc, 'Ejecución real');
  boxedRows(doc, [
    ['Aviso MIP vinculado', datos.avisoVinculadoId ? `Aviso MIP #${datos.avisoVinculadoId}` : 'Sin vincular'],
    ['Fecha real', formatDate(valueAt(datos.fechaActividad, documento.periodoDesde))],
    ['Hora real', datos.horaActividad],
    ['Sectores recorridos', datos.ejecucion?.sectoresRecorridos],
    ['Casillas revisadas', datos.ejecucion?.casillasRevisadas],
    ['Trampas revisadas', datos.ejecucion?.trampasRevisadas],
    ['Actividad detectada / hallazgos', datos.ejecucion?.actividadDetectada],
    ['Productos utilizados', datos.ejecucion?.productosUtilizados],
    ['Observaciones', datos.ejecucion?.observaciones],
    ['Medidas correctivas', datos.ejecucion?.medidasCorrectivas]
  ]);
  renderProductosAplicados(doc, productosAplicadosInforme(datos));
  renderTable(doc, 'Roedores', ROEDORES_COLUMNS, Array.isArray(datos.roedores?.filas) ? datos.roedores.filas : []);
  renderTable(doc, 'Otras plagas', OTRAS_COLUMNS, Array.isArray(datos.otrasPlagas?.filas) ? datos.otrasPlagas.filas : []);
  renderTable(doc, 'Áreas externas y espacios verdes', SIMPLE_COLUMNS, normalizedSimpleRows(Array.isArray(datos.areasExternas?.filas) ? datos.areasExternas.filas : [], 'areasExternas'));
  renderTable(doc, 'Hermeticidad', SIMPLE_COLUMNS, normalizedSimpleRows(Array.isArray(datos.hermeticidad?.filas) ? datos.hermeticidad.filas : [], 'hermeticidad'));
  sectionTitle(doc, 'Verificación');
  boxedRows(doc, [
    ['Acompañamiento', [formatDate(datos.verificacion?.fechaAcompanamiento), datos.verificacion?.horaDesde, datos.verificacion?.horaHasta].map(clean).filter(Boolean).join(' · ')],
    ['Responsable control', datos.verificacion?.responsableControl],
    ['Incrementar actividades', datos.verificacion?.incrementarActividades],
    ['Detalle de sectores', datos.verificacion?.detalleSectores],
    ['Observaciones finales', datos.verificacion?.observacionesFinales]
  ]);
}

function signatures(doc) {
  ensureSpace(doc, 80);
  doc.moveDown(2);
  const y = doc.y + 20;
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const col = width / 3;
  ['Responsable Técnico MIP', 'Recibido S.I.V.', 'Firma y sello'].forEach((label, index) => {
    const x = left + index * col + 12;
    doc.moveTo(x, y).lineTo(x + col - 24, y).strokeColor('#555').stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor('black').text(label, x, y + 6, { width: col - 24, align: 'center' });
  });
  doc.y = y + 30;
}

function renderSenasaPdf(documento, writableStream) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
  doc.pipe(writableStream);
  const datos = documento?.datosJson && typeof documento.datosJson === 'object' && !Array.isArray(documento.datosJson) ? documento.datosJson : {};

  doc.font('Helvetica');
  if (documento.tipoDocumento === 'AVISO_MIP') renderAviso(documento, datos, doc);
  else renderInforme(documento, datos, doc);
  signatures(doc);

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7.5).fillColor('#555').text(`Página ${i + 1} de ${pages.count}`, PAGE.margin, doc.page.height - 30, { align: 'right', width: doc.page.width - PAGE.margin * 2 });
  }

  doc.end();
}

module.exports = { renderSenasaPdf };

const CATEGORIA_AGROQUIMICOS_SENASA = 'AGROQUÍMICOS SENASA';

const PRODUCTOS_SENASA_MIP = [
  { nombreComercial: 'Storm', principioActivo: 'Flocoumafen', concentracion: '0,005%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250019' },
  { nombreComercial: 'Fendona 6 SC', principioActivo: 'Alfacipermetrina', concentracion: '6%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250058' },
  {
    nombreComercial: 'Sipertrin',
    principioActivo: 'Beta-cipermetrina',
    concentracion: '0,5%',
    organismoHabilitante: 'ANMAT',
    tipoRegistro: 'RNPUD',
    numeroRegistro: '0250075',
    disposicionRegistro: 'DI-2021-5216-APN-ANMAT#MS',
    fechaVencimientoRegistro: '2026-06-23',
    empresaTitularRegistro: 'Chemotecnica S.A. - RNE N° 020033120'
  },
  {
    nombreComercial: 'K-Othrina',
    principioActivo: 'Deltametrina',
    concentracion: '2,5%',
    organismoHabilitante: 'ANMAT',
    tipoRegistro: 'RNPUD',
    numeroRegistro: '0250079',
    disposicionRegistro: 'DI-2022-7452-APN-ANMAT#MS',
    fechaVencimientoRegistro: '2026-10-03',
    empresaTitularRegistro: 'Bayer S.A. - RNE N° 020032212'
  },
  {
    nombreComercial: 'K-Othrine',
    principioActivo: 'Deltametrina',
    concentracion: '2,5%',
    organismoHabilitante: 'ANMAT',
    tipoRegistro: 'RNPUD',
    numeroRegistro: '0250079',
    disposicionRegistro: 'DI-2022-7452-APN-ANMAT#MS',
    fechaVencimientoRegistro: '2026-10-03',
    empresaTitularRegistro: 'Bayer S.A. - RNE N° 020032212'
  },
  { nombreComercial: 'Aqua K-Othrine', principioActivo: 'Deltametrina', concentracion: '2%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250052' },
  { nombreComercial: 'Solfac EW 50', principioActivo: 'Cyfluthrin', concentracion: '5%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250005' },
  { nombreComercial: 'Blattanex Gel', principioActivo: 'Fipronil', concentracion: '0,05%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250034' },
  { nombreComercial: 'Maxforce Gel', principioActivo: 'Imidacloprid', concentracion: '2,15%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250044' },
  { nombreComercial: 'Klerat', principioActivo: 'Brodifacoum', concentracion: '0,005%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250012' },
  { nombreComercial: 'Rodilon Bloque', principioActivo: 'Difethialone', concentracion: '0,0025%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250071' },
  { nombreComercial: 'Mirex-S', principioActivo: 'Sulfluramida', concentracion: '0,3%', organismoHabilitante: 'SENASA', tipoRegistro: 'SENASA', numeroRegistro: '36.184' }
].map((producto) => ({
  ...producto,
  habilitacionCompleta: producto.habilitacionCompleta || habilitacionCompletaProducto(producto),
  disposicionRegistro: producto.disposicionRegistro || '',
  fechaResolucionSenasa: producto.fechaResolucionSenasa || null,
  fechaVencimientoRegistro: producto.fechaVencimientoRegistro || null,
  empresaTitularRegistro: producto.empresaTitularRegistro || '',
  observacionesRegulatorias: producto.observacionesRegulatorias || '',
  usoPrincipal: producto.usoPrincipal || 'MIP'
}));

const PRODUCTO_SENASA_WHERE = { aptoSenasaMip: true };


function habilitacionCompletaProducto({ organismoHabilitante = '', tipoRegistro = '', numeroRegistro = '' } = {}) {
  const organismo = String(organismoHabilitante || '').trim();
  const tipo = String(tipoRegistro || '').trim();
  const numero = String(numeroRegistro || '').trim();
  const partes = [organismo];
  if (tipo && tipo.toLowerCase() !== organismo.toLowerCase()) partes.push(tipo);
  if (numero) partes.push(`N° ${numero}`);
  return partes.filter(Boolean).join(' ');
}

function normalizarNombreSenasa(nombre = '') {
  return String(nombre).trim().toLocaleLowerCase('es-AR');
}

function normalizarProductoMipPayload(payload = {}) {
  return {
    nombreComercial: String(payload.nombreComercial ?? payload.nombre ?? '').trim(),
    principioActivo: String(payload.principioActivo || '').trim(),
    concentracion: String(payload.concentracion || '').trim(),
    organismoHabilitante: String(payload.organismoHabilitante ?? payload.organismoRegulador ?? payload.habilitacionHabitual ?? '').trim(),
    tipoRegistro: String(payload.tipoRegistro || '').trim(),
    numeroRegistro: String(payload.numeroRegistro ?? payload.resolucionSenasa ?? '').trim(),
    habilitacionCompleta: String(payload.habilitacionCompleta || '').trim(),
    disposicionRegistro: String(payload.disposicionRegistro ?? '').trim(),
    fechaResolucionSenasa: payload.fechaResolucionSenasa || null,
    fechaVencimientoRegistro: payload.fechaVencimientoRegistro || null,
    empresaTitularRegistro: String(payload.empresaTitularRegistro ?? '').trim(),
    observacionesRegulatorias: String(payload.observacionesRegulatorias ?? '').trim(),
    usoPrincipal: String(payload.usoPrincipal || 'MIP').trim() || 'MIP'
  };
}

function validarProductoMipPayload(data = {}) {
  data.habilitacionCompleta = data.habilitacionCompleta || habilitacionCompletaProducto(data);
  const faltantes = ['nombreComercial', 'principioActivo', 'concentracion', 'organismoHabilitante', 'tipoRegistro', 'numeroRegistro', 'habilitacionCompleta']
    .filter((campo) => !String(data[campo] || '').trim());
  return faltantes.length ? `Faltan campos obligatorios: ${faltantes.join(', ')}` : null;
}

async function upsertProductosSenasaMip(prisma) {
  const existentes = await prisma.productoMip.findMany({ select: { id: true, nombreComercial: true } });
  const existentesPorNombre = new Map(existentes.map((producto) => [normalizarNombreSenasa(producto.nombreComercial), producto]));
  let creados = 0;
  let actualizados = 0;

  for (const producto of PRODUCTOS_SENASA_MIP) {
    const existente = existentesPorNombre.get(normalizarNombreSenasa(producto.nombreComercial));
    await prisma.productoMip.upsert({
      where: { id: existente?.id || -1 },
      update: producto,
      create: { ...producto, activo: true }
    });
    if (existente) actualizados += 1;
    else creados += 1;
  }

  return { categoria: CATEGORIA_AGROQUIMICOS_SENASA, creados, actualizados, total: PRODUCTOS_SENASA_MIP.length };
}

async function bootstrapProductosSenasaMipSiVacio(prisma) {
  const existentesAptos = await prisma.productoMip.count();
  if (existentesAptos > 0) return { ejecutado: false, existentesAptos };
  const resultado = await upsertProductosSenasaMip(prisma);
  return { ejecutado: true, existentesAptos, ...resultado };
}

function mapearProductoSenasaApi(producto = {}) {
  const nombreComercial = producto.nombreComercial || producto.nombre || '';
  const organismoHabilitante = producto.organismoHabilitante || producto.organismoRegulador || producto.habilitacionHabitual || '';
  const tipoRegistro = producto.tipoRegistro || '';
  const numeroRegistro = producto.numeroRegistro || producto.resolucionSenasa || '';
  const resolucionSenasa = tipoRegistro && numeroRegistro ? `${tipoRegistro} ${numeroRegistro}` : numeroRegistro;
  return {
    ...producto,
    nombreComercial,
    nombre: nombreComercial,
    principioActivo: producto.principioActivo || '',
    concentracion: producto.concentracion || '',
    organismoHabilitante,
    organismoRegulador: organismoHabilitante,
    habilitacionHabitual: organismoHabilitante,
    tipoRegistro,
    numeroRegistro,
    resolucionSenasa,
    disposicionRegistro: producto.disposicionRegistro || '',
    fechaResolucionSenasa: producto.fechaResolucionSenasa || null,
    fechaVencimientoRegistro: producto.fechaVencimientoRegistro || null,
    empresaTitularRegistro: producto.empresaTitularRegistro || '',
    observacionesRegulatorias: producto.observacionesRegulatorias || '',
    habilitacionCompleta: producto.habilitacionCompleta || habilitacionCompletaProducto({ organismoHabilitante, tipoRegistro, numeroRegistro }),
    usoPrincipal: producto.usoPrincipal || 'MIP',
    aptoSenasaMip: true,
    categoria: CATEGORIA_AGROQUIMICOS_SENASA,
    activo: producto.activo !== false
  };
}

module.exports = {
  CATEGORIA_AGROQUIMICOS_SENASA,
  PRODUCTOS_SENASA_MIP,
  PRODUCTO_SENASA_WHERE,
  bootstrapProductosSenasaMipSiVacio,
  mapearProductoSenasaApi,
  normalizarProductoMipPayload,
  upsertProductosSenasaMip,
  validarProductoMipPayload
};

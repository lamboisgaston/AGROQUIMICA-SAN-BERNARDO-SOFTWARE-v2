const CATEGORIA_AGROQUIMICOS_SENASA = 'AGROQUÍMICOS SENASA';

function fechaRegistroOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const texto = String(value).trim();
  if (!texto) return null;
  const normalizado = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto;
  const fecha = new Date(normalizado);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const PRODUCTOS_SENASA_MIP = [
  { nombreComercial: 'Storm', principioActivo: 'Flocoumafen', concentracion: '0,005%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250019' },
  { nombreComercial: 'Fendona 6 SC', principioActivo: 'Alfacipermetrina', concentracion: '6%', organismoHabilitante: 'ANMAT', tipoRegistro: 'RNPUD', numeroRegistro: '0250058' },
  {
    nombreComercial: 'Sipertrin',
    marca: 'Sipertrin',
    denominacion: 'Insecticida vinchuquicida',
    principioActivo: 'Beta-cipermetrina',
    concentracion: '0.5%',
    organismoHabilitante: 'ANMAT',
    organismoRegulador: 'ANMAT',
    tipoRegistro: 'RNPUD',
    numeroRegistro: '0250075',
    disposicionRegistro: 'DI-2021-5216-APN-ANMAT#MS',
    fechaVencimientoRegistro: '2026-06-23',
    empresaTitularRegistro: 'Chemotecnica S.A. - RNE N° 020033120',
    habilitacionHabitual: 'ANMAT'
  },
  {
    nombreComercial: 'K-Othrine Floable 2.5',
    marca: 'K-Othrine Floable 2.5',
    denominacion: 'Insecticida vinchuquicida',
    aliases: ['K-Othrina', 'K-Othrine'],
    principioActivo: 'Deltametrina',
    concentracion: '2.5%',
    organismoHabilitante: 'ANMAT',
    tipoRegistro: 'RNPUD',
    numeroRegistro: '0250079',
    disposicionRegistro: 'DI-2022-7452-APN-ANMAT#MS',
    fechaVencimientoRegistro: '2026-10-03',
    empresaTitularRegistro: 'Bayer S.A. - RNE N° 020032212',
    habilitacionHabitual: 'ANMAT'
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
  organismoHabilitante: producto.organismoHabilitante || producto.organismoRegulador || producto.habilitacionHabitual || '',
  organismoRegulador: producto.organismoRegulador || producto.organismoHabilitante || producto.habilitacionHabitual || '',
  habilitacionHabitual: producto.habilitacionHabitual || producto.organismoHabilitante || producto.organismoRegulador || '',
  marca: producto.marca || producto.nombreComercial || '',
  denominacion: producto.denominacion || '',
  aliases: producto.aliases || [],
  habilitacionCompleta: producto.habilitacionCompleta || habilitacionCompletaProducto(producto),
  disposicionRegistro: producto.disposicionRegistro || '',
  fechaResolucionSenasa: fechaRegistroOrNull(producto.fechaResolucionSenasa),
  fechaVencimientoRegistro: fechaRegistroOrNull(producto.fechaVencimientoRegistro),
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


function productoMipDataPrisma(producto = {}) {
  const { aliases: _aliases, marca: _marca, denominacion: _denominacion, organismoRegulador: _organismoRegulador, habilitacionHabitual: _habilitacionHabitual, ...data } = producto;
  return data;
}

function nombresUpsertProducto(producto = {}) {
  return [producto.nombreComercial, producto.marca, ...(Array.isArray(producto.aliases) ? producto.aliases : [])]
    .map(normalizarNombreSenasa)
    .filter(Boolean);
}


const PRODUCTOS_SENASA_MIP_METADATA = new Map();
PRODUCTOS_SENASA_MIP.forEach((producto) => {
  nombresUpsertProducto(producto).forEach((nombre) => PRODUCTOS_SENASA_MIP_METADATA.set(nombre, producto));
  if (producto.numeroRegistro) PRODUCTOS_SENASA_MIP_METADATA.set(`registro:${normalizarNombreSenasa(producto.numeroRegistro)}`, producto);
});

function metadataProductoMip(producto = {}) {
  const claves = [producto.nombreComercial, producto.nombre, producto.numeroRegistro ? `registro:${producto.numeroRegistro}` : '']
    .map(normalizarNombreSenasa)
    .filter(Boolean);
  return claves.map((clave) => PRODUCTOS_SENASA_MIP_METADATA.get(clave)).find(Boolean) || {};
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
    fechaResolucionSenasa: fechaRegistroOrNull(payload.fechaResolucionSenasa),
    fechaVencimientoRegistro: fechaRegistroOrNull(payload.fechaVencimientoRegistro),
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
    const nombresBusqueda = nombresUpsertProducto(producto);
    const existente = nombresBusqueda.map((nombre) => existentesPorNombre.get(nombre)).find(Boolean);
    const data = productoMipDataPrisma(producto);
    const upserted = await prisma.productoMip.upsert({
      where: { id: existente?.id || -1 },
      update: data,
      create: { ...data, activo: true }
    });
    nombresBusqueda.forEach((nombre) => existentesPorNombre.set(nombre, upserted));
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
  const meta = metadataProductoMip(producto);
  const nombreComercial = producto.nombreComercial || producto.nombre || meta.nombreComercial || '';
  const organismoHabilitante = producto.organismoHabilitante || producto.organismoRegulador || producto.habilitacionHabitual || meta.organismoHabilitante || meta.organismoRegulador || meta.habilitacionHabitual || '';
  const tipoRegistro = producto.tipoRegistro || '';
  const numeroRegistro = producto.numeroRegistro || producto.resolucionSenasa || '';
  const resolucionSenasa = tipoRegistro && numeroRegistro ? `${tipoRegistro} ${numeroRegistro}` : numeroRegistro;
  return {
    ...producto,
    nombreComercial,
    nombre: nombreComercial,
    marca: meta.marca || nombreComercial,
    denominacion: meta.denominacion || '',
    principioActivo: producto.principioActivo || '',
    concentracion: producto.concentracion || '',
    organismoHabilitante,
    organismoRegulador: producto.organismoRegulador || meta.organismoRegulador || organismoHabilitante,
    habilitacionHabitual: producto.habilitacionHabitual || meta.habilitacionHabitual || organismoHabilitante,
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

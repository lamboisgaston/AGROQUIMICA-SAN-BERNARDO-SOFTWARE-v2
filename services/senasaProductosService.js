const CATEGORIA_AGROQUIMICOS_SENASA = 'AGROQUÍMICOS SENASA';

const PRODUCTOS_SENASA_MIP = [
  ['Fendona 6 SC', 'Alfacipermetrina', '6%', 'ANMAT', 'RNPUD', '0250058'],
  ['K-Othrina', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250006'],
  ['Aqua K-Othrine', 'Deltametrina', '2%', 'ANMAT', 'RNPUD', '0250052'],
  ['Solfac EW 50', 'Cyfluthrin', '5%', 'ANMAT', 'RNPUD', '0250005'],
  ['Blattanex Gel', 'Fipronil', '0,05%', 'ANMAT', 'RNPUD', '0250034'],
  ['Maxforce Gel', 'Imidacloprid', '2,15%', 'ANMAT', 'RNPUD', '0250044'],
  ['Klerat', 'Brodifacoum', '0,005%', 'ANMAT', 'RNPUD', '0250012'],
  ['Storm', 'Flocoumafen', '0,005%', 'ANMAT', 'RNPUD', '0250019'],
  ['Rodilon Bloque', 'Difethialone', '0,0025%', 'ANMAT', 'RNPUD', '0250071'],
  ['Mirex-S', 'Sulfluramida', '0,3%', 'SENASA', 'SENASA', '36.184']
].map(([nombreComercial, principioActivo, concentracion, organismoHabilitante, tipoRegistro, numeroRegistro]) => ({
  nombreComercial,
  principioActivo,
  concentracion,
  organismoHabilitante,
  tipoRegistro,
  numeroRegistro,
  usoPrincipal: 'MIP'
}));

const PRODUCTO_SENASA_WHERE = { aptoSenasaMip: true };

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
    usoPrincipal: String(payload.usoPrincipal || 'MIP').trim() || 'MIP'
  };
}

function validarProductoMipPayload(data = {}) {
  const faltantes = ['nombreComercial', 'principioActivo', 'concentracion', 'organismoHabilitante', 'tipoRegistro', 'numeroRegistro']
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
      update: { ...producto, activo: true },
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
    resolucionSenasa: [tipoRegistro, numeroRegistro].filter(Boolean).join(' '),
    habilitacionCompleta: [organismoHabilitante, tipoRegistro, numeroRegistro ? `N° ${numeroRegistro}` : ''].filter(Boolean).join(' '),
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

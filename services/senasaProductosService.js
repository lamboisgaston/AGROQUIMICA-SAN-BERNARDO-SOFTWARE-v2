const CATEGORIA_AGROQUIMICOS_SENASA = 'AGROQUÍMICOS SENASA';

const PRODUCTOS_SENASA_MIP = [
  {
    nombre: 'Fendona 6 SC',
    principioActivo: 'Alfacipermetrina',
    concentracion: '6% SC',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida de uso profesional para programas MIP; verificar rótulo, alcance de uso y registro vigente antes de aplicar.'
  },
  {
    nombre: 'Sipertrin',
    principioActivo: 'Beta Cipermetrina',
    concentracion: '5%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida piretroide para control de insectos; usar según marbete y habilitación sanitaria vigente.'
  },
  {
    nombre: 'Delta Pro',
    principioActivo: 'Deltametrina + Propoxur',
    concentracion: '2,5% + 20%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida combinado; confirmar formulación, registro y condiciones de uso del lote disponible.'
  },
  {
    nombre: 'Veloxan Derribante',
    principioActivo: 'Cipermetrina + Tetrametrina',
    concentracion: '15% + 0,2%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida de volteo; aplicar únicamente bajo indicaciones de etiqueta y normativa aplicable.'
  },
  {
    nombre: 'K-Othrina',
    principioActivo: 'Deltametrina',
    concentracion: '2,5%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida para saneamiento ambiental; validar registro y uso autorizado para el establecimiento.'
  },
  {
    nombre: 'Solfac EW 50',
    principioActivo: 'Cyfluthrin',
    concentracion: '5%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida residual; conservar respaldo documental de habilitación y lote utilizado.'
  },
  {
    nombre: 'Maxforce Gel',
    principioActivo: 'Imidacloprid',
    concentracion: '2,15%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Cebo gel cucarachicida; utilizar conforme a registro sanitario y plan MIP.'
  },
  {
    nombre: 'Blattanex Gel',
    principioActivo: 'Fipronil',
    concentracion: '0,05%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Cebo gel para cucarachas; documentar aplicación según indicaciones del fabricante.'
  },
  {
    nombre: 'Mirex-S',
    principioActivo: 'Sulfluramida',
    concentracion: '0,3%',
    habilitacionHabitual: 'SENASA / ANMAT según uso',
    observacionesRegulatorias: 'Cebo hormiguicida; confirmar autoridad registrante y alcance de uso según destino de aplicación.'
  },
  {
    nombre: 'Klerat',
    principioActivo: 'Brodifacoum',
    concentracion: '0,005%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Cebo rodenticida anticoagulante; usar en estaciones seguras y registrar reposiciones del plan MIP.'
  },
  {
    nombre: 'Racumin',
    principioActivo: 'Coumatetralyl',
    concentracion: '0,75%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Rodenticida anticoagulante; verificar presentación y autorización vigente antes de su uso.'
  },
  {
    nombre: 'Storm',
    principioActivo: 'Flocoumafen',
    concentracion: '0,005%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Cebo rodenticida; mantener trazabilidad de lote, ubicación y consumo por estación.'
  },
  {
    nombre: 'Rodilon Bloque',
    principioActivo: 'Difethialone',
    concentracion: '0,0025%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Bloque rodenticida para programa MIP; aplicar con control de exposición a no objetivos.'
  },
  {
    nombre: 'Dragnet',
    principioActivo: 'Permetrina',
    concentracion: '25%',
    habilitacionHabitual: 'ANMAT / SENASA',
    observacionesRegulatorias: 'Producto insecticida; confirmar registro aplicable según uso urbano, industrial o agropecuario.'
  },
  {
    nombre: 'Dragón',
    principioActivo: 'Cipermetrina',
    concentracion: '25%',
    habilitacionHabitual: 'SENASA',
    observacionesRegulatorias: 'Producto insecticida con referencia SENASA; validar marbete y restricciones vigentes.'
  },
  {
    nombre: 'Biflex',
    principioActivo: 'Bifentrin',
    concentracion: '10%',
    habilitacionHabitual: 'SENASA / ANMAT según formulación',
    observacionesRegulatorias: 'Producto insecticida; la autoridad habilitante puede variar por formulación y destino.'
  },
  {
    nombre: 'Cislin 25',
    principioActivo: 'Deltametrina',
    concentracion: '2,5%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida residual; usar según etiqueta y requisitos del cliente auditado.'
  },
  {
    nombre: 'Aqua K-Othrine',
    principioActivo: 'Deltametrina',
    concentracion: '2%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida base acuosa; verificar condiciones de dilución y aplicación autorizadas.'
  },
  {
    nombre: 'Demand CS',
    principioActivo: 'Lambda Cyhalothrin',
    concentracion: '9,7%',
    habilitacionHabitual: 'ANMAT',
    observacionesRegulatorias: 'Producto insecticida microencapsulado; registrar dosis y sectores en documentación MIP.'
  },
  {
    nombre: 'Icon 10 CS',
    principioActivo: 'Lambda Cyhalothrin',
    concentracion: '10%',
    habilitacionHabitual: 'ANMAT / SENASA según uso',
    observacionesRegulatorias: 'Producto insecticida microencapsulado; verificar autoridad registrante según el uso declarado.'
  }
];

const PRODUCTO_SENASA_WHERE = {
  OR: [
    { aptoSenasaMip: true },
    { categoria: CATEGORIA_AGROQUIMICOS_SENASA },
    { categorias: { some: { nombre: CATEGORIA_AGROQUIMICOS_SENASA } } }
  ]
};

function normalizarNombreSenasa(nombre = '') {
  return String(nombre).trim().toLocaleLowerCase('es-AR');
}

function dataProductoSenasa(producto) {
  return {
    nombre: producto.nombre,
    categoria: CATEGORIA_AGROQUIMICOS_SENASA,
    principioActivo: producto.principioActivo,
    concentracion: producto.concentracion,
    habilitacionHabitual: producto.habilitacionHabitual,
    observaciones: producto.observacionesRegulatorias,
    usoSenasa: 'MIP',
    aptoSenasaMip: true,
    activo: true,
    eliminado: false
  };
}

function dataProductoSenasaCreate(producto, categoriaId) {
  return {
    ...dataProductoSenasa(producto),
    categorias: { connect: { id: categoriaId } },
    marca: '',
    unidad: 'UN',
    stock: 0,
    monedaCosto: 'ARS',
    costoBase: 0,
    precioVenta: 0,
    porcentajeUva: 0,
    porcentajeFlete: 0,
    porcentajeGanancia: 0,
    precioFinalPesos: 0
  };
}

async function upsertProductosSenasaMip(prisma) {
  const categoria = await prisma.categoria.upsert({
    where: { nombre: CATEGORIA_AGROQUIMICOS_SENASA },
    update: { activo: true },
    create: {
      nombre: CATEGORIA_AGROQUIMICOS_SENASA,
      descripcion: 'Productos técnicos habilitados para uso SENASA / MIP.'
    }
  });

  const existentes = await prisma.producto.findMany({
    select: { id: true, nombre: true, categorias: true }
  });
  const existentesPorNombre = new Map(existentes.map((producto) => [normalizarNombreSenasa(producto.nombre), producto]));

  let creados = 0;
  let actualizados = 0;

  for (const producto of PRODUCTOS_SENASA_MIP) {
    const existente = existentesPorNombre.get(normalizarNombreSenasa(producto.nombre));
    const data = dataProductoSenasa(producto);
    const categorias = existente?.categorias?.some((item) => item.id === categoria.id)
      ? undefined
      : { connect: { id: categoria.id } };

    await prisma.producto.upsert({
      where: { id: existente?.id || -1 },
      update: { ...data, ...(categorias ? { categorias } : {}) },
      create: dataProductoSenasaCreate(producto, categoria.id)
    });

    if (existente) actualizados += 1;
    else creados += 1;
  }

  return { categoria: CATEGORIA_AGROQUIMICOS_SENASA, creados, actualizados, total: PRODUCTOS_SENASA_MIP.length };
}

async function bootstrapProductosSenasaMipSiVacio(prisma) {
  const existentesAptos = await prisma.producto.count({
    where: { eliminado: false, activo: true, aptoSenasaMip: true }
  });
  if (existentesAptos > 0) return { ejecutado: false, existentesAptos };
  const resultado = await upsertProductosSenasaMip(prisma);
  return { ejecutado: true, existentesAptos, ...resultado };
}

function mapearProductoSenasaApi(producto) {
  return {
    ...producto,
    observacionesRegulatorias: producto.observacionesRegulatorias || producto.observaciones || ''
  };
}

module.exports = {
  CATEGORIA_AGROQUIMICOS_SENASA,
  PRODUCTOS_SENASA_MIP,
  PRODUCTO_SENASA_WHERE,
  bootstrapProductosSenasaMipSiVacio,
  mapearProductoSenasaApi,
  upsertProductosSenasaMip
};

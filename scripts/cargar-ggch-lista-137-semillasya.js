const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SEMILLERO = {
  nombre: 'G.G.CH.',
  logo: '/app/assets/semilleros/garden-gasty-chuchuy.svg',
  contacto: '',
  observaciones: 'Garde, Giusti y Chuchuy SA · Lista de precios N°137 · Mayo 2026'
};

const MARCAS = [
  'Sais Italia', 'G.G.Ch.', 'Clause', 'Tozer', 'Harris Moran', 'Niagara', 'Nirit', 'Daehnfeldt', 'Syngenta',
  'Starke Ayres', 'Cora Seeds', 'Vilmorin', 'Hed Seeds', 'Hazera', 'Yuksel', 'Harmoniz', 'Apricus Seeds',
  'Pennington Seeds', 'Hollar', 'Amsa', 'Mikado', 'Isi', 'Japon', 'U.S. Agriseeds'
];

const CULTIVOS_DETECTADOS = [
  'Acelga', 'Achicoria', 'Albahaca', 'Apio', 'Arveja', 'Berenjena', 'Brócoli', 'Cebolla', 'Coliflor', 'Espinaca',
  'Hinojo', 'Lechuga', 'Maíz', 'Melón', 'Pepino', 'Perejil', 'Pimiento', 'Poroto', 'Puerro', 'Rabanito',
  'Remolacha', 'Repollo', 'Sandía', 'Tomate', 'Zanahoria', 'Zapallo', 'Zucchini', 'Aromáticas', 'Flores', 'Césped'
];

// Carga base curada a partir de los ejemplos/estructura recibidos. Cuando se disponga
// del PDF extraído completo, agregar filas al arreglo o pasar un JSON por GGCH_ROWS_JSON.
const PRODUCTOS = [
  {
    cultivo: 'Tomate', marca: 'Nirit', variedad: 'Tamara F1', presentacion: 'Sobre x 1.000 semillas', precioUsd: 198,
    descripcionTecnica: 'Tomate híbrido F1. Precio de lista expresado en USD + IVA según lista G.G.CH. N°137 Mayo 2026.'
  }
];

function normalizarTexto(valor = '') {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

function detectarMetadata(row = {}) {
  const texto = [row.variedad, row.presentacion, row.descripcionTecnica, row.observaciones].map(normalizarTexto).join(' ');
  const tags = new Set();
  if (/\bagotad[oa]s?\b/i.test(texto)) tags.add('AGOTADO');
  if (/\bnovedad(?:es)?\b/i.test(texto)) tags.add('NOVEDAD');
  if (/\bf\s*1\b/i.test(texto) || /\bh[ií]brid[oa]s?\b/i.test(texto)) tags.add('F1');
  if (/resistent/i.test(texto)) tags.add('RESISTENTE');
  if (/toleran/i.test(texto)) tags.add('TOLERANCIA');
  if (/hidrop[oó]nic/i.test(texto)) tags.add('HIDROPÓNICA');
  return {
    tags: [...tags],
    agotado: tags.has('AGOTADO'),
    novedad: tags.has('NOVEDAD'),
    hibrido: tags.has('F1')
  };
}

function detectarTipoEnvase(presentacion = '') {
  const texto = presentacion.toLowerCase();
  if (texto.includes('sobre')) return 'Sobre';
  if (texto.includes('lata')) return 'Lata';
  if (texto.includes('bolsa')) return 'Bolsa';
  if (texto.includes('alfoil')) return 'Alfoil';
  if (texto.includes('granel')) return 'Granel';
  return '';
}

function detectarUnidad(presentacion = '') {
  const match = String(presentacion || '').match(/x\s*([\d.,]+\s*(?:semillas|kg|gr|g|lb|libras?))/i);
  if (match) return match[1].replace(/\s+/g, ' ').trim();
  return '';
}

function filasEntrada() {
  if (!process.env.GGCH_ROWS_JSON) return PRODUCTOS;
  const parsed = JSON.parse(process.env.GGCH_ROWS_JSON);
  if (!Array.isArray(parsed)) throw new Error('GGCH_ROWS_JSON debe ser un arreglo JSON');
  return parsed;
}

async function upsertSemilleroYMarcas() {
  const semillero = await prisma.semillero.upsert({
    where: { nombre: SEMILLERO.nombre },
    update: SEMILLERO,
    create: SEMILLERO
  });

  const marcas = new Map();
  for (const nombre of MARCAS) {
    const marca = await prisma.marca.upsert({
      where: { nombre },
      update: { semilleroId: semillero.id, descripcion: 'Marca comercial visible en SemillasYa asociada a lista G.G.CH. N°137 Mayo 2026' },
      create: { nombre, semilleroId: semillero.id, descripcion: 'Marca comercial visible en SemillasYa asociada a lista G.G.CH. N°137 Mayo 2026' }
    });
    marcas.set(nombre.toUpperCase(), marca);
  }

  return { semillero, marcas };
}

async function main() {
  const rows = filasEntrada();
  const { semillero, marcas } = await upsertSemilleroYMarcas();
  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;

  for (const row of rows) {
    const cultivo = normalizarTexto(row.cultivo);
    const variedad = normalizarTexto(row.variedad || row.nombre);
    const marcaNombre = normalizarTexto(row.marca || 'G.G.Ch.');
    const presentacionEnvase = normalizarTexto(row.presentacion || row.presentacionEnvase);
    if (!cultivo || !variedad || !presentacionEnvase) {
      omitidos += 1;
      continue;
    }

    const marca = marcas.get(marcaNombre.toUpperCase()) || await prisma.marca.upsert({
      where: { nombre: marcaNombre },
      update: { semilleroId: semillero.id },
      create: { nombre: marcaNombre, semilleroId: semillero.id, descripcion: 'Marca comercial importada desde lista G.G.CH. N°137 Mayo 2026' }
    });
    const meta = detectarMetadata(row);
    const precioUsd = row.precioUsd == null || row.precioUsd === '' ? null : Number(row.precioUsd);
    const descripcionTecnica = normalizarTexto(row.descripcionTecnica || row.descripcion || '');

    const data = {
      nombre: variedad,
      semilleroLaboratorio: semillero.nombre,
      semilleroId: semillero.id,
      marcaId: marca.id,
      marcaComercial: marca.nombre,
      categoria: cultivo,
      cultivo,
      presentacionEnvase,
      unidad: normalizarTexto(row.unidad) || detectarUnidad(presentacionEnvase),
      tipoEnvase: normalizarTexto(row.tipoEnvase) || detectarTipoEnvase(presentacionEnvase),
      origen: normalizarTexto(row.origen) || 'Lista G.G.CH. N°137 Mayo 2026',
      descripcion: `${cultivo} · ${marca.nombre} · ${variedad} · ${presentacionEnvase}`,
      descripcionTecnica,
      observacionesComerciales: normalizarTexto(row.observaciones) || `origen=GGCH_LISTA_137_MAYO_2026; marca=${marca.nombre}`,
      precioUsd,
      precioInternoManual: precioUsd,
      monedaCompra: 'USD',
      costoCompra: precioUsd || 0,
      porcentajeFlete: Number(row.porcentajeFlete ?? 10),
      porcentajeIva: Number(row.porcentajeIva ?? 21),
      precioVentaFinal: precioUsd || 0,
      visibleEnSemillasYa: Boolean(row.visibleEnSemillasYa ?? true),
      publicadoWeb: Boolean(row.publicadoWeb ?? true),
      activo: true,
      estado: meta.agotado ? 'AGOTADO' : (precioUsd ? 'DISPONIBLE' : 'CONSULTAR'),
      agotado: meta.agotado,
      novedad: meta.novedad,
      hibrido: meta.hibrido,
      tags: JSON.stringify(meta.tags),
      metadataTecnica: JSON.stringify({ fuente: 'LISTA_GGCH_137_MAYO_2026', marca: marca.nombre, cultivo })
    };

    const existente = await prisma.productoPrecampania.findFirst({
      where: { cultivo, nombre: variedad, marcaComercial: marca.nombre, presentacionEnvase, semilleroId: semillero.id }
    });

    if (existente) {
      await prisma.productoPrecampania.update({ where: { id: existente.id }, data });
      actualizados += 1;
    } else {
      await prisma.productoPrecampania.create({ data });
      creados += 1;
    }
  }

  console.log(`G.G.CH lista 137 SemillasYa: marcas=${MARCAS.length}, cultivosDetectados=${CULTIVOS_DETECTADOS.length}, procesados=${rows.length}, creados=${creados}, actualizados=${actualizados}, omitidos=${omitidos}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar G.G.CH lista 137 en SemillasYa:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

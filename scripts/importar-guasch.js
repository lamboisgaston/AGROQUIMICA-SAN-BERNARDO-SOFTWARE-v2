const { PrismaClient, TipoReglaComercial } = require('@prisma/client');

const prisma = new PrismaClient();

const LISTA_COMERCIAL_ID = 1;
const LISTA_COMERCIAL_NOMBRE = 'GUASCH PRECAMPAÑA 2026';
const PROVEEDOR = 'Semillera Guasch SRL';
const FECHA_FUENTE = '2026-03-09';

const PRODUCTOS_GUASCH = [
  { categoria: 'Pasturas', nombre: 'Raigrás Anual Tetraploide Macho', presentacion: 'Bolsa 25 Kg', precioUsd: 1.95 },
  { categoria: 'Pasturas', nombre: 'Alfalfa Brava', presentacion: 'Bolsa 25 Kg', precioUsd: 10.31 },
  { categoria: 'Verdeos Invernales', nombre: 'Avena Blanca Bonaerense INTA Calen', presentacion: 'Bolsa 40 Kg', precioUsd: 0.46 },
  { categoria: 'Pasturas/Alfalfas', nombre: 'Armona', presentacion: '25 Kg', precioUsd: 9.07 },
  { categoria: 'Pasturas/Alfalfas', nombre: 'Pampa Flor', presentacion: '25 Kg', precioUsd: 8.46 },
  { categoria: 'Césped / Blends', nombre: 'Champions', presentacion: 'Bolsa 10 Kg', precioUsd: 56.5 },
  { categoria: 'Césped / Blends', nombre: 'Champions', presentacion: 'Bolsa 25 Kg', precioUsd: 137.5 },
  { categoria: 'Césped / Blends', nombre: 'Cherokee', presentacion: 'Bolsa 10 Kg', estado: 'CONSULTAR', precioUsd: null },
  { categoria: 'Césped / Blends', nombre: 'Cherokee', presentacion: 'Bolsa 25 Kg', estado: 'CONSULTAR', precioUsd: null },
  { categoria: 'Césped / Blends', nombre: 'Tucson', presentacion: 'Lata 500 g', precioUsd: 18.7 },
  { categoria: 'Césped / Blends', nombre: 'Tucson', presentacion: 'Balde 10 Kg', precioUsd: 352.0 },
  { categoria: 'Césped / Blends', nombre: 'Winipeg', presentacion: 'Alupack 1 Kg', estado: 'CONSULTAR', precioUsd: null },
  { categoria: 'Césped / Blends', nombre: 'Winipeg', presentacion: 'Bolsa 10 Kg', estado: 'CONSULTAR', precioUsd: null },
  { categoria: 'Césped Profesional', nombre: 'Poa Pratensis', presentacion: 'Alupack 1 Kg', precioUsd: 12.3 },
  { categoria: 'Césped Profesional', nombre: 'Poa Pratensis', presentacion: 'Bolsa 10 Kg', precioUsd: 120.0 },
  { categoria: 'Césped Profesional', nombre: 'Raigrás Perenne Lolius', presentacion: 'Bolsa 25 Kg', precioUsd: 178.75 },
  { categoria: 'Césped Profesional', nombre: 'Raigrás Perenne Boost', presentacion: 'Bolsa 25 Kg', precioUsd: 90.0 },
  { categoria: 'Césped Profesional', nombre: 'Raigrás Perenne Prana', presentacion: 'Bolsa 25 Kg', precioUsd: 92.5 },
  { categoria: 'Césped Profesional', nombre: 'Trébol Blanco Grasslands Huia', presentacion: 'Alupack 1 Kg', precioUsd: 8.5 },
  { categoria: 'Césped Profesional', nombre: 'Trébol Blanco Grasslands Huia', presentacion: 'Bolsa 10 Kg', precioUsd: 82.4 },
  { categoria: 'Césped Profesional', nombre: 'Trébol Blanco Grasslands Huia', presentacion: 'Bolsa 25 Kg', precioUsd: 195.5 }
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function normalizarEstado(estado, precioUsd) {
  const raw = String(estado || '').trim().toUpperCase();
  if (raw === 'CONSULTAR') return 'CONSULTAR';
  if (raw === 'AGOTADO') return 'AGOTADO';
  if (raw === 'SIN STOCK' || raw === 'SIN_STOCK') return 'SIN_STOCK';
  return Number(precioUsd) > 0 ? 'DISPONIBLE' : 'CONSULTAR';
}

function calcularPrecioFinal(precioUsd, tipoCambio) {
  const precioPesos = round2(precioUsd * tipoCambio);
  const conFlete = round2(precioPesos * 1.07);
  const conIva = round2(conFlete * 1.21);
  const gananciaObjetivo = round2(conIva * 0.2);
  return { precioPesos, conFlete, precioFinal: conIva, gananciaObjetivo };
}

async function resolverListaComercial() {
  const listaPorId = await prisma.listaComercial.findUnique({ where: { id: LISTA_COMERCIAL_ID } });
  if (listaPorId) return listaPorId;

  const listaPorNombre = await prisma.listaComercial.findFirst({
    where: { nombre: LISTA_COMERCIAL_NOMBRE }
  });

  if (listaPorNombre) return listaPorNombre;

  throw new Error(
    `No existe ListaComercial.id=${LISTA_COMERCIAL_ID} ni una lista con nombre "${LISTA_COMERCIAL_NOMBRE}".`
  );
}

async function main() {
  const lista = await resolverListaComercial();

  const cfg = await prisma.configuracionGlobal.findUnique({ where: { id: 1 } });
  const tipoCambio = Number(cfg?.tipoCambioActual || 0);
  if (!tipoCambio || tipoCambio <= 0) {
    throw new Error('ConfiguracionGlobal.id=1.tipoCambioActual inválido.');
  }

  const proveedorExistente = await prisma.empresaComercial.findFirst({
    where: { nombre: PROVEEDOR }
  });

  const proveedor = proveedorExistente
    ? await prisma.empresaComercial.update({
        where: { id: proveedorExistente.id },
        data: { activo: true }
      })
    : await prisma.empresaComercial.create({
        data: { nombre: PROVEEDOR, activo: true }
      });

  await prisma.listaComercial.update({
    where: { id: lista.id },
    data: {
      empresaComercialId: proveedor.id,
      nombre: LISTA_COMERCIAL_NOMBRE,
      moneda: 'USD',
      vigenteDesde: new Date(`${FECHA_FUENTE}T00:00:00.000Z`),
      metadata: JSON.stringify({
        fuente: 'GUASCH PDF/imagenes analizadas',
        fechaFuente: FECHA_FUENTE,
        tipoCambioUsado: tipoCambio
      })
    }
  });

  await prisma.reglaComercialLista.deleteMany({ where: { listaComercialId: lista.id } });
  await prisma.reglaComercialLista.createMany({
    data: [
      { listaComercialId: lista.id, nombre: 'Flete 7%', tipo: TipoReglaComercial.FLETE_PORCENTAJE, valor: 7, orden: 10 },
      { listaComercialId: lista.id, nombre: 'IVA 21%', tipo: TipoReglaComercial.IVA_PORCENTAJE, valor: 21, orden: 20 },
      { listaComercialId: lista.id, nombre: 'Ganancia objetivo 20%', tipo: TipoReglaComercial.MARGEN_PORCENTAJE, valor: 20, orden: 30 }
    ]
  });

  await prisma.productoListaComercial.deleteMany({ where: { listaComercialId: lista.id } });

  const rows = PRODUCTOS_GUASCH.map((p) => {
    const estado = normalizarEstado(p.estado, p.precioUsd);
    const tienePrecio = Number(p.precioUsd) > 0;
    const precioUsd = tienePrecio ? Number(p.precioUsd) : null;
    const calculo = estado === 'DISPONIBLE' && precioUsd ? calcularPrecioFinal(precioUsd, tipoCambio) : null;

    const metadataOriginal = {
      nombre: p.nombre,
      categoria: p.categoria,
      presentacion: p.presentacion,
      precioUsd,
      estado,
      precioFinal: calculo?.precioFinal ?? null,
      calculo: calculo ?? null
    };

    return {
      listaComercialId: lista.id,
      nombreProducto: p.nombre,
      unidad: p.presentacion || null,
      precioNeto: calculo?.precioFinal ?? 0,
      precioSugeridoPublico: calculo?.precioFinal ?? null,
      ivaPorcentaje: 21,
      fletePorcentaje: 7,
      margenPorcentaje: 20,
      moneda: 'ARS',
      activo: true,
      skuExterno: `GUASCH|${Buffer.from(JSON.stringify(metadataOriginal)).toString('base64')}`
    };
  });

  const res = await prisma.productoListaComercial.createMany({ data: rows });

  console.log(
    `Importación GUASCH OK. Lista ${lista.id} (${lista.nombre}). Productos insertados: ${res.count}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

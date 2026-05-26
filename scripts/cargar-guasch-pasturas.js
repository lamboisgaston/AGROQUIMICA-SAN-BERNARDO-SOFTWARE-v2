const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  cultivos: ['GRAMÍNEAS / PASTURAS', 'CULTIVOS FORRAJEROS / COBERTURA', 'TRÉBOLES / LOTUS'],
  semilleroLaboratorio: 'GUASCH',
  moneda: 'USD',
  margenPorcentaje: 0,
  utilidadPorcentaje: 0,
  fletePorcentaje: 10,
  ivaPorcentaje: 21,
  visibleEnSemillasYa: true,
  activo: true,
  origen: 'GUASCH_LISTA_2026_05_18'
};

const PRODUCTOS = [
  ['GRAMÍNEAS / PASTURAS', 'Agropiro Alargado', 'Bolsa 20 kg', 84.70],
  ['GRAMÍNEAS / PASTURAS', 'Cebadilla Criolla Don Humberto', 'Bolsa 25 kg', 56.38],
  ['GRAMÍNEAS / PASTURAS', 'Festuca Alta Vegas', 'Bolsa 25 kg', 115.50],
  ['GRAMÍNEAS / PASTURAS', 'Pasto Ovillo Amba', 'Bolsa 25 kg', 167.75],
  ['GRAMÍNEAS / PASTURAS', 'Raigrás Anual Tetraploide Macho', 'Bolsa 25 kg', 53.63],
  ['GRAMÍNEAS / PASTURAS', 'Raigrás Anual LE 284', 'Bolsa 25 kg', 48.13],
  ['GRAMÍNEAS / PASTURAS', 'Raigrás Perenne Córdoba', 'Bolsa 25 kg', 103.13],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Acelga Forrajera', 'Bolsa 20 kg', 246.40],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Achicoria Forrajera', 'Bolsa 25 kg', 233.75],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Mostaza Blanca', 'Bolsa 25 kg', 290.13],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Sorgo de Escoba', 'Bolsa 25 kg', 27.50],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Vicia Sativa', 'Bolsa 25 kg', 61.88],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Vicia Villosa', 'Bolsa 25 kg', 63.25],
  ['TRÉBOLES / LOTUS', 'Trébol de Olor Amarillo', 'Bolsa 25 kg', 182.88],
  ['TRÉBOLES / LOTUS', 'Lotus Tenuis', 'Bolsa 25 kg', 253.00],
  ['TRÉBOLES / LOTUS', 'Lotus Corniculatus', 'Bolsa 25 kg', 324.50],
  ['TRÉBOLES / LOTUS', 'Trébol Rojo Quiñequeli', 'Bolsa 25 kg', 181.50]
];

async function main() {
  const desactivados = await prisma.productoPrecampania.updateMany({
    where: { semilleroLaboratorio: CONFIG.semilleroLaboratorio, cultivo: { in: CONFIG.cultivos } },
    data: { activo: false, visibleEnSemillasYa: false }
  });

  for (const [cultivo, nombre, presentacionEnvase, precioListaUsd] of PRODUCTOS) {
    const descripcion = `${cultivo} · ${CONFIG.semilleroLaboratorio} · ${nombre} · ${presentacionEnvase}`;
    await prisma.productoPrecampania.create({ data: {
      nombre, semilleroLaboratorio: CONFIG.semilleroLaboratorio, categoria: cultivo, cultivo, presentacionEnvase, descripcion,
      observacionesComerciales: `origen=${CONFIG.origen}; utilidadPorcentaje=${CONFIG.utilidadPorcentaje}; precioListaUsd=${precioListaUsd}`,
      precioInternoManual: precioListaUsd, monedaCompra: CONFIG.moneda, costoCompra: precioListaUsd, porcentajeFlete: CONFIG.fletePorcentaje,
      porcentajeIva: CONFIG.ivaPorcentaje, porcentajeMargen: CONFIG.margenPorcentaje, precioVentaFinal: precioListaUsd,
      visibleEnSemillasYa: CONFIG.visibleEnSemillasYa, activo: CONFIG.activo, publicadoWeb: true, estado: precioListaUsd == null ? 'CONSULTAR' : 'DISPONIBLE'
    }});
  }

  console.log(`GUASCH Pasturas: desactivados=${desactivados.count}, creados=${PRODUCTOS.length}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());

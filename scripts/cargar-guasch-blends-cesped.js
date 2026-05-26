const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  cultivo: 'BLENDS CÉSPED',
  semilleroLaboratorio: 'GUASCH',
  moneda: 'USD',
  fletePorcentaje: 10,
  ivaPorcentaje: 21,
  margenPorcentaje: 0,
  utilidadPorcentaje: 0,
  visibleEnSemillasYa: true,
  activo: true,
  origen: 'GUASCH_BLENDS_CESPED_MANUAL_2026_05_18'
};

const PRODUCTOS = [
  ['Champions', 'Bolsa 10 kg', 56.50],
  ['Champions', 'Bolsa 25 kg', 137.50],
  ['Cherokee', 'Bolsa 10 kg', 20.65],
  ['Cherokee', 'Bolsa 25 kg', 47.75],
  ['Tucson', 'Lata 500 gr', 18.70],
  ['Tucson', 'Balde 10 kg', 352.00],
  ['Classic 4 Estaciones Mix', 'Alupack 1 kg', 4.65],
  ['Classic 4 Estaciones Mix', 'Bolsa 25 kg', 103.75],
  ['Media Sombra Mix', 'Alupack 1 kg', 4.75],
  ['Media Sombra Mix', 'Bolsa 25 kg', 107.50],
  ['Comahue', 'Alupack 1 kg', 5.50],
  ['Comahue', 'Bolsa 25 kg', 125.00],
  ['Patagonia Norte Mix', 'Alupack 1 kg', 6.80],
  ['Patagonia Norte Mix', 'Bolsa 25 kg', 157.50],
  ['Austral Mix', 'Bolsa 25 kg', 131.25],
  ['Mustang Grass Mix', 'Bolsa 25 kg', 136.25],
  ['Wembley Grass Mix', 'Bolsa 25 kg', 133.75],
  ['Florida Grass Mix', 'Bolsa 25 kg', 143.75],
  ['Resistencia Pisoteo Mix', 'Bolsa 25 kg', 112.50]
];

async function main() {
  const where = {
    cultivo: CONFIG.cultivo,
    semilleroLaboratorio: CONFIG.semilleroLaboratorio
  };

  const desactivados = await prisma.productoPrecampania.updateMany({
    where,
    data: { activo: false, visibleEnSemillasYa: false }
  });

  let creados = 0;

  for (const [nombre, presentacionEnvase, precioListaUsd] of PRODUCTOS) {
    const metadatosComerciales = `origen=${CONFIG.origen}; precio_lista_usd=${precioListaUsd}; utilidad_porcentaje=${CONFIG.utilidadPorcentaje}`;
    const descripcion = `${CONFIG.cultivo} · ${CONFIG.semilleroLaboratorio} · ${nombre} · ${presentacionEnvase} · ${metadatosComerciales}`;

    await prisma.productoPrecampania.create({
      data: {
        nombre,
        semilleroLaboratorio: CONFIG.semilleroLaboratorio,
        categoria: CONFIG.cultivo,
        cultivo: CONFIG.cultivo,
        presentacionEnvase,
        descripcion,
        precioInternoManual: precioListaUsd,
        monedaCompra: CONFIG.moneda,
        costoCompra: precioListaUsd,
        porcentajeFlete: CONFIG.fletePorcentaje,
        porcentajeIva: CONFIG.ivaPorcentaje,
        porcentajeMargen: CONFIG.margenPorcentaje,
        precioVentaFinal: precioListaUsd,
        visibleEnSemillasYa: CONFIG.visibleEnSemillasYa,
        activo: CONFIG.activo,
        publicadoWeb: true,
        estado: 'DISPONIBLE'
      }
    });

    creados += 1;
  }

  console.log(`GUASCH BLENDS CÉSPED: desactivados=${desactivados.count}, creados=${creados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar BLENDS CÉSPED GUASCH:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

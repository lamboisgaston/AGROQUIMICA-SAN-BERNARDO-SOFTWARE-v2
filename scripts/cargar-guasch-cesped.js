const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  cultivo: 'CÉSPED',
  semilleroLaboratorio: 'GUASCH',
  moneda: 'USD',
  fletePorcentaje: 10,
  ivaPorcentaje: 21,
  margenPorcentaje: 0,
  utilidadPorcentaje: 0,
  visibleEnSemillasYa: true,
  activo: true,
  origen: 'GUASCH_CESPED_MANUAL_2026_05_18'
};

const PRODUCTOS = [
  ['Bermuda Grass Unhulled', 'Alubag 100 gr', 21.70],
  ['Bermuda Grass Unhulled', 'Doypack 250 gr', 4.80],
  ['Bermuda Grass Unhulled', 'Lata 500 gr', 10.30],
  ['Bermuda Grass Unhulled', 'Alupack 1 kg', 17.90],
  ['Festuca Belfine', 'Bolsa 25 kg', 105.00],
  ['Festuca Kentucky', 'Bolsa 25 kg', 102.50],
  ['Festuca Troubadix', 'Bolsa 25 kg', 185.00],
  ['Raigrás Perenne Lolius', 'Bolsa 25 kg', 178.75],
  ['Raigrás Perenne Boost', 'Bolsa 25 kg', 90.00],
  ['Raigrás Perenne Prana', 'Bolsa 25 kg', 92.50],
  ['Trébol Blanco Grasslands Huia', 'Alupack 1 kg', 8.50],
  ['Trébol Blanco Grasslands Huia', 'Bolsa 10 kg', 82.40]
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

  console.log(`GUASCH CÉSPED: desactivados=${desactivados.count}, creados=${creados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar CÉSPED GUASCH:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

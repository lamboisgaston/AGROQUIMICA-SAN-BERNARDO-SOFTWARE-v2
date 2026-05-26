const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  cultivo: 'ALFALFA',
  semilleroLaboratorio: 'GUASCH',
  moneda: 'USD',
  fletePorcentaje: 10,
  ivaPorcentaje: 21,
  margenPorcentaje: 0,
  utilidadPorcentaje: 0,
  visibleEnSemillasYa: true,
  activo: true,
  origen: 'GUASCH_ALFALFA_MANUAL_2026_05_18'
};

const PRODUCTOS = [
  ['BRAVA', 'Inoculante + Funguicida', 'G9', 'Bolsa 25 Kg', 270.75],
  ['BRAVA', 'Sin tratamiento', 'G9', 'Bolsa 25 Kg', 274.00],
  ['ARMONA', 'Inoculante + Funguicida', 'G8', 'Bolsa 25 Kg', 246.00],
  ['ARMONA', 'Sin tratamiento', 'G8', 'Bolsa 25 Kg', 247.25],
  ['PAMPA FLOR', 'Inoculante + Funguicida', 'G6', 'Bolsa 25 Kg', 232.75],
  ['PAMPA FLOR', 'Sin tratamiento', 'G6', 'Bolsa 25 Kg', 235.75],
  ['VECTOR', 'Inoculante + Funguicida', 'G5', 'Bolsa 25 Kg', 270.75],
  ['SIROSAL', 'Inoculante + Funguicida', 'G9', 'Bolsa 25 Kg', 267.75],
  ['SIROSAL', 'Sin tratamiento', 'G9', 'Bolsa 25 Kg', 271.50],
  ['CUF 101', 'Inoculante + Funguicida', 'G9', 'Bolsa 25 Kg', 240.75],
  ['AURORA', 'Inoculante + Funguicida', 'G7', 'Bolsa 25 Kg', 232.75],
  ['AURORA', 'Sin tratamiento', 'G7', 'Bolsa 25 Kg', 235.75]
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

  for (const [nombre, tratamiento, grupo, presentacionEnvase, precioListaUsd] of PRODUCTOS) {
    const metadatosComerciales = `origen=${CONFIG.origen}; tratamiento=${tratamiento}; grupo=${grupo}; precio_lista_usd=${precioListaUsd}; utilidad_porcentaje=${CONFIG.utilidadPorcentaje}`;
    const descripcion = `${CONFIG.cultivo} · ${CONFIG.semilleroLaboratorio} · ${nombre} · ${tratamiento} · ${grupo} · ${presentacionEnvase} · ${metadatosComerciales}`;

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

  console.log(`GUASCH ALFALFA: desactivados=${desactivados.count}, creados=${creados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar ALFALFA GUASCH:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

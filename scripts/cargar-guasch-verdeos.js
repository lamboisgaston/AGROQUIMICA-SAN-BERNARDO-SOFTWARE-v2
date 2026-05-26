const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  cultivo: 'VERDEOS',
  semilleroLaboratorio: 'GUASCH',
  moneda: 'USD',
  fletePorcentaje: 10,
  ivaPorcentaje: 21,
  margenPorcentaje: 0,
  utilidadPorcentaje: 0,
  visibleEnSemillasYa: true,
  activo: true,
  origen: 'GUASCH_VERDEOS_MANUAL_2026_05_18'
};

const PRODUCTOS = [
  ['Avena Blanca Bonaerense INTA Calen', 'Bolsa 40 kg', 26.40],
  ['Avena Blanca Florencia INTA', 'Bolsa 40 kg', 30.80],
  ['Avena Blanca Martina INTA', 'Bolsa 40 kg', 35.20],
  ['Avena Strigosa', 'Bolsa 40 kg', 51.04],
  ['Cebada Forrajera Negra Manfredi', 'Bolsa 40 kg', 20.68],
  ['Cebada Granífera Silera INTA', 'Bolsa 40 kg', 30.36],
  ['Centeno Secale Cereale', 'Bolsa 40 kg', 34.76],
  ['Centeno Emilio INTA', 'Bolsa 40 kg', 38.72],
  ['Triticale Yagan INTA', 'Bolsa 40 kg', 35.64],
  ['Triticale Ona INTA', 'Bolsa 40 kg', 36.52],
  ['Mijo Amarillo tipo Xanae', 'Bolsa 25 kg', 22.00],
  ['Mijo Verde tipo Trinidad', 'Bolsa 25 kg', 34.38],
  ['Grama Rhodes Katambora', 'Bolsa 10 kg', 159.50]
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

  console.log(`GUASCH VERDEOS: desactivados=${desactivados.count}, creados=${creados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar VERDEOS GUASCH:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

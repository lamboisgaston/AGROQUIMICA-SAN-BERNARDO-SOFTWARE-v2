const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  cultivo: 'ALFALFA',
  semilleroLaboratorio: 'GUASCH',
  visibleEnSemillasYa: true,
  activo: true,
  monedaCompra: 'USD',
  porcentajeMargen: 0,
  porcentajeFlete: 10,
  porcentajeIva: 21,
  publicadoWeb: false,
  origen: 'GUASCH_LISTA_ALFALFA'
};

const PRODUCTOS = [
  { nombre: 'BRAVA', tratamiento: 'Inoculante + Funguicida', grupo: 'G9', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 10.83, precioListaUsd: 270.75 },
  { nombre: 'BRAVA', tratamiento: 'Sin tratamiento', grupo: 'G9', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 10.96, precioListaUsd: 274.00 },
  { nombre: 'ARMONA', tratamiento: 'Inoculante + Funguicida', grupo: 'G8', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.84, precioListaUsd: 246.00 },
  { nombre: 'ARMONA', tratamiento: 'Sin tratamiento', grupo: 'G8', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.89, precioListaUsd: 247.25 },
  { nombre: 'PAMPA FLOR', tratamiento: 'Inoculante + Funguicida', grupo: 'G6', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.31, precioListaUsd: 232.75 },
  { nombre: 'PAMPA FLOR', tratamiento: 'Sin tratamiento', grupo: 'G6', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.43, precioListaUsd: 235.75 },
  { nombre: 'VECTOR', tratamiento: 'Inoculante + Funguicida', grupo: 'G5', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 10.83, precioListaUsd: 270.75 },
  { nombre: 'SIROSAL', tratamiento: 'Inoculante + Funguicida', grupo: 'G9', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 10.71, precioListaUsd: 267.75 },
  { nombre: 'SIROSAL', tratamiento: 'Sin tratamiento', grupo: 'G9', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 10.86, precioListaUsd: 271.50 },
  { nombre: 'CUF 101', tratamiento: 'Inoculante + Funguicida', grupo: 'G9', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.63, precioListaUsd: 240.75 },
  { nombre: 'AURORA', tratamiento: 'Inoculante + Funguicida', grupo: 'G7', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.31, precioListaUsd: 232.75 },
  { nombre: 'AURORA', tratamiento: 'Sin tratamiento', grupo: 'G7', presentacionEnvase: 'Bolsa 25 kg', precioKgUsd: 9.43, precioListaUsd: 235.75 }
];

function round(valor, decimales = 4) {
  return Number(Number(valor || 0).toFixed(decimales));
}

async function desactivarAlfalfaGuaschPrevio() {
  const result = await prisma.productoPrecampania.updateMany({
    where: {
      activo: true,
      cultivo: CONFIG.cultivo,
      semilleroLaboratorio: CONFIG.semilleroLaboratorio
    },
    data: { activo: false, visibleEnSemillasYa: false }
  });
  return result.count;
}

async function main() {
  let creados = 0;
  let actualizados = 0;

  const desactivados = await desactivarAlfalfaGuaschPrevio();

  for (const row of PRODUCTOS) {
    const precioListaUsd = round(row.precioListaUsd, 4);
    const precioKgUsd = round(row.precioKgUsd, 4);
    const precioUsdConFlete = round(precioListaUsd * (1 + CONFIG.porcentajeFlete / 100), 4);

    const data = {
      nombre: row.nombre,
      semilleroLaboratorio: CONFIG.semilleroLaboratorio,
      categoria: CONFIG.cultivo,
      cultivo: CONFIG.cultivo,
      presentacionEnvase: row.presentacionEnvase,
      descripcion: `${CONFIG.cultivo} · ${CONFIG.semilleroLaboratorio} · ${row.nombre} · ${row.tratamiento} · ${row.grupo} · ${row.presentacionEnvase}`,
      observacionesComerciales: `origen=${CONFIG.origen}; tratamiento=${row.tratamiento}; grupo=${row.grupo}; precio_kg_usd=${precioKgUsd}; precio_lista_usd=${precioListaUsd}; clave_unica=${CONFIG.cultivo}|${CONFIG.semilleroLaboratorio}|${row.nombre}|${row.tratamiento}|${row.grupo}|${row.presentacionEnvase}|${precioListaUsd}`,
      precioInternoManual: precioListaUsd,
      monedaCompra: CONFIG.monedaCompra,
      costoCompra: precioListaUsd,
      porcentajeFlete: CONFIG.porcentajeFlete,
      porcentajeIva: CONFIG.porcentajeIva,
      porcentajeMargen: CONFIG.porcentajeMargen,
      precioVentaFinal: precioUsdConFlete,
      visibleEnSemillasYa: CONFIG.visibleEnSemillasYa,
      activo: CONFIG.activo,
      publicadoWeb: CONFIG.publicadoWeb,
      estado: 'DISPONIBLE'
    };

    const existente = await prisma.productoPrecampania.findFirst({
      where: {
        cultivo: CONFIG.cultivo,
        semilleroLaboratorio: CONFIG.semilleroLaboratorio,
        nombre: row.nombre,
        presentacionEnvase: row.presentacionEnvase,
        costoCompra: precioListaUsd,
        descripcion: { contains: `· ${row.tratamiento} · ${row.grupo} · ${row.presentacionEnvase}` }
      }
    });

    if (existente) {
      await prisma.productoPrecampania.update({ where: { id: existente.id }, data });
      actualizados += 1;
    } else {
      await prisma.productoPrecampania.create({ data });
      creados += 1;
    }
  }

  console.log(`GUASCH ALFALFA SemillasYa: procesados=${PRODUCTOS.length}, creados=${creados}, actualizados=${actualizados}, desactivados=${desactivados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar GUASCH ALFALFA en SemillasYa:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

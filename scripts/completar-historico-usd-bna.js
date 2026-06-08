const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function usdDesdeArs(amountArs, dolar) {
  const monto = Number(amountArs);
  const cotizacion = Number(dolar);
  return Number.isFinite(monto) && Number.isFinite(cotizacion) && cotizacion > 0 ? monto / cotizacion : null;
}

async function main() {
  const rows = await prisma.estadisticaHistorica.findMany({ orderBy: { fecha: 'asc' } });
  const resultado = { revisados: rows.length, actualizados: 0, sinCotizacion: 0 };

  for (const row of rows) {
    const cotizacion = (await prisma.cotizacionDolar.findFirst({
      where: { fecha: row.fecha, fuente: 'BNA' },
      orderBy: { updatedAt: 'desc' }
    }))?.dolarBnaVenta;

    if (!cotizacion) {
      resultado.sinCotizacion += 1;
      continue;
    }

    const data = { dolarBnaVenta: cotizacion };
    if (Number.isFinite(Number(row.ventasArs))) data.ventasUsd = usdDesdeArs(row.ventasArs, cotizacion);

    Object.keys(data).forEach((key) => { if (data[key] == null) delete data[key]; });
    if (!Object.keys(data).length) continue;
    await prisma.estadisticaHistorica.update({ where: { id: row.id }, data });
    resultado.actualizados += 1;
  }

  console.log(JSON.stringify(resultado, null, 2));
}

main()
  .catch((error) => {
    console.error('Error al completar USD histórico con dólar BNA:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

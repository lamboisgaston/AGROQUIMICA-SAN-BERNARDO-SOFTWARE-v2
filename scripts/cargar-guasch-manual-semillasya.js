const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  semilleroLaboratorio: 'GUASCH',
  visibleEnSemillasYa: true,
  activo: true,
  monedaCompra: 'USD',
  porcentajeMargen: 0,
  porcentajeFlete: 10,
  porcentajeIva: 21,
  publicadoWeb: false,
  origen: 'GUASCH_LISTA_2026_05_18'
};

const MAPA_CULTIVOS = new Map([
  ['ACHICORIA', 'ACHICORIA'],
  ['CEBOLLA HIBRIDA', 'CEBOLLA'],
  ['TOMATE HIBRIDO', 'TOMATE'],
  ['MAIZ DULCE HIBRIDO', 'MAÍZ DULCE'],
  ['ZAPALLITO HIBRIDO', 'ZAPALLITO'],
  ['SANDIA HIBRIDA', 'SANDÍA'],
  ['CESPED', 'CÉSPED'],
  ['CESPED', 'CÉSPED']
]);

function normalizarTexto(valor = '') {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizarCultivo(cultivo) {
  const base = normalizarTexto(cultivo);
  return MAPA_CULTIVOS.get(base) || String(cultivo || '').trim().toUpperCase() || 'OTRO';
}

const PRODUCTOS = require('../data/guasch-lista-02-2026.json').productos || [];

function debeDesactivarRegistro(p = {}) {
  const semillero = normalizarTexto(p.semilleroLaboratorio);
  const nombre = normalizarTexto(p.nombre);
  const cultivo = normalizarTexto(p.cultivo || p.categoria);
  const presentacion = normalizarTexto(p.presentacionEnvase);
  const precio = Number(p.costoCompra || 0);

  if (['ARG-AGRO', 'VENTA', 'PRODUCTOS', 'MARCAS'].includes(semillero)) return true;
  if (nombre.includes('ENVIOS') || nombre.includes('TELEFONOS') || nombre.includes('VENTA MINIMA') || nombre.includes('BIENVENIDO')) return true;
  if (cultivo.includes('BIENVENIDO')) return true;
  if (precio === 0 && presentacion === 'NO ESPECIFICADA') return true;
  return false;
}

async function limpiarCatalogoViejo() {
  const activos = await prisma.productoPrecampania.findMany({ where: { activo: true } });
  const ids = activos.filter(debeDesactivarRegistro).map((p) => p.id);
  if (!ids.length) return 0;
  const result = await prisma.productoPrecampania.updateMany({
    where: { id: { in: ids } },
    data: { activo: false, visibleEnSemillasYa: false }
  });
  return result.count;
}

async function main() {
  let creados = 0;
  let actualizados = 0;

  const desactivados = await limpiarCatalogoViejo();

  for (const row of PRODUCTOS) {
    const cultivo = normalizarCultivo(row.cultivo || row.categoria || 'OTRO');
    const nombre = String(row.nombre || '').trim();
    const presentacionEnvase = String(row.presentacionEnvase || '').trim() || 'No especificada';
    const precioListaUsd = Number(row.precioListaUsd || row.precio || 0);
    const precioUsdConFlete = Number((precioListaUsd * 1.10).toFixed(4));

    const data = {
      nombre,
      semilleroLaboratorio: CONFIG.semilleroLaboratorio,
      categoria: cultivo,
      cultivo,
      presentacionEnvase,
      descripcion: `${cultivo} · ${CONFIG.semilleroLaboratorio} · ${nombre} · ${presentacionEnvase}`,
      observacionesComerciales: `origen=${CONFIG.origen}; precio_lista_usd=${precioListaUsd}; precio_usd_con_flete=${precioUsdConFlete}; ganancia_incluida=true`,
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
      where: { cultivo, semilleroLaboratorio: CONFIG.semilleroLaboratorio, nombre, presentacionEnvase }
    });

    if (existente) {
      await prisma.productoPrecampania.update({ where: { id: existente.id }, data });
      actualizados += 1;
    } else {
      await prisma.productoPrecampania.create({ data });
      creados += 1;
    }
  }

  console.log(`GUASCH manual SemillasYa: procesados=${PRODUCTOS.length}, creados=${creados}, actualizados=${actualizados}, desactivados=${desactivados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar GUASCH manual en SemillasYa:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

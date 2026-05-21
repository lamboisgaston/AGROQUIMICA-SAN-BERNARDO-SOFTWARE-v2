const fs = require('fs');
const path = require('path');
const { PrismaClient, TipoReglaComercial } = require('@prisma/client');

const prisma = new PrismaClient();

const PROVEEDOR = 'Semillera Guasch SRL';
const LISTA_NOMBRE = 'GUASCH Lista Nº 02';
const LISTA_CODIGO = 'GUASCH-2026-03-09-N02';
const FECHA_LISTA = new Date('2026-03-09T00:00:00.000Z');
const DATASET_PATH = path.join(__dirname, '..', 'data', 'guasch-lista-02-2026.json');

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizarEstado = (raw, precioUsd) => {
  const v = String(raw || '').trim().toUpperCase();
  if (v === 'CONSULTAR') return 'CONSULTAR';
  if (v === 'AGOTADO') return 'AGOTADO';
  if (v === 'SIN STOCK' || v === 'SIN_STOCK') return 'SIN_STOCK';
  return Number(precioUsd) > 0 ? 'DISPONIBLE' : 'SIN_PRECIO';
};

function calcular(precioUsd, tipoCambio) {
  const precioPesos = round(precioUsd * tipoCambio);
  const conFlete = round(precioPesos * 1.07);
  const precioFinal = round(conFlete * 1.21);
  const margen20 = round(precioFinal * 0.2);
  return { precioPesos, conFlete, precioFinal, margen20 };
}

function cargarCatalogo() {
  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  const json = JSON.parse(raw);
  if (!Array.isArray(json.productos) || json.productos.length === 0) {
    throw new Error('data/guasch-lista-02-2026.json no contiene productos válidos.');
  }
  return json;
}

async function main() {
  const cfg = await prisma.configuracionGlobal.findUnique({ where: { id: 1 } });
  const tipoCambio = Number(cfg?.tipoCambioActual || 0);
  if (!tipoCambio || tipoCambio <= 0) throw new Error('tipoCambioActual inválido en ConfiguracionGlobal.id=1');

  const catalogo = cargarCatalogo();
  const productos = catalogo.productos;

  const proveedor = await prisma.empresaComercial.upsert({ where: { nombre: PROVEEDOR }, update: { activo: true }, create: { nombre: PROVEEDOR, activo: true } });
  const existente = await prisma.listaComercial.findFirst({ where: { codigo: LISTA_CODIGO }, select: { id: true } });
  const lista = await prisma.listaComercial.upsert({
    where: { id: existente?.id || -1 },
    update: { empresaComercialId: proveedor.id, nombre: LISTA_NOMBRE, codigo: LISTA_CODIGO, moneda: 'USD', vigenteDesde: FECHA_LISTA, activa: true },
    create: { empresaComercialId: proveedor.id, nombre: LISTA_NOMBRE, codigo: LISTA_CODIGO, moneda: 'USD', vigenteDesde: FECHA_LISTA, activa: true }
  });

  await prisma.reglaComercialLista.deleteMany({ where: { listaComercialId: lista.id } });
  await prisma.reglaComercialLista.createMany({ data: [
    { listaComercialId: lista.id, nombre: 'Flete GUASCH', tipo: TipoReglaComercial.FLETE_PORCENTAJE, valor: 7, orden: 10 },
    { listaComercialId: lista.id, nombre: 'IVA GUASCH', tipo: TipoReglaComercial.IVA_PORCENTAJE, valor: 21, orden: 20 },
    { listaComercialId: lista.id, nombre: 'Margen promoción objetivo', tipo: TipoReglaComercial.MARGEN_PORCENTAJE, valor: 20, orden: 30 }
  ] });

  await prisma.productoListaComercial.deleteMany({ where: { listaComercialId: lista.id } });

  const auditoria = { total: 0, porCategoria: {}, conPrecio: 0, consultar: 0, agotado: 0, sinStock: 0, sinPrecio: 0 };

  for (const p of productos) {
    const precioUsd = Number(p.precioUsd || 0);
    const estado = normalizarEstado(p.estado, precioUsd);
    const disponible = estado === 'DISPONIBLE' && precioUsd > 0;
    const calc = disponible ? calcular(precioUsd, tipoCambio) : null;

    auditoria.total += 1;
    auditoria.porCategoria[p.categoria] = (auditoria.porCategoria[p.categoria] || 0) + 1;
    if (disponible) auditoria.conPrecio += 1;
    if (estado === 'CONSULTAR') auditoria.consultar += 1;
    if (estado === 'AGOTADO') auditoria.agotado += 1;
    if (estado === 'SIN_STOCK') auditoria.sinStock += 1;
    if (!disponible) auditoria.sinPrecio += 1;

    const metadataOriginal = {
      pagina: p.pagina ?? null,
      categoria: p.categoria,
      subcategoria: p.subcategoria || null,
      nombreProducto: p.nombreProducto,
      envase: p.envase || null,
      caracteristicas: p.caracteristicas || null,
      precioUsd: disponible ? precioUsd : null,
      estado,
      precioFinal: calc?.precioFinal ?? null,
      calculo: calc
    };

    await prisma.productoListaComercial.create({
      data: {
        listaComercialId: lista.id,
        nombreProducto: p.nombreProducto,
        skuExterno: `GUASCH|${Buffer.from(JSON.stringify(metadataOriginal)).toString('base64')}`,
        unidad: p.envase || null,
        precioNeto: calc?.precioFinal || 0,
        precioSugeridoPublico: calc?.precioFinal || null,
        ivaPorcentaje: 21,
        fletePorcentaje: 7,
        margenPorcentaje: calc?.margen20 || 0,
        moneda: 'ARS',
        activo: true
      }
    });
  }

  await prisma.listaComercial.update({
    where: { id: lista.id },
    data: {
      metadata: JSON.stringify({
        tipo: 'PRECAMPAÑA', fuente: catalogo.fuente || 'Lista comercial GUASCH N° 02', fecha: catalogo.fecha || '2026-03-09',
        base: 'USD', tipoCambioReferencia: 'dólar billete BNA vendedor', auditoria
      })
    }
  });

  console.log('Importación GUASCH completada.');
  console.log(`total productos importados: ${auditoria.total}`);
  console.log(`total por categoría: ${JSON.stringify(auditoria.porCategoria)}`);
  console.log(`productos con precio: ${auditoria.conPrecio}`);
  console.log(`productos CONSULTAR: ${auditoria.consultar}`);
  console.log(`productos AGOTADO: ${auditoria.agotado}`);
  console.log(`productos sin precio: ${auditoria.sinPrecio}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});

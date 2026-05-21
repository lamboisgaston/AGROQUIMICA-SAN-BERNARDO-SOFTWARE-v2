const { PrismaClient, TipoReglaComercial } = require('@prisma/client');

const prisma = new PrismaClient();

const PROVEEDOR = 'Semillera Guasch SRL';
const LISTA_NOMBRE = 'GUASCH Lista Nº 02';
const LISTA_CODIGO = 'GUASCH-2026-03-09-N02';
const FECHA_LISTA = new Date('2026-03-09T00:00:00.000Z');

const PRODUCTOS = [
  { categoria: 'Pasturas/Alfalfas', nombre: 'Brava', variedadTipo: 'Alfalfa', origen: 'Argentina', tratamiento: 'MVPro / MVPlus', caracteristicas: 'Inoculante + Fungicida', presentacion: '25 Kg', precioUsd: 10.31 },
  { categoria: 'Pasturas/Alfalfas', nombre: 'Armona', variedadTipo: 'Alfalfa', origen: 'Argentina', tratamiento: 'MVPro / MVPlus', caracteristicas: 'Inoculante + Fungicida', presentacion: '25 Kg', precioUsd: 9.07 },
  { categoria: 'Pasturas/Alfalfas', nombre: 'Pampa Flor', variedadTipo: 'Alfalfa', origen: 'Argentina', tratamiento: 'MVPro / MVPlus', caracteristicas: 'Inoculante + Fungicida', presentacion: '25 Kg', precioUsd: 8.46 },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Agropiro Alargado', variedadTipo: 'Gramínea templada', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Dens. siembra 20-25 Kg/Ha', presentacion: '20 Kg', precioUsd: 3.85 },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Cebadilla Criolla Don Humberto', variedadTipo: 'Gramínea templada', origen: 'Argentina', tratamiento: 'MVBiz', caracteristicas: 'Despuntada', presentacion: '25 Kg', precioUsd: 2.05 },
  { categoria: 'Tréboles', nombre: 'Trébol de Olor Amarillo', variedadTipo: 'Melilotus officinalis', origen: 'Argentina', tratamiento: 'MVPro', caracteristicas: 'Trébol Madrid', presentacion: '25 Kg', precioUsd: 6.65 },
  { categoria: 'Verdeos Invernales', nombre: 'Avena Blanca Bonaerense INTA Calen', variedadTipo: 'Avena sativa', origen: 'Argentina', tratamiento: 'Std', caracteristicas: '-', presentacion: '40 Kg', precioUsd: 0.46 },
  { categoria: 'Cultivos Extensivos/Sorgo Granífero Híbrido', nombre: 'Mistral CT120 Nueva Campaña', variedadTipo: 'Sorgo granífero', origen: 'Argentina', tratamiento: 'MaximQuattro', caracteristicas: 'Con tanino', presentacion: 'Bolsa 20 Kg', precioUsd: 109.0 },
  { categoria: 'Cultivos Extensivos/Maíz', nombre: 'Amancay INTA C2', variedadTipo: 'Maíz', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Flint colorado duro, OP libre OGM', presentacion: 'Bolsa 72.000 semillas', precioUsd: 59.0 },
  { categoria: 'Cultivos Extensivos/Specialities Crops', nombre: 'Alpiste', variedadTipo: 'Phalaris canariensis', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Dens. siembra aprox. 40 Kg/Ha', presentacion: '25 Kg', precioUsd: 2.0 },
  { categoria: 'Inoculantes', nombre: 'Zaden Vicia-Tb', variedadTipo: 'Inoculante para Vicia/Arveja/Lenteja', origen: 'Argentina', tratamiento: '-', caracteristicas: 'Envase 200 gr', presentacion: 'Envase 200 gr', precioUsd: 3.95 },
  { categoria: 'Hortalizas/Acelga', nombre: 'Verde Penca Blanca Ancha', variedadTipo: 'Acelga', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Anual, pencas blancas anchas', presentacion: 'Doypack 150 gr', precioUsd: 2.55 },
  { categoria: 'Hortalizas/Cebolla', nombre: 'Roja Chata de Italia', variedadTipo: 'Cebolla', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Doble propósito verdeo/bulbo', presentacion: 'Lata 250 gr', precioUsd: 21.7 },
  { categoria: 'Hortalizas/Perejil', nombre: 'Común Hojas Lisas', variedadTipo: 'Perejil', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Muy aromático', presentacion: 'Doypack 250 gr', precioUsd: 3.65 },
  { categoria: 'Hortalizas/Pimiento', nombre: 'Jalapeño M', variedadTipo: 'Pimiento', origen: 'USA', tratamiento: 'Thiram', caracteristicas: 'Picante, ají chili', presentacion: 'Lata 100 gr', precioUsd: 28.14 },
  { categoria: 'Césped Profesional/Bermuda', nombre: 'Bermuda Grass Unhulled', variedadTipo: 'Cynodon dactylon', origen: 'USA', tratamiento: 'MVBiz', caracteristicas: 'Resiste calor/sequía', presentacion: 'Alubag 100 gr', precioUsd: 21.7 },
  { categoria: 'Césped Profesional/Festuca', nombre: 'Festuca Belfine', variedadTipo: 'Festuca arundinacea', origen: 'Argentina', tratamiento: 'MVBiz', caracteristicas: 'Lawn type', presentacion: 'Bolsa 25 Kg', precioUsd: 4.2 },
  { categoria: 'Césped Blends', nombre: 'Mustang Grass Mix', variedadTipo: 'Blend', origen: 'Argentina', tratamiento: '-', caracteristicas: '4 componentes', presentacion: 'Bolsa 25 Kg', precioUsd: 4.15 },
  { categoria: 'Semillas en Sobres', nombre: 'Colec. Flornova', variedadTipo: 'Flores y hortalizas en sobres', origen: 'Argentina', tratamiento: '-', caracteristicas: 'Precio por sobre', presentacion: 'Sobre', precioUsd: 2.6 },

  { categoria: 'Pasturas/Gramíneas', nombre: 'Falaris Bulbosa', estado: 'CONSULTAR', presentacion: '25 Kg' },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Pasto Llorón', estado: 'CONSULTAR', presentacion: '25 Kg' },
  { categoria: 'Tréboles', nombre: 'Trébol de Olor Blanco', estado: 'CONSULTAR', presentacion: '25 Kg' },
  { categoria: 'Gramíneas Subtropicales', nombre: 'Buffel Grass Texas', estado: 'CONSULTAR', presentacion: '10 Kg' },
  { categoria: 'Hortalizas/Achicoria', nombre: 'Hoja Ancha Doble Blonde', estado: 'AGOTADO', presentacion: 'Lata 200 gr' },
  { categoria: 'Hortalizas/Lechuga', nombre: 'Maravilla de Verano', estado: 'AGOTADO', presentacion: 'Lata 250 gr' },
  { categoria: 'Césped Profesional/Dichondra', nombre: 'Dichondra', estado: 'AGOTADO', presentacion: 'Alubag 1 Kg' },
  { categoria: 'Césped Profesional/Bermuda', nombre: 'Bermuda Grass Unhulled Bolsa 10Kg', estado: 'CONSULTAR', presentacion: 'Bolsa 10 Kg' }
];

function round(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function normalizarEstado(raw) {
  const v = String(raw || '').trim().toUpperCase();
  if (v === 'CONSULTAR') return 'CONSULTAR';
  if (v === 'AGOTADO') return 'AGOTADO';
  if (v === 'SIN STOCK' || v === 'SIN_STOCK') return 'SIN_STOCK';
  return 'DISPONIBLE';
}

function calcular(precioUsd, tipoCambio) {
  const precioPesos = round(precioUsd * tipoCambio);
  const conFlete = round(precioPesos * 1.07);
  const precioFinal = round(conFlete * 1.21);
  const gananciaObjetivo = round(precioFinal * 0.2);
  return { precioPesos, conFlete, precioFinal, gananciaObjetivo };
}

async function main() {
  const cfg = await prisma.configuracionGlobal.findUnique({ where: { id: 1 } });
  const tipoCambio = Number(cfg?.tipoCambioActual || 0);
  if (!tipoCambio || tipoCambio <= 0) throw new Error('tipoCambioActual inválido en ConfiguracionGlobal.id=1');

  const proveedor = await prisma.empresaComercial.upsert({
    where: { nombre: PROVEEDOR },
    update: { activo: true },
    create: { nombre: PROVEEDOR, activo: true }
  });

  const lista = await prisma.listaComercial.upsert({
    where: { id: (await prisma.listaComercial.findFirst({ where: { codigo: LISTA_CODIGO }, select: { id: true } }))?.id || -1 },
    update: {
      empresaComercialId: proveedor.id,
      nombre: LISTA_NOMBRE,
      codigo: LISTA_CODIGO,
      moneda: 'USD',
      vigenteDesde: FECHA_LISTA,
      activa: true,
      metadata: JSON.stringify({ tipo: 'PRECAMPAÑA', fuente: 'Lista comercial GUASCH N° 02', fecha: '09/03/2026', base: 'USD', tipoCambioReferencia: 'dólar billete BNA vendedor' })
    },
    create: {
      empresaComercialId: proveedor.id,
      nombre: LISTA_NOMBRE,
      codigo: LISTA_CODIGO,
      moneda: 'USD',
      vigenteDesde: FECHA_LISTA,
      activa: true,
      metadata: JSON.stringify({ tipo: 'PRECAMPAÑA', fuente: 'Lista comercial GUASCH N° 02', fecha: '09/03/2026', base: 'USD', tipoCambioReferencia: 'dólar billete BNA vendedor' })
    }
  });

  await prisma.reglaComercialLista.deleteMany({ where: { listaComercialId: lista.id } });
  await prisma.reglaComercialLista.createMany({ data: [
    { listaComercialId: lista.id, nombre: 'Flete GUASCH', tipo: TipoReglaComercial.FLETE_PORCENTAJE, valor: 7, orden: 10 },
    { listaComercialId: lista.id, nombre: 'IVA GUASCH', tipo: TipoReglaComercial.IVA_PORCENTAJE, valor: 21, orden: 20 },
    { listaComercialId: lista.id, nombre: 'Margen promoción objetivo', tipo: TipoReglaComercial.MARGEN_PORCENTAJE, valor: 20, orden: 30 }
  ] });

  await prisma.productoListaComercial.deleteMany({ where: { listaComercialId: lista.id } });

  for (const p of PRODUCTOS) {
    const estado = normalizarEstado(p.estado);
    const precioUsd = Number(p.precioUsd || 0);
    const tienePrecio = estado === 'DISPONIBLE' && precioUsd > 0;
    const calc = tienePrecio ? calcular(precioUsd, tipoCambio) : null;
    const trazabilidad = tienePrecio
      ? `USD ${precioUsd} -> TC ${tipoCambio} = ${calc.precioPesos} -> +7%=${calc.conFlete} -> +21%=${calc.precioFinal} -> margen20%=${calc.gananciaObjetivo}`
      : `SIN PRECIO (${estado})`;

    await prisma.productoListaComercial.create({
      data: {
        listaComercialId: lista.id,
        nombreProducto: p.variedadTipo ? `${p.nombre} | ${p.variedadTipo}` : p.nombre,
        skuExterno: `GUASCH|estado=${estado}|cat=${p.categoria || '-'}|origen=${p.origen || '-'}|trat=${p.tratamiento || '-'}|car=${p.caracteristicas || '-'}|trace=${trazabilidad}`,
        unidad: p.presentacion || null,
        precioNeto: calc?.precioFinal || 0,
        precioSugeridoPublico: calc?.precioFinal || null,
        ivaPorcentaje: 21,
        fletePorcentaje: 7,
        margenPorcentaje: calc?.gananciaObjetivo || 0,
        moneda: 'ARS',
        activo: true
      }
    });
  }

  console.log(`Importación GUASCH completada. Lista #${lista.id}. Productos: ${PRODUCTOS.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});

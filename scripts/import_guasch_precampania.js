const { PrismaClient, TipoReglaComercial } = require('@prisma/client');

const prisma = new PrismaClient();

const PROVEEDOR = 'Semillera Guasch SRL';
const LISTA_NOMBRE = 'GUASCH Lista Nº 02';
const LISTA_CODIGO = 'GUASCH-2026-03-09-N02';
const FECHA_LISTA = new Date('2026-03-09T00:00:00.000Z');

const PRODUCTOS = [
  { categoria: 'Pasturas', subcategoria: 'Alfalfas', nombreProducto: 'Brava', variedadTipo: 'Alfalfa', clase: 'Forrajera', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MVPro / MVPlus', caracteristicas: 'Inoculante + Fungicida', envase: '25 Kg', precioUsd: 10.31 },
  { categoria: 'Pasturas', subcategoria: 'Alfalfas', nombreProducto: 'Armona', variedadTipo: 'Alfalfa', clase: 'Forrajera', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MVPro / MVPlus', caracteristicas: 'Inoculante + Fungicida', envase: '25 Kg', precioUsd: 9.07 },
  { categoria: 'Pasturas', subcategoria: 'Alfalfas', nombreProducto: 'Pampa Flor', variedadTipo: 'Alfalfa', clase: 'Forrajera', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MVPro / MVPlus', caracteristicas: 'Inoculante + Fungicida', envase: '25 Kg', precioUsd: 8.46 },
  { categoria: 'Pasturas', subcategoria: 'Gramíneas Forrajeras Templadas', nombreProducto: 'Agropiro Alargado', variedadTipo: 'Gramínea templada', clase: 'Pastura', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Dens. siembra 20-25 Kg/Ha', envase: '20 Kg', precioUsd: 3.85 },
  { categoria: 'Pasturas', subcategoria: 'Gramíneas Forrajeras Templadas', nombreProducto: 'Cebadilla Criolla Don Humberto', variedadTipo: 'Gramínea templada', clase: 'Pastura', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MVBiz', caracteristicas: 'Despuntada', envase: '25 Kg', precioUsd: 2.05 },
  { categoria: 'Tréboles', subcategoria: 'Tréboles', nombreProducto: 'Trébol de Olor Amarillo', variedadTipo: 'Melilotus officinalis', clase: 'Leguminosa', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MVPro', caracteristicas: 'Trébol Madrid', envase: '25 Kg', precioUsd: 6.65 },
  { categoria: 'Verdeos Invernales', subcategoria: 'Verdeos Invernales', nombreProducto: 'Avena Blanca Bonaerense INTA Calen', variedadTipo: 'Avena sativa', clase: 'Verdeo', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: '-', envase: '40 Kg', precioUsd: 0.46 },
  { categoria: 'Cultivos Extensivos', subcategoria: 'Sorgos Forrajeros Híbridos', nombreProducto: 'Mistral CT120 Nueva Campaña', variedadTipo: 'Sorgo granífero', clase: 'Híbrido', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MaximQuattro', caracteristicas: 'Con tanino', envase: 'Bolsa 20 Kg', precioUsd: 109 },
  { categoria: 'Cultivos Extensivos', subcategoria: 'Maíz', nombreProducto: 'Amancay INTA C2', variedadTipo: 'Maíz', clase: 'OP libre OGM', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Flint colorado duro', envase: 'Bolsa 72.000 semillas', precioUsd: 59 },
  { categoria: 'Cultivos Extensivos', subcategoria: 'Specialities Crops', nombreProducto: 'Alpiste', variedadTipo: 'Phalaris canariensis', clase: 'Especialidad', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Dens. siembra aprox. 40 Kg/Ha', envase: '25 Kg', precioUsd: 2 },
  { categoria: 'Inoculantes', subcategoria: 'Inoculantes', nombreProducto: 'Zaden Vicia-Tb', variedadTipo: 'Inoculante para Vicia/Arveja/Lenteja', clase: 'Biológico', marca: 'Guasch', origen: 'Argentina', tratamiento: '-', caracteristicas: 'Envase 200 gr', envase: 'Envase 200 gr', precioUsd: 3.95 },
  { categoria: 'Hortícolas', subcategoria: 'Acelga', nombreProducto: 'Verde Penca Blanca Ancha', variedadTipo: 'Acelga', clase: 'Hortícola', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Anual, pencas blancas anchas', envase: 'Doypack 150 gr', precioUsd: 2.55 },
  { categoria: 'Hortícolas', subcategoria: 'Cebolla', nombreProducto: 'Roja Chata de Italia', variedadTipo: 'Cebolla', clase: 'Hortícola', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Doble propósito verdeo/bulbo', envase: 'Lata 250 gr', precioUsd: 21.7 },
  { categoria: 'Hortícolas', subcategoria: 'Perejil', nombreProducto: 'Común Hojas Lisas', variedadTipo: 'Perejil', clase: 'Hortícola', marca: 'Guasch', origen: 'Argentina', tratamiento: 'Std', caracteristicas: 'Muy aromático', envase: 'Doypack 250 gr', precioUsd: 3.65 },
  { categoria: 'Hortícolas', subcategoria: 'Pimiento', nombreProducto: 'Jalapeño M', variedadTipo: 'Pimiento', clase: 'Hortícola', marca: 'Guasch', origen: 'USA', tratamiento: 'Thiram', caracteristicas: 'Picante, ají chili', envase: 'Lata 100 gr', precioUsd: 28.14 },
  { categoria: 'Césped Profesional', subcategoria: 'Bermuda', nombreProducto: 'Bermuda Grass Unhulled', variedadTipo: 'Cynodon dactylon', clase: 'Césped', marca: 'Guasch', origen: 'USA', tratamiento: 'MVBiz', caracteristicas: 'Resiste calor/sequía', envase: 'Alubag 100 gr', precioUsd: 21.7 },
  { categoria: 'Césped Profesional', subcategoria: 'Festuca', nombreProducto: 'Festuca Belfine', variedadTipo: 'Festuca arundinacea', clase: 'Césped', marca: 'Guasch', origen: 'Argentina', tratamiento: 'MVBiz', caracteristicas: 'Lawn type', envase: 'Bolsa 25 Kg', precioUsd: 4.2 },
  { categoria: 'GS Césped Blends & Mixs', subcategoria: 'Blends', nombreProducto: 'Mustang Grass Mix', variedadTipo: 'Blend', clase: 'Césped', marca: 'GS', origen: 'Argentina', tratamiento: '-', caracteristicas: '4 componentes', envase: 'Bolsa 25 Kg', precioUsd: 4.15 },
  { categoria: 'Sobres Huerta & Jardín', subcategoria: 'Sobres', nombreProducto: 'Colec. Flornova', variedadTipo: 'Flores y hortalizas en sobres', clase: 'Sobre', marca: 'Guasch', origen: 'Argentina', tratamiento: '-', caracteristicas: 'Precio por sobre', envase: 'Sobre', precioUsd: 2.6 },

  { categoria: 'Pasturas', subcategoria: 'Gramíneas Forrajeras Templadas', nombreProducto: 'Falaris Bulbosa', estado: 'CONSULTAR', envase: '25 Kg' },
  { categoria: 'Pasturas', subcategoria: 'Gramíneas Forrajeras Templadas', nombreProducto: 'Pasto Llorón', estado: 'CONSULTAR', envase: '25 Kg' },
  { categoria: 'Tréboles', subcategoria: 'Tréboles', nombreProducto: 'Trébol de Olor Blanco', estado: 'CONSULTAR', envase: '25 Kg' },
  { categoria: 'Gramíneas Forrajeras Subtropicales', subcategoria: 'Subtropicales', nombreProducto: 'Buffel Grass Texas', estado: 'CONSULTAR', envase: '10 Kg' },
  { categoria: 'Hortícolas', subcategoria: 'Achicoria', nombreProducto: 'Hoja Ancha Doble Blonde', estado: 'AGOTADO', envase: 'Lata 200 gr' },
  { categoria: 'Hortícolas', subcategoria: 'Lechuga', nombreProducto: 'Maravilla de Verano', estado: 'AGOTADO', envase: 'Lata 250 gr' },
  { categoria: 'Césped Profesional', subcategoria: 'Dichondra', nombreProducto: 'Dichondra', estado: 'AGOTADO', envase: 'Alubag 1 Kg' },
  { categoria: 'Césped Profesional', subcategoria: 'Bermuda', nombreProducto: 'Bermuda Grass Unhulled Bolsa 10Kg', estado: 'CONSULTAR', envase: 'Bolsa 10 Kg' }
];

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

async function main() {
  const cfg = await prisma.configuracionGlobal.findUnique({ where: { id: 1 } });
  const tipoCambio = Number(cfg?.tipoCambioActual || 0);
  if (!tipoCambio || tipoCambio <= 0) throw new Error('tipoCambioActual inválido en ConfiguracionGlobal.id=1');

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
  const categoriaOrdenMap = new Map();
  const subcategoriaOrdenMap = new Map();

  for (const [idx, p] of PRODUCTOS.entries()) {
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

    if (!categoriaOrdenMap.has(p.categoria)) categoriaOrdenMap.set(p.categoria, categoriaOrdenMap.size + 1);
    const subKey = `${p.categoria}::${p.subcategoria || ''}`;
    if (!subcategoriaOrdenMap.has(subKey)) subcategoriaOrdenMap.set(subKey, subcategoriaOrdenMap.size + 1);

    const metadataOriginal = {
      categoria: p.categoria,
      subcategoria: p.subcategoria || null,
      nombreProducto: p.nombreProducto,
      variedadTipo: p.variedadTipo || null,
      clase: p.clase || null,
      marca: p.marca || null,
      origen: p.origen || null,
      tratamiento: p.tratamiento || null,
      caracteristicas: p.caracteristicas || null,
      envase: p.envase || null,
      precioUsd: disponible ? precioUsd : null,
      estado,
      categoriaOrden: Number(p.categoriaOrden || categoriaOrdenMap.get(p.categoria)),
      subcategoriaOrden: Number(p.subcategoriaOrden || subcategoriaOrdenMap.get(subKey)),
      ordenCatalogo: Number(p.ordenCatalogo || (idx + 1)),
      precioFinal: calc?.precioFinal ?? null,
      calculo: calc
    };

    await prisma.productoListaComercial.create({
      data: {
        listaComercialId: lista.id,
        nombreProducto: [p.nombreProducto, p.variedadTipo].filter(Boolean).join(' | '),
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
        tipo: 'PRECAMPAÑA', fuente: 'Lista comercial GUASCH N° 02', fecha: '09/03/2026',
        base: 'USD', tipoCambioReferencia: 'dólar billete BNA vendedor', auditoria
      })
    }
  });

  console.log('Importación GUASCH completada.');
  console.log(JSON.stringify(auditoria, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});

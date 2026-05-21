const { PrismaClient, TipoReglaComercial } = require('@prisma/client');

const prisma = new PrismaClient();

const LISTA_COMERCIAL_ID = 1;
const PROVEEDOR = 'Semillera Guasch SRL';
const FECHA_FUENTE = '2026-03-09';

const PRODUCTOS_GUASCH = [
  { categoria: 'Pasturas/Alfalfas', nombre: 'Brava', presentacion: '25 Kg', precioUsd: 10.31 },
  { categoria: 'Pasturas/Alfalfas', nombre: 'Armona', presentacion: '25 Kg', precioUsd: 9.07 },
  { categoria: 'Pasturas/Alfalfas', nombre: 'Pampa Flor', presentacion: '25 Kg', precioUsd: 8.46 },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Agropiro Alargado', presentacion: '20 Kg', precioUsd: 3.85 },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Cebadilla Criolla Don Humberto', presentacion: '25 Kg', precioUsd: 2.05 },
  { categoria: 'Tréboles', nombre: 'Trébol de Olor Amarillo', presentacion: '25 Kg', precioUsd: 6.65 },
  { categoria: 'Verdeos Invernales', nombre: 'Avena Blanca Bonaerense INTA Calen', presentacion: '40 Kg', precioUsd: 0.46 },
  { categoria: 'Cultivos Extensivos/Sorgo Granífero Híbrido', nombre: 'Mistral CT120 Nueva Campaña', presentacion: 'Bolsa 20 Kg', precioUsd: 109.0 },
  { categoria: 'Cultivos Extensivos/Maíz', nombre: 'Amancay INTA C2', presentacion: 'Bolsa 72.000 semillas', precioUsd: 59.0 },
  { categoria: 'Cultivos Extensivos/Specialities Crops', nombre: 'Alpiste', presentacion: '25 Kg', precioUsd: 2.0 },
  { categoria: 'Inoculantes', nombre: 'Zaden Vicia-Tb', presentacion: 'Envase 200 gr', precioUsd: 3.95 },
  { categoria: 'Hortalizas/Acelga', nombre: 'Verde Penca Blanca Ancha', presentacion: 'Doypack 150 gr', precioUsd: 2.55 },
  { categoria: 'Hortalizas/Cebolla', nombre: 'Roja Chata de Italia', presentacion: 'Lata 250 gr', precioUsd: 21.7 },
  { categoria: 'Hortalizas/Perejil', nombre: 'Común Hojas Lisas', presentacion: 'Doypack 250 gr', precioUsd: 3.65 },
  { categoria: 'Hortalizas/Pimiento', nombre: 'Jalapeño M', presentacion: 'Lata 100 gr', precioUsd: 28.14 },
  { categoria: 'Césped Profesional/Bermuda', nombre: 'Bermuda Grass Unhulled', presentacion: 'Alubag 100 gr', precioUsd: 21.7 },
  { categoria: 'Césped Profesional/Festuca', nombre: 'Festuca Belfine', presentacion: 'Bolsa 25 Kg', precioUsd: 4.2 },
  { categoria: 'Césped Blends', nombre: 'Mustang Grass Mix', presentacion: 'Bolsa 25 Kg', precioUsd: 4.15 },
  { categoria: 'Semillas en Sobres', nombre: 'Colec. Flornova', presentacion: 'Sobre', precioUsd: 2.6 },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Falaris Bulbosa', presentacion: '25 Kg', estado: 'Consultar' },
  { categoria: 'Pasturas/Gramíneas', nombre: 'Pasto Llorón', presentacion: '25 Kg', estado: 'Consultar' },
  { categoria: 'Tréboles', nombre: 'Trébol de Olor Blanco', presentacion: '25 Kg', estado: 'Consultar' },
  { categoria: 'Gramíneas Subtropicales', nombre: 'Buffel Grass Texas', presentacion: '10 Kg', estado: 'Consultar' },
  { categoria: 'Hortalizas/Achicoria', nombre: 'Hoja Ancha Doble Blonde', presentacion: 'Lata 200 gr', estado: 'Agotado' },
  { categoria: 'Hortalizas/Lechuga', nombre: 'Maravilla de Verano', presentacion: 'Lata 250 gr', estado: 'Agotado' },
  { categoria: 'Césped Profesional/Dichondra', nombre: 'Dichondra', presentacion: 'Alubag 1 Kg', estado: 'Agotado' },
  { categoria: 'Césped Profesional/Bermuda', nombre: 'Bermuda Grass Unhulled Bolsa 10Kg', presentacion: 'Bolsa 10 Kg', estado: 'Sin Stock' }
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function normalizarEstado(estado, precioUsd) {
  const raw = String(estado || '').trim().toUpperCase();
  if (raw === 'CONSULTAR') return 'CONSULTAR';
  if (raw === 'AGOTADO') return 'AGOTADO';
  if (raw === 'SIN STOCK' || raw === 'SIN_STOCK') return 'SIN_STOCK';
  return Number(precioUsd) > 0 ? 'DISPONIBLE' : 'CONSULTAR';
}

function calcularPrecioFinal(precioUsd, tipoCambio) {
  const precioPesos = round2(precioUsd * tipoCambio);
  const conFlete = round2(precioPesos * 1.07);
  const conIva = round2(conFlete * 1.21);
  const gananciaObjetivo = round2(conIva * 0.2);
  return { precioPesos, conFlete, precioFinal: conIva, gananciaObjetivo };
}

async function main() {
  const lista = await prisma.listaComercial.findUnique({ where: { id: LISTA_COMERCIAL_ID } });
  if (!lista) {
    throw new Error(`No existe ListaComercial.id=${LISTA_COMERCIAL_ID}. Primero crear la lista comercial.`);
  }

  const cfg = await prisma.configuracionGlobal.findUnique({ where: { id: 1 } });
  const tipoCambio = Number(cfg?.tipoCambioActual || 0);
  if (!tipoCambio || tipoCambio <= 0) {
    throw new Error('ConfiguracionGlobal.id=1.tipoCambioActual inválido.');
  }

  const proveedor = await prisma.empresaComercial.upsert({
    where: { nombre: PROVEEDOR },
    update: { activo: true },
    create: { nombre: PROVEEDOR, activo: true }
  });

  await prisma.listaComercial.update({
    where: { id: LISTA_COMERCIAL_ID },
    data: {
      empresaComercialId: proveedor.id,
      moneda: 'USD',
      vigenteDesde: new Date(`${FECHA_FUENTE}T00:00:00.000Z`),
      metadata: JSON.stringify({
        fuente: 'GUASCH PDF/imagenes analizadas',
        fechaFuente: FECHA_FUENTE,
        tipoCambioUsado: tipoCambio
      })
    }
  });

  await prisma.reglaComercialLista.deleteMany({ where: { listaComercialId: LISTA_COMERCIAL_ID } });
  await prisma.reglaComercialLista.createMany({
    data: [
      { listaComercialId: LISTA_COMERCIAL_ID, nombre: 'Flete 7%', tipo: TipoReglaComercial.FLETE_PORCENTAJE, valor: 7, orden: 10 },
      { listaComercialId: LISTA_COMERCIAL_ID, nombre: 'IVA 21%', tipo: TipoReglaComercial.IVA_PORCENTAJE, valor: 21, orden: 20 },
      { listaComercialId: LISTA_COMERCIAL_ID, nombre: 'Ganancia objetivo 20%', tipo: TipoReglaComercial.MARGEN_PORCENTAJE, valor: 20, orden: 30 }
    ]
  });

  await prisma.productoListaComercial.deleteMany({ where: { listaComercialId: LISTA_COMERCIAL_ID } });

  for (const p of PRODUCTOS_GUASCH) {
    const estado = normalizarEstado(p.estado, p.precioUsd);
    const precioUsd = Number(p.precioUsd || 0);
    const calculo = estado === 'DISPONIBLE' ? calcularPrecioFinal(precioUsd, tipoCambio) : null;

    const metadataOriginal = {
      nombre: p.nombre,
      categoria: p.categoria,
      presentacion: p.presentacion,
      precioUsd: precioUsd || null,
      estado,
      precioFinal: calculo?.precioFinal ?? null,
      calculo: calculo ?? null
    };

    await prisma.productoListaComercial.create({
      data: {
        listaComercialId: LISTA_COMERCIAL_ID,
        nombreProducto: p.nombre,
        unidad: p.presentacion || null,
        precioNeto: calculo?.precioFinal ?? 0,
        precioSugeridoPublico: calculo?.precioFinal ?? null,
        ivaPorcentaje: 21,
        fletePorcentaje: 7,
        margenPorcentaje: 20,
        moneda: 'ARS',
        activo: true,
        skuExterno: `GUASCH|${Buffer.from(JSON.stringify(metadataOriginal)).toString('base64')}`
      }
    });
  }

  console.log(`Importación GUASCH OK. Lista ${LISTA_COMERCIAL_ID}. Productos: ${PRODUCTOS_GUASCH.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

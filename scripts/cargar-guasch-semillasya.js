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

const PRODUCTOS = [
  ['ALFALFA', 'Brava', 'Bolsa 25 kg', 297.83],
  ['ALFALFA', 'Armona', 'Bolsa 25 kg', 270.60],
  ['ALFALFA', 'Pampa Flor', 'Bolsa 25 kg', 256.03],
  ['ALFALFA', 'Vector', 'Bolsa 25 kg', 297.83],
  ['ALFALFA', 'Sirosal', 'Bolsa 25 kg', 294.53],
  ['ALFALFA', 'CUF 101', 'Bolsa 25 kg', 264.83],
  ['ALFALFA', 'Aurora', 'Bolsa 25 kg', 256.03],
  ['GRAMÍNEAS / PASTURAS', 'Agropiro Alargado', 'Bolsa 20 kg', 84.70],
  ['GRAMÍNEAS / PASTURAS', 'Cebadilla Criolla Don Humberto', 'Bolsa 25 kg', 56.38],
  ['GRAMÍNEAS / PASTURAS', 'Festuca Alta Vegas', 'Bolsa 25 kg', 115.50],
  ['GRAMÍNEAS / PASTURAS', 'Pasto Ovillo Amba', 'Bolsa 25 kg', 167.75],
  ['GRAMÍNEAS / PASTURAS', 'Raigrás Anual Tetraploide Macho', 'Bolsa 25 kg', 53.63],
  ['GRAMÍNEAS / PASTURAS', 'Raigrás Anual LE 284', 'Bolsa 25 kg', 48.13],
  ['GRAMÍNEAS / PASTURAS', 'Raigrás Perenne Córdoba', 'Bolsa 25 kg', 103.13],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Acelga Forrajera', 'Bolsa 20 kg', 246.40],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Achicoria Forrajera', 'Bolsa 25 kg', 233.75],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Mostaza Blanca', 'Bolsa 25 kg', 290.13],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Sorgo de Escoba', 'Bolsa 25 kg', 27.50],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Vicia Sativa', 'Bolsa 25 kg', 61.88],
  ['CULTIVOS FORRAJEROS / COBERTURA', 'Vicia Villosa', 'Bolsa 25 kg', 63.25],
  ['TRÉBOLES / LOTUS', 'Trébol de Olor Amarillo', 'Bolsa 25 kg', 182.88],
  ['TRÉBOLES / LOTUS', 'Lotus Tenuis', 'Bolsa 25 kg', 253.00],
  ['TRÉBOLES / LOTUS', 'Lotus Corniculatus', 'Bolsa 25 kg', 324.50],
  ['TRÉBOLES / LOTUS', 'Trébol Rojo Quiñequeli', 'Bolsa 25 kg', 181.50],
  ['VERDEOS', 'Avena Blanca Bonaerense INTA Calen', 'Bolsa 40 kg', 26.40],
  ['VERDEOS', 'Avena Blanca Florencia INTA', 'Bolsa 40 kg', 30.80],
  ['VERDEOS', 'Avena Blanca Martina INTA', 'Bolsa 40 kg', 35.20],
  ['VERDEOS', 'Avena Strigosa', 'Bolsa 40 kg', 51.04],
  ['VERDEOS', 'Cebada Forrajera Negra Manfredi', 'Bolsa 40 kg', 20.68],
  ['VERDEOS', 'Cebada Granífera Silera INTA', 'Bolsa 40 kg', 30.36],
  ['VERDEOS', 'Centeno Secale Cereale', 'Bolsa 40 kg', 34.76],
  ['VERDEOS', 'Centeno Emilio INTA', 'Bolsa 40 kg', 38.72],
  ['VERDEOS', 'Triticale Yagan INTA', 'Bolsa 40 kg', 35.64],
  ['VERDEOS', 'Triticale Ona INTA', 'Bolsa 40 kg', 36.52],
  ['VERDEOS', 'Mijo Amarillo tipo Xanae', 'Bolsa 25 kg', 22.00],
  ['VERDEOS', 'Mijo Verde tipo Trinidad', 'Bolsa 25 kg', 34.38],
  ['VERDEOS', 'Grama Rhodes Katambora', 'Bolsa 10 kg', 159.50],
  ['HORTALIZAS', 'Acelga Verde Penca Blanca Ancha', 'Doypack 150 gr', 2.55],
  ['HORTALIZAS', 'Acelga Verde Penca Blanca Ancha', 'Alupack 1 kg', 15.40],
  ['HORTALIZAS', 'Acelga Verde Penca Blanca Ancha', 'Balde 5 kg', 79.00],
  ['HORTALIZAS', 'Acelga Verde Penca Blanca Ancha', 'Bolsa 10 kg', 148.75],
  ['HORTALIZAS', 'Achicoria Hoja Fina San Pedro', 'Lata 200 gr', 4.15],
  ['HORTALIZAS', 'Achicoria Hoja Fina San Pedro', 'Lata 500 gr', 9.50],
  ['HORTALIZAS', 'Achicoria Spadona', 'Lata 200 gr', 3.90],
  ['HORTALIZAS', 'Achicoria Spadona', 'Lata 500 gr', 9.10],
  ['HORTALIZAS', 'Cebolla Roja Chata de Italia', 'Lata 250 gr', 21.70],
  ['HORTALIZAS', 'Cebolla Roja Chata de Italia', 'Lata 500 gr', 42.70],
  ['HORTALIZAS', 'Cebolla Valencianita Sel. La Banda', 'Lata 250 gr', 19.35],
  ['HORTALIZAS', 'Cebolla Valencianita Sel. La Banda', 'Lata 500 gr', 38.00],
  ['HORTALIZAS', 'Cebolla Valencianita Sel. La Banda', 'Balde 5 kg', 366.60],
  ['HORTALIZAS', 'Cebolla Valenciana Grano de Oro', 'Lata 250 gr', 32.75],
  ['HORTALIZAS', 'Cebolla Valenciana Grano de Oro', 'Lata 500 gr', 64.85],
  ['HORTALIZAS', 'Cebolla Valenciana Grano de Oro', 'Balde 5 kg', 634.60],
  ['HORTALIZAS', 'Cebolla Valcatorce INTA', 'Lata 250 gr', 22.70],
  ['HORTALIZAS', 'Cebolla Valcatorce INTA', 'Lata 500 gr', 44.80],
  ['HORTALIZAS', 'Cebolla Valcatorce INTA', 'Balde 5 kg', 434.00],
  ['HORTALIZAS', 'Cilantro', 'Alupack 1 kg', 11.95],
  ['HORTALIZAS', 'Cilantro', 'Balde 5 kg', 62.25],
  ['HORTALIZAS', 'Cilantro', 'Bolsa 10 kg', 116.50],
  ['HORTALIZAS', 'Lechuga Prizehead', 'Lata 250 gr', 13.85],
  ['HORTALIZAS', 'Lechuga Prizehead', 'Lata 500 gr', 27.15],
  ['HORTALIZAS', 'Lechuga Waldmann’s Green', 'Lata 250 gr', 14.15],
  ['HORTALIZAS', 'Lechuga Waldmann’s Green', 'Lata 500 gr', 27.80],
  ['HORTALIZAS', 'Lechuga Crimor INTA', 'Lata 250 gr', 11.95],
  ['HORTALIZAS', 'Lechuga Crimor INTA', 'Lata 500 gr', 23.50],
  ['HORTALIZAS', 'Maíz Dulce Golden Bantam', 'Alupack 1 kg', 4.50],
  ['HORTALIZAS', 'Maíz Dulce Golden Bantam', 'Balde 10 kg', 44.45],
  ['HORTALIZAS', 'Maíz Dulce Golden Bantam', 'Bolsa 20 kg', 80.90],
  ['HORTALIZAS', 'Maíz Dulce Golden Hib-F1', 'Alupack 1 kg', 26.70],
  ['HORTALIZAS', 'Maíz Dulce Golden Hib-F1', 'Balde 5 kg', 134.00],
  ['HORTALIZAS', 'Perejil Común Hojas Lisas', 'Doypack 250 gr', 3.65],
  ['HORTALIZAS', 'Perejil Común Hojas Lisas', 'Alupack 1 kg', 13.95],
  ['HORTALIZAS', 'Pimiento Jalapeño M', 'Lata 100 gr', 28.14],
  ['HORTALIZAS', 'Remolacha Green Top Bunching', 'Doypack 150 gr', 4.80],
  ['HORTALIZAS', 'Remolacha Green Top Bunching', 'Alupack 1 kg', 30.60],
  ['HORTALIZAS', 'Remolacha Green Top Bunching', 'Balde 5 kg', 154.00],
  ['HORTALIZAS', 'Remolacha Green Top Bunching', 'Bolsa 10 kg', 299.00],
  ['HORTALIZAS', 'Rúcula Cultivada', 'Lata 250 gr', 5.30],
  ['HORTALIZAS', 'Rúcula Cultivada', 'Lata 500 gr', 9.95],
  ['HORTALIZAS', 'Rúcula Importada Emerald', 'Alupack 1 kg', 43.60],
  ['HORTALIZAS', 'Tomate Río Pampa', 'Sobre 1.000 semillas', 36.84],
  ['HORTALIZAS', 'Tomate Río Pampa', 'Sobre 5.000 semillas', 175.08],
  ['HORTALIZAS', 'Zanahoria Chantenay Red Core', 'Lata 250 gr', 8.35],
  ['HORTALIZAS', 'Zanahoria Chantenay Red Core', 'Lata 500 gr', 16.30],
  ['HORTALIZAS', 'Zanahoria Nantes', 'Lata 250 gr', 9.60],
  ['HORTALIZAS', 'Zanahoria Nantes', 'Lata 500 gr', 18.90],
  ['HORTALIZAS', 'Zapallito Pilar', 'Lata 2000 semillas', 9.07],
  ['HORTALIZAS', 'Zapallito Pilar', 'Balde 5 kg', 117.90],
  ['HORTALIZAS', 'Zapallito Pilar', 'Balde 10 kg', 234.00],
  ['HORTALIZAS', 'Zapallo Grey Zucchini', 'Lata 500 gr', 16.90],
  ['HORTALIZAS', 'Zapallo Gris Plomo', 'Lata 200 gr', 8.85],
  ['HORTALIZAS', 'Zapallo Gris Plomo', 'Lata 500 gr', 23.05],
  ['HORTALIZAS', 'Zapallo Gris Plomo', 'Balde 5 kg', 218.00],
  ['HORTALIZAS', 'Zapallo Cokena INTA', 'Lata 500 gr', 37.00],
  ['HORTALIZAS', 'Zapallo Cokena INTA', 'Balde 5 kg', 360.00],
  ['HORTALIZAS', 'Zapallo Waltham Butternut', 'Lata 250 gr', 10.70],
  ['HORTALIZAS', 'Zapallo Waltham Butternut', 'Lata 500 gr', 20.50],
  ['HORTALIZAS', 'Zapallo Waltham Butternut', 'Balde 5 kg', 193.00],
  ['CÉSPED', 'Bermuda Grass Unhulled', 'Alubag 100 gr', 21.70],
  ['CÉSPED', 'Bermuda Grass Unhulled', 'Doypack 250 gr', 4.80],
  ['CÉSPED', 'Bermuda Grass Unhulled', 'Lata 500 gr', 10.30],
  ['CÉSPED', 'Bermuda Grass Unhulled', 'Alupack 1 kg', 17.90],
  ['CÉSPED', 'Festuca Belfine', 'Bolsa 25 kg', 105.00],
  ['CÉSPED', 'Festuca Kentucky', 'Bolsa 25 kg', 102.50],
  ['CÉSPED', 'Festuca Troubadix', 'Bolsa 25 kg', 185.00],
  ['CÉSPED', 'Raigrás Perenne Lolius', 'Bolsa 25 kg', 178.75],
  ['CÉSPED', 'Raigrás Perenne Boost', 'Bolsa 25 kg', 90.00],
  ['CÉSPED', 'Raigrás Perenne Prana', 'Bolsa 25 kg', 92.50],
  ['CÉSPED', 'Trébol Blanco Grasslands Huia', 'Alupack 1 kg', 8.50],
  ['CÉSPED', 'Trébol Blanco Grasslands Huia', 'Bolsa 10 kg', 82.40],
  ['BLENDS CÉSPED', 'Champions', 'Bolsa 10 kg', 56.50],
  ['BLENDS CÉSPED', 'Champions', 'Bolsa 25 kg', 137.50],
  ['BLENDS CÉSPED', 'Cherokee', 'Bolsa 10 kg', 20.65],
  ['BLENDS CÉSPED', 'Cherokee', 'Bolsa 25 kg', 47.75],
  ['BLENDS CÉSPED', 'Tucson', 'Lata 500 gr', 18.70],
  ['BLENDS CÉSPED', 'Tucson', 'Balde 10 kg', 352.00],
  ['BLENDS CÉSPED', 'Classic 4 Estaciones Mix', 'Alupack 1 kg', 4.65],
  ['BLENDS CÉSPED', 'Classic 4 Estaciones Mix', 'Bolsa 25 kg', 103.75],
  ['BLENDS CÉSPED', 'Media Sombra Mix', 'Alupack 1 kg', 4.75],
  ['BLENDS CÉSPED', 'Media Sombra Mix', 'Bolsa 25 kg', 107.50],
  ['BLENDS CÉSPED', 'Comahue', 'Alupack 1 kg', 5.50],
  ['BLENDS CÉSPED', 'Comahue', 'Bolsa 25 kg', 125.00],
  ['BLENDS CÉSPED', 'Patagonia Norte Mix', 'Alupack 1 kg', 6.80],
  ['BLENDS CÉSPED', 'Patagonia Norte Mix', 'Bolsa 25 kg', 157.50],
  ['BLENDS CÉSPED', 'Austral Mix', 'Bolsa 25 kg', 131.25],
  ['BLENDS CÉSPED', 'Mustang Grass Mix', 'Bolsa 25 kg', 136.25],
  ['BLENDS CÉSPED', 'Wembley Grass Mix', 'Bolsa 25 kg', 133.75],
  ['BLENDS CÉSPED', 'Florida Grass Mix', 'Bolsa 25 kg', 143.75],
  ['BLENDS CÉSPED', 'Resistencia Pisoteo Mix', 'Bolsa 25 kg', 112.50]
];


function normalizar(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
}

function cultivoRealDesdeRegistro(cultivoOriginal = '', nombre = '') {
  const c = normalizar(cultivoOriginal);
  const n = normalizar(nombre);

  if (c === 'HORTALIZAS') {
    if (n.startsWith('ACELGA')) return 'ACELGA';
    if (n.startsWith('ACHICORIA')) return 'ACHICORIA';
    if (n.startsWith('CEBOLLA')) return 'CEBOLLA';
    if (n.startsWith('CILANTRO')) return 'CILANTRO';
    if (n.startsWith('LECHUGA')) return 'LECHUGA';
    if (n.startsWith('MAIZ DULCE')) return 'MAÍZ DULCE';
    if (n.startsWith('PEREJIL')) return 'PEREJIL';
    if (n.startsWith('PIMIENTO')) return 'PIMIENTO';
    if (n.startsWith('REMOLACHA')) return 'REMOLACHA';
    if (n.startsWith('RUCULA')) return 'RÚCULA';
    if (n.startsWith('TOMATE')) return 'TOMATE';
    if (n.startsWith('ZANAHORIA')) return 'ZANAHORIA';
    if (n.startsWith('ZAPALLITO')) return 'ZAPALLITO';
    if (n.startsWith('ZAPALLO')) return 'ZAPALLO';
  }

  if (c === 'CULTIVOS FORRAJEROS / COBERTURA') {
    if (n.startsWith('ACELGA')) return 'ACELGA';
    if (n.startsWith('ACHICORIA')) return 'ACHICORIA';
    if (n.startsWith('MOSTAZA')) return 'MOSTAZA';
    if (n.startsWith('SORGO')) return 'SORGO';
    if (n.startsWith('VICIA')) return 'VICIA';
  }

  if (c === 'GRAMINEAS / PASTURAS') {
    if (n.startsWith('AGROPIRO')) return 'AGROPIRO';
    if (n.startsWith('CEBADILLA')) return 'CEBADILLA';
    if (n.startsWith('FESTUCA')) return 'FESTUCA';
    if (n.startsWith('PASTO OVILLO')) return 'PASTO OVILLO';
    if (n.startsWith('RAIGRAS')) return 'RAIGRÁS';
  }

  if (c === 'VERDEOS') {
    if (n.startsWith('AVENA')) return 'AVENA';
    if (n.startsWith('CEBADA')) return 'CEBADA';
    if (n.startsWith('CENTENO')) return 'CENTENO';
    if (n.startsWith('TRITICALE')) return 'TRITICALE';
    if (n.startsWith('MIJO')) return 'MIJO';
    if (n.startsWith('GRAMA RHODES')) return 'GRAMA RHODES';
  }

  return cultivoOriginal;
}
async function main() {
  let creados = 0;
  let actualizados = 0;

  for (const [cultivoOriginal, nombre, presentacionEnvase, precioListaUsd] of PRODUCTOS) {
    const cultivo = cultivoRealDesdeRegistro(cultivoOriginal, nombre);
    const costoConFlete = Number((precioListaUsd * (1 + CONFIG.porcentajeFlete / 100)).toFixed(4));

    const data = {
      nombre,
      semilleroLaboratorio: CONFIG.semilleroLaboratorio,
      categoria: cultivoOriginal,
      cultivo,
      presentacionEnvase,
      descripcion: `${cultivo} · ${CONFIG.semilleroLaboratorio} · ${nombre} · ${presentacionEnvase}`,
      observacionesComerciales: `origen=${CONFIG.origen}; precio_base_usd=${precioListaUsd}; ganancia_incluida=true`,
      precioInternoManual: precioListaUsd,
      monedaCompra: CONFIG.monedaCompra,
      costoCompra: costoConFlete,
      porcentajeFlete: CONFIG.porcentajeFlete,
      porcentajeIva: CONFIG.porcentajeIva,
      porcentajeMargen: CONFIG.porcentajeMargen,
      precioVentaFinal: costoConFlete,
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

  console.log(`GUASCH SemillasYa: procesados=${PRODUCTOS.length}, creados=${creados}, actualizados=${actualizados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar GUASCH en SemillasYa:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

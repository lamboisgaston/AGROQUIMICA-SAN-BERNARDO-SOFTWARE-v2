const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG = {
  semilleroLaboratorio: 'CAPS',
  visibleEnSemillasYa: false,
  activo: true,
  monedaCompra: 'USD',
  porcentajeMargen: 25,
  porcentajeFlete: 0,
  publicadoWeb: false
};

const PRODUCTOS = {
  'ACELGA': [
    ['LARGE RIBBED DARK GREEN', 'Alfoil 1 Kg', 17.8],
    ['LARGE RIBBED DARK GREEN', 'Bolsa 10 Kg', 162.0],
    ['VERDE DE PENCA BLANCA ANCHA', 'Alfoil 1 Kg', 15.0],
    ['VERDE DE PENCA VERDE', 'Alfoil 1 Kg', 15.0]
  ],
  'ACHICORIA': [
    ['HOJA ANCHA DOUBLE BLONDE', 'Alfoil 1 Kg', 26.3], ['HOJA FINA BLANCA', 'Alfoil 1 Kg', 13.5], ['PAN DI ZUCCHERO', 'Lata 1/4 Kg', 9.3]
  ],
  'ALBAHACA': [['GENOVESE GIGANTE', 'Lata 1/4 Kg', 17.0], ['GENOVESE GIGANTE', 'Alfoil 5 Kg', 290.0]],
  'APIO': [['PASCAL', 'Lata 100 Gr', 7.7], ['PASCAL', 'Lata 1/4 Kg', 17.0], ['PASCAL', 'Alfoil 5 Kg', 280.0]],
  'ARVEJA': [['ONWARD', 'Alfoil 1 Kg', 6.9], ['ONWARD', 'Alfoil 5 Kg', 31.0], ['UTRILLO', 'Alfoil 1 Kg', 7.6], ['UTRILLO', 'Alfoil 5 Kg', 34.5]],
  'BERENJENA': [['FLORIDA MARKET', 'Lata 100 Gr', 11.0], ['FLORIDA MARKET', 'Lata 1/4 Kg', 24.5], ['FLORIDA MARKET', 'Lata 1 Lb', 44.0]],
  'BROCOLI': [['DE CICCO', 'Lata 100 Gr', 9.0], ['DE CICCO', 'Lata 1/4 Kg', 18.0], ['DE CICCO', 'Lata 1 Lb', 32.0], ['DE CICCO', 'Alfoil 5 Kg', 340.0]],
  'CALABAZA': [['RAYADA', 'Alfoil 1 Kg', 95.0], ['RAYADA', 'Alfoil 4 Kg', 375.0], ['RAYADA', 'Bolsa 10 Kg', 920.0]],
  'CEBOLLA': [['NEBUKA', 'Lata 100 Gr', 12.0], ['NEBUKA', 'Alfoil 1 Kg', 98.0], ['VALCATORCE INTA', 'Lata 1/4 Kg', 32.0], ['VALCATORCE INTA', 'Alfoil 1 Kg', 117.0], ['VALENCIANITA SEL LA BANDA', 'Lata 1/4 Kg', 17.0], ['VALENCIANITA SEL LA BANDA', 'Alfoil 1 Kg', 63.0], ['COLORADA CHATA INTA', 'Lata 1/4 Kg', 40.0], ['COLORADA CHATA INTA', 'Granel x Kg', 150.0], ['MORADA INTA', 'Lata 1/4 Kg', 38.0], ['MORADA INTA', 'Granel x Kg', 140.0]],
  'CILANTRO': [['AMERICAN LONG STANDING', 'Lata 1/2 Kg', 8.9], ['AMERICAN LONG STANDING', 'Alfoil 1 Kg', 11.8], ['AMERICAN LONG STANDING', 'Bolsa 10 Kg', 102.0]],
  'COLIFLOR': [['SNOWBALL', 'Lata 100 Gr', 11.5], ['SNOWBALL', 'Lata 1/4 Kg', 26.0], ['SNOWBALL', 'Alfoil 5 Kg', 540.0]],
  'ESPINACA': [['SUPER ULTRAFLAY', 'Alfoil 1 Kg', 13.2], ['SUPER ULTRAFLAY', 'Alfoil 5 Kg', 60.5], ['F1-EL RIO', 'Bolsa 100.000 semillas', 50.0]],
  'LECHUGA': [['BATAVIA LM SEL LA CONSULTA', 'Lata 100 Gr', 7.0], ['BATAVIA LM SEL LA CONSULTA', 'Lata 1/4 Kg', 15.0], ['FUEGO', 'Lata 100 Gr', 13.0], ['GRAND RAPIDS', 'Lata 1/4 Kg', 14.0], ['CRIMOR INTA', 'Lata 1/4 Kg', 18.0], ['CRIOLLA BLANCA', 'Lata 1/4 Kg', 19.0], ['CRIOLLA VERDE', 'Lata 1/4 Kg', 19.0]],
  'MAIZ DULCE': [['ABASTO INTA', 'Alfoil 1 Kg', 4.5], ['ABASTO INTA', 'Alfoil 5 Kg', 19.0], ['ABASTO INTA', 'Bolsa 20 Kg', 66.0], ['F1-GOLDEN CROSS', 'Bolsa 10.000 semillas', 85.0]],
  'MELON': [["PLANTER'S JUMBO", 'Lata 1/4 Kg', 15.0], ['HALES BEST JUMBO', 'Lata 1/4 Kg', 15.0], ['HONEY DEW GREEN FLESH', 'Lata 1/4 Kg', 15.5]],
  'PEPINO': [['POINSETT', 'Lata 1/4 Kg', 17.5], ['POINSETT', 'Lata 1 Lb', 31.0], ['NATIONAL PICKLING', 'Lata 1/4 Kg', 15.0]],
  'PEREJIL': [['DE HOJAS LISAS COMUN', 'Alfoil 1 Kg', 11.1], ['GIGANTE DE ITALIA', 'Alfoil 1 Kg', 15.0]],
  'PIMIENTO': [['CALIFORNIA WONDER', 'Lata 100 Gr', 15.5], ['CALIFORNIA WONDER', 'Lata 1/4 Kg', 36.0], ['FYUCO INTA', 'Lata 100 Gr', 19.0], ['KEYSTONE RESISTANT GIANT 3 TMR', 'Lata 100 Gr', 15.5]],
  'POROTO': [['STRINGLESS BLUE LAKE', 'Alfoil 1 Kg', 14.0], ['BUSH BLUE LAKE 274', 'Alfoil 1 Kg', 13.0], ['BUSH BLUE LAKE 274', 'Bolsa 20 Kg', 240.0]],
  'PUERRO': [['DE CARENTAN II', 'Lata 100 Gr', 10.0], ['DE CARENTAN II', 'Lata 1/4 Kg', 22.0], ['DE CARENTAN II', 'Alfoil 5 Kg', 390.0]],
  'RABANITO': [['CHERRY BELLE', 'Lata 1/4 Kg', 9.5], ['CRIMSON GIANT', 'Lata 1/4 Kg', 9.0], ['SPARKLER', 'Lata 1/4 Kg', 8.3]],
  'REMOLACHA': [['DETROIT DARK RED', 'Alfoil 1 Kg', 25.0], ['EARLY WONDER TALL TOP', 'Alfoil 1 Kg', 25.0], ['GREEN TOP BUNCHING', 'Alfoil 1 Kg', 24.0]],
  'REPOLLO': [['BRUNSWICK', 'Lata 100 Gr', 6.0], ['BRUNSWICK', 'Alfoil 1 Kg', 43.0], ['COLORADO MAMMOUTH', 'Alfoil 1 Kg', 50.0]],
  'SANDIA': [['CRIMSON SWEET', 'Lata 1/4 Kg', 20.0], ['CRIMSON SWEET', 'Alfoil 1 Kg', 72.0], ['JUBILEE', 'Lata 1/4 Kg', 15.0], ['F1-SMILE', 'Sobre 1.000 semillas', 80.0]],
  'TOMATE': [['RIO GRANDE', 'Lata 100 Gr', 20.0], ['RIO GRANDE', 'Lata 1/4 Kg', 46.0], ['PLATENSE', 'Lata 100 Gr', 22.0], ['PLATENSE', 'Alfoil 5 Kg', 940.0], ['F1-PAISANO', 'Lata 3000 semillas', 140.0]],
  'ZANAHORIA': [['CHANTENAY RED CORE', 'Lata 1/4 Kg', 13.2], ['CHANTENAY RED CORE', 'Alfoil 1 Kg', 46.0], ['DIANA', 'Alfoil 1 Kg', 40.0], ['LARGA CORDOBESA', 'Alfoil 1 Kg', 40.0]],
  'ZAPALLITO': [['CLARISSIMO', 'Lata 1/4 Kg', 9.0], ['CLARISSIMO', 'Alfoil 1 Kg', 29.0], ['ZUCCHINI GREY', 'Lata 1/4 Kg', 10.0], ['ZUCCHINI GREY', 'Alfoil 5 Kg', 170.0]],
  'ZAPALLO': [['BUTTERNUT WALTHAM', 'Lata 1/4 Kg', 14.0], ['BUTTERNUT WALTHAM', 'Alfoil 1 Kg', 51.0], ['COKENA INTA', 'Lata 1 Lb', 33.0], ['GRIS PLOMO', 'Alfoil 1 Kg', 43.8], ['F1-SHINTOSA', 'Lata 100 Gr', 27.5]],
  'CESPED': [['BERMUDA GRASS', 'Lata 1/4 Kg', 7.0], ['BERMUDA GRASS', 'Alfoil 1 Kg', 20.5], ['BERMUDA GRASS', 'Alfoil 5 Kg', 99.0], ['DICHONDRA REPENS', 'Alfoil 1 Kg', null], ['RAY GRASS ANUAL', 'Alfoil 1 Kg', null]]
};

function buildRows() {
  const rows = [];
  for (const [cultivo, productos] of Object.entries(PRODUCTOS)) {
    for (const [nombre, presentacionEnvase, precioListaUsd] of productos) {
      rows.push({ cultivo, nombre, presentacionEnvase, precioListaUsd });
    }
  }
  return rows;
}

async function main() {
  const rows = buildRows();
  let creados = 0;
  let actualizados = 0;

  for (const row of rows) {
    const estado = row.precioListaUsd == null ? 'CONSULTAR' : 'DISPONIBLE';
    const data = {
      nombre: row.nombre,
      semilleroLaboratorio: CONFIG.semilleroLaboratorio,
      categoria: row.cultivo,
      cultivo: row.cultivo,
      presentacionEnvase: row.presentacionEnvase,
      descripcion: `${row.cultivo} · ${row.nombre} · ${row.presentacionEnvase}`,
      precioInternoManual: row.precioListaUsd,
      monedaCompra: CONFIG.monedaCompra,
      costoCompra: row.precioListaUsd ?? 0,
      porcentajeFlete: CONFIG.porcentajeFlete,
      porcentajeMargen: CONFIG.porcentajeMargen,
      visibleEnSemillasYa: CONFIG.visibleEnSemillasYa,
      activo: CONFIG.activo,
      publicadoWeb: CONFIG.publicadoWeb,
      estado
    };

    const existente = await prisma.productoPrecampania.findFirst({
      where: {
        nombre: row.nombre,
        cultivo: row.cultivo,
        presentacionEnvase: row.presentacionEnvase,
        semilleroLaboratorio: CONFIG.semilleroLaboratorio
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

  console.log(`CAPS Precampaña: procesados=${rows.length}, creados=${creados}, actualizados=${actualizados}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar CAPS manual en precampaña:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

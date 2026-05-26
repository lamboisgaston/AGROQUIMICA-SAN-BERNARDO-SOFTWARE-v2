const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CULTIVOS_INVALIDOS = [
  'HORTALIZAS',
  'VERDEOS',
  'CULTIVOS FORRAJEROS / COBERTURA',
  'GRAMÍNEAS / PASTURAS'
];

function normalizar(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
}

function cultivoReal(cultivoOriginal = '', nombre = '') {
  const c = normalizar(cultivoOriginal);
  const n = normalizar(nombre);

  if (c === 'HORTALIZAS' || c === 'CULTIVOS FORRAJEROS / COBERTURA') {
    if (n.startsWith('ACELGA')) return 'ACELGA';
    if (n.startsWith('ACHICORIA')) return 'ACHICORIA';
    if (n.startsWith('MOSTAZA')) return 'MOSTAZA';
    if (n.startsWith('SORGO')) return 'SORGO';
    if (n.startsWith('VICIA')) return 'VICIA';
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
  const candidatos = await prisma.productoPrecampania.findMany({
    where: {
      semilleroLaboratorio: 'GUASCH',
      cultivo: { in: CULTIVOS_INVALIDOS }
    },
    select: { id: true, nombre: true, cultivo: true, categoria: true, presentacionEnvase: true }
  });

  let actualizados = 0;
  let sinCambio = 0;

  for (const p of candidatos) {
    const nuevoCultivo = cultivoReal(p.cultivo, p.nombre);
    if (nuevoCultivo === p.cultivo) {
      sinCambio += 1;
      continue;
    }

    await prisma.productoPrecampania.update({
      where: { id: p.id },
      data: {
        cultivo: nuevoCultivo,
        descripcion: `${nuevoCultivo} · GUASCH · ${p.nombre} · ${p.presentacionEnvase}`
      }
    });
    actualizados += 1;
  }

  console.log(`Corrección GUASCH SemillasYa completada. candidatos=${candidatos.length}, actualizados=${actualizados}, sinCambio=${sinCambio}`);
}

main()
  .catch((error) => {
    console.error('Error corrigiendo cultivos GUASCH SemillasYa:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

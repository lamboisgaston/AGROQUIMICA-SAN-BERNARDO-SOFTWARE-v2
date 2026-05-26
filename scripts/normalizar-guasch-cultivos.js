const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CULTIVOS_INVALIDOS = [
  'HORTALIZAS',
  'VERDEOS',
  'GRAMÍNEAS / PASTURAS',
  'CULTIVOS FORRAJEROS / COBERTURA'
];

function normalizar(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
}

function cultivoObjetivo(nombre = '', cultivoActual = '') {
  const n = normalizar(nombre);
  const c = normalizar(cultivoActual);

  if (n.startsWith('ACELGA FORRAJERA')) return 'ACELGA';
  if (n.startsWith('ACHICORIA FORRAJERA')) return 'ACHICORIA';
  if (n.startsWith('MOSTAZA BLANCA')) return 'MOSTAZA';
  if (n.startsWith('SORGO DE ESCOBA')) return 'SORGO';
  if (n.startsWith('VICIA SATIVA')) return 'VICIA';
  if (n.startsWith('VICIA VILLOSA')) return 'VICIA';
  if (n.startsWith('REMOLACHA GREEN TOP BUNCHING')) return 'REMOLACHA';
  if (n.startsWith('CEBOLLAS GUASCH') || n.startsWith('CEBOLLA')) return 'CEBOLLA';
  if (n.startsWith('LECHUGAS GUASCH') || n.startsWith('LECHUGA')) return 'LECHUGA';
  if (n.startsWith('ZAPALLOS GUASCH') || n.startsWith('ZAPALLO')) return 'ZAPALLO';
  if (n.startsWith('ZAPALLITOS GUASCH') || n.startsWith('ZAPALLITO')) return 'ZAPALLITO';

  if (n.includes('BLEND') && n.includes('CESPED')) return 'BLENDS CÉSPED';
  if (n.includes('CÉSPED') || n.includes('CESPED')) return 'CÉSPED';

  if (!CULTIVOS_INVALIDOS.includes(cultivoActual) && !CULTIVOS_INVALIDOS.includes(c)) {
    return cultivoActual;
  }

  if (n.startsWith('ACELGA')) return 'ACELGA';
  if (n.startsWith('ACHICORIA')) return 'ACHICORIA';
  if (n.startsWith('MOSTAZA')) return 'MOSTAZA';
  if (n.startsWith('SORGO')) return 'SORGO';
  if (n.startsWith('VICIA')) return 'VICIA';
  if (n.startsWith('REMOLACHA')) return 'REMOLACHA';
  if (n.startsWith('CEBOLLA')) return 'CEBOLLA';
  if (n.startsWith('LECHUGA')) return 'LECHUGA';
  if (n.startsWith('ZAPALLITO')) return 'ZAPALLITO';
  if (n.startsWith('ZAPALLO')) return 'ZAPALLO';

  return null;
}

async function main() {
  const productosGuasch = await prisma.productoPrecampania.findMany({
    where: { semilleroLaboratorio: 'GUASCH' },
    select: { id: true, nombre: true, cultivo: true, categoria: true, presentacionEnvase: true, activo: true }
  });

  let corregidos = 0;
  let desactivados = 0;
  let sinCambio = 0;

  for (const p of productosGuasch) {
    const nuevoCultivo = cultivoObjetivo(p.nombre, p.cultivo);
    const cultivoInvalido = CULTIVOS_INVALIDOS.includes(p.cultivo);

    if (!nuevoCultivo && cultivoInvalido) {
      await prisma.productoPrecampania.update({ where: { id: p.id }, data: { activo: false } });
      desactivados += 1;
      continue;
    }

    if (!nuevoCultivo) {
      sinCambio += 1;
      continue;
    }

    const requiereCambio = p.cultivo !== nuevoCultivo;
    if (!requiereCambio) {
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
    corregidos += 1;
  }

  console.log(JSON.stringify({ totalGuasch: productosGuasch.length, corregidos, desactivados, sinCambio }, null, 2));
}

main()
  .catch((error) => {
    console.error('Error normalizando cultivos GUASCH:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

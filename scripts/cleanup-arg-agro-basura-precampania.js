const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BASURA_EXACTA = new Set([
  'envíos a todo el país',
  'telefonos',
  'teléfonos',
  'teléfonos:',
  'telefonos:'
]);

const TOKENS_BASURA = [
  'bienvenido',
  'semillería venta de semillas e insumos para el agro',
  'contacto',
  'whatsapp',
  'instagram',
  'facebook',
  'mail',
  'correo',
  'teléfono',
  'telefono',
  'atención',
  'institucional'
];

function normalizar(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esBasuraTexto(nombre = '', cultivo = '') {
  const n = normalizar(nombre);
  const c = normalizar(cultivo);
  if (!n && !c) return false;
  if (n.includes('bienvenido') || c.includes('bienvenido')) return true;
  if (BASURA_EXACTA.has(n)) return true;
  if (TOKENS_BASURA.some((t) => n.includes(normalizar(t)))) return true;
  return false;
}

async function main() {
  const productos = await prisma.productoPrecampania.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, cultivo: true, semilleroLaboratorio: true }
  });

  const idsBasura = productos
    .filter((p) => esBasuraTexto(p.nombre, p.cultivo))
    .map((p) => p.id);

  if (!idsBasura.length) {
    console.log('No se detectaron registros basura para desactivar.');
    return;
  }

  const resultado = await prisma.productoPrecampania.updateMany({
    where: { id: { in: idsBasura } },
    data: { activo: false, visibleEnSemillasYa: false, publicadoWeb: false }
  });

  console.log(`Registros desactivados: ${resultado.count}`);
  console.log(`IDs: ${idsBasura.join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

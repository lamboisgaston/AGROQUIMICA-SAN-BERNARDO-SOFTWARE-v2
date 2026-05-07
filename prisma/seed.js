const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.configuracionGlobal.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tipoCambioActual: 1000 }
  });

  await prisma.persona.createMany({
    data: [
      { nombre: 'Alejandro Pablo', telefono: '0001', tipo: 'GERENTE' },
      { nombre: 'Gaston', telefono: '0002', tipo: 'ADMINISTRADOR_GENERAL' }
    ],
    skipDuplicates: true
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

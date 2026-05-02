const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.producto.createMany({
    data: [
      { nombre: 'Glifosato 20L', categoria: 'Herbicida', precioUsd: 85, stock: 10 },
      { nombre: 'Cipermetrina 1L', categoria: 'Insecticida', precioUsd: 12, stock: 25 },
      { nombre: 'Fertilizante NPK 25kg', categoria: 'Fertilizante', precioUsd: 30, stock: 15 }
    ],
    skipDuplicates: true
  });

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

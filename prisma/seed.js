const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.producto.createMany({
    data: [
      { nombre: 'Glifosato 20L', categoria: 'Herbicida', precio: 85000, stock: 10 },
      { nombre: 'Cipermetrina 1L', categoria: 'Insecticida', precio: 12000, stock: 25 },
      { nombre: 'Fertilizante NPK 25kg', categoria: 'Fertilizante', precio: 30000, stock: 15 }
    ],
    skipDuplicates: true
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

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.producto.createMany({
    data: [
      { nombre: 'Herbicida Total', precio: 25.5, descripcion: 'Control de malezas' },
      { nombre: 'Fertilizante NPK', precio: 18.9, descripcion: 'Nutrientes balanceados' },
      { nombre: 'Insecticida Plus', precio: 30.0, descripcion: 'Amplio espectro' }
    ]
  });

  await prisma.persona.createMany({
    data: [
      { nombre: 'Juan Pérez', email: 'juan@agro.com', telefono: '555-1001' },
      { nombre: 'María Gómez', email: 'maria@agro.com', telefono: '555-1002' }
    ]
  });

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

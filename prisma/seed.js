const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.warn('⚠️ Seed en modo seguro: no borra datos ni hace reset.');
  console.warn('⚠️ Solo aplica upserts/inserciones idempotentes sobre DATABASE_URL actual.');

  await prisma.configuracionGlobal.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tipoCambioActual: 1000 }
  });

  await prisma.persona.createMany({
    data: [
      { nombre: 'Alejandro Pablo', telefono: '0001', tipo: 'GERENTE' },
      { nombre: 'Gaston', telefono: '0002', tipo: 'ADMINISTRADOR_GENERAL' },
      { nombre: 'Cliente Mostrador Demo', telefono: '11111111', tipo: 'CLIENTE', tipoCliente: 'PERSONAL', activo: true, eliminado: false },
      { nombre: 'Ferreteria Demo SRL', telefono: '22222222', cuitDni: '30-12345678-9', mail: 'compras@demo.local', tipo: 'CLIENTE', tipoCliente: 'EMPRESA', activo: true, eliminado: false }
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

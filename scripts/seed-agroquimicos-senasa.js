const { PrismaClient } = require('@prisma/client');
const { upsertProductosSenasaMip } = require('../services/senasaProductosService');

const prisma = new PrismaClient();

async function ensureSchemaColumns() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "concentracion" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "habilitacionHabitual" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "aptoSenasaMip" BOOLEAN NOT NULL DEFAULT false');
  } catch (error) {
    console.warn('[seed:senasa] No se pudieron asegurar columnas con ALTER TABLE IF NOT EXISTS. Si falla el seed, ejecutá primero `npx prisma db push`.', error.message);
  }
}

async function main() {
  await ensureSchemaColumns();
  const resultado = await upsertProductosSenasaMip(prisma);
  console.log(`[seed:senasa] Categoría: ${resultado.categoria}`);
  console.log(`[seed:senasa] Productos creados: ${resultado.creados}`);
  console.log(`[seed:senasa] Productos actualizados: ${resultado.actualizados}`);
}

main()
  .catch((error) => {
    console.error('[seed:senasa] Error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

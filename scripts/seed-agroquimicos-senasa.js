const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const CATEGORIA = 'AGROQUÍMICOS SENASA';

const PRODUCTOS = [
  ['Fendona 6 SC', 'Alfacipermetrina', '6% SC', 'ANMAT'],
  ['Sipertrin', 'Beta Cipermetrina', '5%', 'ANMAT'],
  ['Delta Pro', 'Deltametrina + Propoxur', '2,5% + 20%', 'ANMAT'],
  ['Veloxan Derribante', 'Cipermetrina + Tetrametrina', '15% + 0,2%', 'ANMAT'],
  ['K-Othrina', 'Deltametrina', '2,5%', 'ANMAT'],
  ['Solfac EW 50', 'Cyfluthrin', '5%', 'ANMAT'],
  ['Maxforce Gel', 'Imidacloprid', '2,15%', 'ANMAT'],
  ['Blattanex Gel', 'Fipronil', '0,05%', 'ANMAT'],
  ['Mirex-S', 'Sulfluramida', '0,3%', 'SENASA / ANMAT según uso'],
  ['Klerat', 'Brodifacoum', '0,005%', 'ANMAT'],
  ['Racumin', 'Coumatetralyl', '0,75%', 'ANMAT'],
  ['Storm', 'Flocoumafen', '0,005%', 'ANMAT'],
  ['Rodilon Bloque', 'Difethialone', '0,0025%', 'ANMAT'],
  ['Dragnet', 'Permetrina', '25%', 'ANMAT / SENASA'],
  ['Dragón', 'Cipermetrina', '25%', 'SENASA'],
  ['Biflex', 'Bifentrin', '10%', 'SENASA / ANMAT según formulación'],
  ['Cislin 25', 'Deltametrina', '2,5%', 'ANMAT'],
  ['Aqua K-Othrine', 'Deltametrina', '2%', 'ANMAT'],
  ['Demand CS', 'Lambda Cyhalothrin', '9,7%', 'ANMAT'],
  ['Icon 10 CS', 'Lambda Cyhalothrin', '10%', 'ANMAT / SENASA según uso']
].map(([nombre, principioActivo, concentracion, habilitacionHabitual]) => ({
  nombre,
  principioActivo,
  concentracion,
  habilitacionHabitual
}));

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

  const categoria = await prisma.categoria.upsert({
    where: { nombre: CATEGORIA },
    update: { activo: true },
    create: { nombre: CATEGORIA, descripcion: 'Productos técnicos habilitados para uso SENASA / MIP.' }
  });

  let creados = 0;
  let actualizados = 0;

  for (const producto of PRODUCTOS) {
    const data = {
      nombre: producto.nombre,
      categoria: CATEGORIA,
      principioActivo: producto.principioActivo,
      concentracion: producto.concentracion,
      habilitacionHabitual: producto.habilitacionHabitual,
      usoSenasa: 'MIP',
      aptoSenasaMip: true,
      activo: true,
      eliminado: false
    };

    const posibles = await prisma.producto.findMany({
      where: { nombre: producto.nombre },
      select: { id: true, nombre: true, categorias: { select: { id: true } } }
    });
    const existente = posibles.find((item) => item.nombre.toLocaleLowerCase('es-AR') === producto.nombre.toLocaleLowerCase('es-AR')) || posibles[0];

    if (existente) {
      await prisma.producto.update({
        where: { id: existente.id },
        data: {
          ...data,
          ...(existente.categorias.some((item) => item.id === categoria.id) ? {} : { categorias: { connect: { id: categoria.id } } })
        }
      });
      actualizados += 1;
    } else {
      await prisma.producto.create({
        data: {
          ...data,
          categorias: { connect: { id: categoria.id } },
          marca: '',
          unidad: 'UN',
          stock: 0,
          monedaCosto: 'ARS',
          costoBase: 0,
          precioVenta: 0,
          porcentajeUva: 0,
          porcentajeFlete: 0,
          porcentajeGanancia: 0,
          precioFinalPesos: 0
        }
      });
      creados += 1;
    }
  }

  console.log(`[seed:senasa] Categoría: ${CATEGORIA}`);
  console.log(`[seed:senasa] Productos creados: ${creados}`);
  console.log(`[seed:senasa] Productos actualizados: ${actualizados}`);
}

main()
  .catch((error) => {
    console.error('[seed:senasa] Error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

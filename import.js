const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const workbook = XLSX.readFile('precios.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const precioUsd = row[1];
    const nombre = row[3];

    if (!nombre || !precioUsd) continue;

    await prisma.producto.create({
      data: {
        nombre: String(nombre).trim(),
        precioUsd: Number(precioUsd),
        categoria: 'General',
        stock: 100
      }
    });

    console.log(`✔ Cargado: ${nombre}`);
  }

  console.log('IMPORTACIÓN COMPLETA');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
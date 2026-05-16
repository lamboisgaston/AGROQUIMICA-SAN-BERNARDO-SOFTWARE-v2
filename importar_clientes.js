const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function normalizarTipoCliente(valor) {
  const v = String(valor || '').trim().toUpperCase();
  return v === 'EMPRESA' ? 'EMPRESA' : 'PERSONAL';
}

function normalizarFila(row = {}) {
  const nombre = String(row.nombre || row.razonSocial || '').trim();
  const telefono = String(row.telefono || row.telefonoPrincipal || '').trim();
  const cuitDni = String(row.cuitDni || row.cuit || '').trim();
  const mail = String(row.mail || row.email || '').trim();
  const tipoCliente = normalizarTipoCliente(row.tipoCliente);
  if (!nombre) return null;
  return { nombre, telefono, cuitDni, mail, tipoCliente };
}

async function run() {
  const input = process.argv[2];
  if (!input) throw new Error('Uso: node importar_clientes.js <archivo.csv|archivo.xlsx>');
  const fullPath = path.resolve(process.cwd(), input);
  if (!fs.existsSync(fullPath)) throw new Error(`No existe el archivo: ${fullPath}`);

  const workbook = XLSX.readFile(fullPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  let creados = 0;
  let omitidos = 0;
  for (const row of rows) {
    const data = normalizarFila(row);
    if (!data) {
      omitidos += 1;
      continue;
    }
    const existente = data.tipoCliente === 'EMPRESA'
      ? await prisma.persona.findFirst({ where: { tipoCliente: 'EMPRESA', cuitDni: data.cuitDni || null } })
      : await prisma.persona.findFirst({ where: { tipoCliente: 'PERSONAL', telefono: data.telefono || null } });

    const payload = {
      nombre: data.nombre,
      telefono: data.telefono || null,
      cuitDni: data.cuitDni || null,
      mail: data.mail || null,
      tipo: 'CLIENTE',
      tipoCliente: data.tipoCliente
    };
    if (existente?.id) {
      await prisma.persona.update({
        where: { id: existente.id },
        data: { ...payload, activo: true, eliminado: false }
      });
    } else {
      await prisma.persona.create({
        data: {
          ...payload,
          activo: true,
          eliminado: false
        }
      });
    }
    creados += 1;
  }
  console.log(`Importación finalizada. Procesados: ${rows.length}. Creados/actualizados: ${creados}. Omitidos: ${omitidos}.`);
}

run()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

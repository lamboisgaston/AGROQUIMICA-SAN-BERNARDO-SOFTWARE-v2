const fs = require('fs');
const path = require('path');
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
  const observaciones = String(row.observaciones || '').trim();
  const tipoCliente = normalizarTipoCliente(row.tipoCliente);
  if (!nombre) return null;
  return { nombre, telefono, cuitDni, mail, tipoCliente, observaciones };
}

async function run() {
  const input = process.argv[2];
  if (!input) throw new Error('Uso: node importar_clientes.js <archivo.csv>');
  const fullPath = path.resolve(process.cwd(), input);
  if (!fs.existsSync(fullPath)) throw new Error(`No existe el archivo: ${fullPath}`);
  if (path.extname(fullPath).toLowerCase() !== '.csv') {
    throw new Error('Formato no soportado. Use un archivo .csv con columnas nombre,telefono,cuitDni,mail,tipoCliente,observaciones');
  }

  const contenido = fs.readFileSync(fullPath, 'utf8');
  const lineas = contenido
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
  if (lineas.length === 0) throw new Error('CSV vacío');
  const headers = lineas[0].split(',').map((h) => h.trim());
  const rows = lineas.slice(1).map((linea) => {
    const valores = linea.split(',').map((v) => v.trim());
    return headers.reduce((acc, header, idx) => {
      acc[header] = valores[idx] || '';
      return acc;
    }, {});
  });

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
      observaciones: data.observaciones || null,
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

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const FUENTE = 'BNA';
const MESES_SLUG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function getArgValue(name) {
  const prefixed = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function ymdFromDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function fechaUtcDesdeYmd(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function parseNumeroArgentino(value) {
  if (value == null) return null;
  const raw = String(value).trim().replace(/[$\s]/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((value) => value.trim());
}

function cargarCsvCotizaciones(csvPath) {
  const resolved = path.resolve(csvPath);
  const content = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return new Map();
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const fechaIdx = headers.findIndex((h) => h.toLowerCase() === 'fecha');
  const dolarIdx = headers.findIndex((h) => h.toLowerCase() === 'dolarbnaventa');
  if (fechaIdx < 0 || dolarIdx < 0) {
    throw new Error('El CSV debe tener encabezado: fecha,dolarBnaVenta');
  }

  const cotizaciones = new Map();
  for (const [index, line] of lines.slice(1).entries()) {
    const cols = parseCsvLine(line);
    const fecha = cols[fechaIdx];
    const dolar = parseNumeroArgentino(cols[dolarIdx]);
    if (!fechaUtcDesdeYmd(fecha)) throw new Error(`Fecha inválida en CSV línea ${index + 2}: ${fecha}`);
    if (!dolar) throw new Error(`dolarBnaVenta inválido en CSV línea ${index + 2}: ${cols[dolarIdx]}`);
    cotizaciones.set(fecha, dolar);
  }
  return cotizaciones;
}

async function fetchText(url) {
  if (typeof fetch !== 'function') throw new Error('fetch no está disponible en esta versión de Node.js');
  const response = await fetch(url, { headers: { 'user-agent': 'agroquimica-historico/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} al consultar ${url}`);
  return response.text();
}

function parseDolarHistoricoHtml(html) {
  const cotizaciones = new Map();
  const patrones = [
    /<tr[^>]*>\s*<td[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/gi,
    /(\d{2})\/(\d{2})\/(\d{4})<\/a>\s*([\d.,]+)\s*([\d.,]+)/gi
  ];
  for (const regex of patrones) {
    let match;
    while ((match = regex.exec(html))) {
      const fecha = `${match[3]}-${match[2]}-${match[1]}`;
      const venta = parseNumeroArgentino(match[5]);
      if (fechaUtcDesdeYmd(fecha) && venta) cotizaciones.set(fecha, venta);
    }
  }
  return cotizaciones;
}

async function cargarAutomaticoDolarHistorico(fechasPendientes) {
  const meses = [...new Set(fechasPendientes.map((fecha) => fecha.slice(0, 7)))];
  const cotizaciones = new Map();
  for (const ym of meses) {
    const [year, month] = ym.split('-');
    const monthSlug = MESES_SLUG[Number(month) - 1];
    const urls = [
      `https://dolarhistorico.com/dolar-banco-nacion/mes/${monthSlug}-${year}`,
      `https://dolarhistorico.com/dolar-banco-nacion/mes/${year}-${month}`
    ];
    for (const url of urls) {
      try {
        const html = await fetchText(url);
        const parsed = parseDolarHistoricoHtml(html);
        for (const [fecha, dolar] of parsed) cotizaciones.set(fecha, dolar);
        if (parsed.size) break;
      } catch (error) {
        console.warn(`[auto] No se pudo consultar ${url}: ${error.message || error}`);
      }
    }
  }
  return cotizaciones;
}

function completarUsd(row, dolarBnaVenta) {
  const ventasArs = Number(row.ventasArs);
  return Number.isFinite(ventasArs) && Number.isFinite(dolarBnaVenta) && dolarBnaVenta > 0 ? ventasArs / dolarBnaVenta : null;
}

async function main() {
  const csvPath = getArgValue('--csv');
  const dryRun = hasArg('--dry-run');
  const soloCsv = hasArg('--solo-csv');
  const rows = await prisma.estadisticaHistorica.findMany({ orderBy: { fecha: 'asc' } });
  const fechasHistorico = [...new Set(rows.map((row) => ymdFromDate(row.fecha)))];
  const resultado = {
    fechasHistorico: fechasHistorico.length,
    cotizacionesExistentes: 0,
    cotizacionesCsv: 0,
    cotizacionesAutomaticas: 0,
    cotizacionesCreadasOActualizadas: 0,
    estadisticasActualizadas: 0,
    sinCotizacion: 0,
    dryRun
  };

  const existentes = await prisma.cotizacionDolar.findMany({
    where: { fuente: FUENTE, fecha: { in: fechasHistorico.map(fechaUtcDesdeYmd).filter(Boolean) } }
  });
  const cotizaciones = new Map(existentes.map((item) => [ymdFromDate(item.fecha), Number(item.dolarBnaVenta)]));
  resultado.cotizacionesExistentes = cotizaciones.size;

  if (csvPath) {
    const desdeCsv = cargarCsvCotizaciones(csvPath);
    for (const [fecha, dolar] of desdeCsv) cotizaciones.set(fecha, dolar);
    resultado.cotizacionesCsv = desdeCsv.size;
  }

  const pendientesAuto = fechasHistorico.filter((fecha) => !cotizaciones.has(fecha));
  if (pendientesAuto.length && !soloCsv) {
    const desdeAuto = await cargarAutomaticoDolarHistorico(pendientesAuto);
    for (const [fecha, dolar] of desdeAuto) cotizaciones.set(fecha, dolar);
    resultado.cotizacionesAutomaticas = desdeAuto.size;
  }

  for (const fecha of fechasHistorico) {
    const dolar = cotizaciones.get(fecha);
    if (!dolar) {
      resultado.sinCotizacion += 1;
      continue;
    }
    const fechaDate = fechaUtcDesdeYmd(fecha);
    if (!dryRun) {
      await prisma.cotizacionDolar.upsert({
        where: { fecha_fuente: { fecha: fechaDate, fuente: FUENTE } },
        update: { dolarBnaVenta: dolar },
        create: { fecha: fechaDate, fuente: FUENTE, dolarBnaVenta: dolar }
      });
    }
    resultado.cotizacionesCreadasOActualizadas += 1;
  }

  for (const row of rows) {
    const fecha = ymdFromDate(row.fecha);
    const dolar = cotizaciones.get(fecha);
    if (!dolar) continue;
    const ventasUsd = completarUsd(row, dolar);
    const data = { dolarBnaVenta: dolar };
    if (ventasUsd != null) data.ventasUsd = ventasUsd;
    if (!dryRun) await prisma.estadisticaHistorica.update({ where: { id: row.id }, data });
    resultado.estadisticasActualizadas += 1;
  }

  console.log(JSON.stringify(resultado, null, 2));
  if (resultado.sinCotizacion > 0) {
    console.warn('Quedaron fechas sin cotización. Puede completar con un CSV: fecha,dolarBnaVenta');
  }
}

main()
  .catch((error) => {
    console.error('Error al completar CotizacionDolar histórico:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

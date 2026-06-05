const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const CSV_PATH = path.join(__dirname, '..', 'data', 'historico_estadistico_agroquimica_normalizado.csv');

const NUMERIC_FIELDS = [
  'ventasArs',
  'recTransferenciaArs',
  'sinRespaldoArs',
  'facContadoArs',
  'facBContadoArs',
  'fcCuentaCorrienteArs',
  'ffArs',
  'facturadoArs',
  'comprasArs',
  'dolarBnaVenta',
  'ventasUsd',
  'comprasUsd',
  'facturadoUsd',
  'margenBrutoArs',
  'margenBrutoUsd'
];

const FIELD_ALIASES = {
  fecha: ['fecha', 'date', 'dia', 'día'],
  etiquetaOriginal: ['etiquetaOriginal', 'etiqueta_original', 'etiqueta', 'label', 'periodo'],
  ventasArs: ['ventasArs', 'ventas_ars', 'ventas ars', 'ventas', 'venta_ars'],
  recTransferenciaArs: ['recTransferenciaArs', 'rec_transferencia_ars', 'rec transferencia ars', 'transferencias_ars', 'transferencias ars', 'rec.transferencia'],
  sinRespaldoArs: ['sinRespaldoArs', 'sin_respaldo_ars', 'sin respaldo ars', 'sin_respaldo'],
  facContadoArs: ['facContadoArs', 'fac_contado_ars', 'fac contado ars', 'factura_contado_ars'],
  facBContadoArs: ['facBContadoArs', 'fac_b_contado_ars', 'fac b contado ars', 'factura_b_contado_ars'],
  fcCuentaCorrienteArs: ['fcCuentaCorrienteArs', 'fc_cuenta_corriente_ars', 'fc cuenta corriente ars', 'cuenta_corriente_ars'],
  ffArs: ['ffArs', 'ff_ars', 'ff ars'],
  facturadoArs: ['facturadoArs', 'facturado_ars', 'facturado ars', 'facturacion_ars'],
  comprasArs: ['comprasArs', 'compras_ars', 'compras ars', 'compra_ars'],
  dolarBnaVenta: ['dolarBnaVenta', 'dolar_bna_venta', 'dólar bna venta', 'dolar bna venta', 'usd_bna_venta', 'tipo_cambio', 'dolar'],
  ventasUsd: ['ventasUsd', 'ventas_usd', 'ventas usd'],
  comprasUsd: ['comprasUsd', 'compras_usd', 'compras usd'],
  facturadoUsd: ['facturadoUsd', 'facturado_usd', 'facturado usd'],
  margenBrutoArs: ['margenBrutoArs', 'margen_bruto_ars', 'margen bruto ars', 'margen_ars'],
  margenBrutoUsd: ['margenBrutoUsd', 'margen_bruto_usd', 'margen bruto usd', 'margen_usd']
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitCsvLine(line, delimiter) {
  const out = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  return lines.slice(1).map((line, idx) => {
    const values = splitCsvLine(line, delimiter);
    const row = { __line: idx + 2 };
    headers.forEach((header, i) => { row[header] = values[i] == null ? '' : values[i].trim(); });
    return row;
  });
}

function buildHeaderMap(row) {
  const normalizedHeaders = new Map(Object.keys(row).filter((k) => k !== '__line').map((h) => [normalizeHeader(h), h]));
  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const original = normalizedHeaders.get(normalizeHeader(alias));
      if (original) {
        map[field] = original;
        break;
      }
    }
  }
  return map;
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  let year;
  let month;
  let day;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else if (slash) {
    day = Number(slash[1]); month = Number(slash[2]); year = Number(slash[3]);
    if (year < 100) year += 2000;
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function parseNumber(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/ARS|USD/gi, '')
    .replace(/\((.*)\)/, '-$1');
  let normalized = cleaned;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function deriveUsd(amountArs, dolar) {
  return Number.isFinite(amountArs) && Number.isFinite(dolar) && dolar > 0 ? amountArs / dolar : null;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`No existe el archivo requerido: ${CSV_PATH}`);
  }

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  if (!rows.length) throw new Error('El CSV no tiene filas de datos.');

  const headerMap = buildHeaderMap(rows[0]);
  if (!headerMap.fecha) throw new Error('El CSV debe incluir una columna fecha.');

  const seenDates = new Set();
  const stats = { leidas: rows.length, importadas: 0, omitidasDuplicadas: 0, errores: [] };

  for (const row of rows) {
    const fecha = parseDate(row[headerMap.fecha]);
    if (!fecha) {
      stats.errores.push(`Línea ${row.__line}: fecha inválida (${row[headerMap.fecha] || 'vacía'})`);
      continue;
    }

    const fechaKey = fecha.toISOString().slice(0, 10);
    if (seenDates.has(fechaKey)) {
      stats.errores.push(`Línea ${row.__line}: fecha duplicada dentro del archivo (${fechaKey})`);
      continue;
    }
    seenDates.add(fechaKey);

    const data = {
      fecha,
      etiquetaOriginal: headerMap.etiquetaOriginal ? String(row[headerMap.etiquetaOriginal] || '').trim() || null : null
    };

    let invalidNumber = false;
    for (const field of NUMERIC_FIELDS) {
      const header = headerMap[field];
      if (!header) {
        data[field] = null;
        continue;
      }
      const parsed = parseNumber(row[header]);
      if (Number.isNaN(parsed)) {
        stats.errores.push(`Línea ${row.__line}: campo numérico inválido ${field}=${row[header]}`);
        invalidNumber = true;
      } else {
        data[field] = parsed;
      }
    }
    if (invalidNumber) continue;

    const dolar = data.dolarBnaVenta;
    data.ventasUsd = data.ventasUsd ?? deriveUsd(data.ventasArs, dolar);
    data.comprasUsd = data.comprasUsd ?? deriveUsd(data.comprasArs, dolar);
    data.facturadoUsd = data.facturadoUsd ?? deriveUsd(data.facturadoArs, dolar);
    data.margenBrutoArs = data.margenBrutoArs ?? (
      Number.isFinite(data.ventasArs) && Number.isFinite(data.comprasArs) ? data.ventasArs - data.comprasArs : null
    );
    data.margenBrutoUsd = data.margenBrutoUsd ?? deriveUsd(data.margenBrutoArs, dolar);

    const exists = await prisma.estadisticaHistorica.findUnique({ where: { fecha } });
    if (exists) {
      stats.omitidasDuplicadas += 1;
      continue;
    }

    await prisma.estadisticaHistorica.create({ data });
    if (Number.isFinite(dolar) && dolar > 0) {
      await prisma.cotizacionDolar.upsert({
        where: { fecha_fuente: { fecha, fuente: 'BNA' } },
        update: { dolarBnaVenta: dolar },
        create: { fecha, fuente: 'BNA', dolarBnaVenta: dolar }
      });
    }
    stats.importadas += 1;
  }

  console.log(JSON.stringify(stats, null, 2));
  if (stats.errores.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Error al importar histórico estadístico:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

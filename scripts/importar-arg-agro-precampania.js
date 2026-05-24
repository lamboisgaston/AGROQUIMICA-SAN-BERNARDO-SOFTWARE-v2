const https = require('https');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BASE_URL = 'https://arg-agro.com.ar';
const ORIGEN = 'ARG_AGRO_IMPORT';
const USER_AGENT = 'Mozilla/5.0 (compatible; AgroquimicaImporter/1.0)';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirected = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(fetchText(redirected));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} al obtener ${url}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString('utf8'); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error(`Timeout al obtener ${url}`)));
  });
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html) {
  return decodeHtmlEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractLinksByPattern(html, pattern) {
  const out = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = stripHtml(m[2]).toLowerCase();
    const full = new URL(href, BASE_URL).toString();
    if (pattern.test(href.toLowerCase()) || pattern.test(text) || pattern.test(full.toLowerCase())) out.add(full);
  }
  return [...out];
}

function detectarCultivo(categoria, nombre, descripcion) {
  const t = `${categoria} ${nombre} ${descripcion}`.toLowerCase();
  const rules = [
    ['soja', 'Soja'], ['maiz', 'Maíz'], ['maíz', 'Maíz'], ['trigo', 'Trigo'], ['girasol', 'Girasol'],
    ['sorgo', 'Sorgo'], ['alfalfa', 'Alfalfa'], ['avena', 'Avena'], ['cebada', 'Cebada'], ['pasto', 'Pasturas'],
  ];
  for (const [k, v] of rules) if (t.includes(k)) return v;
  return categoria || 'Otro';
}

function detectarSemillero(nombre, descripcion) {
  const texto = `${nombre} ${descripcion}`;
  const marcas = ['Bayer', 'Syngenta', 'BASF', 'Nidera', 'DonMario', 'DK', 'Neogen', 'Stine', 'Macro Seed', 'Pioneer', 'Advanta'];
  for (const m of marcas) {
    const re = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(texto)) return m;
  }
  const prefijo = (nombre.match(/^([A-Z][A-Za-z0-9\-]{2,})\s+/) || [])[1];
  return prefijo || 'SIN_DETECTAR';
}

function detectarPresentacion(nombre, descripcion) {
  const texto = `${nombre} ${descripcion}`;
  const m = texto.match(/(bolsa\s*\d+[\.,]?\d*\s*(kg|g)|\d+[\.,]?\d*\s*(kg|g|l|ml)|envase\s*\d+[\.,]?\d*\s*(kg|g|l|ml)|doypack\s*\d+[\.,]?\d*\s*(kg|g))/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : 'No especificada';
}

function parseProductosDesdePagina(html, categoria) {
  const items = [];
  const cardRegex = /<article\b[\s\S]*?<\/article>|<li\b[\s\S]*?<\/li>/gi;
  const cards = html.match(cardRegex) || [];
  for (const c of cards) {
    const titulo = stripHtml((c.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) || [])[1] || '');
    if (!titulo || titulo.length < 3) continue;
    const desc = stripHtml((c.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');
    items.push({ nombre: titulo, descripcion: desc || 'Sin descripción provista', categoria });
  }
  return items;
}

async function main() {
  const home = await fetchText(BASE_URL);
  const categorias = extractLinksByPattern(home, /(categoria|cultivo|product|catalogo|shop)/i);
  if (!categorias.length) throw new Error('No se detectaron categorías/cultivos en ARG-AGRO.');

  const productoMap = new Map();
  for (const c of categorias) {
    try {
      const html = await fetchText(c);
      const categoriaTexto = stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') || 'Sin categoría';
      const productos = parseProductosDesdePagina(html, categoriaTexto);
      for (const p of productos) {
        const key = `${p.nombre.toLowerCase()}|${categoriaTexto.toLowerCase()}`;
        if (!productoMap.has(key)) productoMap.set(key, p);
      }
    } catch (e) {
      console.warn(`No se pudo leer categoría ${c}: ${e.message}`);
    }
  }

  let totalCreados = 0;
  let totalActualizados = 0;
  const porCultivo = {};
  const porLaboratorio = {};

  for (const p of productoMap.values()) {
    const cultivo = detectarCultivo(p.categoria, p.nombre, p.descripcion);
    const semilleroLaboratorio = detectarSemillero(p.nombre, p.descripcion);
    const presentacionEnvase = detectarPresentacion(p.nombre, p.descripcion);
    const descripcion = `${p.descripcion}\nOrigen: ${ORIGEN}`.trim();

    const data = {
      nombre: p.nombre,
      semilleroLaboratorio,
      categoria: p.categoria,
      cultivo,
      presentacionEnvase,
      descripcion,
      precioInternoManual: null,
      costoCompra: 0,
      precioVentaFinal: 0,
      visibleEnSemillasYa: false,
      activo: true,
      publicadoWeb: false,
      estado: 'CONSULTAR'
    };

    const existente = await prisma.productoPrecampania.findFirst({
      where: { nombre: p.nombre, cultivo, semilleroLaboratorio, categoria: p.categoria }
    });

    if (existente) {
      await prisma.productoPrecampania.update({
        where: { id: existente.id },
        data
      });
      totalActualizados += 1;
    } else {
      await prisma.productoPrecampania.create({ data });
      totalCreados += 1;
    }

    porCultivo[cultivo] = (porCultivo[cultivo] || 0) + 1;
    porLaboratorio[semilleroLaboratorio] = (porLaboratorio[semilleroLaboratorio] || 0) + 1;
  }

  console.log('Importación ARG-AGRO PRECAMPAÑA finalizada.');
  console.log(`total encontrados: ${productoMap.size}`);
  console.log(`total creados: ${totalCreados}`);
  console.log(`total actualizados: ${totalActualizados}`);
  console.log(`total por cultivo: ${JSON.stringify(porCultivo)}`);
  console.log(`total por laboratorio: ${JSON.stringify(porLaboratorio)}`);
}

main().catch((error) => {
  console.error('Error en importación ARG-AGRO:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});

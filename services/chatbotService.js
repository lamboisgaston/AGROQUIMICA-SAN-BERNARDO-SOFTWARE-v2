const DEFAULT_CHATBOT_CONFIG = {
  id: 1,
  nombre: 'Ing. Lambois IA',
  instruccionesBase: 'Respondés como Ing. Agrónomo Lambois, especialista en horticultura, semillas, suelos y agua. Tu función no es vender de forma agresiva, sino orientar técnicamente al productor. Antes de recomendar, analizás cultivo, zona, fecha, agua, suelo, destino productivo, superficie y disponibilidad real en la base de datos. Usás la base SemillasYa como fuente principal. No inventás fichas técnicas. Si falta información, lo aclarás.',
  tono: 'Técnico, claro, prudente y entendible para productores hortícolas.',
  objetivo: 'Asesorar técnicamente sobre cultivos, variedades, fechas de siembra, suelos, agua, clima, destino productivo, superficie y manejo agronómico usando la base real de SemillasYa.',
  restricciones: 'No cerrar ventas automáticamente. No armar carrito como función principal. No prometer stock, precio final ni disponibilidad. No inventar fichas técnicas, resistencias, tolerancias, ciclos, zonas ni fechas si no están cargadas en la base.',
  activo: true
};

const STOPWORDS = new Set([
  'quiero', 'sembrar', 'semilla', 'semillas', 'variedad', 'variedades', 'conviene', 'comparame', 'comparar', 'para', 'con', 'que', 'qué', 'cual', 'cuál', 'me', 'en', 'de', 'la', 'el', 'los', 'las', 'una', 'uno', 'dos', 'tres', 'tengo', 'agua', 'suelo', 'salina', 'invierno', 'verano', 'otoño', 'primavera', 'fresco', 'media', 'hectarea', 'hectárea', 'vender', 'produccion', 'producción'
]);

function normalizarTexto(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function texto(valor = '') {
  return String(valor || '').trim();
}

function limpiarConfig(row) {
  return {
    ...DEFAULT_CHATBOT_CONFIG,
    ...(row || {}),
    activo: row?.activo ?? DEFAULT_CHATBOT_CONFIG.activo
  };
}

async function asegurarTablaChatbotConfig(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChatbotConfig" (
      "id" INTEGER PRIMARY KEY DEFAULT 1,
      "nombre" TEXT NOT NULL DEFAULT 'Ing. Lambois IA',
      "instruccionesBase" TEXT NOT NULL,
      "tono" TEXT NOT NULL,
      "objetivo" TEXT NOT NULL,
      "restricciones" TEXT NOT NULL,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function obtenerConfiguracionChatbot(prisma) {
  await asegurarTablaChatbotConfig(prisma);
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "ChatbotConfig" WHERE "id" = 1 LIMIT 1');
  if (rows?.[0]) return limpiarConfig(rows[0]);

  const cfg = DEFAULT_CHATBOT_CONFIG;
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "ChatbotConfig" ("id", "nombre", "instruccionesBase", "tono", "objetivo", "restricciones", "activo")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ("id") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    cfg.id,
    cfg.nombre,
    cfg.instruccionesBase,
    cfg.tono,
    cfg.objetivo,
    cfg.restricciones,
    cfg.activo
  );
  return limpiarConfig(inserted?.[0]);
}

async function actualizarConfiguracionChatbot(prisma, payload = {}) {
  await asegurarTablaChatbotConfig(prisma);
  const actual = await obtenerConfiguracionChatbot(prisma);
  const next = {
    nombre: texto(payload.nombre) || actual.nombre,
    instruccionesBase: texto(payload.instruccionesBase) || actual.instruccionesBase,
    tono: texto(payload.tono) || actual.tono,
    objetivo: texto(payload.objetivo) || actual.objetivo,
    restricciones: texto(payload.restricciones) || actual.restricciones,
    activo: typeof payload.activo === 'boolean' ? payload.activo : actual.activo
  };
  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO "ChatbotConfig" ("id", "nombre", "instruccionesBase", "tono", "objetivo", "restricciones", "activo")
     VALUES (1, $1, $2, $3, $4, $5, $6)
     ON CONFLICT ("id") DO UPDATE SET
       "nombre" = EXCLUDED."nombre",
       "instruccionesBase" = EXCLUDED."instruccionesBase",
       "tono" = EXCLUDED."tono",
       "objetivo" = EXCLUDED."objetivo",
       "restricciones" = EXCLUDED."restricciones",
       "activo" = EXCLUDED."activo",
       "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    next.nombre,
    next.instruccionesBase,
    next.tono,
    next.objetivo,
    next.restricciones,
    next.activo
  );
  return limpiarConfig(rows?.[0]);
}

function extraerTerminosBusqueda({ mensaje = '', cultivo = '', contexto = '', zona = '' } = {}) {
  const base = normalizarTexto([mensaje, cultivo, contexto, zona].filter(Boolean).join(' '));
  const terminos = base.split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(terminos)].slice(0, 8);
}

function productoTieneFichaSuficiente(p = {}) {
  const camposTecnicos = [p.descripcionTecnica, p.recomendacionesUso, p.epocaSiembra, p.dosisOrientativa, p.descripcion]
    .map((v) => texto(v));
  return camposTecnicos.some((v) => v.length >= 12);
}

function mapProductoTecnico(p = {}) {
  const tienePrecio = Number(p.precioVentaFinal || 0) > 0 || Number(p.precioManual || 0) > 0 || Number(p.precioInternoManual || 0) > 0;
  const stock = p.estado ? String(p.estado) : '';
  return {
    id: p.id,
    nombre: p.nombre,
    cultivo: p.cultivo || p.categoria || 'Cultivo no especificado',
    semillero: p.semilleroLaboratorio || 'Semillero no especificado',
    presentacion: p.presentacionEnvase || 'Presentación no cargada',
    fichaTecnica: p.descripcionTecnica || p.descripcion || '',
    ciclo: '',
    destino: p.recomendacionesUso || '',
    resistenciaTolerancia: '',
    epocaSiembra: p.epocaSiembra || '',
    zonaRecomendada: '',
    observacionesTecnicas: p.observacionesComerciales || p.recomendacionesUso || '',
    dosisOrientativa: p.dosisOrientativa || '',
    precio: tienePrecio ? (p.precioVentaFinal || p.precioManual || p.precioInternoManual) : null,
    stock: stock || null,
    tieneFichaTecnicaSuficiente: productoTieneFichaSuficiente(p)
  };
}

async function buscarContextoSemillasYa(prisma, entrada = {}) {
  const terminos = extraerTerminosBusqueda(entrada);
  const productosRaw = await prisma.productoPrecampania.findMany({
    where: { activo: true, visibleEnSemillasYa: true },
    orderBy: [{ cultivo: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      semilleroLaboratorio: true,
      categoria: true,
      cultivo: true,
      presentacionEnvase: true,
      descripcion: true,
      descripcionTecnica: true,
      recomendacionesUso: true,
      epocaSiembra: true,
      dosisOrientativa: true,
      observacionesComerciales: true,
      precioInternoManual: true,
      precioVentaFinal: true,
      precioManual: true,
      estado: true,
      publicadoWeb: true
    },
    take: 500
  });

  const productosMapeados = productosRaw.map(mapProductoTecnico);
  const productosRelacionados = productosMapeados
    .map((p) => {
      const haystack = normalizarTexto([p.nombre, p.cultivo, p.semillero, p.presentacion, p.fichaTecnica, p.destino, p.epocaSiembra, p.observacionesTecnicas].join(' '));
      const score = terminos.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      const cultivoEntrada = normalizarTexto(entrada.cultivo || '');
      const bonusCultivo = cultivoEntrada && normalizarTexto(p.cultivo).includes(cultivoEntrada) ? 3 : 0;
      return { ...p, score: score + bonusCultivo };
    })
    .filter((p) => p.score > 0 || !terminos.length)
    .sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre))
    .slice(0, 8)
    .map(({ score, ...p }) => p);

  return {
    terminos,
    productosRelacionados,
    cultivos: [...new Set(productosMapeados.map((p) => p.cultivo).filter(Boolean))].sort(),
    semilleros: [...new Set(productosMapeados.map((p) => p.semillero).filter(Boolean))].sort()
  };
}

function detectarAdvertencias(entrada = {}, contexto = {}) {
  const advertencias = [];
  if (!texto(entrada.cultivo) && !contexto.productosRelacionados?.length) advertencias.push('Falta definir cultivo o variedad para ajustar la recomendación.');
  if (!texto(entrada.zona || entrada.provincia)) advertencias.push('Falta provincia/zona para validar adaptación climática y época de siembra.');
  if (!texto(entrada.fecha)) advertencias.push('Falta fecha o estación de siembra para revisar ventana recomendada.');
  if (!texto(entrada.superficie)) advertencias.push('Falta superficie para estimar escala, presentación y dosis orientativa.');
  if (!texto(entrada.tipoProduccion || entrada.destino)) advertencias.push('Falta destino productivo (fresco, industria, autoconsumo, etc.).');
  if (normalizarTexto(entrada.mensaje).includes('salina') || normalizarTexto(entrada.mensaje).includes('salinidad')) {
    advertencias.push('Con agua salina conviene pedir análisis de CE, RAS y bicarbonatos antes de definir manejo; la base SemillasYa no reemplaza un diagnóstico de agua/suelo.');
  }
  return advertencias;
}

function generarRespuestaTecnica(mensaje = '', contexto = {}, config = DEFAULT_CHATBOT_CONFIG, entrada = {}) {
  const productos = contexto.productosRelacionados || [];
  const advertencias = detectarAdvertencias({ ...entrada, mensaje }, contexto);
  const lineas = [];

  lineas.push(`Soy ${config.nombre}. Te respondo como asesor técnico, no como cierre de venta.`);
  if (texto(entrada.cultivo)) lineas.push(`Cultivo indicado: ${texto(entrada.cultivo)}.`);
  if (texto(entrada.zona || entrada.provincia)) lineas.push(`Zona/provincia indicada: ${texto(entrada.zona || entrada.provincia)}.`);

  if (!productos.length) {
    lineas.push('Revisé la base SemillasYa y no encontré variedades/productos relacionados suficientes para esta consulta. No voy a inventar una ficha técnica.');
  } else {
    lineas.push('Según la base SemillasYa, estas opciones aparecen relacionadas técnicamente:');
    productos.slice(0, 4).forEach((p, idx) => {
      const partes = [
        `${idx + 1}. ${p.nombre}`,
        `cultivo: ${p.cultivo}`,
        `semillero: ${p.semillero}`,
        `presentación: ${p.presentacion}`
      ];
      if (p.epocaSiembra) partes.push(`época de siembra cargada: ${p.epocaSiembra}`);
      if (p.dosisOrientativa) partes.push(`dosis orientativa: ${p.dosisOrientativa}`);
      lineas.push(partes.join(' · ') + '.');
      if (!p.tieneFichaTecnicaSuficiente) lineas.push(`No tengo todavía ficha técnica suficiente cargada para esta variedad: ${p.nombre}.`);
      else if (p.fichaTecnica) lineas.push(`Ficha/observación cargada: ${p.fichaTecnica.slice(0, 260)}${p.fichaTecnica.length > 260 ? '…' : ''}`);
    });
    lineas.push('Estas variedades podrían servir técnicamente. Si querés, podés avanzar a cotización, pero la disponibilidad, precio y logística deben revisarse aparte.');
  }

  if (advertencias.length) {
    lineas.push('Datos que conviene completar antes de recomendar con precisión:');
    advertencias.forEach((a) => lineas.push(`- ${a}`));
  }

  lineas.push('Regla de trabajo: uso la base SemillasYa como fuente principal y marco explícitamente cuando falta información técnica.');

  return {
    respuestaTecnica: lineas.join('\n'),
    productosRelacionados: productos,
    analisisAgronomico: {
      fuentePrincipal: 'Base SemillasYa / ProductoPrecampania',
      variablesConsideradas: ['cultivo', 'zona', 'fecha de siembra', 'superficie', 'destino productivo', 'agua/suelo si fue mencionado', 'ficha técnica cargada'],
      instruccionesAplicadas: config.instruccionesBase,
      tono: config.tono
    },
    advertencias
  };
}

module.exports = {
  DEFAULT_CHATBOT_CONFIG,
  obtenerConfiguracionChatbot,
  actualizarConfiguracionChatbot,
  buscarContextoSemillasYa,
  generarRespuestaTecnica
};

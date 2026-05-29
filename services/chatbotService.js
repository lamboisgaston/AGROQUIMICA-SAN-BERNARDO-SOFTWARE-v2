const DEFAULT_CHATBOT_CONFIG = {
  id: 1,
  nombre: 'Ing. Lambois IA',
  rolPrincipal: 'Asesor técnico agronómico especializado en horticultura, semillas, suelos y agua.',
  instruccionesBase: 'No actuar como vendedor. Primero entender el problema productivo. Preguntar zona, cultivo, fecha de siembra, tipo de suelo, agua disponible, superficie y destino comercial.',
  flujoPreguntasObligatorias: `- ¿En qué zona o provincia estás?
- ¿Qué cultivo querés sembrar?
- ¿En qué fecha pensás sembrar?
- ¿Qué superficie tenés?
- ¿Es para autoconsumo, fresco, industria o venta mayorista?
- ¿Qué tipo de agua usás?
- ¿Conocés algo del suelo?`,
  criteriosTecnicosRespuesta: 'Debe analizar época de siembra, ciclo, destino, tolerancias, disponibilidad de variedades en SemillasYa y ficha técnica cargada.',
  frasesPermitidas: `“Con los datos que me das, técnicamente miraría estas opciones…”
“Antes de recomendarte una variedad, necesito saber…”`,
  frasesProhibidas: `No decir: comprá este producto ya.
No inventar datos técnicos.
No prometer resultados productivos.`,
  estiloRespuesta: 'Claro, técnico, amable, explicado para productor común.',
  cierreSugerido: 'Si corresponde, decir: “Estas opciones pueden servir técnicamente. Si querés, podés avanzar a una cotización.”',
  // Campos heredados para instalaciones que ya tenían esta tabla antes de ampliar el flujo.
  tono: 'Técnico, claro, prudente y entendible para productores hortícolas.',
  objetivo: 'Asesorar técnicamente sobre cultivos, variedades, fechas de siembra, suelos, agua, clima, destino productivo, superficie y manejo agronómico usando la base real de SemillasYa.',
  restricciones: 'No cerrar ventas automáticamente. No armar carrito como función principal. No prometer stock, precio final ni disponibilidad. No inventar fichas técnicas, resistencias, tolerancias, ciclos, zonas ni fechas si no están cargadas en la base.',
  activo: true
};

const STOPWORDS = new Set([
  'quiero', 'sembrar', 'semilla', 'semillas', 'variedad', 'variedades', 'conviene', 'comparame', 'comparar', 'para', 'con', 'que', 'qué', 'cual', 'cuál', 'me', 'en', 'de', 'la', 'el', 'los', 'las', 'una', 'uno', 'dos', 'tres', 'tengo', 'agua', 'suelo', 'salina', 'invierno', 'verano', 'otoño', 'primavera', 'fresco', 'media', 'hectarea', 'hectárea', 'vender', 'produccion', 'producción'
]);

function sanitizarMensajeUsuario(valor = '') {
  return String(valor || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function normalizarTexto(valor = '') {
  return sanitizarMensajeUsuario(valor)
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

async function obtenerConfiguracionChatbot(prisma) {
  const config = await prisma.chatbotConfig.findFirst({
    where: { id: DEFAULT_CHATBOT_CONFIG.id }
  });

  if (config) return limpiarConfig(config);

  const creada = await prisma.chatbotConfig.create({
    data: { ...DEFAULT_CHATBOT_CONFIG }
  });

  return limpiarConfig(creada);
}

async function actualizarConfiguracionChatbot(prisma, payload = {}) {
  const actual = await obtenerConfiguracionChatbot(prisma);
  const next = {
    nombre: texto(payload.nombre) || actual.nombre,
    rolPrincipal: texto(payload.rolPrincipal) || actual.rolPrincipal,
    instruccionesBase: texto(payload.instruccionesBase) || actual.instruccionesBase,
    flujoPreguntasObligatorias: texto(payload.flujoPreguntasObligatorias) || actual.flujoPreguntasObligatorias,
    criteriosTecnicosRespuesta: texto(payload.criteriosTecnicosRespuesta) || actual.criteriosTecnicosRespuesta,
    frasesPermitidas: texto(payload.frasesPermitidas) || actual.frasesPermitidas,
    frasesProhibidas: texto(payload.frasesProhibidas) || actual.frasesProhibidas,
    estiloRespuesta: texto(payload.estiloRespuesta) || actual.estiloRespuesta,
    cierreSugerido: texto(payload.cierreSugerido) || actual.cierreSugerido,
    tono: texto(payload.tono || payload.estiloRespuesta) || actual.tono,
    objetivo: texto(payload.objetivo || payload.rolPrincipal) || actual.objetivo,
    restricciones: texto(payload.restricciones || payload.frasesProhibidas) || actual.restricciones,
    activo: typeof payload.activo === 'boolean' ? payload.activo : actual.activo
  };

  const config = await prisma.chatbotConfig.upsert({
    where: { id: DEFAULT_CHATBOT_CONFIG.id },
    create: { id: DEFAULT_CHATBOT_CONFIG.id, ...next },
    update: next
  });

  return limpiarConfig(config);
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

function primeraLinea(valor = '') {
  return texto(valor).split('\n').map((v) => v.trim()).filter(Boolean)[0] || '';
}

function esSaludoSimple(mensaje = '') {
  return ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches'].includes(normalizarTexto(mensaje));
}

function generarRespuestaTecnica(mensaje = '', contexto = {}, config = DEFAULT_CHATBOT_CONFIG, entrada = {}) {
  const cfg = limpiarConfig(config);
  if (esSaludoSimple(mensaje)) {
    return {
      respuestaTecnica: 'Hola, soy el Ing. Lambois IA. Para orientarte técnicamente necesito saber cultivo, zona, fecha de siembra, suelo, agua y destino productivo.',
      productosRelacionados: [],
      analisisAgronomico: {
        fuentePrincipal: 'Saludo inicial',
        variablesConsideradas: ['cultivo', 'zona', 'fecha de siembra', 'suelo', 'agua', 'destino productivo'],
        instruccionesAplicadas: cfg.instruccionesBase,
        flujoPreguntasObligatorias: cfg.flujoPreguntasObligatorias,
        criteriosTecnicosRespuesta: cfg.criteriosTecnicosRespuesta,
        frasesProhibidas: cfg.frasesProhibidas,
        estiloRespuesta: cfg.estiloRespuesta
      },
      advertencias: []
    };
  }
  const productos = contexto.productosRelacionados || [];
  const advertencias = detectarAdvertencias({ ...entrada, mensaje }, contexto);
  const lineas = [];
  const frasePermitida = primeraLinea(cfg.frasesPermitidas);

  lineas.push(`Soy ${cfg.nombre}. ${cfg.rolPrincipal}`);
  if (frasePermitida) lineas.push(frasePermitida);
  else lineas.push('Te respondo como asesor técnico, no como cierre de venta.');
  if (texto(entrada.cultivo)) lineas.push(`Cultivo indicado: ${texto(entrada.cultivo)}.`);
  if (texto(entrada.zona || entrada.provincia)) lineas.push(`Zona/provincia indicada: ${texto(entrada.zona || entrada.provincia)}.`);

  if (!productos.length) {
    lineas.push('No encontré información técnica cargada para esa consulta.');
  } else {
    lineas.push('Según los criterios técnicos configurados y la base SemillasYa, estas opciones aparecen relacionadas técnicamente:');
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
    lineas.push(texto(cfg.cierreSugerido) || 'Estas variedades podrían servir técnicamente. Si querés, podés avanzar a cotización, pero la disponibilidad, precio y logística deben revisarse aparte.');
  }

  if (advertencias.length) {
    lineas.push('Datos que conviene completar antes de recomendar con precisión:');
    advertencias.forEach((a) => lineas.push(`- ${a}`));
  }

  if (texto(cfg.flujoPreguntasObligatorias)) {
    lineas.push('Flujo obligatorio a completar si falta información:');
    lineas.push(cfg.flujoPreguntasObligatorias);
  }

  lineas.push(`Regla de trabajo: ${texto(cfg.instruccionesBase)} Criterios técnicos: ${texto(cfg.criteriosTecnicosRespuesta)} Límites: ${texto(cfg.frasesProhibidas || cfg.restricciones)}`);

  return {
    respuestaTecnica: lineas.join('\n'),
    productosRelacionados: productos,
    analisisAgronomico: {
      fuentePrincipal: 'Base SemillasYa / ProductoPrecampania',
      variablesConsideradas: ['cultivo', 'zona', 'fecha de siembra', 'superficie', 'destino productivo', 'agua/suelo si fue mencionado', 'ficha técnica cargada'],
      instruccionesAplicadas: cfg.instruccionesBase,
      flujoPreguntasObligatorias: cfg.flujoPreguntasObligatorias,
      criteriosTecnicosRespuesta: cfg.criteriosTecnicosRespuesta,
      frasesProhibidas: cfg.frasesProhibidas,
      estiloRespuesta: cfg.estiloRespuesta
    },
    advertencias
  };
}

module.exports = {
  DEFAULT_CHATBOT_CONFIG,
  obtenerConfiguracionChatbot,
  actualizarConfiguracionChatbot,
  buscarContextoSemillasYa,
  generarRespuestaTecnica,
  sanitizarMensajeUsuario
};

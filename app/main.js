const $ = (s) => document.querySelector(s);
const money = (v) => '$' + Number(v || 0).toFixed(2);
const clampPorcentaje = (v) => Math.min(100, Math.max(0, Number(v || 0)));

let ventaId = null;
let venta = null;
let listasComerciales = [];
let productosListaComercial = [];
let productos = [];
let resultadosProductosVisibles = [];
let indiceProductoSeleccionado = -1;
let buscadorProductosTimer = null;
let categoriaMostradorActiva = 'TODAS';
let cuentaCorrienteMostrada = null;
let fechaCajaSeleccionada = null;
let fechaVentasCobradasSeleccionada = null;
let tipoCambioActual = 1;
let proveedores = [];
let proveedoresFiltrados = [];
let proveedorSeleccionadoId = null;
let remitoDetalles = [];
let filtroProductosAdmin = '';
let modoProducto = 'AGREGAR';
let categoriasProducto = [];
let presupuestoClienteId = null;
let presupuestoTipoDestinatario = 'A_QUIEN_CORRESPONDA';
let presupuestoNombreLibre = '';
let presupuestoItems = [];
let presupuestoTipoOperacion = 'MOSTRADOR';
let presupuestoModuloActivo = 'MOSTRADOR';
let filtroProductosPresupuesto = '';
let productosPresupuestoVisibles = [];
let solicitudesTerritoriales = [];
let provinciaTerritorialActiva = '';
let solicitudTerritorialActivaId = null;
let pedidoProveedorId = null;
let pedidoItems = [];
let productosPedidoVisibles = [];
let catalogoGuaschCategorias = [];
let precampaniaSemilleros = [];
let precampaniaProductos = [];
let precampaniaContextoCarga = { cultivo: '', semillero: '', categoria: '' };
let precampaniaCultivos = [];
let precampaniaCultivoActivo = 'TODOS';
let productoSemillasYaParaDuplicar = null;
const VENTA_ACTIVA_STORAGE_KEY = 'venta_activa_id';

function setVentaActivaId(id) {
  const parsed = Number(id);
  if (Number.isInteger(parsed) && parsed > 0) {
    localStorage.setItem(VENTA_ACTIVA_STORAGE_KEY, String(parsed));
  } else {
    localStorage.removeItem(VENTA_ACTIVA_STORAGE_KEY);
  }
}

function getVentaActivaId() {
  const raw = localStorage.getItem(VENTA_ACTIVA_STORAGE_KEY);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', 'x-user-role': activeRole || '' }, ...options });

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_) {
    data = rawText || null;
  }

  if (!response.ok) {
    const errorMessage = (typeof data === 'object' && data)
      ? (data.error || data.message)
      : (String(data || '').trim());
    const err = new Error(errorMessage || `Error ${response.status}`);
    err.status = response.status;
    err.body = data;
    err.url = url;
    throw err;
  }

  return data;
}


function escapeHtmlClient(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setMsg(text, type = 'info') {
  const msg = $('#msg');
  msg.textContent = String(text || '');
  msg.className = `msg msg-${type}`;
}
function normalizarMonedaProducto(valor) {
  const v = String(valor || '').trim().toUpperCase();
  if (v === 'USD' || v === 'DOLAR' || v === 'DÓLAR' || v === 'DOLARES' || v === 'DÓLARES') return 'USD';
  if (v === 'ARS' || v === 'PESOS' || v === 'PESO') return 'ARS';
  return 'ARS';
}
function pct(base, p) { return Number(base) * (1 + (Number(p || 0) / 100)); }

function calcularPrecioSemillasYa(producto = {}, tipoCambioSistema = 1) {
  const tc = Number(tipoCambioSistema || 1);
  const ivaRate = 0.21;
  const precioListaUsd = Number(producto.precioListaUsd ?? 0);
  const costoCompra = Number(producto.costoCompra ?? 0);
  const precioInternoManual = Number(producto.precioInternoManual ?? 0);
  const fletePorcentaje = Number(producto.porcentajeFlete ?? producto.fletePorcentaje ?? 10);
  const baseUsd = [precioListaUsd, costoCompra, precioInternoManual].find((v) => Number.isFinite(v) && v > 0) || 0;
  const tienePrecio = baseUsd > 0;
  if (!tienePrecio) return { tienePrecio: false, precioFinalConIva: null, precioListaUsd, costoCompra, precioInternoManual, baseUsd: 0 };
  const precioUsdConFlete = baseUsd * (1 + (fletePorcentaje / 100));
  const precioArsSinIva = precioUsdConFlete * tc;
  const iva = precioArsSinIva * ivaRate;
  const precioFinalConIva = precioArsSinIva + iva;
  return { tienePrecio: true, precioFinalConIva, precioListaUsd, costoCompra, precioInternoManual, baseUsd, precioUsdConFlete, precioArsSinIva, iva };
}
function calcularSubtotalRemito(item) {
  const basePesos = item.monedaCosto === 'USD' ? Number(item.costoCompra || 0) * tipoCambioActual : Number(item.costoCompra || 0);
  return pct(pct(pct(basePesos, item.ivaPorcentaje), item.fletePorcentaje), item.gananciaPorcentaje) * Number(item.cantidad || 0);
}
function calcularPrecioProductoForm() {
  const monedaCompra = $('#prod-moneda').value;
  const costoCompra = Number($('#prod-costo').value || 0);
  const ivaPorcentaje = Number($('#prod-iva').value || 0);
  const fletePorcentaje = Number($('#prod-flete').value || 0);
  const margenGananciaPorcentaje = Number($('#prod-ganancia').value || 0);
  const costoCompraPesos = monedaCompra === 'USD' ? (costoCompra * tipoCambioActual) : costoCompra;
  const costoConIva = costoCompraPesos * (1 + (ivaPorcentaje / 100));
  const costoTotalPesos = costoConIva * (1 + (fletePorcentaje / 100));
  const precioVentaPesos = costoTotalPesos * (1 + (margenGananciaPorcentaje / 100));
  return {
    costoCompra,
    monedaCompra,
    costoCompraPesos,
    ivaPorcentaje,
    fletePorcentaje,
    margenGananciaPorcentaje,
    costoTotalPesos,
    precioVentaPesos
  };
}

function logFlujo(paso, payload) {
  if (payload !== undefined) {
    console.log(`[flujo-venta] ${paso}`, payload);
    return;
  }
  console.log(`[flujo-venta] ${paso}`);
}




function obtenerImagenProducto(p) {
  return p?.imagenUrl || p?.fotoUrl || p?.imageUrl || p?.imagen || p?.foto || '';
}

function productoEsSenasaMip(p = {}) {
  const categoria = String(p.categoria || '').trim().toUpperCase();
  const categorias = (p.categorias || []).map((c) => String(c?.nombre || '').trim().toUpperCase());
  return p.activo !== false && (Boolean(p.aptoSenasaMip) || categoria === 'AGROQUÍMICOS SENASA' || categorias.includes('AGROQUÍMICOS SENASA') || Boolean(p.nombreComercial));
}

function renderProductoCard(p, opciones = {}) {
  const {
    accion = '',
    accionLabel = 'Agregar',
    accionClass = 'btn-accion-agregar',
    extraBotones = '',
    seleccionado = false,
    mostrarCosto = false,
    proveedoresTexto = ''
  } = opciones;
  const imagen = obtenerImagenProducto(p);
  const imagenHtml = imagen
    ? `<img src="${imagen}" alt="${p.nombre || 'Producto'}" class="producto-card-img" loading="lazy" />`
    : '<div class="producto-card-placeholder">Sin foto</div>';
  const esPrecampania = Boolean(p._precampania);
  const precio = money(p.precioPesosCalculado || p.precioVentaPesos || p.precioFinalPesos || p.precioFinal || p.precioUsd || 0);
  const stock = Number(p.stock ?? 0);
  const metaHtml = esPrecampania
    ? `
      <div class="producto-meta">Categoría: <strong>${p.categoria || '-'}</strong> · Envase: <strong>${p.envase || '-'}</strong></div>
      <div class="producto-meta">Precio final: <strong>${money(p.precioFinal || 0)}</strong></div>
      <div class="producto-meta">Estado: <strong>${p.estado || '-'}</strong> · Margen: <strong>${Number(p.margenPorcentaje || 0).toFixed(2)}%</strong></div>
      ${p.gananciaEstimada != null ? `<div class="producto-meta">Ganancia estimada: <strong>${money(p.gananciaEstimada)}</strong></div>` : ''}
    `
    : `
      <div class="producto-meta">Categorías: <strong>${(p.categorias || []).map((c) => c.nombre).join(', ') || p.categoria || '-'}</strong></div>
      <div class="producto-meta">Marca: <strong>${p.marca || '-'}</strong> · Unidad: <strong>${p.unidad || '-'}</strong></div>
      <div class="producto-meta">Precio: <strong>${precio}</strong> · Stock: <strong>${stock}</strong></div>
    `;
  return `<div class="item producto-card ${seleccionado ? 'item-seleccionado' : ''}">
    <div class="producto-media">${imagenHtml}</div>
    <div class="producto-info">
      <div class="producto-titulo">${p.nombre || '-'} ${productoEsSenasaMip(p) ? '<span class="pill senasa">SENASA / ANMAT</span>' : ''}</div>
      ${metaHtml}
      ${proveedoresTexto ? `<div class="producto-meta">Proveedores: <strong>${proveedoresTexto}</strong></div>` : ''}
      ${mostrarCosto ? `<div class="producto-meta">Costo compra: <strong>${p.monedaCompra || p.monedaCosto || 'ARS'} ${money(p.costoCompra ?? p.costoBase)}</strong> · Convertido: <strong>${money(p.costoCompraPesos)}</strong></div>` : ''}
    </div>
    <div class="producto-acciones">
      ${accion ? `<button class="${accionClass}" ${accion}="${p.id}">${accionLabel}</button>` : ''}
      ${extraBotones}
    </div>
  </div>`;
}
function labelCliente(p) {
  const tipo = String(p.tipoCliente || 'PERSONAL').toUpperCase();
  const compras = Number(p.cantidadCompras || 0);
  const total = money(p.totalComprado || 0);
  return `${tipo} | Tel: ${p.telefono || '-'} | ${p.nombre || '-'} | ${p.cuitDni || '-'} | Compras: ${compras} | Total comprado: ${total}`;
}
function actualizarFormularioTipoCliente() {
  const tipo = $('#nuevo-tipo-cliente')?.value || 'PERSONAL';
  $('#nuevo-nombre').placeholder = tipo === 'EMPRESA' ? 'Razón social (obligatorio)' : 'Nombre (obligatorio)';
  $('#nuevo-cuit').placeholder = tipo === 'EMPRESA' ? 'CUIT (obligatorio)' : 'CUIT opcional';
  $('#nuevo-telefono').placeholder = 'Teléfono (obligatorio)';
  $('#nuevo-mail').placeholder = tipo === 'EMPRESA' ? 'Mail (obligatorio)' : 'Mail opcional';
}


function limpiarFormularioNuevoCliente() {
  $('#nuevo-nombre').value = '';
  $('#nuevo-cuit').value = '';
  $('#nuevo-telefono').value = '';
  $('#nuevo-mail').value = '';
}

function validarDatosCliente({ tipoCliente, nombre, telefono, cuitDni, mail }) {
  if (!telefono) return 'Para PERSONAL: teléfono obligatorio';
  if (tipoCliente === 'EMPRESA' && (!cuitDni || !mail)) return 'Para EMPRESA: razón social, CUIT, teléfono y mail obligatorios';
  return null;
}

async function crearClientePayload({ tipoCliente, nombre, telefono, cuitDni, mail }) {
  return api('/personas', {
    method: 'POST',
    body: JSON.stringify({
      nombre,
      razonSocial: nombre,
      telefono,
      cuitDni,
      cuit: cuitDni,
      mail,
      tipo: 'CLIENTE',
      tipoCliente
    })
  });
}
function mostrarErrorBusqueda(containerSelector, error) {
  const detalle = error?.body ? (typeof error.body === 'string' ? error.body : JSON.stringify(error.body)) : '';
  console.error('[busqueda][frontend] error', { containerSelector, error, detalle });
  const container = $(containerSelector);
  if (!container) return;
  container.innerHTML = `<div class="item">Error al buscar: ${error?.message || 'Error desconocido'}${detalle ? ` | ${detalle}` : ''}</div>`;
}

async function buscarProductos(query) {
  const q = (query || '').trim();
  console.log('Buscando productos:', q);
  if (!q) return [];
  const data = await api(`/productos?q=${encodeURIComponent(q)}`);
  const lista = Array.isArray(data) ? data : [];
  console.log('Resultados productos:', lista);
  return lista.slice(0, 8);
}

async function buscarPersonas(query) {
  const q = (query || '').trim();
  console.log(`Buscando clientes: ${q || '[listado completo]'}`);
  if (!q) return api('/clientes');
  return api('/clientes?q=' + encodeURIComponent(q));
}

function renderListaClientesMostrador(personas = []) {
  const contenedor = $('#resultados-clientes');
  if (!contenedor) return;
  contenedor.innerHTML = personas.length
    ? personas.slice(0, 20).map((p) => `<div class="item"><strong>${p.nombre || '-'}</strong> | Tel: ${p.telefono || '-'} | CUIT: ${p.cuitDni || '-'} | Mail: ${p.mail || '-'} <button data-persona="${p.id}">Seleccionar cliente</button> <button data-eliminar-cliente="${p.id}">Eliminar</button></div>`).join('')
    : '<div class="item">No se encontraron clientes</div>';
}

async function eliminarConPassword(endpoint, entidad) {
  const password = prompt('Ingrese contraseña para eliminar');
  if (password == null) return false;
  const motivo = prompt('Motivo de eliminación (opcional)') || '';
  await api(endpoint, { method: 'DELETE', body: JSON.stringify({ password, motivo }) });
  setMsg(`${entidad} eliminado correctamente`, 'info');
  return true;
}

async function buscarProveedores(query) {
  const q = (query || '').trim();
  console.log(`Buscando proveedor: ${q}`);
  if (!q) return [];
  return api('/proveedores?q=' + encodeURIComponent(q));
}

async function renderProductos() {
  const q = $('#buscar-producto').value.trim();
  try {
    const tipoOperacion = $('#tipo-operacion-venta')?.value || 'MOSTRADOR';
    const lista = tipoOperacion === 'PRECAMPAÑA'
      ? productosListaComercial
        .filter((p) => (p.nombreProducto || '').toLowerCase().includes(q.toLowerCase()))
        .map((p) => ({
          id: p.id,
          nombre: p.nombreProducto,
          categoria: p.categoria,
          envase: p.envase,
          precioUsd: Number(p.precioUsd || p.precioNeto || 0),
          precioFinal: Number(p.precioFinal || p.precioSugeridoPublico || p.precioNeto || 0),
          estado: p.estado,
          margenPorcentaje: Number(p.margenPorcentaje || 0),
          gananciaEstimada: p.gananciaEstimada == null ? null : Number(p.gananciaEstimada),
          _precampania: true
        }))
      : filtrarProductosMostrador(q, categoriaMostradorActiva);
    resultadosProductosVisibles = lista;
    if (lista.length === 0) indiceProductoSeleccionado = -1;
    if (lista.length > 0 && (indiceProductoSeleccionado < 0 || indiceProductoSeleccionado >= lista.length)) {
      indiceProductoSeleccionado = 0;
    }
    $('#resultados-productos').innerHTML = lista.length
      ? lista.map((p, idx) => renderProductoCard(p, { seleccionado: idx === indiceProductoSeleccionado, accion: 'data-producto', accionLabel: 'Agregar', accionClass: 'btn-accion-agregar' })).join('')
      : '<div class="item">Sin resultados</div>';
  } catch (error) {
    mostrarErrorBusqueda('#resultados-productos', error);
  }
}

function normalizarBusquedaTexto(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function construirIndiceBusquedaProducto(producto = {}) {
  const categorias = (producto.categorias || []).map((c) => c?.nombre).filter(Boolean).join(' ');
  return normalizarBusquedaTexto([
    producto.nombre,
    producto.marca,
    producto.categoria,
    producto.descripcion,
    producto.codigo,
    producto.sku,
    producto.skuExterno,
    producto.presentacion,
    producto.envase,
    producto.unidad,
    producto.semillero,
    producto.observaciones,
    categorias
  ].filter(Boolean).join(' '));
}

function filtrarProductosMostrador(query = '', categoria = 'TODAS') {
  const q = normalizarBusquedaTexto(query);
  const qTokens = q.split(' ').filter(Boolean);
  const filtroCategoria = normalizarBusquedaTexto(categoria);
  const listaBase = productos.filter((p) => {
    if (filtroCategoria === 'todas') return true;
    const categorias = (p.categorias || []).map((c) => normalizarBusquedaTexto(c.nombre));
    return categorias.includes(filtroCategoria) || normalizarBusquedaTexto(p.categoria || '') === filtroCategoria;
  });
  if (!q) return listaBase.slice(0, 24);

  return listaBase
    .map((p) => {
      const nombre = normalizarBusquedaTexto(p.nombre || '');
      const marca = normalizarBusquedaTexto(p.marca || '');
      const categoriaTexto = normalizarBusquedaTexto([p.categoria, ...(p.categorias || []).map((c) => c?.nombre)].filter(Boolean).join(' '));
      const indice = construirIndiceBusquedaProducto(p);
      const coincideTodosTokens = qTokens.every((token) => indice.includes(token));
      if (!coincideTodosTokens) return null;

      let score = 0;
      if (nombre === q) score += 1000;
      else if (nombre.startsWith(q)) score += 700;
      else if (nombre.includes(q)) score += 500;

      if (marca.startsWith(q) || categoriaTexto.startsWith(q)) score += 240;
      if (marca.includes(q) || categoriaTexto.includes(q)) score += 180;
      if (indice.includes(q)) score += 120;
      score += Math.max(0, 80 - nombre.length / 10);

      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.p.nombre || '').localeCompare(String(b.p.nombre || ''), 'es'))
    .slice(0, 24)
    .map(({ p }) => p);
}

function renderCategoriasMostrador() {
  const cont = $('#mostrador-categorias-chips');
  if (!cont) return;
  const categorias = Array.from(new Set(productos
    .flatMap((p) => (p.categorias || []).map((c) => c.nombre).concat(p.categoria ? [p.categoria] : []))
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));
  const base = ['GENERAL', 'SEMILLAS', 'FERTILIZANTES', 'AGROQUÍMICOS', 'RIEGO'];
  const visibles = Array.from(new Set([...base, ...categorias])).slice(0, 20);
  cont.innerHTML = [`<button type="button" class="mostrador-chip ${categoriaMostradorActiva === 'TODAS' ? 'is-active' : ''}" data-cat-mostrador="TODAS">TODAS</button>`,
    ...visibles.map((cat) => `<button type="button" class="mostrador-chip ${categoriaMostradorActiva === cat ? 'is-active' : ''}" data-cat-mostrador="${cat}">${cat}</button>`)].join('');
}

async function agregarProductoAlCarrito(productoId) {
  const tipoOperacion = $('#tipo-operacion-venta')?.value || 'MOSTRADOR';
  if (!ventaId) {
    const listaComercialId = $('#lista-comercial-select')?.value ? Number($('#lista-comercial-select').value) : null;
    const v = await api('/mostrador/ventas', { method: 'POST', body: JSON.stringify({ tipoOperacion, listaComercialId }) });
    ventaId = v.id;
    setVentaActivaId(ventaId);
  }
  if (!productoId) return setMsg('Producto inválido');
  try {
    if (tipoOperacion === 'PRECAMPAÑA') {
      const listaComercialId = Number($('#lista-comercial-select').value || 0);
      const calc = await api('/api/precios-precampaña/calcular', { method: 'POST', body: JSON.stringify({ listaComercialId, productoListaComercialId: Number(productoId) }) });
      $('#precio-precampania-detalle').innerHTML = `<div class="item">Base: ${money(calc.precioBase)} | Final: ${money(calc.precioFinal)} | Reglas: ${(calc.reglasAplicadas || []).map(r => `${r.nombre}(${r.valor}%)`).join(', ') || 'sin reglas'}</div>`;
      await api(`/mostrador/ventas/${ventaId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          productoId,
          cantidad: 1,
          precioUnitario: Number(calc.precioFinal || 0),
          tipoOperacion: 'PRECAMPAÑA',
          productoListaComercialId: Number(productoId)
        })
      });
      await refreshVenta();
      await loadCaja20();
      $('#buscar-producto').value = '';
      indiceProductoSeleccionado = -1;
      renderProductos();
      $('#buscar-producto').focus();
      return setMsg(`Producto PRECAMPAÑA agregado con precio final ${money(calc.precioFinal)}.`);
    }
    const producto = resultadosProductosVisibles.find((p) => Number(p.id) === Number(productoId)) || productos.find((p) => Number(p.id) === Number(productoId));
    console.log('Producto agregado al carrito:', producto || { id: productoId });
    await api(`/mostrador/ventas/${ventaId}/items`, { method: 'POST', body: JSON.stringify({ productoId, cantidad: 1 }) });
    await refreshVenta();
    await loadCaja20();
    $('#buscar-producto').value = '';
    indiceProductoSeleccionado = -1;
    renderProductos();
    $('#buscar-producto').focus();
  } catch (err) {
    console.error('[mostrador][carrito] error al agregar producto', { productoId, error: err });
    setMsg(`Error al agregar producto: ${err.message}`);
  }
}

async function cargarListasComerciales() {
  listasComerciales = await api('/api/listas-comerciales');
  const select = $('#lista-comercial-select');
  if (!select) return;
  select.innerHTML = listasComerciales.map((l) => `<option value="${l.id}">${l.nombre} - ${l.empresaComercial?.nombre || ''}</option>`).join('');
}

async function cargarProductosListaComercial() {
  const listaId = Number($('#lista-comercial-select')?.value || 0);
  if (!listaId) return;
  productosListaComercial = await api(`/api/listas-comerciales/${listaId}/productos`);
  catalogoGuaschCategorias = construirCatalogoGuasch(productosListaComercial);
  renderCatalogoGuasch();
}

function extraerMetaGuasch(skuExterno = '') {
  const raw = String(skuExterno || '');
  if (!raw.startsWith('GUASCH|')) return {};
  const payload = raw.slice('GUASCH|'.length);
  try {
    const decoded = atob(payload);
    const obj = JSON.parse(decoded);
    return {
      cat: obj.categoria || 'SIN_CATEGORIA',
      subcat: obj.subcategoria || null,
      estado: obj.estado || 'DISPONIBLE',
      ...obj
    };
  } catch {
    const chunks = raw.split('|').slice(1);
    const meta = {};
    for (const chunk of chunks) {
      const [k, ...rest] = chunk.split('=');
      meta[k] = rest.join('=');
    }
    return meta;
  }
}

function normalizarCategoriaGuasch(item) {
  const nombre = String(item.nombre || '').trim();
  let categoria = String(item.categoria || 'SIN_CATEGORIA').trim();
  let subcategoria = item.subcategoria ? String(item.subcategoria).trim() : null;

  if (categoria.includes('/')) {
    const [cat, subcat] = categoria.split('/').map((v) => v.trim()).filter(Boolean);
    if (cat) categoria = cat;
    if (!subcategoria && subcat) subcategoria = subcat;
  }

  const alfalfas = new Set(['Brava', 'Armona', 'Pampa Flor', 'Vector', 'Sirosal', 'CUF 101', 'Aurora']);
  if (alfalfas.has(nombre)) {
    categoria = 'Pasturas';
    subcategoria = 'Alfalfas';
  }

  if (nombre === 'Raigrás Anual Tetraploide Macho') {
    categoria = 'Pasturas';
    subcategoria = 'Gramíneas Forrajeras Templadas';
  }

  return { categoria, subcategoria };
}

function construirCatalogoGuasch(productos = []) {
  const porCategoria = new Map();
  for (const p of productos) {
    const meta = extraerMetaGuasch(p.skuExterno);
    const categoriaRaw = meta.cat && meta.cat !== '-' ? meta.cat : 'SIN_CATEGORIA';
    const normalizado = normalizarCategoriaGuasch({
      nombre: p.nombreProducto,
      categoria: categoriaRaw,
      subcategoria: meta.subcat || null
    });
    const estado = (meta.estado || 'DISPONIBLE').toUpperCase();
    const precioFinal = p.precioSugeridoPublico;
    const tienePrecio = Number(p.precioNeto || 0) > 0;
    const item = {
      id: p.id,
      nombre: p.nombreProducto || '-',
      unidad: p.unidad || '-',
      estado,
      categoria: normalizado.categoria,
      subcategoria: normalizado.subcategoria,
      categoriaOrden: Number(meta.categoriaOrden || 99999),
      subcategoriaOrden: Number(meta.subcategoriaOrden || 99999),
      ordenCatalogo: Number(meta.ordenCatalogo || 99999),
      tienePrecio,
      precioFinal
    };
    if (!porCategoria.has(item.categoria)) porCategoria.set(item.categoria, []);
    porCategoria.get(item.categoria).push(item);
  }
  return Array.from(porCategoria.entries())
    .map(([categoria, items]) => {
      const subMap = new Map();
      for (const item of items) {
        const sub = item.subcategoria || 'SIN_SUBCATEGORIA';
        if (!subMap.has(sub)) subMap.set(sub, []);
        subMap.get(sub).push(item);
      }
      const subcategorias = Array.from(subMap.entries()).map(([subcategoria, subItems]) => ({
        subcategoria,
        subcategoriaOrden: Math.min(...subItems.map((i) => Number(i.subcategoriaOrden || 99999))),
        items: subItems.sort((a, b) => a.ordenCatalogo - b.ordenCatalogo)
      })).sort((a, b) => a.subcategoriaOrden - b.subcategoriaOrden);

      return {
        categoria,
        categoriaOrden: Math.min(...items.map((i) => Number(i.categoriaOrden || 99999))),
        items: items.sort((a, b) => a.ordenCatalogo - b.ordenCatalogo),
        subcategorias
      };
    })
    .sort((a, b) => a.categoriaOrden - b.categoriaOrden);
}

function renderCatalogoGuasch() {
  const panel = $('#catalogo-guasch-panel');
  if (!panel) return;
  const total = productosListaComercial.length;
  if (!total) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const todos = catalogoGuaschCategorias.flatMap((c) => c.items);
  const porEstado = { DISPONIBLE: 0, CONSULTAR: 0, AGOTADO: 0, SIN_STOCK: 0 };
  let sinPrecio = 0;
  let precioFinalNull = 0;
  for (const it of todos) {
    porEstado[it.estado] = (porEstado[it.estado] || 0) + 1;
    if (!it.tienePrecio) sinPrecio += 1;
    if (it.precioFinal == null) precioFinalNull += 1;
  }
  $('#catalogo-guasch-resumen').innerHTML = `
    <div class="item"><strong>Total productos importados:</strong> ${total}</div>
    <div class="item"><strong>Cantidad por categoría:</strong> ${catalogoGuaschCategorias.map((c) => `${c.categoria}: ${c.items.length}`).join(' | ')}</div>
    <div class="item"><strong>DISPONIBLE:</strong> ${porEstado.DISPONIBLE || 0} · <strong>CONSULTAR:</strong> ${porEstado.CONSULTAR || 0} · <strong>AGOTADO:</strong> ${porEstado.AGOTADO || 0} · <strong>SIN_STOCK:</strong> ${porEstado.SIN_STOCK || 0}</div>
    <div class="item"><strong>Productos sin precio:</strong> ${sinPrecio}</div>
    <div class="item"><strong>Productos con precioFinal null:</strong> ${precioFinalNull}</div>
  `;

  $('#catalogo-guasch-acordeon').innerHTML = catalogoGuaschCategorias.map((grupo) => {
    const cantSinPrecio = grupo.items.filter((i) => !i.tienePrecio).length;
    const estadosNoDisponibles = grupo.items.filter((i) => i.estado !== 'DISPONIBLE').length;
    const posibleFaltante = cantSinPrecio > 0 || estadosNoDisponibles > 0;
    const bandera = posibleFaltante ? '<span class="badge-alerta">Posibles faltantes/errores</span>' : '<span class="badge-ok">Completa</span>';
    return `
      <details class="categoria-acordeon" open>
        <summary>${grupo.categoria} (${grupo.items.length}) ${bandera}</summary>
        <div class="categoria-auditoria-meta">Sin precio: <strong>${cantSinPrecio}</strong> · No disponibles: <strong>${estadosNoDisponibles}</strong></div>
        <div class="lista">
          ${grupo.subcategorias.map((sub) => `
          <div class="item"><strong>${sub.subcategoria === 'SIN_SUBCATEGORIA' ? 'Sin subcategoría' : sub.subcategoria}</strong> (${sub.items.length})</div>
          ${sub.items.map((i) => `
            <div class="item auditoria-item ${i.tienePrecio ? '' : 'auditoria-item-alerta'}">
              <strong>${i.nombre}</strong> · ${i.unidad} · Estado: <strong>${i.estado}</strong> · Precio final: <strong>${i.precioFinal == null ? 'SIN PRECIO' : money(i.precioFinal)}</strong> ${i.tienePrecio ? '' : '<span class="badge-alerta">SIN PRECIO</span>'}
            </div>
          `).join('')}
        `).join('')}
        </div>
      </details>
    `;
  }).join('');
}


function calcularItemConDescuento(item = {}) {
  const cantidad = Math.max(0, Number(item.cantidad || 0));
  const precioUnitario = Math.max(0, Number(item.precioUnitario || 0));
  const subtotalBruto = precioUnitario * cantidad;
  const descuentoPorcentaje = clampPorcentaje(item.descuentoPorcentaje);
  const descuentoMonto = subtotalBruto * (descuentoPorcentaje / 100);
  const subtotalFinal = Math.max(0, subtotalBruto - descuentoMonto);
  return { ...item, descuentoPorcentaje, descuentoMonto, subtotalBruto, subtotalFinal, subtotal: subtotalFinal };
}

function renderControlDescuentoItem(itemId, descuentoPorcentaje, prefijo = 'item') {
  const porcentaje = clampPorcentaje(descuentoPorcentaje);
  return `<div class="item-discount-control" aria-label="Descuento por ítem">
    <button type="button" data-${prefijo}-desc-ajustar="-1" data-${prefijo}-desc-item="${itemId}" aria-label="Restar 1% de descuento">-</button>
    <span class="item-discount-value">${porcentaje.toFixed(0)}%</span>
    <button type="button" data-${prefijo}-desc-ajustar="1" data-${prefijo}-desc-item="${itemId}" aria-label="Sumar 1% de descuento">+</button>
  </div>`;
}

function renderCarrito() {
  const items = venta?.items || [];
  const carrito = $('#carrito');
  carrito.innerHTML = items.length
    ? items.map((raw) => {
      const i = calcularItemConDescuento(raw);
      return `
        <article class="mostrador-cart-item">
          <div class="mostrador-cart-name">${i.producto.nombre}</div>
          <div class="mostrador-cart-row">
            <div class="mostrador-cart-field">
              <span>Precio</span>
              <strong>${money(i.precioUnitario)}</strong>
            </div>
            <div class="mostrador-cart-field">
              <span>Cantidad</span>
              <div class="mostrador-cart-quantity">
                <button type="button" data-accion="menos" data-item-id="${i.id}" aria-label="Restar una unidad">-</button>
                <strong>${i.cantidad}</strong>
                <button type="button" data-accion="mas" data-item-id="${i.id}" aria-label="Sumar una unidad">+</button>
              </div>
            </div>
            <div class="mostrador-cart-field">
              <span>Descuento %</span>
              ${renderControlDescuentoItem(i.id, i.descuentoPorcentaje, 'item')}
            </div>
            <div class="mostrador-cart-field mostrador-cart-subtotal">
              <span>Subtotal</span>
              <strong>${money(i.subtotalFinal)}</strong>
            </div>
          </div>
          <button type="button" class="mostrador-cart-remove" data-accion="quitar" data-item-id="${i.id}">Quitar</button>
        </article>
      `;
    }).join('')
    : '<div class="mostrador-cart-empty">Sin productos</div>';

  const subtotal = Number((venta?.items || []).reduce((acc, i) => acc + Number(calcularItemConDescuento(i).subtotalFinal || 0), 0));
  const descuento = Math.max(0, Number($('#descuento').value || 0));
  const descuentoAplicado = subtotal * (descuento / 100);
  const ajusteRedondeo = Number($('#ajuste-redondeo')?.value || 0);
  const final = Math.max(0, subtotal - descuentoAplicado + ajusteRedondeo);
  $('#subtotal').textContent = money(subtotal);
  $('#resumen-descuento-pct').textContent = `${descuento.toFixed(2)}%`;
  $('#importe-descuento').textContent = money(descuentoAplicado);
  $('#monto-ajuste').textContent = money(ajusteRedondeo);
  $('#total-final').textContent = money(final);
  const clienteNombre = venta?.persona
    ? `Tel: ${venta.persona.telefono || '-'} | ${venta.persona.nombre || '-'}`
    : 'Consumidor final';
  $('#carrito-cliente').textContent = clienteNombre;
  const tieneCliente = Boolean(venta?.personaId);
  const bloqueo = !tieneCliente;
  $('#descuento').disabled = bloqueo;
  $('#ajuste-redondeo').disabled = bloqueo;
  $('#descuento-tipo').disabled = bloqueo;
  document.querySelectorAll('.btn-redondeo').forEach((btn) => { btn.disabled = bloqueo; });
  $('#msg-descuento-cliente').classList.toggle('hidden', !bloqueo);
  if (bloqueo) {
    $('#descuento').value = '0';
    $('#ajuste-redondeo').value = '0';
  }
  const requiereCondicion = descuento > 0 || Number($('#ajuste-redondeo')?.value || 0) !== 0;
  $('#condicion-pago-prevista').required = requiereCondicion;
  $('#resumen-condicion-pago').textContent = requiereCondicion ? ($('#condicion-pago-prevista').value || 'Pendiente de definir') : 'No aplica';
  const alertas = items.filter(i => (Number(i.producto.stock || 0) - Number(i.cantidad || 0)) < 0);
  $('#stock-alertas').innerHTML = alertas.map(i => `<div class="item">⚠️ Atención: este producto quedará con stock negativo. ${i.producto.nombre}</div>`).join('');
}


function aplicarEstadoSaldo(selector, saldo) {
  const el = $(selector);
  if (!el) return;
  el.classList.remove('estado-deuda', 'estado-cero');
  el.classList.add(Number(saldo) > 0 ? 'estado-deuda' : 'estado-cero');
}

function renderClienteActivo() {
  const p = venta?.persona;
  $('#cliente-activo').textContent = p ? `Tel: ${p.telefono || '-'} | ${p.nombre || '-'} | ${p.cuitDni || '-'} | Compras: ${Number(p.cantidadCompras || 0)} | Total comprado: ${money(p.totalComprado || 0)}` : 'Consumidor final';
}

async function cargarCuentaCorrientePersona(personaId) {
  if (!personaId) return null;
  return api(`/cuenta-corriente/personas/${personaId}`);
}

async function cargarResumenCuentaCorriente() {
  return api('/cuenta-corriente/resumen');
}

function renderResumenCuentaCorriente(listado) {
  const container = $('#cc-resumen-personas');
  if (!container) return;
  container.innerHTML = listado.length
    ? listado.map((p) => `
      <div class="item">
        <strong>${p.nombre || '-'}</strong> | Tel: ${p.telefono || '-'} | Deuda: ${money(p.deudaTotal || 0)} | Movimientos: ${Number(p.movimientosPendientes || 0)} | Último: ${p.ultimoMovimientoAt ? new Date(p.ultimoMovimientoAt).toLocaleString('es-AR') : '-'}
        <div class="action-row">
          <button data-cc-persona="${p.personaId}">Ver detalle</button>
          <button data-cc-registrar-pago-persona="${p.personaId}">Registrar pago</button>
        </div>
      </div>
    `).join('')
    : '<div class="item">No hay personas con deuda pendiente.</div>';
}

async function loadResumenCuentaCorriente() {
  const container = $('#cc-resumen-personas');
  if (container) container.innerHTML = '<div class="item">Cargando resumen...</div>';
  try {
    const listado = await cargarResumenCuentaCorriente();
    renderResumenCuentaCorriente(listado);
  } catch (error) {
    if (container) container.innerHTML = `<div class="item">Error: ${error.message}</div>`;
  }
}

async function renderCuentaCorrienteClienteActivo() {
  const personaId = venta?.personaId;
  if (!personaId) {
    $('#cliente-saldo').textContent = money(0);
    $('#cliente-deuda').textContent = money(0);
    aplicarEstadoSaldo('#cliente-saldo', 0);
    aplicarEstadoSaldo('#cliente-deuda', 0);
    return;
  }
  try {
    const cuenta = await cargarCuentaCorrientePersona(personaId);
    $('#cliente-saldo').textContent = money(cuenta.saldo);
    $('#cliente-deuda').textContent = money(cuenta.saldo);
    aplicarEstadoSaldo('#cliente-saldo', cuenta.saldo);
    aplicarEstadoSaldo('#cliente-deuda', cuenta.saldo);
  } catch (e) {
    setMsg(e.message);
  }
}

function obtenerVentaIdMovimientoCuentaCorriente(movimiento) {
  const descripcion = String(movimiento?.descripcion || '');
  const ventaIdDirecto = Number(
    movimiento?.ventaId
    || movimiento?.referenciaVentaId
    || movimiento?.comprobanteId
    || movimiento?.venta?.id
    || 0
  );
  if (Number.isFinite(ventaIdDirecto) && ventaIdDirecto > 0) return ventaIdDirecto;

  const matchVenta = descripcion.match(/Venta #(\d+)/i);
  const ventaIdDescripcion = Number(matchVenta?.[1] || 0);
  return Number.isFinite(ventaIdDescripcion) && ventaIdDescripcion > 0 ? ventaIdDescripcion : 0;
}

function renderPanelCuentaCorriente(cuenta) {
  cuentaCorrienteMostrada = cuenta;
  $('#cc-cliente-activo').textContent = cuenta?.persona
    ? `Tel: ${cuenta.persona.telefono || '-'} | ${cuenta.persona.nombre || '-'} | ${cuenta.persona.cuitDni || '-'} | Compras: ${Number(cuenta.persona.cantidadCompras || 0)} | Total comprado: ${money(cuenta.persona.totalComprado || 0)}`
    : 'Ninguno';
  const saldo = cuenta?.saldo || 0;
  $('#cc-saldo').textContent = money(saldo);
  aplicarEstadoSaldo('#cc-saldo', saldo);
  $('#cc-movimientos').innerHTML = (cuenta?.movimientos || []).length
    ? cuenta.movimientos.map(m => {
      const ventaIdMovimiento = obtenerVentaIdMovimientoCuentaCorriente(m);
      const esPagoRegistrado = !ventaIdMovimiento && m.tipo === 'CREDITO';
      const acciones = ventaIdMovimiento
        ? `<div class="action-row cc-movimiento-acciones">
            <button data-cc-ver-ticket="${ventaIdMovimiento}">Ver ticket</button>
          </div>`
        : (esPagoRegistrado
          ? `<div class="action-row cc-movimiento-acciones">
              <button data-cc-ver-comprobante-pago="${m.id}">Ver comprobante</button>
              <button data-cc-imprimir-comprobante-pago="${m.id}">Imprimir</button>
            </div>`
          : '');
      return `<div class="item item-movimiento">
        <span>${new Date(m.createdAt).toLocaleString('es-AR')}</span>
        <strong class="${m.tipo === 'DEBITO' ? 'mov-debe' : 'mov-haber'}">${m.tipo === 'DEBITO' ? 'DEBE' : 'HABER'}</strong>
        <span>${money(m.monto)}</span>
        <span>${escapeHtmlClient(m.descripcion || '-')}</span>
        ${acciones}
      </div>`;
    }).join('')
    : '<div class="item">Sin movimientos</div>';
}


$('#cc-movimientos')?.addEventListener('click', (e) => {
  const verTicket = e.target.closest('button[data-cc-ver-ticket]');
  if (verTicket) {
    window.open(`/ventas/${Number(verTicket.dataset.ccVerTicket)}/ticket`, '_blank', 'noopener,noreferrer');
    return;
  }

  const verComprobante = e.target.closest('button[data-cc-ver-comprobante-pago]');
  if (verComprobante) {
    window.open(`/cuenta-corriente/movimientos/${Number(verComprobante.dataset.ccVerComprobantePago)}/comprobante`, '_blank', 'noopener,noreferrer');
    return;
  }

  const imprimirComprobante = e.target.closest('button[data-cc-imprimir-comprobante-pago]');
  if (imprimirComprobante) {
    window.open(`/cuenta-corriente/movimientos/${Number(imprimirComprobante.dataset.ccImprimirComprobantePago)}/comprobante?imprimir=1`, '_blank', 'noopener,noreferrer');
  }
});

async function refreshVenta() {
  if (!ventaId) return;
  venta = await api(`/mostrador/ventas/${ventaId}`);
  $('#venta-activa').textContent = `Venta #${venta.id}`;
  renderCarrito();
  renderClienteActivo();
  await renderCuentaCorrienteClienteActivo();
}


async function loadResumenCaja() {
  const query = fechaCajaSeleccionada ? `?fecha=${encodeURIComponent(fechaCajaSeleccionada)}` : '';
  const turno = $('#caja-turno')?.value || 'DIARIO';
  const separador = query ? '&' : '?';
  const resumen = await api('/caja/resumen' + query + `${separador}turno=${encodeURIComponent(turno)}`);
  $('#cierre-efectivo').textContent = money(resumen.EFECTIVO);
  $('#cierre-transferencia').textContent = money(resumen.TRANSFERENCIA);
  $('#cierre-tarjeta').textContent = money(resumen.TARJETA);
  $('#cierre-cc').textContent = money(resumen.CUENTA_CORRIENTE);
  $('#cierre-total').textContent = money(resumen.totalGeneral);
  $('#caja-dia').textContent = `Fecha consultada: ${resumen.fechaCaja}`;
  $('#caja-estado').textContent = resumen.estado === 'CERRADO' ? 'CERRADA' : 'ABIERTA';
}

function setFechaCajaHoy() {
  const ahora = new Date();
  const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Salta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
  fechaCajaSeleccionada = fechaLocal;
  $('#caja-fecha').value = fechaLocal;
}


async function loadCierresCaja() {
  const turno = $('#caja-turno')?.value || 'DIARIO';
  const cierres = await api(`/caja/cierres?turno=${encodeURIComponent(turno)}`);
  const container = $('#cierres-caja');
  const containerReportes = $('#cierres-caja-reportes');

  if (!cierres.length) {
    if (container) container.innerHTML = '<div class="item">Sin cierres</div>';
    if (containerReportes) containerReportes.innerHTML = '<div class="item">Sin cierres</div>';
    return;
  }

  const htmlCierres = cierres.map(c => `
    <div class="item">
      <strong>${c.fechaCaja || new Date(c.fecha).toLocaleDateString()}</strong>
      | Turno ${c.turno || 'DIARIO'}
      | Cerró ${c.cerradoPorRol || '-'}
      | Total ${money(c.totalGeneral)}
      | Efectivo ${money(c.totalEfectivo)}
      | Transferencia ${money(c.totalTransferencia)}
      | Tarjeta ${money(c.totalTarjeta)}
      | Cta Cte ${money(c.totalCuentaCorriente)}
      <button class="btn-ver-cierre" data-fecha="${c.fechaCaja}">Ver este día</button>
      <button class="btn-eliminar-cierre" data-id="${c.id}">Eliminar cierre de prueba</button>
    </div>
  `).join('');
  if (container) container.innerHTML = htmlCierres;
  if (containerReportes) containerReportes.innerHTML = htmlCierres;


  document.querySelectorAll('.btn-ver-cierre').forEach(btn => {
    btn.addEventListener('click', async () => {
      fechaCajaSeleccionada = btn.dataset.fecha || null;
      $('#caja-fecha').value = fechaCajaSeleccionada || '';
      try {
        await loadResumenCaja();
        setMsg(`Mostrando resumen de caja del ${fechaCajaSeleccionada}`);
      } catch (err) {
        setMsg(err.message);
      }
    });
  });

  document.querySelectorAll('.btn-eliminar-cierre').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/caja/cierres/${btn.dataset.id}`, { method: 'DELETE' });
        await loadCierresCaja();
        setMsg('Cierre de prueba eliminado');
      } catch (err) {
        setMsg(err.message);
      }
    });
  });
}

function getEstadoCobroOptions() {
  return ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CUENTA_CORRIENTE', 'EN_ESPERA_DE_PAGO', 'CANCELADO']
    .map(e => `<option value="${e}">${e}</option>`).join('');
}

async function loadCaja() {
  await loadCaja20();
}


async function loadVentasCobradas() {
  const query = fechaVentasCobradasSeleccionada ? `?fecha=${encodeURIComponent(fechaVentasCobradasSeleccionada)}` : '';
  const ventas = await api('/ventas/cobradas' + query);
  $('#ventas-cobradas-lista').innerHTML = ventas.length
    ? ventas.map(v => `<div class="item">Venta #${v.id} | ${new Date(v.fechaCobro).toLocaleString('es-AR')} | ${v.cliente} | ${v.medioPago || '-'} | ${money(v.total)} <button class="btn-ver-ticket-cobrada" data-id="${v.id}">Ver ticket</button></div>`).join('')
    : '<div class="item">Sin ventas cobradas para la fecha seleccionada</div>';

  document.querySelectorAll('.btn-ver-ticket-cobrada').forEach(btn => {
    btn.addEventListener('click', () => {
      window.open(`/ventas/${btn.dataset.id}/ticket`, '_blank', 'noopener,noreferrer');
    });
  });
}

function limpiarFormularioProducto() {
  $('#prod-id').value = '';
  $('#prod-nombre').value = '';
  Array.from($('#prod-categoria').options || []).forEach(o => { o.selected = false; });
  $('#prod-marca').value = '';
  $('#prod-unidad').value = '';
  $('#prod-stock').value = '0';
  $('#prod-moneda').value = 'ARS';
  $('#prod-costo').value = '0';
  $('#prod-iva').value = '0';
  $('#prod-flete').value = '0';
  $('#prod-ganancia').value = '0';
  $('#prod-principio-activo').value = '';
  $('#prod-concentracion').value = '';
  $('#prod-habilitacion-habitual').value = '';
  $('#prod-apto-senasa-mip').checked = false;
  $('#prod-resolucion-senasa').value = '';
  $('#prod-fecha-resolucion-senasa').value = '';
  $('#prod-tipo-senasa').value = '';
  $('#prod-uso-senasa').value = '';
  Array.from($('#prod-proveedor').options || []).forEach(o => { o.selected = false; });
  renderResumenPreciosProducto();
}
function renderResumenPreciosProducto() {
  const c = calcularPrecioProductoForm();
  $('#prod-costo-original').textContent = money(c.costoCompra);
  $('#prod-moneda-resumen').textContent = c.monedaCompra;
  $('#prod-costo-convertido').textContent = money(c.costoCompraPesos);
  $('#prod-iva-resumen').textContent = `${Number(c.ivaPorcentaje || 0).toFixed(2)}%`;
  $('#prod-flete-resumen').textContent = `${Number(c.fletePorcentaje || 0).toFixed(2)}%`;
  $('#prod-costo-total').textContent = money(c.costoTotalPesos);
  $('#prod-margen-resumen').textContent = `${Number(c.margenGananciaPorcentaje || 0).toFixed(2)}%`;
  $('#prod-precio-final').textContent = money(c.precioVentaPesos);
}

function renderCategoriasProducto(selected = []) {
  const sel = $('#prod-categoria');
  if (!sel) return;
  const opciones = categoriasProducto.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  sel.innerHTML = opciones;
  const selectedSet = new Set((selected || []).map(String));
  Array.from(sel.options).forEach((opt) => { opt.selected = selectedSet.has(opt.value); });
  const avisoId = 'prod-categoria-aviso';
  let aviso = document.getElementById(avisoId);
  if (!categoriasProducto.length) {
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.id = avisoId;
      aviso.className = 'msg msg-info';
      sel.insertAdjacentElement('afterend', aviso);
    }
    aviso.textContent = 'Primero debe crear una categoría desde el módulo Categorías.';
  } else if (aviso) {
    aviso.remove();
  }
}

function setModoProducto(nuevoModo) {
  modoProducto = nuevoModo;
  const panelEditar = $('#panel-editar-productos');
  if (panelEditar) panelEditar.style.display = modoProducto === 'EDITAR' ? 'block' : 'none';
  if (modoProducto === 'AGREGAR') limpiarFormularioProducto();
}

function renderProductosAdmin() {
  const container = $('#productos-admin');
  const f = filtroProductosAdmin.toLowerCase();
  const lista = productos.filter(p => !f || p.nombre.toLowerCase().includes(f) || ((p.categorias || []).map((c) => c.nombre).join(' ').toLowerCase().includes(f)) || (p.categoria || '').toLowerCase().includes(f) || (p.marca || '').toLowerCase().includes(f));
  container.innerHTML = lista.length
    ? lista.map(p => renderProductoCard(p, { accion: 'data-editar-producto', accionLabel: 'Editar', accionClass: 'btn-accion-editar', mostrarCosto: true, proveedoresTexto: ((p.proveedores || []).map(pp => pp.proveedor?.razonSocial).filter(Boolean).join(', ') || '-') , extraBotones: `<button class="btn-accion-precio" data-editar-producto="${p.id}">Cambiar precio</button> <button class="btn-accion-eliminar" data-eliminar-producto="${p.id}">Eliminar</button>` })).join('')
    : '<div class="item">Sin productos</div>';
}
function renderPresupuestoProductos() {
  const origen = productosPresupuestoVisibles.length ? productosPresupuestoVisibles : productos;
  const lista = origen
    .filter((p) => {
      if (!filtroProductosPresupuesto) return true;
      return (p.nombre || '').toLowerCase().includes(filtroProductosPresupuesto)
        || ((p.categorias || []).map((c) => c.nombre).join(' ').toLowerCase().includes(filtroProductosPresupuesto))
        || (p.categoria || '').toLowerCase().includes(filtroProductosPresupuesto)
        || (p.marca || '').toLowerCase().includes(filtroProductosPresupuesto)
        || String(p.id || '').includes(filtroProductosPresupuesto);
    })
    .slice(0, 8);
  presupuestoItems = presupuestoItems.map((it) => {
    const base = Number(it.precioUnitario || 0) * Number(it.cantidad || 0);
    const descPct = clampPorcentaje(it.descuentoPorcentaje);
    const descMonto = base * (descPct / 100);
    return { ...it, descuentoPorcentaje: descPct, descuentoMonto: descMonto, subtotalBruto: base, subtotalFinal: Math.max(0, base - descMonto), subtotal: Math.max(0, base - descMonto) };
  });
  const subtotal = presupuestoItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  const descuentoInput = $('#pres-descuento');
  const descuentoBloque = $('#pres-descuento-bloque');
  const msgDescuento = $('#pres-descuento-msg');
  const condicion = $('#pres-condicion-pago-prevista')?.value || '';
  const hayClienteSeleccionado = presupuestoTipoDestinatario === 'EXISTENTE' && Boolean(presupuestoClienteId);
  const descuentoHabilitado = presupuestoItems.length > 0 && hayClienteSeleccionado;
  if (descuentoBloque) descuentoBloque.style.display = presupuestoItems.length ? 'block' : 'none';
  if (descuentoInput) descuentoInput.disabled = !descuentoHabilitado;
  if (!descuentoHabilitado && descuentoInput) descuentoInput.value = '0';
  const descuentoPorcentaje = Math.max(0, Number(descuentoInput?.value || 0));
  const importeDescontado = subtotal * (descuentoPorcentaje / 100);
  const ajusteRedondeo = Number($('#pres-ajuste-redondeo')?.value || 0);
  const total = Math.max(0, subtotal - importeDescontado + ajusteRedondeo);
  if (msgDescuento) msgDescuento.textContent = (!presupuestoItems.length || descuentoHabilitado)
    ? ''
    : 'Para aplicar descuento debe seleccionar un cliente.';
  if (presupuestoTipoDestinatario !== 'EXISTENTE') presupuestoClienteId = null;
  const condicionRequerida = (descuentoPorcentaje > 0 || ajusteRedondeo !== 0);
  $('#pres-condicion-pago-prevista').required = condicionRequerida;
  $('#pres-subtotal').textContent = money(subtotal);
  $('#pres-resumen-descuento-pct').textContent = `${descuentoPorcentaje.toFixed(2)}%`;
  $('#pres-importe-descuento').textContent = money(importeDescontado);
  $('#pres-resumen-ajuste').textContent = money(ajusteRedondeo);
  $('#pres-total').textContent = money(total);
  $('#pres-resumen-condicion').textContent = condicionRequerida ? (condicion || 'Obligatoria') : 'No requerida';

  const resultados = lista.map(p => renderProductoCard(p, { accion: 'data-pres-agregar', accionLabel: 'Agregar', accionClass: 'btn-accion-agregar' })).join('');
  const tabla = presupuestoItems.length
    ? `<table style="width:100%;margin-top:8px;"><thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Descuento %</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>${
      presupuestoItems.map(it => `<tr>
        <td>${it.nombre}</td>
        <td>${money(it.precioUnitario)}</td>
        <td><button data-pres-menos="${it.productoId}">-</button> ${it.cantidad} <button data-pres-mas="${it.productoId}">+</button></td>
        <td>${renderControlDescuentoItem(it.productoId, it.descuentoPorcentaje, 'pres')}</td>
        <td>${money(it.subtotal)}</td>
        <td><button data-pres-quitar="${it.productoId}">Quitar</button></td>
      </tr>`).join('')
    }</tbody></table>`
    : '<div class="item">Debe agregar al menos un producto</div>';
  $('#pres-productos').innerHTML = `${resultados || '<div class="item">Sin productos encontrados</div>'}${tabla}`;
}
function normalizarTelefonoWhatsapp(telefono) {
  return String(telefono || '').replace(/[\s\-()]/g, '');
}


function renderPedidoProductos() {
  const origen = productosPedidoVisibles.length ? productosPedidoVisibles : productos;
  const items = origen.slice(0, 30).map((p) => {
    const it = pedidoItems.find((x) => x.productoId === p.id);
    return `<div class="item">${p.nombre} (${p.unidad || 'UN'}) <button data-ped-add="${p.id}">Agregar</button> ${it ? `<strong>${it.cantidad}</strong> <button data-ped-del="${p.id}">-</button> <button data-ped-rm="${p.id}">Quitar</button>` : ''}</div>`;
  });
  $('#ped-productos').innerHTML = items.join('') || '<div class="item">Sin resultados</div>';
  $('#ped-carrito').innerHTML = pedidoItems.length
    ? `<table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Obs.</th><th>Acciones</th></tr></thead><tbody>${pedidoItems.map((it, idx) => `<tr>
      <td>${it.nombre}</td>
      <td><input type="number" min="0" step="0.01" data-ped-index="${idx}" data-ped-field="cantidad" value="${Number(it.cantidad || 0)}" style="width:88px"></td>
      <td><input type="text" data-ped-index="${idx}" data-ped-field="unidad" value="${it.unidad || 'UN'}" style="width:82px"></td>
      <td><input type="text" data-ped-index="${idx}" data-ped-field="observacion" value="${it.observacion || ''}" placeholder="Opcional" style="width:100%"></td>
      <td><button data-ped-rm="${it.productoId}">Quitar</button></td>
    </tr>`).join('')}</tbody></table>`
    : '<div class="item">Carrito vacío</div>';
}
async function armarMensajePedidoProveedor(pedido) {
  const tipoTexto = pedido.tipo === 'SOLICITUD_PRESUPUESTO'
    ? 'solicitud de presupuesto'
    : 'orden de pedido y envío';
  return `Hola ${pedido.proveedor?.contactoComercial || ''}, compartimos ${tipoTexto} #${pedido.id} de Agroquímica San Bernardo.
Ver detalle e imprimir: ${window.location.origin}/pedidos/${pedido.id}/imprimir`;
}

async function loadPedidos() {
  const lista = await api('/pedidos');
  $('#ped-lista').innerHTML = (lista || []).map((p) => {
    const tel = normalizarTelefonoWhatsapp(p.proveedor?.telefono || '');
    const mail = String(p.proveedor?.mail || '').trim();
    return `<div class="item">#${p.id} | ${p.proveedor?.razonSocial || '-'} | ${p.estado} | ${p.tipo}
      <button data-ped-print="${p.id}">Imprimir</button>
      <button data-ped-pdf="${p.id}">Descargar PDF</button>
      <button data-ped-wa="${p.id}" data-ped-wa-telefono="${tel}" ${tel ? '' : 'disabled'}>WhatsApp</button>
      <button data-ped-mail="${p.id}" data-ped-mail-destino="${mail}" ${mail ? '' : 'disabled'}>Email</button>
    </div>`;
  }).join('') || '<div class="item">Sin pedidos</div>';
}
function armarMensajeWhatsappPresupuesto(presupuestoId, total) {
  return `Hola, te compartimos el presupuesto #${presupuestoId} de Agroquímica San Bernardo. Total: ${money(total)}. Adjuntamos el PDF del presupuesto.`;
}

async function loadPresupuestos() {
  const esSemillasYa = presupuestoModuloActivo === 'SEMILLASYA';
  const endpoint = esSemillasYa ? '/api/presupuestos/semillasya' : '/api/presupuestos/mostrador';
  const lista = await api(endpoint);
  if (!Array.isArray(lista) || lista.length === 0) {
    $('#pres-lista').innerHTML = esSemillasYa
      ? '<div class="item">No hay solicitudes SemillasYa todavía.</div>'
      : '<div class="item">No hay presupuestos de mostrador todavía.</div>';
    return;
  }
  $('#pres-lista').innerHTML = lista.map(p => {
    const telefonoCliente = normalizarTelefonoWhatsapp(p.persona?.telefono || p.persona?.telefonoPrincipal || '');
    const puedeWhatsapp = Boolean(telefonoCliente);
    return `<div class="item">#${p.id} | ${p.persona?.nombre || p.nombreLibre || (p.tipoDestinatario === 'A_QUIEN_CORRESPONDA' ? 'A quien corresponda' : 'Sin destinatario')} | ${p.estado} | ${money(p.total)} <a class="btn-link" href="/presupuestos/${p.id}/imprimir" target="_blank" rel="noopener noreferrer">Imprimir</a> <button data-pres-pdf="${p.id}">Descargar PDF</button> ${puedeWhatsapp ? `<button data-pres-whatsapp="${p.id}" data-pres-whatsapp-telefono="${telefonoCliente}" data-pres-whatsapp-total="${Number(p.total || 0)}">Enviar WhatsApp</button>` : ''} <button data-pres-aceptar="${p.id}">Aceptar</button> <button data-pres-rechazar="${p.id}">Rechazar</button></div>`;
  }).join('');
}
function metadataTerritorial(p) {
  const raw = p?.persona?.metadata || p?.metadata || '';
  if (raw && typeof raw === 'object') return raw;
  if (!raw || typeof raw !== 'string') return {};
  try { return JSON.parse(raw); } catch (_e) { return {}; }
}
function provinciasTerritorialesArgentina() {
  return [
    'Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
    'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ];
}
function normalizarProvinciaTerritorial(p) {
  const PROVINCIAS_ARG = provinciasTerritorialesArgentina();
  const aliases = { 'CABA': 'Ciudad Autónoma de Buenos Aires', 'CAPITAL FEDERAL': 'Ciudad Autónoma de Buenos Aires', 'CIUDAD AUTONOMA DE BUENOS AIRES': 'Ciudad Autónoma de Buenos Aires', 'CIUDAD AUTÓNOMA DE BUENOS AIRES': 'Ciudad Autónoma de Buenos Aires' };
  const meta = metadataTerritorial(p);
  const normalizarTxt = (v) => String(v || '').trim();
  const fuentes = [meta.provincia, p?.persona?.provincia, p?.provincia, p?.observaciones, JSON.stringify(p?.persona || {}), JSON.stringify(p || {})].map(normalizarTxt).filter(Boolean);
  const fuenteMay = fuentes.join(' | ').toUpperCase();
  let provincia = PROVINCIAS_ARG.find((prov) => fuenteMay.includes(prov.toUpperCase()))
    || Object.keys(aliases).find((a) => fuenteMay.includes(a));
  if (aliases[provincia]) provincia = aliases[provincia];
  return { provincia: provincia || 'Sin provincia', corregida: !provincia };
}
function mapearEstadoTerritorial(estado) {
  const e = String(estado || '').toUpperCase();
  if (['WEB_SOLICITADO', 'BORRADOR'].includes(e)) return 'nuevas';
  if (['COTIZADO', 'ENVIADO'].includes(e)) return 'cotizadas';
  if (['ACEPTADO', 'APROBADO'].includes(e)) return 'aprobadas';
  if (['RECHAZADO'].includes(e)) return 'rechazadas';
  if (['LOGISTICA', 'EN_LOGISTICA'].includes(e)) return 'logística';
  if (['ENTREGADO'].includes(e)) return 'entregadas';
  return 'nuevas';
}
function normalizarCiudadTerritorial(p) {
  const meta = metadataTerritorial(p);
  const fuente = [meta.localidad, meta.ciudad, p?.persona?.localidad, p?.persona?.ciudad, p?.localidad, p?.ciudad, p?.observaciones, JSON.stringify(meta), JSON.stringify(p || {})]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' | ');
  const m = fuente.match(/(Ciudad\/Localidad|Localidad|Ciudad)\s*:\s*([^|]+)/i);
  return (m?.[2] || meta.localidad || meta.ciudad || p?.persona?.localidad || p?.persona?.ciudad || p?.localidad || p?.ciudad || '-').trim();
}
function renderPanelTerritorialSemillasYa() {
  const contProvincias = $('#pres-provincias');
  const contOps = $('#pres-operaciones-provincia');
  const contDetalle = $('#pres-detalle-solicitud');
  if (!contProvincias || !contOps || !contDetalle) return;
  const PROVINCIAS_ARG = provinciasTerritorialesArgentina();
  const agrupado = PROVINCIAS_ARG.reduce((acc, prov) => ({ ...acc, [prov]: [] }), { 'Sin provincia': [] });
  solicitudesTerritoriales.forEach((s) => {
    const infoProv = normalizarProvinciaTerritorial(s);
    if (!agrupado[infoProv.provincia]) agrupado[infoProv.provincia] = [];
    agrupado[infoProv.provincia].push({ ...s, _provinciaCorregida: infoProv.corregida });
  });
  const provincias = [...PROVINCIAS_ARG, ...(agrupado['Sin provincia']?.length ? ['Sin provincia'] : [])];
  contProvincias.innerHTML = provincias.map((prov) => {
    const pendientes = (agrupado[prov] || []).filter((s) => ['WEB_SOLICITADO', 'BORRADOR'].includes(String(s.estado || '').toUpperCase())).length;
    const cotizadas = (agrupado[prov] || []).filter((s) => mapearEstadoTerritorial(s.estado) === 'cotizadas').length;
    const aprobadas = (agrupado[prov] || []).filter((s) => mapearEstadoTerritorial(s.estado) === 'aprobadas').length;
    const logistica = (agrupado[prov] || []).filter((s) => mapearEstadoTerritorial(s.estado) === 'logística').length;
    const entregadas = (agrupado[prov] || []).filter((s) => mapearEstadoTerritorial(s.estado) === 'entregadas').length;
    const alerta = pendientes > 0 ? '🔴' : '🟢';
    return `<div class="item ${provinciaTerritorialActiva === prov ? 'item-seleccionado' : ''}"><strong>${prov}</strong> | Nuevas: ${pendientes} | Cotizadas: ${cotizadas} | Aprobadas: ${aprobadas} | Logística: ${logistica} | Entregadas: ${entregadas} ${alerta} <button data-pres-provincia="${prov}">Ver operaciones</button></div>`;
  }).join('');
  if (!provinciaTerritorialActiva && provincias.length) provinciaTerritorialActiva = provincias[0];
  const solicitudesProvincia = agrupado[provinciaTerritorialActiva] || [];
  const buckets = { nuevas: 0, cotizadas: 0, aprobadas: 0, rechazadas: 0, 'logística': 0, entregadas: 0 };
  solicitudesProvincia.forEach((s) => { buckets[mapearEstadoTerritorial(s.estado)] += 1; });
  const ciudadesProvincia = Object.entries(solicitudesProvincia.reduce((acc, s) => {
    const ciudad = normalizarCiudadTerritorial(s);
    acc[ciudad] = (acc[ciudad] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const ciudadesHtml = ciudadesProvincia.length
    ? `<div class="item"><strong>Ciudades/Localidades:</strong> ${ciudadesProvincia.map(([c, n]) => `${c} (${n})`).join(' · ')}</div>`
    : '<div class="item"><strong>Ciudades/Localidades:</strong> sin datos</div>';
  contOps.innerHTML = `<div class="item"><strong>${provinciaTerritorialActiva || 'Provincia'}</strong> | Nuevas: ${buckets.nuevas} | Cotizadas: ${buckets.cotizadas} | Aprobadas: ${buckets.aprobadas} | Rechazadas: ${buckets.rechazadas} | Logística: ${buckets['logística']} | Entregadas: ${buckets.entregadas}</div>`
    + ciudadesHtml
    + (solicitudesProvincia.map((s) => `<div class="item ${solicitudTerritorialActivaId === s.id ? 'item-seleccionado' : ''}">#${s.id} | ${s.persona?.nombre || 'Sin cliente'} | ${s.estado} | ${money(s.total)} ${s._provinciaCorregida ? '<span style="color:#b91c1c;font-weight:700;">provincia corregida automáticamente</span>' : ''} <button data-pres-open="${s.id}">Gestionar</button></div>`).join('') || '<div class="item">Sin operaciones en esta provincia.</div>');
  const solicitud = solicitudesProvincia.find((s) => s.id === solicitudTerritorialActivaId);
  if (!solicitud) {
    contDetalle.innerHTML = '<div class="item">Seleccione una solicitud para editar margen/flete/productos/observaciones y estado.</div>';
    return;
  }
  const telefono = normalizarTelefonoWhatsapp(solicitud.persona?.telefono || solicitud.persona?.telefonoPrincipal || '');
  const localidad = normalizarCiudadTerritorial(solicitud);
  const provincia = String(normalizarProvinciaTerritorial(solicitud).provincia || provinciaTerritorialActiva || '-').trim();
  const textoWhatsapp = `Hola, soy el Ing. Gastón Lambois de SemillasYa.\n\nTe envío la cotización solicitada.\n\nEl precio es puesto en la ciudad de ${localidad}/${provincia}.\nLa mercadería llega en aproximadamente 4 días.\n\nA continuación te envío la cotización.`;
  contDetalle.innerHTML = `<div class="item"><strong>Solicitud #${solicitud.id}</strong><br/>
  Cliente: ${solicitud.persona?.nombre || 'Sin cliente'}<br/>
  Estado actual: ${solicitud.estado}<br/><br/>
  <button data-pres-semillasya-interaccion="${solicitud.id}" data-pres-semillasya-telefono="${telefono}" data-pres-semillasya-msg="${encodeURIComponent(textoWhatsapp)}">Enviar interacción</button>
  <button data-pres-semillasya-pdf="${solicitud.id}">Descargar cotización</button>
  </div>`;
}
function renderProveedores() {
  const q = ($('#proveedor-buscar')?.value || '').trim().toLowerCase();
  proveedoresFiltrados = proveedores.filter((pr) => !q || [pr.razonSocial, pr.cuit, pr.contactoComercial].filter(Boolean).join(' ').toLowerCase().includes(q));
  if (proveedorSeleccionadoId && !proveedores.some((pr) => pr.id === proveedorSeleccionadoId)) proveedorSeleccionadoId = null;
  $('#proveedores-lista').innerHTML = proveedoresFiltrados.length
    ? proveedoresFiltrados.map(pr => `<div class="item proveedor-row ${proveedorSeleccionadoId === pr.id ? 'item-seleccionado' : ''}" data-proveedor-select="${pr.id}"><span class="proveedor-meta"><span class="proveedor-id">#${pr.id}</span><b>${pr.razonSocial}</b><small>CUIT: ${pr.cuit || '-'} | Tel: ${pr.telefono || '-'} | Mail: ${pr.mail || '-'}</small></span><button data-eliminar-proveedor="${pr.id}">Eliminar</button></div>`).join('')
    : '<div class="item">Sin proveedores</div>';
  const opt = proveedores.map(pr => `<option value="${pr.id}">${pr.razonSocial}</option>`);
  const sel = $('#prod-proveedor');
  if (sel) sel.innerHTML = opt.join('');
  const detalleSel = $('#proveedor-detalle-select');
  if (detalleSel) {
    detalleSel.innerHTML = '<option value="">Seleccione proveedor</option>' + opt.join('');
    if (proveedorSeleccionadoId) detalleSel.value = String(proveedorSeleccionadoId);
  }
  const remSel = $('#remito-proveedor');
  if (remSel) renderProveedoresRemito();
}
function estadoStockClase(estado) {
  if (estado === 'SIN_STOCK') return 'estado-sin-stock';
  if (estado === 'BAJO_STOCK') return 'estado-bajo-stock';
  return 'estado-stock-normal';
}
function renderStockTabla(items = []) {
  const tbody = $('#stock-tabla');
  if (!tbody) return;
  tbody.innerHTML = items.length
    ? items.map((s) => `<tr>
      <td>${s.productoNombre || '-'}</td><td>${s.categoria || '-'}</td><td>${s.unidad || '-'}</td>
      <td>${s.cantidadActual ?? 0}</td><td>${s.stockMinimo ?? 0}</td>
      <td><span class="estado-stock ${estadoStockClase(s.estado)}">${s.estado || 'STOCK_NORMAL'}</span></td>
      <td>${(s.proveedores || []).join(', ') || '-'}</td></tr>`).join('')
    : '<tr><td colspan="7">Sin resultados</td></tr>';
}
async function loadStockResumen(url = '/stock') {
  const data = await api(url);
  renderStockTabla(data || []);
}
async function verDetalleProveedor() {
  const id = Number($('#proveedor-detalle-select')?.value || proveedorSeleccionadoId || 0);
  if (!id) return setMsg('Seleccione proveedor');
  proveedorSeleccionadoId = id;
  renderProveedores();
  const proveedor = await api(`/proveedores/${id}`);
  $('#proveedor-detalle').innerHTML = `<div class="item"><b>Proveedor #${proveedor.id} - ${proveedor.razonSocial}</b><br>CUIT: ${proveedor.cuit || '-'} | Tel: ${proveedor.telefono || '-'} | Mail: ${proveedor.mail || '-'} | Dirección: ${proveedor.direccion || '-'} | Contacto: ${proveedor.contactoComercial || '-'} | Obs: ${proveedor.observaciones || '-'}</div>`;
}
async function renderProveedoresRemito() {
  const remSel = $('#remito-proveedor');
  if (!remSel) return;
  const q = ($('#remito-buscar-proveedor')?.value || '').trim();
  try {
    const lista = q ? await buscarProveedores(q) : proveedores;
    remSel.innerHTML = '<option value="">Seleccione proveedor</option>' + lista.slice(0, 8).map(pr => `<option value="${pr.id}">${pr.razonSocial}${pr.cuit ? ` (${pr.cuit})` : ''}</option>`).join('');
  } catch (error) { mostrarErrorBusqueda('#remito-resultados-productos', error); }
}
function renderStockProductos() {
  $('#stock-producto').innerHTML = productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
}
async function loadProveedores() {
  proveedores = await api('/proveedores');
  renderProveedores();
}
async function cargarStockProducto() {
  const productoId = Number($('#stock-producto').value || 0);
  if (!productoId) return;
  const data = await api(`/productos/${productoId}/stock`);
  $('#stock-actual').textContent = data.cantidadActual;
  $('#stock-movimientos').innerHTML = (data.movimientos || []).length
    ? data.movimientos.map(m => `<div class="item">${new Date(m.createdAt).toLocaleString('es-AR')} | ${m.tipo} | ${m.cantidad} | ${m.motivo}</div>`).join('')
    : '<div class="item">Sin movimientos</div>';
}

async function loadTipoCambio() {
  const config = await api('/config/tipo-cambio');
  tipoCambioActual = Number(config.tipoCambioActual || 1);
  $('#tipo-cambio').value = tipoCambioActual;
  if ($('#pre-tipo-cambio-global')) $('#pre-tipo-cambio-global').value = String(tipoCambioActual);
  calcularPreviewPrecampania();
}

async function loadCategoriasProducto() {
  categoriasProducto = await api('/categorias');
  renderCategoriasProducto();
  renderCategoriasAdmin();
}

function renderCategoriasAdmin() {
  const cont = $('#categorias-lista');
  if (!cont) return;
  cont.innerHTML = categoriasProducto.map((c) => `<div class="item">#${c.id} <b>${c.nombre}</b> | ${c.descripcion || '-'} | ${c.activo ? 'Activa' : 'Inactiva'}
    <button data-cat-toggle="${c.id}" data-activo="${c.activo ? '1' : '0'}">${c.activo ? 'Desactivar' : 'Activar'}</button></div>`).join('') || '<div class="item">Sin categorías</div>';
}

async function loadProductosAll() {
  productos = await api('/productos');
  renderCategoriasMostrador();
  renderProductos();
  renderProductosAdmin();
  await loadCategoriasProducto();
  renderStockProductos();
  renderBuscadorRemitoProductos();
  if (typeof renderSenasaResolucionForm === 'function') { senasaProductos = productos; renderSenasaResolucionForm(); }
}

async function renderBuscadorRemitoProductos() {
  const proveedorId = Number($('#remito-proveedor').value || 0);
  const q = ($('#remito-buscar-producto').value || '').trim();
  if (!proveedorId) {
    $('#remito-resultados-productos').innerHTML = '<div class=\"item\">Seleccione proveedor para buscar productos</div>';
    return;
  }
  let encontrados = [];
  try {
    encontrados = q ? await buscarProductos(q) : productos.slice(0, 8);
  } catch (error) {
    return mostrarErrorBusqueda('#remito-resultados-productos', error);
  }
  $('#remito-resultados-productos').innerHTML = encontrados.length
    ? encontrados.map(p => `<div class=\"item\">${p.nombre} | Stock actual ${p.stock} <button data-remito-agregar=\"${p.id}\">Agregar</button></div>`).join('')
    : '<div class=\"item\">Producto no encontrado. Cárguelo primero desde Productos.</div>';
}

function renderRemitoItems() {
  const tbody = $('#remito-items');
  tbody.innerHTML = remitoDetalles.length
    ? remitoDetalles.map((item, idx) => `<tr>
      <td>${item.productoNombre}</td>
      <td><input type="number" min="1" data-remito-field="cantidad" data-index="${idx}" value="${item.cantidad}" /></td>
      <td>${item.stockActual}</td>
      <td>${item.stockActual + item.cantidad}</td>
      <td><button data-remito-quitar="${idx}">Quitar</button></td>
    </tr>`).join('')
    : '<tr><td colspan="5">Sin productos en el remito</td></tr>';
}


const ROLE_STORAGE_KEY = 'agro_sb_active_role';
const ROLE_NAME_STORAGE_KEY = 'agro_sb_active_role_name';
const BUSINESS_STORAGE_KEY = 'agro_sb_active_business';
const HOME_MODULES_BASE = [
  'clientes',
  'productos',
  'categorias',
  'presupuestos',
  'presupuestos-semillasya',
  'pedidos',
  'senasa',
  'ventas',
  'caja',
  'cuenta-corriente',
  'proveedores',
  'stock',
  'remitos',
  'reportes',
  'eliminados',
  'estado-sistema',
  'productos-precampania',
  'clientes-semillasya',
  'operaciones-semillasya',
  'territorios-semillasya',
  'configuracion-ia-lambois',
  'semillasya-publico',
  'usuarios',
  'configuracion'
];
const ROLE_MODULES = {
  ADMINISTRADOR_GENERAL: [...HOME_MODULES_BASE],
  GERENTE: [...HOME_MODULES_BASE],
  MOSTRADOR: [...HOME_MODULES_BASE],
  CAJA: [...HOME_MODULES_BASE]
};
let activeRole = null;
let activeRoleName = '';
let activeBusiness = null;
let moduloActivo = null;
const BUSINESS_MODULES = {
  AGROQUIMICA: ['clientes', 'productos', 'categorias', 'presupuestos', 'pedidos', 'senasa', 'ventas', 'caja', 'cuenta-corriente', 'proveedores', 'stock', 'remitos', 'reportes', 'eliminados', 'estado-sistema', 'semillasya-publico', 'configuracion-ia-lambois', 'usuarios', 'configuracion'],
  SEMILLASYA: ['productos-precampania', 'clientes-semillasya', 'presupuestos-semillasya', 'operaciones-semillasya', 'territorios-semillasya', 'configuracion-ia-lambois']
};


async function cargarConfiguracionChatbot() {
  const estado = $('#chatbot-config-estado');
  if (estado) estado.textContent = 'Cargando configuración...';
  const data = await api('/api/chatbot/config');
  const cfg = data?.config || data;
  $('#chatbot-nombre').value = cfg.nombre || 'Ing. Lambois IA';
  $('#chatbot-rol-principal').value = cfg.rolPrincipal || cfg.objetivo || '';
  $('#chatbot-instrucciones').value = cfg.instruccionesBase || '';
  $('#chatbot-flujo-preguntas').value = cfg.flujoPreguntasObligatorias || '';
  $('#chatbot-criterios-tecnicos').value = cfg.criteriosTecnicosRespuesta || '';
  $('#chatbot-frases-permitidas').value = cfg.frasesPermitidas || '';
  $('#chatbot-frases-prohibidas').value = cfg.frasesProhibidas || cfg.restricciones || '';
  $('#chatbot-estilo-respuesta').value = cfg.estiloRespuesta || cfg.tono || '';
  $('#chatbot-cierre-sugerido').value = cfg.cierreSugerido || '';
  $('#chatbot-activo').checked = cfg.activo !== false;
  if (estado) estado.textContent = 'Configuración cargada.';
}

async function guardarConfiguracionChatbot() {
  const estado = $('#chatbot-config-estado');
  const payload = {
    nombre: $('#chatbot-nombre').value.trim(),
    rolPrincipal: $('#chatbot-rol-principal').value.trim(),
    instruccionesBase: $('#chatbot-instrucciones').value.trim(),
    flujoPreguntasObligatorias: $('#chatbot-flujo-preguntas').value.trim(),
    criteriosTecnicosRespuesta: $('#chatbot-criterios-tecnicos').value.trim(),
    frasesPermitidas: $('#chatbot-frases-permitidas').value.trim(),
    frasesProhibidas: $('#chatbot-frases-prohibidas').value.trim(),
    estiloRespuesta: $('#chatbot-estilo-respuesta').value.trim(),
    cierreSugerido: $('#chatbot-cierre-sugerido').value.trim(),
    activo: $('#chatbot-activo').checked
  };
  await api('/api/chatbot/config', { method: 'PUT', body: JSON.stringify(payload) });
  if (estado) estado.textContent = 'Configuración guardada. El chat público leerá estas instrucciones en la próxima consulta.';
  setMsg('Configuración IA guardada');
}

function renderUsuarioActivo() {
  const el = $('#usuario-activo');
  if (!el) return;
  el.textContent = activeRole ? `Usuario activo: ${activeRoleName} | ${activeRole}` : 'Usuario activo: - | -';
}

function applyRoleModules() {
  const allowed = new Set(ROLE_MODULES[activeRole] || []);
  const allowedBusiness = new Set(BUSINESS_MODULES[activeBusiness] || []);
  document.querySelectorAll('[data-module-card]').forEach((card) => {
    const modulo = card.dataset.moduleCard;
    card.classList.toggle('hidden', !allowed.has(modulo) || !allowedBusiness.has(modulo));
  });
}

function seleccionarBusiness(business) {
  activeBusiness = business;
  localStorage.setItem(BUSINESS_STORAGE_KEY, business);
  $('#business-selector')?.classList.add('hidden');
  if (activeRole) {
    applyRoleModules();
    volverInicio();
    return;
  }
  $('#role-selector')?.classList.remove('hidden');
}

function seleccionarRol(role, roleName) {
  if (!activeBusiness) return;
  activeRole = role;
  activeRoleName = roleName;
  localStorage.setItem(ROLE_STORAGE_KEY, role);
  localStorage.setItem(ROLE_NAME_STORAGE_KEY, roleName);
  renderUsuarioActivo();
  applyRoleModules();
  volverInicio();
}

function cambiarUsuario() {
  activeRole = null;
  activeRoleName = '';
  localStorage.removeItem(ROLE_STORAGE_KEY);
  localStorage.removeItem(ROLE_NAME_STORAGE_KEY);
  renderUsuarioActivo();
  document.querySelectorAll('.app-shell').forEach((el) => el.classList.add('hidden'));
  $('#home-dashboard')?.classList.add('hidden');
  $('#business-selector')?.classList.remove('hidden');
  $('#role-selector')?.classList.add('hidden');
}
async function abrirModulo(modulo) {
  if (!activeRole) return;
  moduloActivo = modulo;
  const roleSelector = $('#role-selector');
  const businessSelector = $('#business-selector');
  const home = $('#home-dashboard');
  const appShell = document.querySelectorAll('.app-shell');
  const modulos = document.querySelectorAll('[data-modulo]');
  if (!home) return;
  roleSelector?.classList.add('hidden');
  businessSelector?.classList.add('hidden');
  home.classList.add('hidden');
  appShell.forEach((el) => el.classList.remove('hidden'));
  modulos.forEach((el) => {
    const grupos = String(el.dataset.modulo || '').split(/\s+/).filter(Boolean);
    el.classList.toggle('hidden', !grupos.includes(modulo));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (moduloActivo === 'senasa' && !['/senasa', '/dashboard/senasa'].includes(window.location.pathname)) {
    window.history.pushState({ modulo: 'senasa' }, '', '/senasa');
  }
  if (modulo === 'clientes') {
    try {
      await buscarClienteMostrador();
    } catch (error) {
      console.error('[clientes] error al abrir módulo', error);
      setMsg(`Error al abrir Clientes: ${error.message || error}`, 'warning');
    }
  }
  if (modulo === 'clientes-semillasya') {
    await cargarClientesSemillasYa();
  }
  if (modulo === 'eliminados') {
    await loadEliminados();
  }
  if (modulo === 'caja') {
    await loadCaja20();
  }
  if (modulo === 'pedidos') {
    await inicializarModuloPedidos();
    renderPedidoProductos();
  }
  if (modulo === 'estado-sistema') {
    await loadEstadoSistema();
  }
  if (modulo === 'senasa') {
    await cargarSenasa();
  }
  if (modulo === 'cuenta-corriente') {
    await loadResumenCuentaCorriente();
  }
  if (modulo === 'productos-precampania') {
    await loadProductosPrecampania();
  }
  if (modulo === 'configuracion-ia-lambois') {
    await cargarConfiguracionChatbot();
  }
  if (modulo === 'presupuestos' || modulo === 'presupuestos-semillasya' || modulo === 'operaciones-semillasya' || modulo === 'territorios-semillasya') {
    const esSemillasYa = modulo === 'presupuestos-semillasya' || modulo === 'operaciones-semillasya' || modulo === 'territorios-semillasya';
    presupuestoModuloActivo = esSemillasYa ? 'SEMILLASYA' : 'MOSTRADOR';
    presupuestoTipoOperacion = esSemillasYa ? 'PRECAMPAÑA' : 'MOSTRADOR';
    const tituloModulo = $('#pres-titulo-modulo');
    if (tituloModulo) tituloModulo.textContent = esSemillasYa ? '11) Presupuestos SemillasYa' : '11) Presupuestos Mostrador';
    const tituloListado = $('#pres-titulo-listado');
    if (tituloListado) tituloListado.textContent = esSemillasYa ? 'Solicitudes de cotización SemillasYa guardadas' : 'Presupuestos Mostrador guardados';
    $('#pres-formulario-manual')?.classList.toggle('hidden', esSemillasYa);
    $('#panel-territorial-semillasya')?.classList.toggle('hidden', !esSemillasYa);
    $('#pres-guardar')?.classList.toggle('hidden', esSemillasYa);
    if (esSemillasYa) {
      tituloModulo.textContent = modulo === 'territorios-semillasya' ? '11) Territorios SemillasYa' : '11) Operaciones territoriales SemillasYa';
      if (tituloListado) tituloListado.textContent = modulo === 'territorios-semillasya' ? 'Territorios y solicitudes SemillasYa' : 'Solicitudes y cotizaciones SemillasYa';
      solicitudesTerritoriales = await api('/api/presupuestos/semillasya');
      provinciaTerritorialActiva = '';
      solicitudTerritorialActivaId = null;
      renderPanelTerritorialSemillasYa();
    }
    await loadPresupuestos();
  }
}

async function cargarClientesSemillasYa() {
  const lista = $('#lista-clientes-semillasya');
  if (!lista) return;
  lista.innerHTML = '<div class="item">Cargando...</div>';
  try {
    const clientes = await api('/clientes/semillasya');
    lista.innerHTML = (clientes || []).length
      ? clientes.map((c) => `<div class="item"><strong>${c.nombre || '-'}</strong> | WhatsApp: ${c.telefono || '-'} | ${c.provincia || '-'} / ${c.localidad || '-'} | Alta: #${c.fechaAlta} | Solicitudes: ${Number(c.solicitudes || 0)}</div>`).join('')
      : '<div class="item">Sin clientes SemillasYa.</div>';
  } catch (error) {
    lista.innerHTML = `<div class="item">Error: ${error.message || error}</div>`;
  }
}

function resetFormularioPrecampania() {
  $('#pre-id').value = '';
  $('#pre-nombre').value = '';
  $('#pre-cultivo').value = precampaniaContextoCarga.cultivo || '';
  $('#pre-categoria').value = precampaniaContextoCarga.categoria || '';
  $('#pre-envase').value = '';
  $('#pre-descripcion').value = '';
  $('#pre-descripcion-tecnica').value = '';
  $('#pre-recomendaciones-uso').value = '';
  $('#pre-epoca-siembra').value = '';
  $('#pre-dosis-orientativa').value = '';
  $('#pre-imagen-url').value = '';
  $('#pre-precio-final').value = '0';
  $('#pre-publicado-web').checked = false;
  $('#pre-oferta').checked = false;
  $('#pre-imagenes-adicionales').value = '';
  $('#pre-ficha-pdf-url').value = '';
  if (precampaniaContextoCarga.cultivo) $('#pre-cultivo').value = precampaniaContextoCarga.cultivo;
  if (precampaniaContextoCarga.semillero) $('#pre-semillero').value = precampaniaContextoCarga.semillero;
  calcularPreviewPrecampania();
}

function abrirDrawerPrecampania(titulo = "Agregar producto") {
  $("#pre-drawer-title").textContent = titulo;
  seleccionarTabEditorPrecampania('tecnico');
  $("#pre-drawer")?.classList.remove("hidden");
  $("#pre-drawer-overlay")?.classList.remove("hidden");
}
function cerrarDrawerPrecampania() {
  $("#pre-drawer")?.classList.add("hidden");
  $("#pre-drawer-overlay")?.classList.add("hidden");
}

function calcularPreviewPrecampania() {
  const precioFinal = Number($('#pre-precio-final')?.value || 0);
  if ($('#pre-precio-final')) $('#pre-precio-final').value = String(Number.isFinite(precioFinal) ? Number(precioFinal.toFixed(2)) : 0);
}

function calcularPreviewEconomicoPrecampania() {
  const precioCompraUsd = Number($('#pre-modal-precio-compra-usd')?.value || 0);
  const margenPorcentaje = Number($('#pre-modal-margen')?.value || 0);
  const fletePorcentaje = Number($('#pre-modal-flete')?.value || 0);
  const ivaPorcentaje = Number($('#pre-modal-iva')?.value || 0);
  const tipoCambioSistema = Number($('#pre-modal-tipo-cambio')?.value || tipoCambioActual || 1);
  const precioManualActivo = Boolean($('#pre-modal-precio-manual')?.checked);

  const precioUsdConMargen = precioCompraUsd * (1 + (margenPorcentaje / 100));
  const precioUsdConFlete = precioUsdConMargen * (1 + (fletePorcentaje / 100));
  const precioArsSinIva = precioUsdConFlete * tipoCambioSistema;
  const ivaMonto = precioArsSinIva * (ivaPorcentaje / 100);
  const precioFinalVentaArs = precioArsSinIva + ivaMonto;

  const finalInput = $('#pre-modal-precio-final-input');
  if (finalInput && !precioManualActivo) finalInput.value = String(Number(precioFinalVentaArs.toFixed(2)));
  if (finalInput) finalInput.disabled = !precioManualActivo;

  const preview = $('#pre-modal-preview-economico');
  if (preview) {
    preview.innerHTML = [
      `USD compra: <strong>${Number(precioCompraUsd.toFixed(2))}</strong>`,
      `USD con margen: <strong>${Number(precioUsdConMargen.toFixed(2))}</strong>`,
      `USD con flete: <strong>${Number(precioUsdConFlete.toFixed(2))}</strong>`,
      `ARS sin IVA: <strong>${money(precioArsSinIva)}</strong>`,
      `IVA: <strong>${money(ivaMonto)}</strong>`,
      `Precio final venta ARS: <strong>${money(precioManualActivo ? Number(finalInput?.value || 0) : precioFinalVentaArs)}</strong>`
    ].join('<br/>');
  }
}

function seleccionarTabEditorPrecampania(tab = 'tecnico') {
  document.querySelectorAll('[data-pre-editor-tab]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.preEditorTab === tab);
  });
  document.querySelectorAll('[data-pre-editor-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.preEditorPanel !== tab);
  });
}

function renderSemillerosPrecampania() {
  const semillerosDisponibles = ['CAPS', 'GUASCH'];
  const cultivosDisponibles = Array.from(new Set([
    ...precampaniaCultivos,
    ...precampaniaProductos.map((p) => String(p.cultivo || p.categoria || 'Otro').trim() || 'Otro')
  ])).sort((a, b) => a.localeCompare(b, 'es'));

  const selCultivoForm = $('#pre-cultivo');
  if (selCultivoForm) {
    selCultivoForm.innerHTML = `<option value="">Seleccionar cultivo</option>${cultivosDisponibles.map((c) => `<option value="${c}">${c}</option>`).join('')}`;
    if (precampaniaContextoCarga.cultivo) selCultivoForm.value = precampaniaContextoCarga.cultivo;
  }
  const selForm = $('#pre-semillero');
  const selFiltro = $('#pre-filtro-semillero');
  if (selForm) {
    selForm.innerHTML = `<option value="">Seleccionar semillero</option>${semillerosDisponibles.map((s) => `<option value="${s}">${s}</option>`).join('')}`;
    if (precampaniaContextoCarga.semillero) selForm.value = precampaniaContextoCarga.semillero;
  }
  if (selFiltro) {
    selFiltro.innerHTML = `<option value="TODOS">Todos los semilleros</option>${semillerosDisponibles.map((s) => `<option value="${s}">${s}</option>`).join('')}`;
  }
}


function renderCultivoChipsPrecampania() {
  const chipWrap = $('#pre-cultivo-chips');
  if (!chipWrap) return;
  const cultivos = ['TODOS', ...Array.from(new Set(precampaniaProductos.map((p) => String(p.cultivo || p.categoria || 'Otro').trim() || 'Otro'))).sort((a,b)=>a.localeCompare(b,'es'))];
  chipWrap.innerHTML = cultivos.map((c) => `<button type="button" class="pre-chip ${precampaniaCultivoActivo===c?'is-active':''}" data-pre-chip-cultivo="${c}">${c === 'TODOS' ? 'Todos' : c}</button>`).join('');
}
function renderProductosPrecampania() {
  const q = ($('#pre-buscar')?.value || '').trim().toLowerCase();
  const visibilidadFiltro = $('#pre-filtro-visible')?.value || 'TODOS';
  const semilleroFiltro = $('#pre-filtro-semillero')?.value || 'TODOS';
  const categoriaFiltro = ($('#pre-filtro-categoria')?.value || '').trim().toLowerCase();
  const lista = precampaniaProductos.filter((p) => {
    const matchQ = !q || [p.nombre, p.semilleroLaboratorio, p.cultivo, p.categoria, p.presentacionEnvase].some((v) => String(v || '').toLowerCase().includes(q));
    const matchVisible = visibilidadFiltro === 'TODOS' || (visibilidadFiltro === 'VISIBLES' && p.visibleEnSemillasYa) || (visibilidadFiltro === 'OCULTOS' && !p.visibleEnSemillasYa);
    const matchSem = semilleroFiltro === 'TODOS' || p.semilleroLaboratorio === semilleroFiltro;
    const cultivo = String(p.cultivo || p.categoria || 'Otro').trim() || 'Otro';
    const matchCultivo = precampaniaCultivoActivo === 'TODOS' || cultivo === precampaniaCultivoActivo;
    const matchCat = !categoriaFiltro || String(p.categoria || '').toLowerCase().includes(categoriaFiltro);
    return matchQ && matchVisible && matchSem && matchCultivo && matchCat;
  });
  const ordenada = [...lista].sort((a, b) => (
    String(a.cultivo || a.categoria || 'Otro').localeCompare(String(b.cultivo || b.categoria || 'Otro'), 'es')
    || String(a.semilleroLaboratorio || '').localeCompare(String(b.semilleroLaboratorio || ''), 'es')
    || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
    || String(a.presentacionEnvase || '').localeCompare(String(b.presentacionEnvase || ''), 'es')
  ));

  const porCultivo = ordenada.reduce((acc, p) => {
    const cultivo = String(p.cultivo || p.categoria || 'Otro').trim() || 'Otro';
    const semillero = String(p.semilleroLaboratorio || 'SIN_SEMILLERO').trim() || 'SIN_SEMILLERO';
    ((acc[cultivo] ??= {})[semillero] ??= []).push(p);
    return acc;
  }, {});

  const bloques = Object.entries(porCultivo).map(([cultivo, semilleros]) => {
    const semilleroBloques = Object.entries(semilleros).map(([semillero, productos]) => {
      const porVariedad = productos.reduce((acc, p) => {
        const variedad = String(p.nombre || 'Variedad sin nombre').trim() || 'Variedad sin nombre';
        (acc[variedad] ??= []).push(p);
        return acc;
      }, {});
      const variedadesHtml = Object.entries(porVariedad).map(([variedad, presentaciones]) => {
        const presentacionesHtml = presentaciones.map((p) => {
        const precioFinalVentaArs = Number(p.precioVentaFinal || 0);
        return `<article class="pre-presentacion-item">
          <div class="pre-presentacion-main">
            <!-- RENDER_PRODUCTOS_SEMILLASYA_POR_PRESENTACION -->
            <div class="pre-presentacion-nombre">${p.nombre || variedad || '-'}</div>
            <div class="pre-presentacion-detalle">Semillero: <strong>${p.semilleroLaboratorio || semillero || '-'}</strong></div>
            <div class="pre-presentacion-detalle">Cultivo: <strong>${p.cultivo || cultivo || '-'}</strong></div>
            <div class="pre-presentacion-detalle">Presentación: <strong>${p.presentacionEnvase || '-'}</strong></div>
            <div class="pre-presentacion-detalle">Precio final venta ARS: <strong>${money(precioFinalVentaArs)}</strong></div>
          </div>
          <div class="pre-producto-actions">
            <button class="pre-icon-btn" type="button" data-pre-open-tab="tecnico" data-pre-id="${p.id}">1. Variables técnicas</button>
            <button class="pre-icon-btn" type="button" data-pre-open-economico="${p.id}">2. Variables económicas</button>
            <button class="pre-icon-btn" type="button" data-pre-open-tab="imagenes" data-pre-id="${p.id}">3. Imágenes</button>
            <button type="button" class="pre-icon-btn" data-pre-duplicar-mostrador="${p.id}">Duplicar a Mostrador</button>
            <button type="button" class="pre-toggle ${p.visibleEnSemillasYa ? 'is-on' : 'is-off'}" data-pre-toggle-visible="${p.id}" aria-pressed="${p.visibleEnSemillasYa ? 'true' : 'false'}"><span class="pre-toggle-track"><span class="pre-toggle-thumb"></span></span></button>
          </div>
        </article>`;
      }).join('');
      return `<section class="pre-variedad-block">
        <h5 class="pre-variedad-title">${variedad}</h5>
        <div class="pre-presentaciones-list">${presentacionesHtml}</div>
      </section>`;
      }).join('');
      return `<section class="pre-semillero-block"><h4 class="pre-semillero-title">${semillero} (${productos.length})</h4>${variedadesHtml}</section>`;
    }).join('');
    const totalCultivo = Object.values(semilleros).reduce((acc, productos) => acc + productos.length, 0);
    return `<section class="pre-cultivo-block"><h3 class="pre-cultivo-title">${cultivo} (${totalCultivo} presentaciones)</h3>${semilleroBloques}</section>`;
  });
  $('#pre-lista').innerHTML = bloques.length ? bloques.join('') : '<div class="item">Sin productos SemillasYa.</div>';
  renderCultivoChipsPrecampania();
}

function cargarProductoEnDrawerPrecampania(p, tabInicial = 'tecnico') {
  if (!p) return;
  $('#pre-id').value = String(p.id);
  $('#pre-nombre').value = p.nombre || '';
  $('#pre-cultivo').value = p.cultivo || '';
  if (!$('#pre-cultivo').value && precampaniaCultivos.includes('Otro')) $('#pre-cultivo').value = 'Otro';
  $('#pre-semillero').value = p.semilleroLaboratorio || '';
  $('#pre-categoria').value = p.categoria || '';
  $('#pre-envase').value = p.presentacionEnvase || '';
  $('#pre-descripcion').value = p.descripcion || '';
  $('#pre-descripcion-tecnica').value = p.descripcionTecnica || '';
  $('#pre-recomendaciones-uso').value = p.recomendacionesUso || '';
  $('#pre-epoca-siembra').value = p.epocaSiembra || '';
  $('#pre-dosis-orientativa').value = p.dosisOrientativa || '';
  $('#pre-imagen-url').value = p.imagenUrl || '';
  $('#pre-precio-final').value = p.precioVentaFinal == null ? '0' : String(p.precioVentaFinal);
  $('#pre-publicado-web').checked = Boolean(p.publicadoWeb);
  $('#pre-oferta').checked = p.estado === 'DISPONIBLE';
  $('#pre-imagenes-adicionales').value = p.observacionesComerciales || '';
  $('#pre-ficha-pdf-url').value = '';
  calcularPreviewPrecampania();
  abrirDrawerPrecampania('Editar producto');
  seleccionarTabEditorPrecampania(tabInicial);
}

async function loadProductosPrecampania() {
  const data = await api('/api/productos-precampania');
  precampaniaSemilleros = Array.isArray(data?.semilleros) ? data.semilleros : [];
  precampaniaCultivos = Array.isArray(data?.cultivos) ? data.cultivos : [];
  precampaniaProductos = Array.isArray(data?.productos) ? data.productos : [];
  renderSemillerosPrecampania();
  renderProductosPrecampania();
  renderCultivoChipsPrecampania();
}


async function inicializarModuloPedidos() {
  setMsg('PEDIDOS-NUEVO-FLUJO', 'info');
  const tareas = [loadPedidos(), buscarProveedoresPedido()];
  const resultados = await Promise.allSettled(tareas);
  resultados.forEach((resultado) => {
    if (resultado.status === 'rejected') {
      console.error('[pedidos] error al inicializar módulo', resultado.reason);
      setMsg(`Pedidos: ${resultado.reason?.message || resultado.reason || 'error inesperado'}`, 'warning');
    }
  });
}


async function loadEstadoSistema() {
  const panel = $('#estado-sistema-panel');
  if (!panel) return;
  panel.classList.add('estado-sistema-grid');
  panel.innerHTML = '<div class="item">Cargando Centro de Control...</div>';
  try {
    const data = await api('/api/estado-sistema');
    const valorNumerico = (value) => Number(value || 0);
    const estadoPorSemaforo = (valor, alertaDesde = 1, problemaDesde = 5) => {
      if (valor >= problemaDesde) return 'rojo';
      if (valor >= alertaDesde) return 'amarillo';
      return 'verde';
    };
    const estadoPorConteoBase = (valor) => {
      if (valor <= 0) return 'rojo';
      if (valor <= 5) return 'amarillo';
      return 'verde';
    };
    const tarjetas = [
      { etiqueta: 'Productos', icono: '📦', valor: valorNumerico(data?.conteos?.productos), estado: estadoPorConteoBase(valorNumerico(data?.conteos?.productos)) },
      { etiqueta: 'Ventas', icono: '🧾', valor: valorNumerico(data?.conteos?.ventas), estado: estadoPorConteoBase(valorNumerico(data?.conteos?.ventas)) },
      { etiqueta: 'Presupuestos', icono: '📑', valor: valorNumerico(data?.conteos?.presupuestos), estado: estadoPorConteoBase(valorNumerico(data?.conteos?.presupuestos)) },
      {
        etiqueta: 'Productos sin costo',
        icono: '💸',
        valor: valorNumerico(data?.auditoriaDatos?.productosSinCosto),
        estado: estadoPorSemaforo(valorNumerico(data?.auditoriaDatos?.productosSinCosto), 1, 5)
      },
      {
        etiqueta: 'Productos sin imagen',
        icono: '🖼️',
        valor: valorNumerico(data?.auditoriaDatos?.productosSinImagen),
        estado: estadoPorSemaforo(valorNumerico(data?.auditoriaDatos?.productosSinImagen), 1, 10)
      },
      {
        etiqueta: 'Stock bajo',
        icono: '📉',
        valor: valorNumerico(data?.alertasOperativas?.productosConStockBajo),
        estado: estadoPorSemaforo(valorNumerico(data?.alertasOperativas?.productosConStockBajo), 1, 10)
      },
      {
        etiqueta: 'Ventas borrador antiguas',
        icono: '⏳',
        valor: valorNumerico(data?.auditoriaDatos?.ventasBorradorAntiguas),
        estado: estadoPorSemaforo(valorNumerico(data?.auditoriaDatos?.ventasBorradorAntiguas), 1, 3)
      },
      {
        etiqueta: 'Clientes duplicados',
        icono: '👥',
        valor: valorNumerico(data?.auditoriaDatos?.clientesDuplicados?.length),
        estado: estadoPorSemaforo(valorNumerico(data?.auditoriaDatos?.clientesDuplicados?.length), 1, 3)
      },
      {
        etiqueta: 'Productos duplicados',
        icono: '🧪',
        valor: valorNumerico(data?.auditoriaDatos?.productosDuplicados?.length),
        estado: estadoPorSemaforo(valorNumerico(data?.auditoriaDatos?.productosDuplicados?.length), 1, 3)
      }
    ];
    panel.innerHTML = tarjetas.map((item) => `
      <article class="estado-sistema-card estado-${item.estado}">
        <p class="estado-sistema-label"><span class="estado-sistema-icono" aria-hidden="true">${item.icono}</span>${item.etiqueta}</p>
        <strong class="estado-sistema-value">${item.valor}</strong>
      </article>
    `).join('');
  } catch (error) {
    panel.innerHTML = `<div class="item">Error al leer estado del sistema: ${error.message || error}</div>`;
  }
}

async function loadEliminados() {
  const contenedor = $('#eliminados-lista');
  if (!contenedor) return;
  contenedor.innerHTML = 'Cargando...';
  try {
    const data = await api('/eliminados');
    const registros = Array.isArray(data?.registros) ? data.registros : [];
    if (!registros.length) {
      contenedor.innerHTML = '<div class="item">No hay registros eliminados.</div>';
      return;
    }
    const porTipo = (tipo) => registros.filter((r) => r.tipo === tipo);
    const renderSeccion = (titulo, tipo) => `<h3>${titulo}</h3>${porTipo(tipo).map((item) => `<div class="item">
      <strong>${item.nombre || '-'}</strong><br/>
      Fecha: ${item.fecha || '-'} | Eliminado por: ${item.eliminadoPor || '-'}<br/>
      Motivo: ${item.motivo || '-'}
      <br/><button data-restaurar-tipo="${item.tipo}" data-restaurar-id="${item.id}">Restaurar</button>
    </div>`).join('') || '<div class="item">Sin registros</div>'}`;
    contenedor.innerHTML = [
      renderSeccion('Clientes eliminados', 'CLIENTE'),
      renderSeccion('Productos eliminados', 'PRODUCTO'),
      renderSeccion('Proveedores eliminados', 'PROVEEDOR')
    ].join('');
  } catch (error) {
    contenedor.innerHTML = `<div class="item">Error al cargar eliminados: ${error.message || error}</div>`;
  }
}

function volverInicio() {
  moduloActivo = null;
  const roleSelector = $('#role-selector');
  const businessSelector = $('#business-selector');
  const home = $('#home-dashboard');
  const appShell = document.querySelectorAll('.app-shell');
  const modulos = document.querySelectorAll('[data-modulo]');
  if (!home) return;
  if (!activeBusiness) {
    businessSelector?.classList.remove('hidden');
    roleSelector?.classList.add('hidden');
    home.classList.add('hidden');
    appShell.forEach((el) => el.classList.add('hidden'));
    modulos.forEach((el) => el.classList.add('hidden'));
    return;
  }
  if (!activeRole) {
    businessSelector?.classList.add('hidden');
    roleSelector?.classList.remove('hidden');
    home.classList.add('hidden');
    appShell.forEach((el) => el.classList.add('hidden'));
    modulos.forEach((el) => el.classList.add('hidden'));
    return;
  }
  roleSelector?.classList.add('hidden');
  home.classList.remove('hidden');
  appShell.forEach((el) => el.classList.add('hidden'));
  modulos.forEach((el) => el.classList.add('hidden'));
  if (['/senasa', '/dashboard/senasa'].includes(window.location.pathname)) {
    window.history.pushState({}, '', '/app');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrirRutaInicial() {
  if (!['/senasa', '/dashboard/senasa'].includes(window.location.pathname)) return;
  activeBusiness = 'AGROQUIMICA';
  localStorage.setItem(BUSINESS_STORAGE_KEY, activeBusiness);
  if (!activeRole) {
    activeRole = 'ADMINISTRADOR_GENERAL';
    activeRoleName = 'Administrador General';
    localStorage.setItem(ROLE_STORAGE_KEY, activeRole);
    localStorage.setItem(ROLE_NAME_STORAGE_KEY, activeRoleName);
    renderUsuarioActivo();
  }
  applyRoleModules();
  abrirModulo('senasa').catch((error) => setMsg(`Error al abrir SENASA: ${error.message || error}`, 'error'));
}

document.querySelectorAll('[data-abrir-modulo]').forEach((btn) => {
  btn.addEventListener('click', () => abrirModulo(btn.dataset.abrirModulo).catch((error) => setMsg(`Error al abrir ${btn.dataset.abrirModulo}: ${error.message || error}`, 'error')));
});
document.querySelectorAll('[data-abrir-semillasya-publica]').forEach((btn) => {
  btn.addEventListener('click', () => { window.location.href = '/semillasya'; });
});
document.querySelectorAll('[data-select-role]').forEach((btn) => {
  btn.addEventListener('click', () => seleccionarRol(btn.dataset.selectRole, btn.dataset.roleName || btn.dataset.selectRole));
});
document.querySelectorAll('[data-select-business]').forEach((btn) => {
  btn.addEventListener('click', () => seleccionarBusiness(btn.dataset.selectBusiness));
});
$('#btn-cambiar-usuario')?.addEventListener('click', cambiarUsuario);
$('#btn-volver-inicio')?.addEventListener('click', volverInicio);
document.querySelectorAll('[data-senasa-scroll]').forEach((btn) => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.senasaScroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
});
window.addEventListener('popstate', () => {
  if (['/senasa', '/dashboard/senasa'].includes(window.location.pathname)) abrirModulo('senasa').catch((error) => setMsg(`Error al abrir SENASA: ${error.message || error}`, 'error'));
  else volverInicio();
});
const savedRole = localStorage.getItem(ROLE_STORAGE_KEY);
const savedRoleName = localStorage.getItem(ROLE_NAME_STORAGE_KEY);
const savedBusiness = localStorage.getItem(BUSINESS_STORAGE_KEY);
if (savedBusiness && BUSINESS_MODULES[savedBusiness]) activeBusiness = savedBusiness;
if (savedRole && ROLE_MODULES[savedRole]) {
  activeRole = savedRole;
  activeRoleName = savedRoleName || savedRole;
  renderUsuarioActivo();
  applyRoleModules();
}
if (['/senasa', '/dashboard/senasa'].includes(window.location.pathname)) {
  abrirRutaInicial();
} else {
  volverInicio();
}

$('#btn-nueva').addEventListener('click', async () => {
  try {
    const tipoOperacion = $('#tipo-operacion-venta')?.value || 'MOSTRADOR';
    const listaComercialId = tipoOperacion === 'PRECAMPAÑA' ? Number($('#lista-comercial-select')?.value || 0) : null;
    const v = await api('/mostrador/ventas', { method: 'POST', body: JSON.stringify({ tipoOperacion, listaComercialId }) });
    ventaId = v.id;
    await refreshVenta();
    setMsg('Venta creada');
  } catch (e) { setMsg(e.message); }
});

$('#tipo-operacion-venta')?.addEventListener('change', async (e) => {
  const esPre = e.target.value === 'PRECAMPAÑA';
  $('#label-lista-comercial')?.classList.toggle('hidden', !esPre);
  $('#buscar-producto')?.classList.toggle('hidden', esPre);
  $('#resultados-productos')?.classList.toggle('hidden', esPre);
  if (esPre) {
    await cargarListasComerciales();
    await cargarProductosListaComercial();
  } else {
    productosListaComercial = [];
    catalogoGuaschCategorias = [];
    $('#catalogo-guasch-panel')?.classList.add('hidden');
    $('#precio-precampania-detalle').innerHTML = '';
  }
});
$('#lista-comercial-select')?.addEventListener('change', async () => {
  await cargarProductosListaComercial();
});
$('#pre-buscar')?.addEventListener('input', renderProductosPrecampania);
$('#pre-filtro-semillero')?.addEventListener('change', renderProductosPrecampania);
$('#pre-filtro-visible')?.addEventListener('change', renderProductosPrecampania);
$('#pre-filtro-categoria')?.addEventListener('input', renderProductosPrecampania);
$('#btn-precampania-nuevo')?.addEventListener('click', () => { resetFormularioPrecampania(); abrirDrawerPrecampania('Agregar producto'); });
$('#pre-cultivo')?.addEventListener('change', (e) => { precampaniaContextoCarga.cultivo = e.target.value; });
$('#pre-semillero')?.addEventListener('change', (e) => { precampaniaContextoCarga.semillero = e.target.value; });
$('#pre-categoria')?.addEventListener('input', (e) => { precampaniaContextoCarga.categoria = e.target.value; });
['pre-precio-final']
  .forEach((id) => {
    $(id)?.addEventListener('input', calcularPreviewPrecampania);
    $(id)?.addEventListener('change', calcularPreviewPrecampania);
  });
document.querySelectorAll('[data-pre-editor-tab]').forEach((btn) => {
  btn.addEventListener('click', () => seleccionarTabEditorPrecampania(btn.dataset.preEditorTab));
});
$('#pre-lista')?.addEventListener('click', async (e) => {
  const abrirTab = e.target.closest('button[data-pre-open-tab]');
  if (abrirTab) {
    const id = Number(abrirTab.dataset.preId);
    const tab = abrirTab.dataset.preOpenTab || 'tecnico';
    const p = precampaniaProductos.find((x) => x.id === id);
    if (!p) return;
    cargarProductoEnDrawerPrecampania(p, tab);
    return;
  }
  const abrirEconomico = e.target.closest('button[data-pre-open-economico]');
  if (abrirEconomico) {
    const id = Number(abrirEconomico.dataset.preOpenEconomico);
    const p = precampaniaProductos.find((x) => x.id === id);
    if (!p) return;
    $('#pre-modal-economico').dataset.preId = String(id);
    $('#pre-modal-precio-compra-usd').value = String(Number(p.costoCompra || 0));
    $('#pre-modal-tipo-cambio').value = String(Number(p.tipoCambio || tipoCambioActual || 1));
    $('#pre-modal-margen').value = String(Number(p.porcentajeMargen || 0));
    $('#pre-modal-flete').value = String(Number(p.porcentajeFlete || 0));
    $('#pre-modal-iva').value = String(Number(p.porcentajeIva || 0));
    $('#pre-modal-precio-manual').checked = Boolean(p.usaPrecioManual);
    $('#pre-modal-precio-final-input').value = String(Number(p.precioVentaFinal || 0));
    $('#pre-modal-publicado-web').checked = Boolean(p.publicadoWeb);
    $('#pre-modal-oferta').checked = p.estado === 'DISPONIBLE';
    calcularPreviewEconomicoPrecampania();
    $('#pre-modal-economico')?.showModal();
    return;
  }
  const duplicar = e.target.closest('button[data-pre-duplicar]');
  if (duplicar) {
    const id = Number(duplicar.dataset.preDuplicar);
    const p = precampaniaProductos.find((x) => x.id === id);
    if (!p) return;
    const { id: _id, createdAt, updatedAt, ...payload } = p;
    payload.nombre = `${p.nombre || 'Producto'} (Copia)`;
    await api('/api/productos-precampania', { method: 'POST', body: JSON.stringify(payload) });
    await loadProductosPrecampania();
    setMsg('Producto SemillasYa duplicado', 'info');
    return;
  }
  const toggleVisible = e.target.closest('button[data-pre-toggle-visible]');
  const duplicarPre = e.target.closest('[data-pre-duplicar-mostrador]');
  if (duplicarPre) {
    const id = Number(duplicarPre.dataset.preDuplicarMostrador);
    const p = precampaniaProductos.find((x) => x.id === id);
    if (!p) return;
    productoSemillasYaParaDuplicar = p;
    const precioBase = Number(p.precioVentaFinal || 0);
    $('#pre-modal-dup-id').value = String(id);
    $('#pre-modal-dup-margen').value = '0';
    $('#pre-modal-dup-precio').value = String(precioBase.toFixed(2));
    $('#pre-modal-dup-preview').textContent = `Costo/base SemillasYa ARS: ${money(precioBase)} (no se modifica)`;
    $('#pre-modal-duplicar-mostrador')?.showModal();
    return;
  }
  if (toggleVisible) {
    const id = Number(toggleVisible.dataset.preToggleVisible);
    const idx = precampaniaProductos.findIndex((x) => x.id === id);
    const p = idx >= 0 ? precampaniaProductos[idx] : null;
    if (!p) return;
    const nextVisible = !Boolean(p.visibleEnSemillasYa);
    const prevVisible = Boolean(p.visibleEnSemillasYa);
    precampaniaProductos[idx] = { ...p, visibleEnSemillasYa: nextVisible };
    renderProductosPrecampania();
  renderCultivoChipsPrecampania();
    try {
      const actualizado = await api(`/api/productos-precampania/${id}/publicacion`, { method: 'PATCH', body: JSON.stringify({ visibleEnSemillasYa: nextVisible }) });
      precampaniaProductos[idx] = { ...p, ...actualizado };
      renderProductosPrecampania();
  renderCultivoChipsPrecampania();
      setMsg(`Producto ${nextVisible ? 'publicado' : 'oculto'} en SemillasYa`, 'info');
    } catch (error) {
      precampaniaProductos[idx] = { ...p, visibleEnSemillasYa: prevVisible };
      renderProductosPrecampania();
  renderCultivoChipsPrecampania();
      setMsg(`No se pudo actualizar publicación en SemillasYa: ${error.message || error}`, 'error');
    }
    return;
  }
  const eliminar = e.target.closest('button[data-pre-eliminar]');
  if (!eliminar) return;
  const id = Number(eliminar.dataset.preEliminar);
  await api(`/api/productos-precampania/${id}`, { method: 'DELETE' });
  await loadProductosPrecampania();
  setMsg('Producto SemillasYa desactivado', 'info');
});

['pre-modal-precio-compra-usd','pre-modal-tipo-cambio','pre-modal-margen','pre-modal-flete','pre-modal-iva','pre-modal-precio-final-input']
  .forEach((id) => {
    $(id)?.addEventListener('input', calcularPreviewEconomicoPrecampania);
    $(id)?.addEventListener('change', calcularPreviewEconomicoPrecampania);
  });
$('#pre-modal-precio-manual')?.addEventListener('change', calcularPreviewEconomicoPrecampania);
$('#btn-pre-modal-cerrar')?.addEventListener('click', () => $('#pre-modal-economico')?.close());
$('#btn-pre-modal-guardar')?.addEventListener('click', async () => {
  const modal = $('#pre-modal-economico');
  const id = Number(modal?.dataset.preId || 0);
  if (!id) return;
  const p = precampaniaProductos.find((x) => x.id === id);
  if (!p) return;
  const usaPrecioManual = Boolean($('#pre-modal-precio-manual').checked);
  const precioFinalInput = Number($('#pre-modal-precio-final-input').value || 0);
  const payload = {
    ...p,
    monedaCompra: 'USD',
    costoCompra: Number($('#pre-modal-precio-compra-usd').value || 0),
    tipoCambio: Number($('#pre-modal-tipo-cambio').value || 0),
    porcentajeMargen: Number($('#pre-modal-margen').value || 0),
    porcentajeFlete: Number($('#pre-modal-flete').value || 0),
    porcentajeIva: Number($('#pre-modal-iva').value || 0),
    usaPrecioManual,
    precioManual: usaPrecioManual ? precioFinalInput : null,
    precioInternoManual: usaPrecioManual ? precioFinalInput : Number($('#pre-modal-precio-compra-usd').value || 0),
    precioVentaFinal: precioFinalInput,
    publicadoWeb: Boolean($('#pre-modal-publicado-web').checked),
    estado: $('#pre-modal-oferta').checked ? 'DISPONIBLE' : 'CONSULTAR'
  };
  console.log("guardando variables económicas", payload);
  await api(`/api/productos-precampania/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  modal?.close();
  await loadProductosPrecampania();
  setMsg('Variables económicas actualizadas', 'ok');
});
$('#btn-precampania-guardar')?.addEventListener('click', async () => {
  calcularPreviewPrecampania();
  const id = Number($('#pre-id').value || 0);
  const payload = {
    nombre: ($('#pre-nombre').value || '').trim(),
    cultivo: $('#pre-cultivo').value,
    semilleroLaboratorio: $('#pre-semillero').value,
    categoria: ($('#pre-categoria').value || '').trim(),
    presentacionEnvase: ($('#pre-envase').value || '').trim(),
    descripcion: ($('#pre-descripcion').value || '').trim(),
    descripcionTecnica: ($('#pre-descripcion-tecnica').value || '').trim(),
    recomendacionesUso: ($('#pre-recomendaciones-uso').value || '').trim(),
    epocaSiembra: ($('#pre-epoca-siembra').value || '').trim(),
    dosisOrientativa: ($('#pre-dosis-orientativa').value || '').trim(),
    observacionesComerciales: ($('#pre-imagenes-adicionales').value || '').trim(),
    imagenUrl: ($('#pre-imagen-url').value || '').trim(),
    costoCompra: Number($('#pre-modal-precio-compra-usd')?.value || 0),
    monedaCompra: 'USD',
    porcentajeFlete: Number($('#pre-modal-flete')?.value || 0),
    porcentajeMargen: Number($('#pre-modal-margen')?.value || 0),
    porcentajeIva: Number($('#pre-modal-iva')?.value || 0),
    precioVentaFinal: Number($('#pre-precio-final').value || 0),
    publicadoWeb: Boolean($('#pre-publicado-web').checked),
    estado: $('#pre-oferta').checked ? 'DISPONIBLE' : 'CONSULTAR',
    usaPrecioManual: false,
    precioManual: '',
    precioInternoManual: Number($('#pre-modal-precio-compra-usd')?.value || 0)
  };
  if (!payload.nombre) return setMsg('Nombre obligatorio', 'warning');
  if (!String(payload.cultivo || '').trim()) return setMsg('Cultivo obligatorio', 'warning');
  if (!String(payload.semilleroLaboratorio || '').trim()) return setMsg('Semillero obligatorio', 'warning');
  if (!String(payload.presentacionEnvase || '').trim()) return setMsg('Presentación obligatoria', 'warning');
  if (id) {
    await api(`/api/productos-precampania/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    setMsg('Producto SemillasYa actualizado', 'info');
  } else {
    await api('/api/productos-precampania', { method: 'POST', body: JSON.stringify(payload) });
    setMsg('Producto SemillasYa creado', 'info');
  }
  resetFormularioPrecampania();
  cerrarDrawerPrecampania();
  await loadProductosPrecampania();
});

$('#btn-precampania-publicar-todos')?.addEventListener('click', async () => {
  const data = await api('/api/productos-precampania/publicar-todos', { method: 'POST', body: '{}' });
  await loadProductosPrecampania();
  setMsg(`Publicados en SemillasYa: ${data?.totalActualizados || 0}`, 'ok');
});


calcularPreviewPrecampania();

$('#buscar-producto').addEventListener('input', () => {
  clearTimeout(buscadorProductosTimer);
  buscadorProductosTimer = setTimeout(renderProductos, 120);
});
$('#buscar-producto').addEventListener('keydown', async (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!resultadosProductosVisibles.length) return;
    indiceProductoSeleccionado = Math.min(indiceProductoSeleccionado + 1, resultadosProductosVisibles.length - 1);
    renderProductos();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!resultadosProductosVisibles.length) return;
    indiceProductoSeleccionado = Math.max(indiceProductoSeleccionado - 1, 0);
    renderProductos();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!resultadosProductosVisibles.length) {
      return setMsg('No se encontró ningún producto con esa búsqueda');
    }
    const seleccionado = resultadosProductosVisibles[indiceProductoSeleccionado] || resultadosProductosVisibles[0];
    if (!seleccionado) return setMsg('No se encontró ningún producto con esa búsqueda');
    console.log('Seleccionado producto:', seleccionado.id);
    await agregarProductoAlCarrito(Number(seleccionado.id));
  }
});

$('#resultados-productos').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-producto]');
  if (!b) return;
  console.log('Seleccionado producto:', b.dataset.producto);
  await agregarProductoAlCarrito(Number(b.dataset.producto));
});
$('#mostrador-categorias-chips')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-cat-mostrador]');
  if (!b) return;
  categoriaMostradorActiva = b.dataset.catMostrador || 'TODAS';
  renderCategoriasMostrador();
  renderProductos();
});

async function actualizarCantidadItemCarrito(itemId, cantidad) {
  await api(`/mostrador/ventas/${ventaId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ cantidad: Math.max(0, cantidad) }) });
}

async function ajustarDescuentoItem(itemId, delta) {
  const item = (venta?.items || []).find((i) => Number(i.id) === Number(itemId));
  if (!item) return;
  const descuentoPrevio = item.descuentoPorcentaje;
  const descuentoPorcentaje = clampPorcentaje(Number(item.descuentoPorcentaje || 0) + Number(delta || 0));
  item.descuentoPorcentaje = descuentoPorcentaje;
  const recalculado = calcularItemConDescuento(item);
  Object.assign(item, recalculado);
  renderCarrito();
  try {
    await api(`/mostrador/ventas/${ventaId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ cantidad: item.cantidad, descuentoPorcentaje })
    });
    await refreshVenta();
  } catch (err) {
    item.descuentoPorcentaje = descuentoPrevio;
    Object.assign(item, calcularItemConDescuento(item));
    renderCarrito();
    setMsg(err.message);
  }
}

function incrementarDescuentoItem(itemId) {
  return ajustarDescuentoItem(itemId, 1);
}

function disminuirDescuentoItem(itemId) {
  return ajustarDescuentoItem(itemId, -1);
}

$('#carrito').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-item-id][data-accion]');
  if (!b || !ventaId) return;
  const itemId = Number(b.dataset.itemId);
  const item = (venta.items || []).find(i => Number(i.id) === itemId);
  if (!item) return;
  const cantidad = b.dataset.accion === 'mas' ? item.cantidad + 1 : (b.dataset.accion === 'quitar' ? 0 : item.cantidad - 1);
  try {
    await actualizarCantidadItemCarrito(itemId, cantidad);
    await refreshVenta();
    await loadCaja20();
  } catch (err) { setMsg(err.message); }
});

$('#carrito').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-item-desc-ajustar]');
  if (!b || !ventaId) return;
  const itemId = Number(b.dataset.itemDescItem);
  if (Number(b.dataset.itemDescAjustar || 0) > 0) {
    await incrementarDescuentoItem(itemId);
  } else {
    await disminuirDescuentoItem(itemId);
  }
});

$('#descuento').addEventListener('input', renderCarrito);
$('#descuento-tipo').addEventListener('change', renderCarrito);
$('#ajuste-redondeo')?.addEventListener('input', renderCarrito);
$('#ajuste-mas')?.addEventListener('click', () => { $('#ajuste-redondeo').value = (Number($('#ajuste-redondeo').value || 0) + 1).toFixed(2); renderCarrito(); });
$('#ajuste-menos')?.addEventListener('click', () => { $('#ajuste-redondeo').value = (Number($('#ajuste-redondeo').value || 0) - 1).toFixed(2); renderCarrito(); });
document.querySelectorAll('.btn-redondeo').forEach((btn) => btn.addEventListener('click', () => {
  const base = Number(btn.dataset.redondeo || 100);
  const subtotal = Number((venta?.items || []).reduce((acc, i) => acc + Number(calcularItemConDescuento(i).subtotalFinal || 0), 0));
  const actual = subtotal - (subtotal * (Math.max(0, Number($('#descuento').value || 0)) / 100));
  const objetivo = Math.round(actual / base) * base;
  $('#ajuste-redondeo').value = (objetivo - actual).toFixed(2);
  renderCarrito();
}));

async function buscarClienteMostrador() {
  const q = $('#buscar-cliente').value.trim();
  try {
    const personas = await buscarPersonas(q);
    renderListaClientesMostrador(Array.isArray(personas) ? personas : []);
  } catch (error) {
    mostrarErrorBusqueda('#resultados-clientes', error);
    setMsg(`Error al buscar clientes: ${error.message || error}`, 'warning');
  }
}

$('#btn-buscar-cliente').addEventListener('click', buscarClienteMostrador);
$('#buscar-cliente').addEventListener('input', buscarClienteMostrador);
$('#btn-recargar-clientes-semillasya')?.addEventListener('click', cargarClientesSemillasYa);

$('#resultados-clientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-persona]');
  if (!b) return;
  try {
    if (!ventaId) {
      const v = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
      ventaId = v.id;
      setVentaActivaId(ventaId);
    }
    console.log('Seleccionado cliente:', b.dataset.persona);
    await api(`/mostrador/ventas/${ventaId}/persona`, { method: 'PUT', body: JSON.stringify({ personaId: Number(b.dataset.persona) }) });
    await refreshVenta();
    setMsg('Cliente seleccionado');
  } catch (err) { setMsg(err.message); }
});

$('#resultados-clientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-eliminar-cliente]');
  if (!b) return;
  try {
    await eliminarConPassword(`/clientes/${b.dataset.eliminarCliente}`, 'Cliente');
    await buscarClienteMostrador();
    await loadEliminados();
  } catch (err) { setMsg(`Error al eliminar cliente: ${err.message}`, 'error'); }
});


$('#resultados-clientes').addEventListener('click', async (e) => {
  const bCrear = e.target.closest('#btn-crear-desde-busqueda');
  if (bCrear) {
    document.querySelector('#nuevo-nombre')?.focus();
    return;
  }
});
$('#btn-crear-cliente').addEventListener('click', async () => {
  const btnCrear = $('#btn-crear-cliente');
  const tipoCliente = $('#nuevo-tipo-cliente').value;
  const nombre = $('#nuevo-nombre').value.trim();
  const telefono = $('#nuevo-telefono').value.trim();
  const cuitDni = $('#nuevo-cuit').value.trim();
  const mail = $('#nuevo-mail').value.trim();
  const errorValidacion = validarDatosCliente({ tipoCliente, nombre, telefono, cuitDni, mail });
  if (errorValidacion) return setMsg(errorValidacion, 'warning');
  const labelOriginal = btnCrear.textContent;
  btnCrear.disabled = true;
  btnCrear.textContent = 'Creando...';
  setMsg('Guardando cliente...', 'info');
  try {
    const persona = await crearClientePayload({ tipoCliente, nombre, telefono, cuitDni, mail });
    if (persona.advertenciaDuplicado) setMsg(persona.advertenciaDuplicado, 'warning');
    if (!ventaId) {
      const v = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
      ventaId = v.id;
      setVentaActivaId(ventaId);
    }
    console.log('Seleccionado cliente:', persona.id);
    await api(`/mostrador/ventas/${ventaId}/persona`, { method: 'PUT', body: JSON.stringify({ personaId: persona.id }) });
    await refreshVenta();
    const panelAlta = $('#alta-rapida-panel');
    if (panelAlta) panelAlta.open = false;
    await buscarClienteMostrador();
    limpiarFormularioNuevoCliente();
    setMsg('Cliente creado y seleccionado');
  } catch (err) {
    setMsg(`Error al crear cliente: ${err.message}`);
  } finally {
    btnCrear.disabled = false;
    btnCrear.textContent = labelOriginal;
  }
});
$('#btn-consumidor-final')?.addEventListener('click', async () => {
  try {
    if (!ventaId) {
      const v = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
      ventaId = v.id;
      setVentaActivaId(ventaId);
    }
    await api(`/mostrador/ventas/${ventaId}/persona`, { method: 'PUT', body: JSON.stringify({ personaId: null }) });
    await refreshVenta();
    setMsg('Venta configurada sin cliente (consumidor final)');
  } catch (err) {
    setMsg(`Error al seleccionar consumidor final: ${err.message}`);
  }
});
$('#btn-alta-rapida').addEventListener('click', () => {
  const panelAlta = $('#alta-rapida-panel');
  if (panelAlta) panelAlta.open = true;
  $('#nuevo-nombre').focus();
});
$('#nuevo-tipo-cliente')?.addEventListener('change', actualizarFormularioTipoCliente);
actualizarFormularioTipoCliente();

$('#btn-cerrar').addEventListener('click', async () => {
  console.log('[cerrar-venta] inicio', { ventaId, venta });

  if (!ventaId || !venta?.id) {
    console.log('[cerrar-venta] sin venta actual');
    return setMsg('Debe crear una venta');
  }

  const itemsCarrito = venta?.items || [];
  console.log('[cerrar-venta] items carrito', itemsCarrito);
  if (itemsCarrito.length === 0) {
    console.log('[cerrar-venta] validación fallida: sin productos');
    return setMsg('Debe agregar productos');
  }

  console.log('[cerrar-venta] cliente actual', venta?.persona);
  if (!venta?.persona) {
    setMsg('Cerrando venta como Consumidor final');
  }
  try {
    console.log('[cerrar-venta] POST /mostrador/ventas/:id/cerrar', { id: ventaId });
    const descuentoValor = Math.max(0, Number($('#descuento').value || 0));
    const descuentoTipo = 'PORCENTAJE';
    const ajusteRedondeo = Number($('#ajuste-redondeo').value || 0);
    const condicionPagoPrevista = $('#condicion-pago-prevista').value || null;
    if ((descuentoValor > 0 || ajusteRedondeo !== 0) && !venta?.personaId) {
      return setMsg('Si hay descuento o ajuste de redondeo, debe seleccionar un cliente');
    }
    if ((descuentoValor > 0 || ajusteRedondeo !== 0) && !condicionPagoPrevista) {
      return setMsg('Si hay descuento o ajuste de redondeo, debe indicar condicionPagoPrevista');
    }
    const totalFinal = Math.max(0, Number((venta?.items || []).reduce((acc, i) => acc + Number(i.subtotal || 0), 0)) - (Number((venta?.items || []).reduce((acc, i) => acc + Number(i.subtotal || 0), 0)) * (descuentoValor / 100)) + ajusteRedondeo);
    const payload = {
      personaId: venta?.personaId || null,
      descuentoTipo,
      descuentoValor,
      ajusteRedondeo,
      condicionPagoPrevista,
      totalFinal
    };
    console.log('Payload venta:', payload);
    const ventaCerrada = await api(`/mostrador/ventas/${ventaId}/cerrar`, { method: 'POST', body: JSON.stringify(payload) });
    logFlujo('venta cerrada', { id: ventaCerrada.id, estado: ventaCerrada.estado });

    ventaId = null;
    setVentaActivaId(null);
    venta = null;
    $('#venta-activa').textContent = 'Sin venta activa';
    renderCarrito();
    renderClienteActivo();
    await loadCaja20();
    logFlujo('caja actualizada');
    $('#descuento').value = '0';
    $('#descuento-tipo').value = 'PORCENTAJE';
    $('#ajuste-redondeo').value = '0';
    $('#condicion-pago-prevista').value = '';
    setMsg(`✅ Venta #${ventaCerrada.id} creada correctamente y enviada a caja. Puede ver/imprimir ticket en caja o en ventas cobradas.`);
    window.open(`/ventas/${ventaCerrada.id}/ticket`, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.log('[cerrar-venta] error backend', err);
    const detalle = (typeof err?.body === 'object' && err?.body)
      ? JSON.stringify(err.body)
      : String(err?.body || '');
    setMsg(`Error al cerrar venta (backend): ${err.message}${detalle ? ` | detalle: ${detalle}` : ''}`);
  }
});

document.addEventListener('keydown', async (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    $('#btn-cerrar').click();
  }
});

$('#btn-cc-buscar').addEventListener('click', async () => {
  const q = $('#cc-buscar-cliente').value.trim();
  if (!q) return;
  try {
    const personas = await api('/personas/buscar?q=' + encodeURIComponent(q));
    $('#cc-resultados-clientes').innerHTML = personas.length
      ? personas.map(p => `<div class="item"><strong>📞 ${p.telefono || '-'}</strong> | ${p.nombre || '-'} | ${p.cuitDni || '-'} | Compras: ${Number(p.cantidadCompras || 0)} | Total comprado: ${money(p.totalComprado || 0)} <button data-cc-persona="${p.id}">Ver cuenta</button></div>`).join('')
      : '<div class="item">Sin resultados</div>';
  } catch (e) { setMsg(e.message); }
});

$('#cc-resultados-clientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-cc-persona]');
  if (!b) return;
  try {
    const cuenta = await cargarCuentaCorrientePersona(Number(b.dataset.ccPersona));
    renderPanelCuentaCorriente(cuenta);
  } catch (e2) { setMsg(e2.message); }
});

$('#cc-resumen-personas')?.addEventListener('click', async (e) => {
  const verDetalle = e.target.closest('button[data-cc-persona]');
  if (verDetalle) {
    try {
      const cuenta = await cargarCuentaCorrientePersona(Number(verDetalle.dataset.ccPersona));
      renderPanelCuentaCorriente(cuenta);
    } catch (error) {
      setMsg(error.message);
    }
    return;
  }

  const registrarPagoPersona = e.target.closest('button[data-cc-registrar-pago-persona]');
  if (registrarPagoPersona) {
    try {
      const cuenta = await cargarCuentaCorrientePersona(Number(registrarPagoPersona.dataset.ccRegistrarPagoPersona));
      renderPanelCuentaCorriente(cuenta);
      document.getElementById('cc-pago-monto')?.focus();
    } catch (error) {
      setMsg(error.message);
    }
    return;
  }
});

$('#btn-cc-registrar-pago').addEventListener('click', async () => {
  const personaId = cuentaCorrienteMostrada?.personaId;
  if (!personaId) return setMsg('Seleccione un cliente para registrar pago');
  const monto = Number($('#cc-pago-monto').value);
  const medioPago = $('#cc-pago-medio').value;
  const fecha = $('#cc-pago-fecha').value;
  const observacion = $('#cc-pago-observacion').value.trim();
  if (!monto || monto <= 0) return setMsg('Ingrese un monto válido');
  if (!fecha) return setMsg('Seleccione la fecha del pago');
  try {
    const payload = { monto, medioPago, fecha, observacion };
    const result = await api(`/cuenta-corriente/personas/${personaId}/pagos`, { method: 'POST', body: JSON.stringify(payload) });
    const cuenta = await cargarCuentaCorrientePersona(personaId);
    renderPanelCuentaCorriente(cuenta);
    await renderCuentaCorrienteClienteActivo();
    await loadResumenCuentaCorriente();
    const recibo = result?.recibo;
    const view = document.getElementById('cc-recibo-view');
    if (view && recibo) {
      const whatsapp = `/cuenta-corriente/recibos/${recibo.id}/whatsapp`;
      view.innerHTML = `<div class="item"><strong>Recibo #${recibo.id}</strong> | ${recibo.personaNombre} | ${money(recibo.monto)} | ${new Date(recibo.fechaPago).toLocaleString('es-AR')}<div class="action-row"><button onclick="window.open('/cuenta-corriente/recibos/${recibo.id}/ver','_blank')">Ver</button><button onclick="window.open('/cuenta-corriente/recibos/${recibo.id}/imprimir','_blank')">Imprimir</button><button onclick="window.open('${whatsapp}','_blank')">WhatsApp</button></div></div>`;
    }
    setMsg('Pago registrado, saldo actualizado y recibo generado');
  } catch (e) { setMsg(e.message); }
});





async function loadCaja20() {
  const pendientesEl = document.getElementById('pendientes');
  const cobradasEl = document.getElementById('cobradas-recientes');
  const cierresEl = document.getElementById('cierres-caja');

  if (pendientesEl) pendientesEl.innerHTML = '<div class="item">Cargando pendientes de cobro...</div>';
  if (cobradasEl) cobradasEl.innerHTML = '<div class="item">Cargando cobradas recientes...</div>';
  if (cierresEl) cierresEl.innerHTML = '<div class="item">Cargando historial de cierres...</div>';

  const renderError = (el, titulo, error) => {
    if (!el) return;
    el.innerHTML = `<div class="item item-error"><strong>${titulo}</strong><p>${escapeHtmlClient(error?.message || error || 'Error desconocido')}</p><button type="button" data-recargar-caja20>Reintentar</button></div>`;
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = money(value || 0);
  };

  const [pendientesRes, resumenRes, cobradasRes] = await Promise.allSettled([
    api('/caja/ventas'),
    api('/caja/resumen'),
    api('/ventas/cobradas-recientes')
  ]);

  if (resumenRes.status === 'fulfilled') {
    const resumen = resumenRes.value || {};
    const efectivo = resumen.efectivo ?? resumen.EFECTIVO ?? 0;
    const transferencia = resumen.transferencia ?? resumen.TRANSFERENCIA ?? 0;
    const tarjeta = resumen.tarjeta ?? resumen.TARJETA ?? 0;
    const cuentaCorriente = resumen.cuentaCorriente ?? resumen.CUENTA_CORRIENTE ?? 0;
    setText('resumen-total', resumen.totalGeneral || resumen.totalVendido || 0);
    setText('resumen-efectivo', efectivo);
    setText('resumen-transferencia', transferencia);
    setText('resumen-tarjeta', tarjeta);
    setText('resumen-cuenta-corriente', cuentaCorriente);
    setText('resumen-caja-real', Number(efectivo) + Number(transferencia) + Number(tarjeta));
  } else {
    setText('resumen-total', 0);
    setText('resumen-efectivo', 0);
    setText('resumen-transferencia', 0);
    setText('resumen-tarjeta', 0);
    setText('resumen-cuenta-corriente', 0);
    setText('resumen-caja-real', 0);
    setMsg(`Error al cargar resumen de caja: ${resumenRes.reason?.message || resumenRes.reason}`, 'warning');
  }

  if (pendientesRes.status === 'fulfilled') {
    const pendientes = Array.isArray(pendientesRes.value) ? pendientesRes.value : [];
    if (pendientesEl) {
      pendientesEl.innerHTML = pendientes.length
        ? pendientes.map(v => `
          <div class="item">
            <h3>${escapeHtmlClient(v.persona?.nombre || v.comprador || 'Consumidor final')}</h3>
            <p><strong>Nº venta:</strong> #${escapeHtmlClient(v.numeroVenta || v.id)}</p>
            <p><strong>Total:</strong> ${money(v.total)}</p>
            <p><strong>Condición prevista:</strong> ${escapeHtmlClient(v.condicionPagoPrevista || 'Sin definir')}</p>
            <div class="action-row">
              <button data-caja20-cobrar="${v.id}" data-medio="EFECTIVO">Efectivo</button>
              <button data-caja20-cobrar="${v.id}" data-medio="TRANSFERENCIA">Transferencia</button>
              <button data-caja20-cobrar="${v.id}" data-medio="TARJETA">Tarjeta</button>
              <button data-caja20-cobrar="${v.id}" data-medio="CUENTA_CORRIENTE">Cuenta corriente</button>
            </div>
          </div>
        `).join('')
        : '<div class="item">No hay ventas pendientes de cobro.</div>';
    }
  } else {
    renderError(pendientesEl, 'No se pudieron cargar los pendientes de cobro.', pendientesRes.reason);
  }

  if (cobradasRes.status === 'fulfilled') {
    const cobradas = Array.isArray(cobradasRes.value) ? cobradasRes.value : [];
    if (cobradasEl) {
      const cobradasOrdenadas = [...cobradas].sort((a, b) => {
        const fechaA = new Date(a.cobradaAt || a.updatedAt || a.createdAt || 0).getTime();
        const fechaB = new Date(b.cobradaAt || b.updatedAt || b.createdAt || 0).getTime();
        if (fechaA !== fechaB) return fechaB - fechaA;
        return Number(b.id || 0) - Number(a.id || 0);
      });
      cobradasEl.innerHTML = cobradasOrdenadas.length
        ? `<div class="cobradas-lista-compacta">${cobradasOrdenadas.map(v => `
          <div class="item item-compacto">
            <p><strong>Nº venta:</strong> #${escapeHtmlClient(v.numeroVenta || v.id)}</p>
            <p><strong>Comprador:</strong> ${escapeHtmlClient(v.persona?.nombre || v.comprador || 'Consumidor final')}</p>
            <p><strong>Forma de pago:</strong> ${escapeHtmlClient(v.formaPago || v.medioPago || 'Sin medio')}</p>
            <p><strong>Total:</strong> ${money(v.total)}</p>
            <div class="action-row">
              <button class="btn-ver-ticket-cobrada" data-id="${v.id}">Ver ticket</button>
              <button class="btn-imprimir-ticket-cobrada" data-id="${v.id}">Imprimir</button>
            </div>
          </div>
        `).join('')}</div>`
        : '<div class="item">Todavía no hay ventas cobradas recientes.</div>';
    }
  } else {
    renderError(cobradasEl, 'No se pudieron cargar las cobradas recientes.', cobradasRes.reason);
  }

  document.querySelectorAll('.btn-ver-ticket-cobrada').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleTicketEnModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-imprimir-ticket-cobrada').forEach(btn => {
    btn.addEventListener('click', () => window.open(`/ventas/${btn.dataset.id}/ticket`, '_blank', 'noopener,noreferrer'));
  });

  try {
    await loadCierresCaja();
  } catch (error) {
    renderError(cierresEl, 'No se pudo cargar el historial de cierres.', error);
  }
}


let ventaTicketActualId = null;
let cierreCajaPendiente = null;

async function abrirDetalleTicketEnModal(ventaId) {
  ventaTicketActualId = Number(ventaId);
  try {
    const detalle = await api(`/ventas/${ventaId}/ticket?formato=json`);
    const venta = detalle?.venta || {};
    const cliente = detalle?.cliente || {};
    const items = Array.isArray(detalle?.items) ? detalle.items : [];
  const descuentos = detalle?.descuentos || {};
  const descuento = descuentos.tipo
    ? `${descuentos.tipo} ${Number(descuentos.valor || 0).toFixed(2)} (${money(descuentos.monto || 0)})`
    : 'Sin descuento';

  const telefonoCliente = String(cliente.telefono || '').trim();
  const direccionCliente = String(cliente.direccion || '').trim();
  const cuitDniCliente = String(cliente.cuitDni || '').trim();
  $('#ticket-venta-contenido').innerHTML = `
    <div class="ticket-sb-logo"><div class="ticket-sb-marca">SAN BERNARDO</div><div class="ticket-sb-sub">AGROQUIMICA • FUMIGACIONES • RIEGO</div></div>
    <p><strong>Nº venta:</strong> #${escapeHtmlClient(venta.id || ventaTicketActualId)}</p>
    <p><strong>Fecha:</strong> ${venta.fecha ? new Date(venta.fecha).toLocaleString('es-AR') : '-'}</p>
    <p><strong>Cliente:</strong> ${escapeHtmlClient(cliente.nombre || 'Consumidor final')}</p>
    ${telefonoCliente ? `<p><strong>Teléfono:</strong> ${escapeHtmlClient(telefonoCliente)}</p>` : ''}
    ${direccionCliente ? `<p><strong>Dirección:</strong> ${escapeHtmlClient(direccionCliente)}</p>` : ''}
    ${cuitDniCliente ? `<p><strong>CUIT/DNI:</strong> ${escapeHtmlClient(cuitDniCliente)}</p>` : ''}
    <p><strong>Forma de pago:</strong> ${escapeHtmlClient(detalle?.formaPago || venta.formaPago || '-')}</p>
    <table>
      <colgroup><col class="col-producto"><col class="col-cantidad"><col class="col-precio"><col class="col-descuento"><col class="col-subtotal"></colgroup>
      <thead><tr><th class="col-producto">Producto</th><th class="col-cantidad">Cantidad</th><th class="col-precio">Precio unitario</th><th class="col-descuento">Descuento</th><th class="col-subtotal">Subtotal</th></tr></thead>
      <tbody>${items.length ? items.map(item => `<tr><td class="col-producto">${escapeHtmlClient(item.producto || '-')}</td><td class="col-cantidad">${item.cantidad || 0}</td><td class="col-precio">${money(item.precioUnitario || 0)}</td><td class="col-descuento">${Number(item.descuentoMonto || 0) > 0 ? money(item.descuentoMonto) : '-'}</td><td class="col-subtotal">${money(item.subtotalFinal || item.subtotal || 0)}</td></tr>`).join('') : '<tr><td colspan="5">Sin productos</td></tr>'}</tbody>
    </table>
    <p><strong>Subtotal:</strong> ${money(venta.subtotal || 0)}</p>
    <p><strong>Descuento:</strong> ${descuento}</p>
    <p><strong>Redondeo:</strong> ${money(detalle?.redondeo ?? venta.ajusteRedondeo ?? 0)}</p>
    <p><strong>Total final:</strong> ${money(venta.total || detalle?.total || 0)}</p>
    <div class="mensaje-pago"><strong>Alias de pago: INGLAMBOIS</strong><br/>Por favor enviar comprobante de pago al Ing. Lambois.</div>
  `;
    $('#modal-ticket-venta')?.showModal();
  } catch (error) {
    $('#ticket-venta-contenido').innerHTML = `<div class="item item-error"><strong>No se pudo cargar el ticket.</strong><p>${escapeHtmlClient(error.message || error)}</p></div>`;
    $('#modal-ticket-venta')?.showModal();
    setMsg(`No se pudo cargar el ticket: ${error.message || error}`, 'warning');
  }
}

async function cerrarCajaDesdeCaja20() {
  const fechaCaja = $('#caja-fecha')?.value || undefined;
  const turno = $('#caja-turno')?.value || 'DIARIO';
  const resumen = await api('/caja/resumen' + (fechaCaja ? `?fecha=${encodeURIComponent(fechaCaja)}&turno=${encodeURIComponent(turno)}` : `?turno=${encodeURIComponent(turno)}`));
  const operaciones = Number(resumen.cantidadVentasCobradas || resumen.cantidadOperaciones || 0);
  const efectivo = Number(resumen.efectivo ?? resumen.EFECTIVO ?? 0);
  const transferencia = Number(resumen.transferencia ?? resumen.TRANSFERENCIA ?? 0);
  const tarjeta = Number(resumen.tarjeta ?? resumen.TARJETA ?? 0);
  const cuentaCorriente = Number(resumen.cuentaCorriente ?? resumen.CUENTA_CORRIENTE ?? 0);
  const totalVendido = Number(resumen.totalGeneral || resumen.totalVendido || 0);
  const totalCobrado = efectivo + transferencia + tarjeta + cuentaCorriente;
  const pendientes = Math.max(0, totalVendido - totalCobrado);

  cierreCajaPendiente = { fechaCaja, turno };
  $('#modal-cierre-efectivo').textContent = money(efectivo);
  $('#modal-cierre-transferencia').textContent = money(transferencia);
  $('#modal-cierre-tarjeta').textContent = money(tarjeta);
  $('#modal-cierre-cc').textContent = money(cuentaCorriente);
  $('#modal-cierre-total-vendido').textContent = money(totalVendido);
  $('#modal-cierre-total-cobrado').textContent = money(totalCobrado);
  $('#modal-cierre-pendientes').textContent = money(pendientes);
  $('#modal-cierre-operaciones').textContent = String(operaciones);

  $('#modal-cierre-caja')?.showModal();
}

async function confirmarCierreCajaPendiente() {
  if (!cierreCajaPendiente) return;
  await api('/caja/cerrar', { method: 'POST', body: JSON.stringify(cierreCajaPendiente) });
  $('#modal-cierre-caja')?.close();
  cierreCajaPendiente = null;
  await loadCaja20();
  setMsg('✅ Caja cerrada, caja activa actualizada e historial disponible');
}

document.addEventListener('click', async (e) => {
  const recargarCaja = e.target.closest('button[data-recargar-caja20]');
  if (recargarCaja) {
    try {
      await loadCaja20();
      setMsg('Caja recargada correctamente');
    } catch (err) {
      setMsg(err.message, 'warning');
    }
    return;
  }

  const btn = e.target.closest('button[data-caja20-cobrar]');
  if (!btn) return;

  const ventaId = btn.dataset.caja20Cobrar;
  const medio = btn.dataset.medio;

  try {
    await api(`/caja/cobrar/${ventaId}`, {
      method: 'POST',
      body: JSON.stringify({
        medioPago: medio,
        estadoCobroReal: medio === 'CUENTA_CORRIENTE' ? 'CUENTA_CORRIENTE' : 'PAGADO'
      })
    });

    await loadCaja20();
    setMsg('✅ Venta procesada correctamente');
  } catch (err) {
    setMsg(err.message);
  }
});


$('#caja-fecha').addEventListener('change', async (e) => {
  fechaCajaSeleccionada = e.target.value || null;
  try {
    await loadResumenCaja();
  } catch (err) {
    setMsg(err.message);
  }
});

$('#btn-ver-caja').addEventListener('click', async () => {
  try {
    await loadResumenCaja();
    setMsg('Caja consultada correctamente');
  } catch (err) {
    setMsg(err.message);
  }
});

$('#btn-cerrar-caja').addEventListener('click', async () => {
  try {
    await cerrarCajaDesdeCaja20();
  } catch (err) {
    setMsg(err.message);
  }
});

$('#btn-caja20-cerrar')?.addEventListener('click', async () => {
  try {
    await cerrarCajaDesdeCaja20();
  } catch (err) {
    setMsg(err.message);
  }
});

$('#btn-confirmar-cierre')?.addEventListener('click', async () => {
  try {
    await confirmarCierreCajaPendiente();
  } catch (err) {
    setMsg(err.message);
  }
});

$('#btn-cancelar-cierre')?.addEventListener('click', () => {
  $('#modal-cierre-caja')?.close();
  cierreCajaPendiente = null;
});
$('#btn-ticket-cerrar-modal')?.addEventListener('click', () => {
  $('#modal-ticket-venta')?.close();
});
$('#btn-ticket-imprimir-modal')?.addEventListener('click', () => {
  if (!ventaTicketActualId) return;
  window.open(`/ventas/${ventaTicketActualId}/ticket`, '_blank', 'noopener,noreferrer');
});
$('#btn-ticket-pdf-modal')?.addEventListener('click', () => {
  if (!ventaTicketActualId) return;
  window.open(`/ventas/${ventaTicketActualId}/ticket`, '_blank', 'noopener,noreferrer');
});

$('#ventas-cobradas-fecha').addEventListener('change', (e) => {
  fechaVentasCobradasSeleccionada = e.target.value || null;
});

$('#btn-ventas-cobradas-buscar').addEventListener('click', async () => {
  try {
    await loadVentasCobradas();
  } catch (err) {
    setMsg(err.message);
  }
});
['#prod-costo', '#prod-iva', '#prod-flete', '#prod-ganancia', '#prod-moneda'].forEach(sel => {
  $(sel).addEventListener('input', () => {
    renderResumenPreciosProducto();
  });
});

$('#btn-guardar-chatbot-config')?.addEventListener('click', () => guardarConfiguracionChatbot().catch((err) => { setMsg(err.message, 'error'); const estado = $('#chatbot-config-estado'); if (estado) estado.textContent = err.message; }));

$('#btn-guardar-tipo-cambio').addEventListener('click', async () => {
  try {
    const nuevo = Number($('#tipo-cambio').value || 0);
    await api('/config/tipo-cambio', { method: 'PUT', body: JSON.stringify({ tipoCambioActual: nuevo }) });
    await loadTipoCambio();
    await loadProductosAll();
  productosPedidoVisibles = productos.slice(0, 30);
  renderPedidoProductos();
    setMsg('Tipo de cambio actualizado');
  } catch (err) { setMsg(err.message); }
});

$('#btn-guardar-producto').addEventListener('click', async () => {
  const btnGuardar = $('#btn-guardar-producto');
  try {
    const nombre = $('#prod-nombre').value.trim();
    const categoriaIds = Array.from($('#prod-categoria').selectedOptions || []).map((o) => Number(o.value)).filter((id) => Number.isInteger(id) && id > 0);
    const categoriaTexto = categoriasProducto.filter((c) => categoriaIds.includes(c.id)).map((c) => c.nombre).join(', ');

    if (!nombre) return setMsg('El nombre del producto es obligatorio', 'error');
    if (categoriasProducto.length > 0 && !categoriaIds.length) return setMsg('Debe seleccionar al menos una categoría', 'error');
    if (!categoriasProducto.length) return setMsg('Primero debe crear una categoría desde el módulo Categorías.', 'error');

    const proveedorIds = Array.from($('#prod-proveedor').selectedOptions || [])
      .map((o) => Number(o.value))
      .filter((id) => Number.isInteger(id) && id > 0);

    const payload = {
      nombre,
      categoria: categoriaTexto,
      categoriaIds,
      marca: $('#prod-marca').value.trim(),
      unidad: $('#prod-unidad').value.trim(),
      stock: Number($('#prod-stock').value || 0),
      monedaCompra: normalizarMonedaProducto($('#prod-moneda').value),
      costoCompraOriginal: Number($('#prod-costo').value || 0),
      costoCompra: Number($('#prod-costo').value || 0),
      ivaPorcentaje: Number($('#prod-iva').value || 0),
      fletePorcentaje: Number($('#prod-flete').value || 0),
      margenGananciaPorcentaje: Number($('#prod-ganancia').value || 0),
      proveedorIds,
      principioActivo: $('#prod-principio-activo').value.trim(),
      concentracion: $('#prod-concentracion').value.trim(),
      habilitacionHabitual: $('#prod-habilitacion-habitual').value.trim(),
      aptoSenasaMip: $('#prod-apto-senasa-mip').checked,
      resolucionSenasa: $('#prod-resolucion-senasa').value.trim(),
      fechaResolucionSenasa: $('#prod-fecha-resolucion-senasa').value || null,
      tipoSenasa: $('#prod-tipo-senasa').value,
      usoSenasa: $('#prod-uso-senasa').value.trim()
    };

    const id = $('#prod-id').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/productos/${id}` : '/productos';
    console.log('[producto-guardado][frontend] payload', payload);
    console.log('[producto-guardado][frontend] iniciando', { method, url, payload, id: id || null });

    btnGuardar.disabled = true;
    setMsg('Guardando...', 'info');

    const productoGuardado = await api(url, { method, body: JSON.stringify(payload) });
    console.log('[producto-guardado][frontend] respuesta ok', productoGuardado);

    await loadProductosAll();
  productosPedidoVisibles = productos.slice(0, 30);
  renderPedidoProductos();
    filtroProductosAdmin = '';
    $('#admin-buscar-producto').value = '';
    renderProductosAdmin();

    const productoEnLista = (productos || []).find((p) => Number(p.id) === Number(productoGuardado?.id));
    if (productoEnLista) {
      console.log('[producto-guardado][frontend] producto visible tras refresco', productoEnLista);
    }
    limpiarFormularioProducto();
    setModoProducto('AGREGAR');
    setMsg('Producto guardado', 'success');
  } catch (err) {
    console.error('[producto-guardado][frontend] error', err);
    const detalle = err?.body ? (typeof err.body === 'string' ? err.body : JSON.stringify(err.body)) : '';
    setMsg(`Error al guardar producto: ${err.message}${detalle ? ` | ${detalle}` : ''}`, 'error');
  } finally {
    btnGuardar.disabled = false;
  }
});

$('#btn-nuevo-producto').addEventListener('click', limpiarFormularioProducto);
$('#btn-modo-agregar-producto').addEventListener('click', () => setModoProducto('AGREGAR'));
$('#btn-modo-editar-producto').addEventListener('click', () => setModoProducto('EDITAR'));
$('#btn-guardar-categoria')?.addEventListener('click', async () => {
  try {
    const nombre = ($('#cat-nombre').value || '').trim();
    const descripcion = ($('#cat-descripcion').value || '').trim();
    if (!nombre) return setMsg('Nombre de categoría obligatorio', 'error');
    await api('/categorias', { method: 'POST', body: JSON.stringify({ nombre, descripcion }) });
    $('#cat-nombre').value = '';
    $('#cat-descripcion').value = '';
    await loadCategoriasProducto();
    setMsg('Categoría creada', 'success');
  } catch (err) { setMsg(err.message, 'error'); }
});
$('#categorias-lista')?.addEventListener('click', async (e) => {
  const id = Number(e.target.dataset.catToggle || 0);
  if (!id) return;
  try {
    const activoActual = e.target.dataset.activo === '1';
    await api(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify({ activo: !activoActual }) });
    await loadCategoriasProducto();
  } catch (err) { setMsg(err.message, 'error'); }
});
$('#admin-buscar-producto').addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  if (!q) {
    filtroProductosAdmin = '';
    return renderProductosAdmin();
  }
  try {
    const lista = await buscarProductos(q);
    $('#productos-admin').innerHTML = lista.length
      ? lista.map((p) => renderProductoCard(p, { accion: 'data-editar-producto', accionLabel: 'Editar', accionClass: 'btn-accion-editar', extraBotones: `<button class="btn-accion-precio" data-editar-producto="${p.id}">Cambiar precio</button>` })).join('')
      : '<div class="item">Sin resultados</div>';
  } catch (error) {
    mostrarErrorBusqueda('#productos-admin', error);
  }
});
$('#productos-admin').addEventListener('click', (e) => {
  const id = e.target.dataset.editarProducto;
  if (!id) return;
  const p = productos.find(x => String(x.id) === String(id));
  if (!p) return;
  console.log('Producto cargado para edición:', p);
  $('#prod-id').value = p.id;
  $('#prod-nombre').value = p.nombre;
  renderCategoriasProducto((p.categorias || []).map((c) => c.id));
  $('#prod-marca').value = p.marca || '';
  $('#prod-unidad').value = p.unidad || '';
  $('#prod-stock').value = p.stock;
  $('#prod-moneda').value = normalizarMonedaProducto(p.monedaCompra || p.monedaCosto || 'ARS');
  $('#prod-costo').value = p.costoCompra || p.costoBase || 0;
  $('#prod-iva').value = p.ivaPorcentaje || p.porcentajeUva || p.ivaMonto || 0;
  $('#prod-flete').value = p.fletePorcentaje || p.porcentajeFlete || p.fleteMonto || 0;
  $('#prod-ganancia').value = p.margenGananciaPorcentaje || p.porcentajeGanancia || 0;
  $('#prod-principio-activo').value = p.principioActivo || '';
  $('#prod-concentracion').value = p.concentracion || '';
  $('#prod-habilitacion-habitual').value = p.habilitacionHabitual || '';
  $('#prod-apto-senasa-mip').checked = productoEsSenasaMip(p);
  $('#prod-resolucion-senasa').value = p.resolucionSenasa || '';
  $('#prod-fecha-resolucion-senasa').value = senasaFecha(p.fechaResolucionSenasa);
  $('#prod-tipo-senasa').value = p.tipoSenasa || '';
  $('#prod-uso-senasa').value = p.usoSenasa || '';
  const ids = (p.proveedores || []).map(pp => String(pp.proveedorId));
  Array.from($('#prod-proveedor').options).forEach(o => { o.selected = ids.includes(o.value); });
  renderResumenPreciosProducto();
  setModoProducto('EDITAR');
});

$('#productos-admin').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-eliminar-producto]');
  if (!b) return;
  try {
    await eliminarConPassword(`/productos/${b.dataset.eliminarProducto}`, 'Producto');
    await loadProductosAll();
  productosPedidoVisibles = productos.slice(0, 30);
  renderPedidoProductos();
    await loadEliminados();
  } catch (err) { setMsg(`Error al eliminar producto: ${err.message}`, 'error'); }
});
async function buscarClientePresupuesto() {
  const q = $('#pres-buscar-cliente').value.trim();
  if (!q) { $('#pres-clientes').innerHTML = '<div class="item">Sin resultados</div>'; return; }
  try {
    const personas = await buscarPersonas(q);
    $('#pres-clientes').innerHTML = personas.filter(p => (p.tipo || '').toUpperCase() !== 'CONSUMIDOR_FINAL').slice(0, 8)
      .map(p => `<div class="item"><strong>📞 ${p.telefono || '-'}</strong> | ${p.nombre || '-'} | Compras: ${Number(p.cantidadCompras || 0)} | Total comprado: ${money(p.totalComprado || 0)} <button data-pres-cliente="${p.id}" data-pres-nombre="${p.nombre}">Seleccionar</button></div>`).join('') || '<div class="item">Sin resultados</div>';
  } catch (error) { mostrarErrorBusqueda('#pres-clientes', error); }
}
$('#pres-btn-buscar-cliente').addEventListener('click', buscarClientePresupuesto);
$('#pres-buscar-cliente').addEventListener('input', buscarClientePresupuesto);
$('#pres-clientes').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-pres-cliente]');
  if (!b) return;
  console.log('Seleccionado cliente:', b.dataset.presCliente);
  presupuestoClienteId = Number(b.dataset.presCliente);
  $('#pres-cliente-activo').textContent = b.dataset.presNombre;
});
$('#pres-productos').addEventListener('click', (e) => {
  const mas = e.target.closest('button[data-pres-mas]');
  const menos = e.target.closest('button[data-pres-menos]');
  const agregar = e.target.closest('button[data-pres-agregar]');
  const quitar = e.target.closest('button[data-pres-quitar]');
  const id = Number(mas?.dataset.presMas || menos?.dataset.presMenos || agregar?.dataset.presAgregar || quitar?.dataset.presQuitar || 0);
  if (!id) return;
  const prod = productos.find(p => p.id === id) || productosPresupuestoVisibles.find(p => p.id === id);
  const it = presupuestoItems.find(x => x.productoId === id);
  if (mas || agregar) {
    if (it) it.cantidad += 1;
    else if (prod) {
      const nuevo = { productoId: id, nombre: prod.nombre, precioUnitario: Number(prod.precioPesosCalculado || prod.precioFinalPesos || 0), cantidad: 1, descuentoPorcentaje: 0, descuentoMonto: 0, subtotal: Number(prod.precioPesosCalculado || prod.precioFinalPesos || 0) };
      console.log('Producto agregado al presupuesto:', prod);
      presupuestoItems.push(nuevo);
    }
  }
  if (menos && it) { it.cantidad -= 1; if (it.cantidad <= 0) presupuestoItems = presupuestoItems.filter(x => x.productoId !== id); }
  if (quitar) presupuestoItems = presupuestoItems.filter(x => x.productoId !== id);
  console.log('Items presupuesto:', presupuestoItems);
  renderPresupuestoProductos();
});
$('#pres-productos').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-pres-desc-ajustar]');
  if (!b) return;
  const id = Number(b.dataset.presDescItem || 0);
  const it = presupuestoItems.find((x) => x.productoId === id);
  if (!it) return;
  it.descuentoPorcentaje = clampPorcentaje(Number(it.descuentoPorcentaje || 0) + Number(b.dataset.presDescAjustar || 0));
  renderPresupuestoProductos();
});
async function buscarProductoPresupuesto() {
  const query = $('#pres-buscar-producto').value.trim();
  filtroProductosPresupuesto = query.toLowerCase();
  console.log('Buscando producto presupuesto:', query);
  try {
    productosPresupuestoVisibles = filtroProductosPresupuesto ? await buscarProductos(filtroProductosPresupuesto) : [];
    console.log('Resultados productos presupuesto:', productosPresupuestoVisibles);
    renderPresupuestoProductos();
  } catch (error) { mostrarErrorBusqueda('#pres-productos', error); }
}
$('#pres-btn-buscar-producto').addEventListener('click', buscarProductoPresupuesto);
$('#pres-buscar-producto').addEventListener('input', buscarProductoPresupuesto);
$('#pres-descuento').addEventListener('input', renderPresupuestoProductos);
$('#pres-ajuste-redondeo').addEventListener('input', renderPresupuestoProductos);
$('#pres-condicion-pago-prevista').addEventListener('change', renderPresupuestoProductos);
function aplicarRedondeoPresupuesto(base) {
  const subtotal = presupuestoItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  const hayClienteSeleccionado = presupuestoTipoDestinatario === 'EXISTENTE' && Boolean(presupuestoClienteId);
  const descuentoPorcentaje = hayClienteSeleccionado ? Math.max(0, Number($('#pres-descuento')?.value || 0)) : 0;
  const parcial = Math.max(0, subtotal - (subtotal * (descuentoPorcentaje / 100)));
  const objetivo = Math.round(parcial / base) * base;
  $('#pres-ajuste-redondeo').value = (objetivo - parcial).toFixed(2);
  renderPresupuestoProductos();
}
$('#pres-redondear-100').addEventListener('click', () => aplicarRedondeoPresupuesto(100));
$('#pres-redondear-500').addEventListener('click', () => aplicarRedondeoPresupuesto(500));
$('#pres-redondear-1000').addEventListener('click', () => aplicarRedondeoPresupuesto(1000));
presupuestoTipoDestinatario = $('#pres-tipo-destinatario')?.value || 'A_QUIEN_CORRESPONDA';
$('#pres-tipo-destinatario').addEventListener('change', (e) => {
  presupuestoTipoDestinatario = e.target.value;
  if (presupuestoTipoDestinatario !== 'EXISTENTE') {
    presupuestoClienteId = null;
    $('#pres-cliente-activo').textContent = 'Ninguno';
  }
  renderPresupuestoProductos();
});
$('#pres-nombre-libre').addEventListener('input', (e) => {
  presupuestoNombreLibre = e.target.value.trim();
});
$('#pres-guardar').addEventListener('click', async () => {
  try {
    if (presupuestoTipoDestinatario === 'EXISTENTE' && !presupuestoClienteId) throw new Error('Debe seleccionar una persona/empresa');
    if (presupuestoTipoDestinatario === 'LIBRE' && !presupuestoNombreLibre) throw new Error('Debe ingresar nombre manual para presupuesto libre');
    if (!presupuestoItems.length) throw new Error('Debe agregar al menos un producto');
    const hayClienteSeleccionado = presupuestoTipoDestinatario === 'EXISTENTE' && Boolean(presupuestoClienteId);
    const descuentoValor = hayClienteSeleccionado ? Math.max(0, Number($('#pres-descuento').value || 0)) : 0;
    const ajusteRedondeo = Number($('#pres-ajuste-redondeo').value || 0);
    const condicionPagoPrevista = $('#pres-condicion-pago-prevista').value || null;
    if ((descuentoValor > 0 || ajusteRedondeo !== 0) && !condicionPagoPrevista) throw new Error('Si hay descuento o ajuste de redondeo, debe indicar condicionPagoPrevista');
    const creado = await api('/presupuestos', { method: 'POST', body: JSON.stringify({ tipoDestinatario: presupuestoTipoDestinatario, clienteId: presupuestoTipoDestinatario === 'EXISTENTE' ? presupuestoClienteId : null, nombreLibre: presupuestoTipoDestinatario === 'LIBRE' ? presupuestoNombreLibre : null, items: presupuestoItems.map(({ productoId, cantidad, descuentoPorcentaje }) => ({ productoId, cantidad, descuentoPorcentaje })), descuentoTipo: 'PORCENTAJE', descuentoValor, ajusteRedondeo, condicionPagoPrevista, observaciones: $('#pres-observaciones').value, validez: $('#pres-validez').value, aliasTransferencia: $('#pres-alias').value, datosBancarios: $('#pres-banco').value, origen: presupuestoModuloActivo === 'SEMILLASYA' ? 'SEMILLASYA' : 'MOSTRADOR', tipoOperacion: presupuestoModuloActivo === 'SEMILLASYA' ? 'PRECAMPAÑA' : 'MOSTRADOR' }) });
    presupuestoItems = [];
    presupuestoClienteId = null;
    presupuestoNombreLibre = '';
    $('#pres-cliente-activo').textContent = 'Ninguno';
    $('#pres-nombre-libre').value = '';
    renderPresupuestoProductos();
    await loadPresupuestos();
    setMsg('Presupuesto guardado');
  } catch (err) { setMsg(err.message); }
});
const botonAltaPresupuestoViejo = $('#pres-dar-alta-persona');
if (botonAltaPresupuestoViejo) botonAltaPresupuestoViejo.addEventListener('click', async () => {
  try {
    const presupuestoId = Number($('#pres-dar-alta-persona').dataset.presupuestoId || 0);
    if (!presupuestoId) throw new Error('Primero guarde un presupuesto para poder dar de alta');
    await api(`/presupuestos/${presupuestoId}/dar-alta-persona`, {
      method: 'POST',
      body: JSON.stringify({
        razonSocial: $('#pres-alta-razon-social').value.trim(),
        cuit: $('#pres-alta-cuit').value.trim(),
        mail: $('#pres-alta-mail').value.trim(),
        telefonoPrincipal: $('#pres-alta-telefono-principal').value.trim(),
        telefonoEmergencia: $('#pres-alta-telefono-emergencia').value.trim()
      })
    });
    setMsg('Persona/empresa dada de alta y vinculada al presupuesto');
    await loadPresupuestos();
  } catch (err) { setMsg(err.message); }
});
const btnCrearClientePresupuesto = $('#pres-btn-crear-cliente');
if (!btnCrearClientePresupuesto) {
  console.log('[init] Botón #pres-btn-crear-cliente no encontrado; se omite binding en esta vista');
} else btnCrearClientePresupuesto.addEventListener('click', async () => {
  const btnCrearPres = btnCrearClientePresupuesto;
  const labelOriginal = btnCrearPres.textContent;
  const tipoCliente = 'PERSONAL';
  const nombre = $('#pres-crear-nombre').value.trim();
  const telefono = $('#pres-crear-telefono').value.trim();
  const cuitDni = $('#pres-crear-cuitdni').value.trim();
  const mail = '';
  const errorValidacion = validarDatosCliente({ tipoCliente, nombre, telefono, cuitDni, mail });
  if (errorValidacion) return setMsg(errorValidacion, 'warning');
  btnCrearPres.disabled = true;
  btnCrearPres.textContent = 'Creando...';
  setMsg('Guardando cliente...', 'info');
  try {
    const nuevo = await crearClientePayload({ tipoCliente, nombre, telefono, cuitDni, mail });
    presupuestoClienteId = nuevo.id;
    $('#pres-cliente-activo').textContent = nuevo.nombre;
    $('#pres-crear-nombre').value = '';
    $('#pres-crear-telefono').value = '';
    $('#pres-crear-cuitdni').value = '';
    await buscarClientePresupuesto();
    setMsg('Cliente creado correctamente');
  } catch (err) {
    setMsg(`Error al crear cliente: ${err.message}`);
  } finally {
    btnCrearPres.disabled = false;
    btnCrearPres.textContent = labelOriginal;
  }
});
$('#pres-lista').addEventListener('click', async (e) => {
  const ac = e.target.closest('button[data-pres-aceptar]');
  const re = e.target.closest('button[data-pres-rechazar]');
  const wa = e.target.closest('button[data-pres-whatsapp]');
  const pdf = e.target.closest('button[data-pres-pdf]');
  if (pdf) {
    const pdfUrl = `${window.location.origin}/presupuestos/${Number(pdf.dataset.presPdf)}/pdf`;
    window.location.href = pdfUrl;
  }
  if (wa) {
    const numero = normalizarTelefonoWhatsapp(wa.dataset.presWhatsappTelefono || '');
    if (numero) {
      const mensaje = armarMensajeWhatsappPresupuesto(Number(wa.dataset.presWhatsapp), Number(wa.dataset.presWhatsappTotal || 0));
      const waUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
      const waWin = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!waWin) window.location.href = waUrl;
    }
  }
  if (ac) await api(`/presupuestos/${ac.dataset.presAceptar}/aceptar`, { method: 'POST', body: JSON.stringify({ estadoVenta: 'PENDIENTE_CAJA' }) });
  if (re) await api(`/presupuestos/${re.dataset.presRechazar}/rechazar`, { method: 'POST', body: '{}' });
  if (ac || re) await loadPresupuestos();
});
$('#panel-territorial-semillasya')?.addEventListener('click', async (e) => {
  const prov = e.target.closest('button[data-pres-provincia]');
  const open = e.target.closest('button[data-pres-open]');
  const enviarInteraccion = e.target.closest('button[data-pres-semillasya-interaccion]');
  const descargarCotizacion = e.target.closest('button[data-pres-semillasya-pdf]');
  if (prov) {
    provinciaTerritorialActiva = prov.dataset.presProvincia;
    solicitudTerritorialActivaId = null;
    renderPanelTerritorialSemillasYa();
    return;
  }
  if (open) {
    solicitudTerritorialActivaId = Number(open.dataset.presOpen);
    renderPanelTerritorialSemillasYa();
    return;
  }
  if (enviarInteraccion) {
    const numero = normalizarTelefonoWhatsapp(enviarInteraccion.dataset.presSemillasyaTelefono || '');
    if (!numero) {
      setMsg('La solicitud no tiene WhatsApp válido cargado.', 'error');
      return;
    }
    const mensaje = decodeURIComponent(enviarInteraccion.dataset.presSemillasyaMsg || '');
    const waUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    const waWin = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!waWin) window.location.href = waUrl;
    return;
  }
  if (descargarCotizacion) {
    const pdfUrl = `${window.location.origin}/presupuestos/${Number(descargarCotizacion.dataset.presSemillasyaPdf)}/pdf`;
    window.location.href = pdfUrl;
  }
});

$('#btn-crear-proveedor').addEventListener('click', async () => {
  alert('Intentando crear proveedor');
  try {
    const creado = await api('/proveedores', {
      method: 'POST',
      body: JSON.stringify({
        razonSocial: $('#prov-razon-social').value.trim(),
        telefono: $('#prov-telefono').value.trim() || null,
        cuit: $('#prov-cuit').value.trim() || null,
        mail: $('#prov-mail').value.trim() || null,
        direccion: $('#prov-direccion').value.trim() || null,
        contactoComercial: $('#prov-contacto').value.trim() || null,
        observaciones: $('#prov-observaciones').value.trim() || null
      })
    });
    proveedorSeleccionadoId = creado.id;
    await loadProveedores();
    const detalleSel = $('#proveedor-detalle-select');
    if (detalleSel) detalleSel.value = String(creado.id);
    const detalle = $('#proveedor-detalle');
    if (detalle) detalle.innerHTML = `<div class="item"><b>Proveedor #${creado.id} - ${creado.razonSocial}</b><br>CUIT: ${creado.cuit || '-'} | Tel: ${creado.telefono || '-'} | Mail: ${creado.mail || '-'}</div>`;
    setMsg(`Proveedor guardado correctamente: #${creado.id} - ${creado.razonSocial}`, 'success');
    alert(`Proveedor guardado correctamente: #${creado.id} - ${creado.razonSocial}`);
  } catch (err) { setMsg(err.message); }
});
$('#btn-nuevo-proveedor').addEventListener('click', () => {
  $('#prov-razon-social')?.focus();
});
$('#proveedor-buscar')?.addEventListener('input', renderProveedores);
$('#proveedor-detalle-select')?.addEventListener('change', async () => {
  try { await verDetalleProveedor(); } catch (err) { setMsg(err.message); }
});
$('#proveedores-lista').addEventListener('click', async (e) => {
  const row = e.target.closest('[data-proveedor-select]');
  if (!row) return;
  proveedorSeleccionadoId = Number(row.dataset.proveedorSelect);
  $('#proveedor-detalle-select').value = row.dataset.proveedorSelect;
  try { await verDetalleProveedor(); } catch (err) { setMsg(err.message); }
});

$('#proveedores-lista').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-eliminar-proveedor]');
  if (!b) return;
  e.stopPropagation();
  try {
    await eliminarConPassword(`/proveedores/${b.dataset.eliminarProveedor}`, 'Proveedor');
    await loadProveedores();
    await loadEliminados();
  } catch (err) { setMsg(`Error al eliminar proveedor: ${err.message}`, 'error'); }
});

$('#eliminados-lista')?.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-restaurar-id]');
  if (!b) return;
  try {
    await api('/eliminados/restaurar', { method: 'POST', body: JSON.stringify({ tipo: b.dataset.restaurarTipo, id: Number(b.dataset.restaurarId) }) });
    await Promise.all([loadEliminados(), loadProductosAll(), loadProveedores(), buscarClienteMostrador()]);
    setMsg('Registro restaurado correctamente', 'info');
  } catch (err) { setMsg(`Error al restaurar: ${err.message}`, 'error'); }
});
$('#btn-stock-todos').addEventListener('click', async () => { try { await loadStockResumen('/stock'); } catch (err) { setMsg(err.message); } });
$('#btn-stock-bajo').addEventListener('click', async () => { try { await loadStockResumen('/stock/bajo'); } catch (err) { setMsg(err.message); } });
$('#btn-stock-sin-proveedor').addEventListener('click', async () => { try { await loadStockResumen('/stock/sin-proveedor'); } catch (err) { setMsg(err.message); } });

$('#btn-ver-stock').addEventListener('click', async () => {
  try { await cargarStockProducto(); } catch (err) { setMsg(err.message); }
});

$('#btn-registrar-stock').addEventListener('click', async () => {
  try {
    const productoId = Number($('#stock-producto').value || 0);
    await api(`/productos/${productoId}/stock`, {
      method: 'POST',
      body: JSON.stringify({
        tipo: $('#stock-tipo').value,
        cantidad: Number($('#stock-cantidad').value || 0),
        motivo: $('#stock-motivo').value.trim()
      })
    });
    await loadProductosAll();
  productosPedidoVisibles = productos.slice(0, 30);
  renderPedidoProductos();
    await cargarStockProducto();
    setMsg('Movimiento de stock registrado');
  } catch (err) { setMsg(err.message); }
});

$('#remito-proveedor').addEventListener('change', renderBuscadorRemitoProductos);
$('#remito-buscar-proveedor').addEventListener('input', renderProveedoresRemito);
$('#remito-buscar-producto').addEventListener('input', renderBuscadorRemitoProductos);
$('#btn-remito-crear-proveedor').addEventListener('click', async () => {
  try {
    const razonSocial = prompt('Razón social del proveedor (obligatorio):')?.trim();
    if (!razonSocial) return setMsg('Razón social obligatoria');
    const telefono = prompt('Teléfono (opcional):')?.trim() || null;
    const cuit = prompt('CUIT (opcional):')?.trim() || null;
    const observaciones = prompt('Observaciones (opcional):')?.trim() || null;
    const creado = await api('/proveedores', { method: 'POST', body: JSON.stringify({ razonSocial, telefono, cuit, observaciones }) });
    await loadProveedores();
    console.log('Seleccionado proveedor:', creado.id);
    $('#remito-proveedor').value = String(creado.id);
    renderBuscadorRemitoProductos();
    setMsg('Proveedor creado');
  } catch (err) { setMsg(err.message); }
});

$('#remito-resultados-productos').addEventListener('click', async (e) => {
  const agregar = e.target.closest('button[data-remito-agregar]');
  if (agregar) {
    const producto = productos.find(p => Number(p.id) === Number(agregar.dataset.remitoAgregar));
    if (!producto) return;
    const existente = remitoDetalles.find(d => d.productoId === producto.id);
    if (existente) existente.cantidad += 1;
    else remitoDetalles.push({ productoId: producto.id, productoNombre: producto.nombre, cantidad: 1, stockActual: Number(producto.stock || 0) });
    console.log('Producto agregado al remito:', producto);
    renderRemitoItems();
    return;
  }
});

$('#remito-items').addEventListener('click', (e) => {
  const quitar = e.target.closest('button[data-remito-quitar]');
  if (!quitar) return;
  remitoDetalles.splice(Number(quitar.dataset.remitoQuitar), 1);
  renderRemitoItems();
});
$('#remito-items').addEventListener('input', (e) => {
  const input = e.target.closest('[data-remito-field]');
  if (!input) return;
  const idx = Number(input.dataset.index);
  const field = input.dataset.remitoField;
  if (!remitoDetalles[idx]) return;
  remitoDetalles[idx][field] = Number(input.value || 0);
  renderRemitoItems();
});

$('#btn-guardar-remito').addEventListener('click', async () => {
  try {
    const proveedorId = Number($('#remito-proveedor').value || 0);
    const detalles = remitoDetalles.map(({ productoId, cantidad }) => ({ productoId, cantidad }));
    await api('/remitos-proveedor', {
      method: 'POST',
      body: JSON.stringify({
        proveedorId,
        numeroRemito: $('#remito-numero').value.trim(),
        fecha: $('#remito-fecha').value,
        observaciones: $('#remito-obs').value.trim() || null,
        detalles
      })
    });
    await loadProductosAll();
  productosPedidoVisibles = productos.slice(0, 30);
  renderPedidoProductos();
    await cargarStockProducto();
    remitoDetalles = [];
    renderRemitoItems();
    setMsg('Remito guardado y stock actualizado');
  } catch (err) { setMsg(err.message); }
});

(async function init() {
  ventaId = getVentaActivaId();
  setFechaCajaHoy();
  fechaVentasCobradasSeleccionada = fechaCajaSeleccionada;
  $('#ventas-cobradas-fecha').value = fechaVentasCobradasSeleccionada;
  await loadTipoCambio();
  await loadProveedores();
  await loadProductosAll();
  productosPedidoVisibles = productos.slice(0, 30);
  renderPedidoProductos();
  await loadStockResumen('/stock');
  setModoProducto('AGREGAR');
  
$('#ped-tipo')?.addEventListener('change', (e) => {
  $('#ped-texto-principal').textContent = e.target.value === 'SOLICITUD_PRESUPUESTO'
    ? 'Solicitamos presupuesto de los siguientes productos/insumos'
    : 'Confirmamos orden de pedido y solicitamos envío de los siguientes productos/insumos';
});
async function buscarProveedoresPedido() {
  const q = $('#ped-buscar-proveedor').value.trim();
  const lista = await api('/proveedores?q=' + encodeURIComponent(q));
  $('#ped-proveedores').innerHTML = (lista || []).map((p) => `<div class="item ${pedidoProveedorId === p.id ? 'item-seleccionado' : ''}">
      <span><b>${p.razonSocial}</b><br><small>CUIT: ${p.cuit || '-'} | Tel: ${p.telefono || '-'} | Mail: ${p.mail || '-'}</small></span>
      <button data-ped-prov="${p.id}" data-ped-prov-nombre="${p.razonSocial}">Seleccionar</button>
    </div>`).join('') || '<div class="item">Sin resultados</div>';
}
$('#ped-btn-buscar-proveedor')?.addEventListener('click', buscarProveedoresPedido);
$('#ped-buscar-proveedor')?.addEventListener('input', () => {
  const q = $('#ped-buscar-proveedor').value.trim();
  if (q.length >= 2 || q.length === 0) buscarProveedoresPedido().catch((err) => setMsg(err.message, 'error'));
});
$('#ped-btn-buscar-producto')?.addEventListener('click', async () => {
  const q = $('#ped-buscar-producto').value.trim().toLowerCase();
  productosPedidoVisibles = q ? await buscarProductos(q) : productos.slice(0, 30);
  renderPedidoProductos();
});
$('#ped-buscar-producto')?.addEventListener('input', async () => {
  const q = $('#ped-buscar-producto').value.trim().toLowerCase();
  productosPedidoVisibles = q ? await buscarProductos(q) : productos.slice(0, 30);
  renderPedidoProductos();
});
$('#ped-guardar')?.addEventListener('click', async () => {
  try {
    if (!pedidoProveedorId) return setMsg('Debe seleccionar proveedor para guardar pedido formal', 'warning');
    if (!pedidoItems.length) return setMsg('Debe agregar productos al carrito', 'warning');
    const creado = await api('/pedidos', { method: 'POST', body: JSON.stringify({ proveedorId: pedidoProveedorId, fecha: $('#ped-fecha').value || new Date().toISOString(), tipoPedido: $('#ped-tipo').value, observaciones: $('#ped-observaciones').value, items: pedidoItems }) });
    pedidoItems = [];
    renderPedidoProductos();
    await loadPedidos();
    setMsg('Pedido guardado correctamente');
  } catch (err) {
    setMsg(err.message, 'error');
  }
});
$('#ped-carrito')?.addEventListener('input', (e) => {
  const input = e.target.closest('[data-ped-index][data-ped-field]');
  if (!input) return;
  const idx = Number(input.dataset.pedIndex);
  const field = input.dataset.pedField;
  if (!pedidoItems[idx]) return;
  if (field === 'cantidad') {
    const valor = Number(input.value || 0);
    pedidoItems[idx].cantidad = Number.isFinite(valor) ? Math.max(0, valor) : 0;
    if (pedidoItems[idx].cantidad <= 0) pedidoItems = pedidoItems.filter((_, i) => i !== idx);
  } else {
    pedidoItems[idx][field] = String(input.value || '').trim();
  }
  renderPedidoProductos();
});
document.addEventListener('click', async (e) => {
  const pp = e.target.closest('[data-ped-prov]');
  const add = e.target.closest('[data-ped-add]');
  const del = e.target.closest('[data-ped-del]');
  const rm = e.target.closest('[data-ped-rm]');
  const wa = e.target.closest('[data-ped-wa]');
  const mail = e.target.closest('[data-ped-mail]');
  const print = e.target.closest('[data-ped-print]');
  const pdf = e.target.closest('[data-ped-pdf]');
  if (pp) { pedidoProveedorId = Number(pp.dataset.pedProv); $('#ped-proveedor-activo').textContent = `${pp.dataset.pedProvNombre} (#${pedidoProveedorId})`; await buscarProveedoresPedido(); }
  if (add) { const id = Number(add.dataset.pedAdd); const prod = productos.find((p) => p.id === id) || productosPedidoVisibles.find((p) => p.id === id); const it = pedidoItems.find((x) => x.productoId === id); if (it) it.cantidad += 1; else pedidoItems.push({ productoId: id, cantidad: 1, unidad: prod?.unidad || 'UN', nombre: prod?.nombre || `#${id}` }); renderPedidoProductos(); }
  if (del) { const id = Number(del.dataset.pedDel); const it = pedidoItems.find((x) => x.productoId === id); if (it) { it.cantidad -= 1; if (it.cantidad <= 0) pedidoItems = pedidoItems.filter((x) => x.productoId !== id); } renderPedidoProductos(); }
  if (rm) { const id = Number(rm.dataset.pedRm); pedidoItems = pedidoItems.filter((x) => x.productoId !== id); renderPedidoProductos(); }
  if (print) window.open(`/pedidos/${Number(print.dataset.pedPrint)}/imprimir`, '_blank', 'noopener,noreferrer');
  if (pdf) window.open(`/pedidos/${Number(pdf.dataset.pedPdf)}/pdf`, '_blank', 'noopener,noreferrer');
  if (wa) {
    const pedidoId = Number(wa.dataset.pedWa);
    const telefono = normalizarTelefonoWhatsapp(wa.dataset.pedWaTelefono || '');
    if (!telefono) return setMsg('El proveedor no tiene teléfono para WhatsApp', 'warning');
    const pedido = (await api('/pedidos')).find((x) => x.id === pedidoId);
    if (!pedido) return setMsg('Pedido no encontrado', 'warning');
    const msg = await armarMensajePedidoProveedor(pedido);
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`, '_blank');
  }
  if (mail) {
    const pedidoId = Number(mail.dataset.pedMail);
    const destino = String(mail.dataset.pedMailDestino || '').trim();
    if (!destino) return setMsg('El proveedor no tiene email cargado', 'warning');
    const pedido = (await api('/pedidos')).find((x) => x.id === pedidoId);
    if (!pedido) return setMsg('Pedido no encontrado', 'warning');
    const body = await armarMensajePedidoProveedor(pedido);
    window.location.href = `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(`Pedido #${pedido.id} - Agroquímica San Bernardo`)}&body=${encodeURIComponent(body)}`;
  }
});
renderPresupuestoProductos();
  await loadPresupuestos();
  if ($('#ped-fecha')) $('#ped-fecha').value = new Date().toISOString().slice(0, 10);
  renderPedidoProductos();
  await inicializarModuloPedidos();
  if (ventaId) {
    try {
      await refreshVenta();
    } catch (_error) {
      ventaId = null;
      venta = null;
      setVentaActivaId(null);
    }
  }
  renderCarrito();
  renderClienteActivo();
  await loadCaja20();
  await loadVentasCobradas();
  renderPanelCuentaCorriente(null);
  limpiarFormularioProducto();
  renderRemitoItems();
  $('#buscar-producto').focus();
})();

$('#btn-estado-sistema-refrescar')?.addEventListener('click', loadEstadoSistema);


if (document.getElementById('cc-pago-fecha')) { document.getElementById('cc-pago-fecha').valueAsDate = new Date(); }

$('#pre-cultivo-chips')?.addEventListener('click', (e)=>{ const btn=e.target.closest('[data-pre-chip-cultivo]'); if(!btn) return; precampaniaCultivoActivo=btn.dataset.preChipCultivo||'TODOS'; renderProductosPrecampania(); });
$('#btn-pre-cerrar-drawer')?.addEventListener('click', cerrarDrawerPrecampania);
$('#pre-drawer-overlay')?.addEventListener('click', cerrarDrawerPrecampania);


function actualizarPreviewDuplicarMostrador() {
  const base = Number(productoSemillasYaParaDuplicar?.precioVentaFinal || 0);
  const margen = Number($('#pre-modal-dup-margen')?.value || 0);
  const sugerido = Number((base * (1 + ((Number.isFinite(margen) ? margen : 0) / 100))).toFixed(2));
  $('#pre-modal-dup-precio').value = String(sugerido);
  $('#pre-modal-dup-preview').textContent = `Base ARS ${money(base)} + margen ${Number.isFinite(margen) ? margen : 0}% => sugerido ARS ${money(sugerido)}`;
}

$('#pre-modal-dup-margen')?.addEventListener('input', actualizarPreviewDuplicarMostrador);
$('#btn-pre-modal-dup-cerrar')?.addEventListener('click', () => $('#pre-modal-duplicar-mostrador')?.close());
$('#btn-pre-modal-dup-confirmar')?.addEventListener('click', async () => {
  const id = Number($('#pre-modal-dup-id')?.value || 0);
  const margenMostrador = Number($('#pre-modal-dup-margen')?.value || 0);
  const precioFinalSugeridoArs = Number($('#pre-modal-dup-precio')?.value || 0);
  await api(`/api/productos-precampania/${id}/duplicar-mostrador`, {
    method: 'POST',
    body: JSON.stringify({ margenMostrador, precioFinalSugeridoArs })
  });
  $('#pre-modal-duplicar-mostrador')?.close();
  setMsg('Producto duplicado a mostrador en subcategoría SEMILLAS', 'ok');
});

// ===== Módulo SENASA / MIP =====
let senasaClientes = [];
let senasaProductos = [];
let senasaResoluciones = [];
let senasaDocumentos = [];
let senasaPlantillas = [];
let senasaDocumentoActual = null;
let senasaFiltrosProductos = {};
let senasaPasoMipActual = 1;
let senasaProductoPrevistoSeleccionado = '';
const SENASA_TEXTO_PENDIENTE = '—';
const SENASA_REGISTRO_PENDIENTE = SENASA_TEXTO_PENDIENTE;

function senasaFecha(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}
function senasaSiNoSelect(name, value = '') {
  return `<select name="${name}"><option value="">-</option><option value="SI" ${value === 'SI' ? 'selected' : ''}>SI</option><option value="NO" ${value === 'NO' ? 'selected' : ''}>NO</option></select>`;
}
function senasaInput(name, label, type = 'text', value = '', extra = '') {
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtmlClient(value || '')}" ${extra} /></label>`;
}
function senasaTextarea(name, label, value = '') {
  return `<label>${label}<textarea name="${name}" rows="2">${escapeHtmlClient(value || '')}</textarea></label>`;
}
function senasaValor(value, fallback = SENASA_TEXTO_PENDIENTE) {
  const text = value == null ? '' : String(value)
    .replace(/[{}[\]"]/g, '')
    .replace(/\b(null|undefined)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}
function senasaNumeroRegistroDesdeResolucion(resolucion = '', tipoRegistro = '') {
  const texto = senasaValor(resolucion, '');
  const tipo = senasaValor(tipoRegistro, '');
  if (!texto) return '';
  if (tipo && texto.toLowerCase().startsWith(tipo.toLowerCase())) return texto.slice(tipo.length).trim();
  return texto;
}
function senasaProductoDatos(datos = {}) {
  const producto = datos.producto && typeof datos.producto === 'object' ? datos.producto : {};
  const tipoRegistro = datos.tipoRegistro || producto.tipoRegistro || '';
  const resolucionSenasa = datos.resolucionSenasa || producto.resolucionSenasa || '';
  const numeroRegistro = datos.numeroRegistro || producto.numeroRegistro || datos.resolucionNumero || senasaNumeroRegistroDesdeResolucion(resolucionSenasa || datos.registroResolucion, tipoRegistro);
  return {
    id: producto.id || datos.productoId || '',
    nombre: datos.productoNombre || datos.nombre || producto.nombre || '',
    principioActivo: datos.principioActivo || producto.principioActivo || '',
    concentracion: datos.concentracion || producto.concentracion || '',
    habilitacionHabitual: datos.habilitacionHabitual || producto.habilitacionHabitual || datos.organismoHabilitante || producto.organismoHabilitante || datos.organismoRegulador || producto.organismoRegulador || '',
    organismoHabilitante: datos.organismoHabilitante || producto.organismoHabilitante || datos.organismoRegulador || producto.organismoRegulador || datos.habilitacionHabitual || producto.habilitacionHabitual || '',
    organismoRegulador: datos.organismoRegulador || producto.organismoRegulador || datos.organismoHabilitante || producto.organismoHabilitante || datos.habilitacionHabitual || producto.habilitacionHabitual || '',
    tipoRegistro,
    numeroRegistro,
    resolucionSenasa,
    habilitacionCompleta: datos.habilitacionCompleta || producto.habilitacionCompleta || '',
    fechaResolucionSenasa: senasaFecha(datos.fechaResolucionSenasa || producto.fechaResolucionSenasa),
    fechaVencimientoRegistro: senasaFecha(datos.fechaVencimientoRegistro || producto.fechaVencimientoRegistro),
    disposicionRegistro: datos.disposicionRegistro || producto.disposicionRegistro || '',
    empresaTitularRegistro: datos.empresaTitularRegistro || producto.empresaTitularRegistro || '',
    observacionesRegulatorias: datos.observacionesRegulatorias || producto.observacionesRegulatorias || ''
  };
}
function senasaRegistroValor(datos = {}, fallback = SENASA_TEXTO_PENDIENTE) {
  const producto = senasaProductoDatos(datos);
  const numero = senasaValor(producto.numeroRegistro, '');
  if (!numero) return fallback;
  const tipo = senasaValor(producto.tipoRegistro, '');
  return senasaValor([tipo, numero].filter(Boolean).join(' '), fallback);
}
function senasaProductoLabel(p = {}) {
  return [p.nombre || p.nombreComercial, p.principioActivo, p.concentracion, p.habilitacionHabitual || p.organismoHabilitante || p.organismoRegulador, p.tipoRegistro, p.numeroRegistro].map((item) => senasaValor(item, '')).filter(Boolean).join(' — ') || 'Producto SENASA / MIP';
}
function senasaProductoEstado(datos = {}) {
  const producto = senasaProductoDatos(datos);
  const requeridos = [producto.nombre, producto.principioActivo, producto.concentracion, producto.habilitacionHabitual || producto.organismoHabilitante, producto.tipoRegistro, producto.numeroRegistro || producto.resolucionSenasa];
  return requeridos.every((item) => senasaValor(item, '') !== '') ? 'Completo' : SENASA_TEXTO_PENDIENTE;
}
function senasaProductoResumenHtml(datos = {}) {
  const producto = senasaProductoDatos(datos);
  if (!producto.id && !producto.nombre) {
    return `<article class="senasa-producto-resumen senasa-producto-resumen-vacio"><div><span>Producto seleccionado</span><strong>Seleccione un producto MIP registrado para autocompletar droga, concentración y habilitación.</strong></div><div><span>Habilitación completa</span><strong>${SENASA_TEXTO_PENDIENTE}</strong></div></article>`;
  }
  const rows = [
    ['Producto seleccionado', producto.nombre],
    ['Principio activo', producto.principioActivo],
    ['Concentración', producto.concentracion],
    ['Organismo habilitante', producto.habilitacionHabitual || producto.organismoHabilitante || producto.organismoRegulador],
    ['Tipo de registro', producto.tipoRegistro],
    ['Número de registro', senasaValor(producto.numeroRegistro, SENASA_TEXTO_PENDIENTE)],
    ['Habilitación completa', senasaHabilitacionCompleta(producto)],
    ['Disposición', producto.disposicionRegistro],
    ['Fecha resolución', producto.fechaResolucionSenasa],
    ['Vencimiento registro', producto.fechaVencimientoRegistro],
    ['Titular', producto.empresaTitularRegistro],
    ['Observaciones regulatorias', producto.observacionesRegulatorias],
    ['Estado documental', senasaProductoEstado(producto)]
  ];
  return `<article class="senasa-producto-resumen">${rows.map(([label, value]) => `<div><span>${escapeHtmlClient(label)}</span><strong>${escapeHtmlClient(senasaValor(value))}</strong></div>`).join('')}</article>`;
}
function senasaSelectProducto(name, label, value = '', datos = {}) {
  const selectedValue = value || senasaProductoDatos(datos).id;
  const filtro = (senasaFiltrosProductos[name] || '').toLowerCase();
  const productosMip = senasaProductos.filter(productoEsSenasaMip).filter((p) => !filtro || senasaProductoLabel(p).toLowerCase().includes(filtro));
  return `<div class="senasa-producto-selector"><label>${label}<input class="senasa-producto-buscar" data-senasa-producto-filtro="${name}" placeholder="Buscar producto SENASA..." value="${escapeHtmlClient(senasaFiltrosProductos[name] || '')}" /><select name="${name}" data-senasa-producto-select><option value="">Seleccione producto SENASA / MIP</option>${productosMip.map((p) => `<option value="${p.id}" ${String(selectedValue) === String(p.id) ? 'selected' : ''}>${escapeHtmlClient(senasaProductoLabel(p))}</option>`).join('')}</select></label>${senasaProductoResumenHtml(datos)}</div>`;
}
function senasaSelectResolucion(name, label, value = '') {
  return `<label>${label}<select name="${name}" data-senasa-resolucion-select><option value="">Prefijado / papeles</option>${senasaResoluciones.map((r) => `<option value="${r.id}" ${String(value) === String(r.id) ? 'selected' : ''}>${escapeHtmlClient(r.productoNombre || '-')} · ${escapeHtmlClient(r.resolucionNumero || SENASA_TEXTO_PENDIENTE)}</option>`).join('')}</select></label>`;
}
function senasaFieldset(title, html, open = true) {
  return `<details class="senasa-card" ${open ? 'open' : ''}><summary>${escapeHtmlClient(title)}</summary><div class="senasa-card-body">${html}</div></details>`;
}
function senasaDefaultRows(tipo) {
  if (tipo === 'roedores') return [{ casilla: '1' }];
  if (tipo === 'otrasPlagas') return [{ sector: '1' }];
  if (tipo === 'areasExternas') return [{ sector: '', tipoNovedad: 'Acúmulo de basura' }];
  if (tipo === 'hermeticidad') return [{ sector: '', elemento: 'Cortinas de aire' }];
  return [{}];
}
function senasaDocumentoBase(tipoDocumento = 'AVISO_MIP') {
  return {
    id: null,
    tipoDocumento,
    clienteId: '',
    numeroCircular: '',
    fechaRecepcion: '',
    periodoDesde: '',
    periodoHasta: '',
    fechaActividad: '',
    horaActividad: '',
    avisoVinculadoId: '',
    planificacion: {},
    ejecucion: {},
    cliente: {},
    establecimiento: {},
    productosPrevistos: [],
    roedores: tipoDocumento === 'INFORME_CONTROL_PLAGAS' ? { filas: senasaDefaultRows('roedores') } : {},
    insectosExternos: {},
    insectosInternos: {},
    otrasPlagas: tipoDocumento === 'INFORME_CONTROL_PLAGAS' ? { filas: senasaDefaultRows('otrasPlagas') } : {},
    areasExternas: tipoDocumento === 'INFORME_CONTROL_PLAGAS' ? { filas: senasaDefaultRows('areasExternas') } : {},
    hermeticidad: tipoDocumento === 'INFORME_CONTROL_PLAGAS' ? { filas: senasaDefaultRows('hermeticidad') } : {},
    verificacion: {}
  };
}
function senasaClienteOption(c, selectedId = '') {
  const selected = String(c.id) === String(selectedId || '') ? ' selected' : '';
  return `<option value="${c.id}"${selected}>${escapeHtmlClient(c.nombre || '-')} ${c.cuitDni ? `(${escapeHtmlClient(c.cuitDni)})` : ''}</option>`;
}
function senasaAplicarCliente(clienteId) {
  const c = senasaClientes.find((x) => String(x.id) === String(clienteId));
  if (!c || !senasaDocumentoActual) return;
  const cfg = c.senasaConfiguracion || {};
  senasaDocumentoActual.clienteId = c.id;
  senasaDocumentoActual.cliente = {
    nombre: c.nombre || '', domicilio: c.direccion || '', telefono: c.telefono || '', localidad: cfg.localidad || '', provincia: cfg.provincia || '', cuitDni: c.cuitDni || '', observaciones: c.observaciones || ''
  };
  senasaDocumentoActual.establecimiento = {
    establecimientoOficial: cfg.establecimientoOficial || '', supervisor: cfg.supervisor || '', responsableSiv: cfg.responsableSiv || '', departamentoPartido: cfg.departamentoPartido || ''
  };
}
function senasaProductoSnapshot(p = {}) {
  return {
    id: p.id || '',
    nombre: p.nombre || '',
    principioActivo: p.principioActivo || '',
    concentracion: p.concentracion || '',
    habilitacionHabitual: p.habilitacionHabitual || p.organismoHabilitante || '',
    organismoHabilitante: p.organismoHabilitante || p.organismoRegulador || p.habilitacionHabitual || '',
    organismoRegulador: p.organismoRegulador || p.organismoHabilitante || p.habilitacionHabitual || '',
    tipoRegistro: p.tipoRegistro || '',
    numeroRegistro: p.numeroRegistro || p.resolucionSenasa || '',
    resolucionSenasa: p.resolucionSenasa || p.numeroRegistro || '',
    fechaResolucionSenasa: senasaFecha(p.fechaResolucionSenasa),
    fechaVencimientoRegistro: senasaFecha(p.fechaVencimientoRegistro),
    disposicionRegistro: p.disposicionRegistro || '',
    empresaTitularRegistro: p.empresaTitularRegistro || '',
    observacionesRegulatorias: p.observacionesRegulatorias || '',
    habilitacionCompleta: p.habilitacionCompleta || ''
  };
}
function senasaProductoTecnico(productoId) {
  const p = senasaProductos.find((x) => String(x.id) === String(productoId));
  if (!p) return {};
  const producto = senasaProductoSnapshot(p);
  return { producto, productoId: producto.id, productoNombre: producto.nombre, principioActivo: producto.principioActivo, concentracion: producto.concentracion, habilitacionHabitual: producto.habilitacionHabitual, organismoHabilitante: producto.organismoHabilitante, organismoRegulador: producto.organismoRegulador, tipoRegistro: producto.tipoRegistro, numeroRegistro: producto.numeroRegistro, resolucionSenasa: producto.resolucionSenasa, habilitacionCompleta: producto.habilitacionCompleta, fechaResolucionSenasa: producto.fechaResolucionSenasa, fechaVencimientoRegistro: producto.fechaVencimientoRegistro, disposicionRegistro: producto.disposicionRegistro, empresaTitularRegistro: producto.empresaTitularRegistro, observacionesRegulatorias: producto.observacionesRegulatorias, aptoSenasaMip: Boolean(p.aptoSenasaMip), categoria: p.categoria || '', tipoSenasa: p.tipoSenasa || '', usoSenasa: p.usoSenasa || '' };
}
function senasaResolucionTecnica(resolucionId) {
  const r = senasaResoluciones.find((x) => String(x.id) === String(resolucionId));
  if (!r) return {};
  return { productoNombre: r.productoNombre || '', principioActivo: r.principioActivo || '', numeroRegistro: r.resolucionNumero || '', resolucionSenasa: r.resolucionNumero || '', fechaResolucionSenasa: senasaFecha(r.fechaResolucion), observacionesRegulatorias: r.observaciones || '' };
}
function renderSenasaListas() {
  const renderDocumentoItem = (d) => `<div class="item senasa-lista-card"><b>#${d.id}</b> ${d.tipoDocumento === 'AVISO_MIP' ? 'Aviso MIP' : 'Informe realizado'}<br>${escapeHtmlClient(d.cliente?.nombre || d.datosJson?.cliente?.nombre || 'Sin cliente')} · Circular ${escapeHtmlClient(d.numeroCircular || '-')}<br><button data-senasa-abrir="${d.id}">Reabrir</button> <button type="button" data-senasa-imprimir="${d.id}">PDF</button></div>`;
  const avisos = senasaDocumentos.filter((d) => d.tipoDocumento === 'AVISO_MIP');
  const informes = senasaDocumentos.filter((d) => d.tipoDocumento === 'INFORME_CONTROL_PLAGAS');
  $('#senasa-avisos').innerHTML = avisos.length ? avisos.map(renderDocumentoItem).join('') : '<div class="item">Sin avisos MIP.</div>';
  $('#senasa-informes').innerHTML = informes.length ? informes.map(renderDocumentoItem).join('') : '<div class="item">Sin informes realizados.</div>';
  $('#senasa-documentos').innerHTML = senasaDocumentos.length ? senasaDocumentos.map(renderDocumentoItem).join('') : '<div class="item">Sin documentos.</div>';
  $('#senasa-plantillas').innerHTML = senasaPlantillas.length ? senasaPlantillas.map((d) => `<div class="item"><b>${escapeHtmlClient(d.nombrePlantilla || `Plantilla #${d.id}`)}</b><br>${d.tipoDocumento}<br><button data-senasa-plantilla="${d.id}">Crear desde plantilla</button></div>`).join('') : '<div class="item">Sin plantillas.</div>';
  $('#senasa-resoluciones').innerHTML = '<div class="item">Los datos regulatorios se mantienen dentro del producto SENASA / ANMAT seleccionado. Use la tabla de productos para revisar o editar cada ficha; no hay carga de resoluciones sueltas.</div>';
  const tabla = $('#senasa-productos-tabla');
  if (tabla) {
    const rows = senasaProductos.filter(productoEsSenasaMip).map((p) => `<tr><td>${escapeHtmlClient(senasaValor(p.nombre || p.nombreComercial))}</td><td>${escapeHtmlClient(senasaValor(p.principioActivo))}</td><td>${escapeHtmlClient(senasaValor(p.concentracion))}</td><td>${escapeHtmlClient(senasaRegistroValor(p))}</td><td>${escapeHtmlClient(senasaValor(p.disposicionRegistro))}</td><td>${escapeHtmlClient(senasaProductoEstado({ productoNombre: p.nombre || p.nombreComercial, ...p }))}</td><td><button type="button" data-senasa-producto-editar="${p.id}">Editar</button> <button type="button" data-senasa-producto-detalle="${p.id}">Ver</button> <button type="button" data-senasa-producto-eliminar="${p.id}">Baja lógica</button></td></tr>`).join('');
    tabla.innerHTML = `<button type="button" class="btn-primary" data-senasa-producto-nuevo>+ Agregar producto MIP</button><div class="senasa-table-wrap"><table class="senasa-productos-table"><thead><tr><th>Producto comercial</th><th>Principio activo</th><th>Concentración</th><th>Registro</th><th>Disposición</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Sin productos SENASA.</td></tr>'}</tbody></table></div>`;
  }
}
function renderSenasaResolucionForm() {
  const sel = $('#senasa-res-producto');
  if (!sel) return;
  const productosMip = senasaProductos.filter(productoEsSenasaMip);
  sel.innerHTML = '<option value="">Producto SENASA / MIP</option>' + productosMip.map((p) => `<option value="${p.id}">${escapeHtmlClient(senasaProductoLabel(p))}</option>`).join('');
}

function senasaHabilitacionCompleta(datos = {}) {
  const producto = senasaProductoDatos(datos);
  const completa = datos.habilitacionCompleta || producto.habilitacionCompleta || '';
  if (senasaValor(completa, '')) return senasaValor(completa, '');
  const organismo = senasaValor(producto.organismoHabilitante || producto.habilitacionHabitual || producto.organismoRegulador, '');
  const tipo = senasaValor(producto.tipoRegistro, '');
  const numero = senasaValor(producto.numeroRegistro, '');
  return [organismo, tipo && tipo.toLowerCase() !== organismo.toLowerCase() ? tipo : '', numero ? `N° ${numero}` : '']
    .filter(Boolean)
    .join(' ');
}
function senasaProductoPrevistoDesdeProductoId(productoId) {
  const tecnico = senasaProductoTecnico(productoId);
  if (!tecnico.productoId) return null;
  const item = { ...tecnico, id: `${tecnico.productoId}-${Date.now()}` };
  item.habilitacionCompleta = senasaHabilitacionCompleta(item);
  item.producto = { ...(item.producto || {}), habilitacionCompleta: item.habilitacionCompleta };
  return item;
}
function senasaProductosPrevistosDocumento(d = {}) {
  const base = Array.isArray(d.productosPrevistos) ? d.productosPrevistos : [];
  if (base.length) return base.map((item) => ({ ...item, habilitacionCompleta: senasaHabilitacionCompleta(item) }));
  return ['roedores', 'insectosExternos', 'insectosInternos', 'otrasPlagas']
    .map((key) => d[key])
    .filter((item) => senasaProductoDatos(item || {}).nombre)
    .map((item) => ({ ...item, habilitacionCompleta: senasaHabilitacionCompleta(item) }));
}
function renderSenasaProductosPrevistosTabla(d = {}) {
  const productos = senasaProductosPrevistosDocumento(d);
  if (!productos.length) return '<div class="senasa-empty-box">No hay productos agregados. Seleccione un producto MIP y presione “Agregar producto”.</div>';
  const rows = productos.map((item, i) => {
    const producto = senasaProductoDatos(item);
    return `<tr><td>${escapeHtmlClient(senasaValor(producto.nombre))}</td><td>${escapeHtmlClient(senasaValor(producto.principioActivo))}</td><td>${escapeHtmlClient(senasaValor(producto.concentracion))}</td><td>${escapeHtmlClient(senasaRegistroValor(producto))}</td><td>${escapeHtmlClient(senasaValor(producto.disposicionRegistro))}</td><td><button type="button" data-senasa-producto-previsto-remove="${i}">Quitar</button></td></tr>`;
  }).join('');
  return `<div class="senasa-table-wrap"><table class="senasa-productos-table"><thead><tr><th>Producto comercial</th><th>Principio activo</th><th>Concentración</th><th>Registro</th><th>Disposición</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function senasaWizardNavHtml(active = 1) {
  const pasos = [['1', 'Establecimiento'], ['2', 'Planificación'], ['3', 'Productos'], ['4', 'Sectores'], ['5', 'PDF']];
  return `<nav class="senasa-wizard-nav" aria-label="Progreso MIP">${pasos.map(([n, label]) => `<button type="button" class="senasa-wizard-step ${Number(n) === Number(active) ? 'activo' : ''}" data-senasa-paso="${n}"><span>${n}</span>${escapeHtmlClient(label)}</button>`).join('')}</nav>`;
}
function senasaVistaPreviaProductosHtml(d = {}) {
  const productos = senasaProductosPrevistosDocumento(d);
  return productos.length ? renderSenasaProductosPrevistosTabla({ productosPrevistos: productos }) : '<div class="senasa-empty-box">Falta agregar al menos un producto MIP con registro.</div>';
}
function senasaValidarAvisoMip(d = {}) {
  if (!senasaValor(d.cliente?.nombre, '')) return 'Falta completar razón social del establecimiento.';
  if (!senasaValor(d.periodoDesde, '') || !senasaValor(d.periodoHasta, '')) return 'Falta completar el periodo del MIP.';
  const productos = senasaProductosPrevistosDocumento(d);
  if (!productos.length) return 'Falta agregar al menos un producto MIP.';
  const incompleto = productos.find((item) => !senasaValor(senasaProductoDatos(item).numeroRegistro, ''));
  if (incompleto) return 'Falta completar número de registro del producto seleccionado.';
  const sinHabilitacion = productos.find((item) => !senasaValor(senasaHabilitacionCompleta(item), ''));
  if (sinHabilitacion) return 'Falta completar habilitación completa del producto seleccionado.';
  return '';
}

function renderSenasaForm() {
  const d = senasaDocumentoActual || senasaDocumentoBase('AVISO_MIP');
  const esAviso = d.tipoDocumento === 'AVISO_MIP';
  if (esAviso) senasaHidratarProductosDocumento(d);
  const cliente = d.cliente || {};
  const est = d.establecimiento || {};
  const form = $('#senasa-form');
  if (!form) return;
  const clienteOptions = '<option value="">Seleccione cliente</option>' + senasaClientes.map((c) => senasaClienteOption(c, d.clienteId)).join('');
  const avisosOptions = '<option value="">Sin vincular</option>' + senasaDocumentos
    .filter((doc) => doc.tipoDocumento === 'AVISO_MIP')
    .map((doc) => `<option value="${doc.id}" ${String(d.avisoVinculadoId || '') === String(doc.id) ? 'selected' : ''}>Aviso MIP #${doc.id} · ${escapeHtmlClient(doc.cliente?.nombre || doc.datosJson?.cliente?.nombre || 'Sin cliente')} · ${escapeHtmlClient(doc.periodoDesde || doc.datosJson?.periodoDesde || '')}</option>`)
    .join('');
  const productosOptions = '<option value="">Seleccione producto MIP registrado</option>' + senasaProductos.filter(productoEsSenasaMip).map((p) => `<option value="${p.id}" ${String(senasaProductoPrevistoSeleccionado) === String(p.id) ? 'selected' : ''}>${escapeHtmlClient(senasaProductoLabel(p))}</option>`).join('');
  const establecimientoHtml = `<div class="senasa-grid-tres senasa-step-grid">${senasaInput('cliente.nombre', 'Razón social', 'text', cliente.nombre)}${senasaInput('cliente.domicilio', 'Domicilio', 'text', cliente.domicilio)}${senasaInput('cliente.localidad', 'Localidad', 'text', cliente.localidad)}${senasaInput('cliente.provincia', 'Provincia', 'text', cliente.provincia)}${senasaInput('establecimiento.responsableSiv', 'Responsable', 'text', est.responsableSiv)}<label>Cliente / establecimiento<select name="clienteId" data-senasa-cliente>${clienteOptions}</select></label>${senasaInput('cliente.telefono', 'Teléfono', 'text', cliente.telefono)}${senasaInput('cliente.cuitDni', 'CUIT/DNI', 'text', cliente.cuitDni)}${senasaInput('establecimiento.establecimientoOficial', 'Establecimiento Nº Oficial', 'text', est.establecimientoOficial)}${senasaInput('establecimiento.supervisor', 'Supervisor', 'text', est.supervisor)}${senasaInput('establecimiento.departamentoPartido', 'Departamento / Partido', 'text', est.departamentoPartido)}${senasaTextarea('cliente.observaciones', 'Observaciones del establecimiento', cliente.observaciones)}</div>`;
  const planificacionHtml = `<div class="senasa-grid-tres senasa-step-grid">${senasaInput('periodoDesde', 'Periodo desde', 'date', d.periodoDesde)}${senasaInput('periodoHasta', 'Periodo hasta', 'date', d.periodoHasta)}${senasaInput('planificacion.frecuenciaGeneral', 'Frecuencia', 'text', d.planificacion?.frecuenciaGeneral)}${senasaInput('planificacion.horariosPrevistos', 'Horario', 'text', d.planificacion?.horariosPrevistos)}${senasaInput('planificacion.tipoControl', 'Tipo de control', 'text', d.planificacion?.tipoControl)}${senasaTextarea('planificacion.metodologia', 'Metodología', d.planificacion?.metodologia)}${senasaTextarea('planificacion.criteriosControl', 'Criterios', d.planificacion?.criteriosControl)}${senasaTextarea('planificacion.cronograma', 'Cronograma previsto', d.planificacion?.cronograma)}</div>`;
  const productoSeleccionado = senasaProductoPrevistoSeleccionado ? senasaProductoTecnico(senasaProductoPrevistoSeleccionado) : {};
  const productosHtml = `<div class="senasa-productos-asistente"><div class="senasa-producto-add-card"><label>Selector de producto MIP<select data-senasa-producto-previsto-select><option value="">Seleccione producto MIP registrado</option>${productosOptions.replace('<option value="">Seleccione producto MIP registrado</option>', '')}</select></label><button type="button" class="btn-primary" data-senasa-producto-previsto-add>Agregar producto</button></div>${senasaProductoResumenHtml(productoSeleccionado)}<h4>Productos agregados</h4>${renderSenasaProductosPrevistosTabla(d)}</div>`;
  const sectoresHtml = `<div class="senasa-sector-cards"><article class="senasa-sector-card"><h4>Roedores</h4><div class="senasa-grid-dos">${senasaInput('roedores.frecuenciaVerificacion', 'Frecuencia verificación/reposición', 'text', d.roedores?.frecuenciaVerificacion)}${senasaInput('roedores.frecuenciaGrupo1', 'Frecuencia grupo 1', 'text', d.roedores?.frecuenciaGrupo1)}${senasaTextarea('roedores.sectoresGrupo1', 'Sectores grupo 1', d.roedores?.sectoresGrupo1)}${senasaInput('roedores.frecuenciaGrupo2', 'Frecuencia grupo 2', 'text', d.roedores?.frecuenciaGrupo2)}${senasaTextarea('roedores.sectoresGrupo2', 'Sectores grupo 2', d.roedores?.sectoresGrupo2)}</div></article><article class="senasa-sector-card"><h4>Insectos externos</h4><div class="senasa-grid-dos">${senasaInput('insectosExternos.frecuenciaGrupo1', 'Frecuencia grupo 1', 'text', d.insectosExternos?.frecuenciaGrupo1 || d.insectosExternos?.frecuenciaHoras)}${senasaTextarea('insectosExternos.sectoresGrupo1', 'Sectores grupo 1', d.insectosExternos?.sectoresGrupo1)}${senasaInput('insectosExternos.frecuenciaGrupo2', 'Frecuencia grupo 2', 'text', d.insectosExternos?.frecuenciaGrupo2)}${senasaTextarea('insectosExternos.sectoresGrupo2', 'Sectores grupo 2', d.insectosExternos?.sectoresGrupo2)}${senasaTextarea('insectosExternos.observacionesSectores', 'Observaciones de sectores', d.insectosExternos?.observacionesSectores || d.insectosExternos?.observaciones)}</div></article><article class="senasa-sector-card"><h4>Insectos internos</h4><div class="senasa-grid-dos">${senasaTextarea('insectosInternos.sectoresTratados', 'Sectores internos tratados', d.insectosInternos?.sectoresTratados || d.insectosInternos?.sectores)}${senasaTextarea('insectosInternos.sectoresCriticos', 'Sectores críticos', d.insectosInternos?.sectoresCriticos || d.insectosInternos?.colorSeccionPlano)}${senasaTextarea('insectosInternos.observaciones', 'Observaciones', d.insectosInternos?.observaciones || d.insectosInternos?.metodologia)}</div></article><article class="senasa-sector-card"><h4>Otras plagas</h4><div class="senasa-grid-dos">${senasaInput('otrasPlagas.especiesVoladoras', 'Especies voladoras previstas', 'text', d.otrasPlagas?.especiesVoladoras)}${senasaInput('otrasPlagas.especiesCaminadoras', 'Especies caminadoras previstas', 'text', d.otrasPlagas?.especiesCaminadoras)}</div></article><article class="senasa-sector-card"><h4>Áreas externas</h4><div class="senasa-grid-dos">${senasaTextarea('areasExternas.sectoresMantenidos', 'Sectores mantenidos', d.areasExternas?.sectoresMantenidos || d.areasExternas?.sectores)}${senasaTextarea('areasExternas.sectoresCriticos', 'Sectores críticos', d.areasExternas?.sectoresCriticos)}${senasaTextarea('areasExternas.observaciones', 'Observaciones', d.areasExternas?.observaciones || d.areasExternas?.actividades)}</div></article><article class="senasa-sector-card"><h4>Hermeticidad</h4><div class="senasa-grid-dos">${senasaTextarea('hermeticidad.sectoresEvaluados', 'Sectores evaluados', d.hermeticidad?.sectoresEvaluados || d.hermeticidad?.sectores)}${senasaTextarea('hermeticidad.observaciones', 'Observaciones', d.hermeticidad?.observaciones || d.hermeticidad?.elementos)}</div></article></div>`;
  const validacion = senasaValidarAvisoMip(d);
  const pdfHtml = `<div class="senasa-pdf-preview-card"><h4>Vista previa antes de generar PDF</h4>${validacion ? `<div class="senasa-validation-error">${escapeHtmlClient(validacion)}</div>` : '<div class="senasa-validation-ok">Datos mínimos completos para generar PDF.</div>'}<div class="senasa-resumen-grid"><p><strong>Razón social:</strong> ${escapeHtmlClient(senasaValor(cliente.nombre))}</p><p><strong>Periodo:</strong> ${escapeHtmlClient(senasaValor(`${d.periodoDesde || ''} — ${d.periodoHasta || ''}`))}</p><p><strong>Frecuencia:</strong> ${escapeHtmlClient(senasaValor(d.planificacion?.frecuenciaGeneral))}</p><p><strong>Tipo de control:</strong> ${escapeHtmlClient(senasaValor(d.planificacion?.tipoControl))}</p></div><h4>Productos a aplicar en PDF</h4>${senasaVistaPreviaProductosHtml(d)}<button type="button" class="btn-primary" data-senasa-generar-pdf ${validacion ? 'disabled aria-disabled="true" title="Complete los datos obligatorios antes de generar el PDF"' : ''}>Generar PDF</button></div>`;
  if (esAviso) {
    const steps = { 1: ['Paso 1: Establecimiento', establecimientoHtml], 2: ['Paso 2: Planificación técnica', planificacionHtml], 3: ['Paso 3: Productos a aplicar', productosHtml], 4: ['Paso 4: Sectores y plagas', sectoresHtml], 5: ['Paso 5: Vista previa y generar PDF', pdfHtml] };
    const [titulo, contenido] = steps[senasaPasoMipActual] || steps[1];
    form.innerHTML = `${senasaWizardNavHtml(senasaPasoMipActual)}<section class="senasa-wizard-panel"><h3>${titulo}</h3>${contenido}<div class="senasa-wizard-actions"><button type="button" data-senasa-paso="${Math.max(1, senasaPasoMipActual - 1)}" ${senasaPasoMipActual === 1 ? 'disabled' : ''}>Volver</button><button type="button" data-senasa-paso="${Math.min(5, senasaPasoMipActual + 1)}" ${senasaPasoMipActual === 5 ? 'disabled' : ''}>Siguiente</button></div></section>`;
    const clienteSelect = form.querySelector('[name="clienteId"]');
    if (clienteSelect) clienteSelect.value = d.clienteId || '';
    const previstoSelect = form.querySelector('[data-senasa-producto-previsto-select]');
    if (previstoSelect) previstoSelect.value = senasaProductoPrevistoSeleccionado || '';
    renderSenasaPreview();
    return;
  }
  const informeHtml = `
    <div class="senasa-alerta-estructural senasa-alerta-real">Informe de actividad / ejecución real: registre sólo lo realizado, verificado y hallado. Este informe puede vincularse a un Aviso MIP, pero no modifica la planificación.</div>
    ${senasaFieldset('Ejecución real', `<div class="senasa-grid-tres">
      <label>Aviso MIP vinculado<select name="avisoVinculadoId">${avisosOptions}</select></label>
      ${senasaInput('fechaActividad', 'Fecha real', 'date', d.fechaActividad)}
      ${senasaInput('horaActividad', 'Hora real', 'time', d.horaActividad)}
      ${senasaTextarea('ejecucion.sectoresRecorridos', 'Sectores recorridos', d.ejecucion?.sectoresRecorridos)}
      ${senasaInput('ejecucion.casillasRevisadas', 'Casillas revisadas', 'text', d.ejecucion?.casillasRevisadas)}
      ${senasaInput('ejecucion.trampasRevisadas', 'Trampas revisadas', 'text', d.ejecucion?.trampasRevisadas)}
      ${senasaTextarea('ejecucion.actividadDetectada', 'Actividad detectada / hallazgos reales', d.ejecucion?.actividadDetectada)}
      ${senasaSelectProducto('ejecucion.productoId', 'Producto utilizado', d.ejecucion?.productoId, d.ejecucion)}
      ${senasaInput('ejecucion.principioActivo', 'Principio activo', 'text', d.ejecucion?.principioActivo)}
      ${senasaInput('ejecucion.concentracion', 'Concentración', 'text', d.ejecucion?.concentracion)}
      ${senasaInput('ejecucion.habilitacionHabitual', 'Organismo habilitante', 'text', d.ejecucion?.habilitacionHabitual || d.ejecucion?.organismoHabilitante)}
      ${senasaInput('ejecucion.tipoRegistro', 'Tipo de registro', 'text', d.ejecucion?.tipoRegistro)}
      ${senasaInput('ejecucion.numeroRegistro', 'Número de registro / habilitación', 'text', d.ejecucion?.numeroRegistro || d.ejecucion?.resolucionSenasa)}
      ${senasaTextarea('ejecucion.productosUtilizados', 'Productos efectivamente utilizados (observaciones)', d.ejecucion?.productosUtilizados)}
      ${senasaTextarea('ejecucion.observaciones', 'Observaciones de actividad', d.ejecucion?.observaciones)}
      ${senasaTextarea('ejecucion.medidasCorrectivas', 'Medidas correctivas reales', d.ejecucion?.medidasCorrectivas)}
    </div>`, true)}
    ${senasaFieldset('Roedores — hallazgos reales', renderSenasaTablaRoedores(d.roedores?.filas || []), true)}
    ${senasaFieldset('Otras plagas — actividad real', renderSenasaTablaOtras(d.otrasPlagas?.filas || []), false)}
    ${senasaFieldset('Áreas externas y espacios verdes — recorrida real', renderSenasaTablaSimple('areasExternas', 'Áreas externas y espacios verdes', d.areasExternas?.filas || [], ['Acúmulo de basura','Malezas','Agua acumulada','Orden y limpieza','Otro']), false)}
    ${senasaFieldset('Hermeticidad — verificación real', renderSenasaTablaSimple('hermeticidad', 'Hermeticidad', d.hermeticidad?.filas || [], ['Cortinas de aire','Portones','Puertas','Burletes','Aberturas','Otro']), false)}
    ${senasaFieldset('Verificación final', `<div class="senasa-grid-tres">
      ${senasaInput('verificacion.fechaAcompanamiento', 'Fecha acompañamiento', 'date', d.verificacion?.fechaAcompanamiento)}
      ${senasaInput('verificacion.horaDesde', 'Hora desde', 'time', d.verificacion?.horaDesde)}
      ${senasaInput('verificacion.horaHasta', 'Hora hasta', 'time', d.verificacion?.horaHasta)}
      ${senasaInput('verificacion.responsableControl', 'Responsable control', 'text', d.verificacion?.responsableControl)}
      <label>Incrementar actividades ${senasaSiNoSelect('verificacion.incrementarActividades', d.verificacion?.incrementarActividades)}</label>
      ${senasaTextarea('verificacion.detalleSectores', 'Detalle de sectores', d.verificacion?.detalleSectores)}
      ${senasaTextarea('verificacion.observacionesFinales', 'Observaciones finales', d.verificacion?.observacionesFinales)}
    </div>`, false)}
  `;
  const cabeceraHtml = `<div class="senasa-grid-tres"><label>Tipo documento<select name="tipoDocumento"><option value="AVISO_MIP" ${esAviso ? 'selected' : ''}>Planilla de Aviso — Programa de Actividades MIP</option><option value="INFORME_CONTROL_PLAGAS" ${!esAviso ? 'selected' : ''}>Informe — Control de Plagas</option></select></label>${senasaInput('numeroCircular', 'Circular Nº', 'text', d.numeroCircular)}${senasaInput('fechaRecepcion', 'Fecha de recepción', 'date', d.fechaRecepcion)}${senasaInput('fechaActividad', 'Fecha real', 'date', d.fechaActividad)}${senasaInput('horaActividad', 'Hora real', 'time', d.horaActividad)}<label>Cliente / establecimiento<select name="clienteId" data-senasa-cliente>${clienteOptions}</select></label></div>`;
  const establecimientoLegacyHtml = `<div class="senasa-grid-tres">${senasaInput('cliente.nombre', 'Razón social / nombre', 'text', cliente.nombre)}${senasaInput('cliente.domicilio', 'Domicilio', 'text', cliente.domicilio)}${senasaInput('cliente.telefono', 'Teléfono', 'text', cliente.telefono)}${senasaInput('cliente.localidad', 'Localidad', 'text', cliente.localidad)}${senasaInput('cliente.provincia', 'Provincia', 'text', cliente.provincia)}${senasaInput('cliente.cuitDni', 'CUIT/DNI', 'text', cliente.cuitDni)}${senasaInput('establecimiento.establecimientoOficial', 'Establecimiento Nº Oficial', 'text', est.establecimientoOficial)}${senasaInput('establecimiento.supervisor', 'Supervisor', 'text', est.supervisor)}${senasaInput('establecimiento.responsableSiv', 'Responsable por S.I.V.', 'text', est.responsableSiv)}${senasaInput('establecimiento.departamentoPartido', 'Departamento / Partido', 'text', est.departamentoPartido)}${senasaTextarea('cliente.observaciones', 'Observaciones del establecimiento', cliente.observaciones)}</div>`;
  form.innerHTML = `${senasaFieldset('Datos del documento', cabeceraHtml, true)}${senasaFieldset('Datos del establecimiento', establecimientoLegacyHtml, true)}${informeHtml}`;
  form.querySelector('[name="clienteId"]').value = d.clienteId || '';
  renderSenasaPreview();
}
function renderSenasaTablaRoedores(rows) {
  const trs = (rows.length ? rows : senasaDefaultRows('roedores')).map((r, i) => `<tr><td><input name="roedores.filas.${i}.casilla" value="${escapeHtmlClient(r.casilla || i + 1)}"></td>${['roedoresVivos','roedoresMuertos','materiaFecal','consumoCebo'].map(k=>`<td>${senasaSiNoSelect(`roedores.filas.${i}.${k}`, r[k])}</td>`).join('')}<td><input name="roedores.filas.${i}.observaciones" value="${escapeHtmlClient(r.observaciones || '')}"></td><td><input name="roedores.filas.${i}.medidaCorrectiva" value="${escapeHtmlClient(r.medidaCorrectiva || '')}"></td><td><button type="button" data-senasa-row-remove="roedores:${i}">Quitar</button></td></tr>`).join('');
  return `<h4>Roedores</h4><table class="senasa-edit-table"><thead><tr><th>Casilla Nº</th><th>Vivos</th><th>Muertos</th><th>Materia fecal</th><th>Consumo cebo</th><th>Observaciones</th><th>Medida correctiva</th><th></th></tr></thead><tbody>${trs}</tbody></table><button type="button" data-senasa-row-add="roedores">Agregar casilla</button>`;
}
function renderSenasaTablaOtras(rows) {
  const trs = (rows.length ? rows : senasaDefaultRows('otrasPlagas')).map((r, i) => `<tr><td><input name="otrasPlagas.filas.${i}.sector" value="${escapeHtmlClient(r.sector || i + 1)}"></td>${['voladorasVivas','voladorasMuertas','caminadorasVivas','caminadorasMuertas'].map(k=>`<td><input name="otrasPlagas.filas.${i}.${k}" value="${escapeHtmlClient(r[k] || '')}"></td>`).join('')}<td><input name="otrasPlagas.filas.${i}.observaciones" value="${escapeHtmlClient(r.observaciones || '')}"></td><td><input name="otrasPlagas.filas.${i}.medidaCorrectiva" value="${escapeHtmlClient(r.medidaCorrectiva || '')}"></td><td><button type="button" data-senasa-row-remove="otrasPlagas:${i}">Quitar</button></td></tr>`).join('');
  return `<h4>Otras plagas</h4><table class="senasa-edit-table"><thead><tr><th>Sector Nº</th><th>Voladoras vivas</th><th>Voladoras muertas</th><th>Caminadoras vivas</th><th>Caminadoras muertas</th><th>Observaciones</th><th>Medida correctiva</th><th></th></tr></thead><tbody>${trs}</tbody></table><button type="button" data-senasa-row-add="otrasPlagas">Agregar sector</button>`;
}
function renderSenasaTablaSimple(key, title, rows, opciones) {
  const trs = (rows.length ? rows : senasaDefaultRows(key)).map((r, i) => `<tr><td><input name="${key}.filas.${i}.sector" value="${escapeHtmlClient(r.sector || '')}"></td><td><select name="${key}.filas.${i}.${key === 'hermeticidad' ? 'elemento' : 'tipoNovedad'}">${opciones.map(o=>`<option value="${escapeHtmlClient(o)}" ${(r.elemento || r.tipoNovedad) === o ? 'selected' : ''}>${escapeHtmlClient(o)}</option>`).join('')}</select></td><td><input name="${key}.filas.${i}.observaciones" value="${escapeHtmlClient(r.observaciones || '')}"></td><td><input name="${key}.filas.${i}.medidaCorrectiva" value="${escapeHtmlClient(r.medidaCorrectiva || '')}"></td><td><button type="button" data-senasa-row-remove="${key}:${i}">Quitar</button></td></tr>`).join('');
  return `<h4>${title}</h4><table class="senasa-edit-table"><thead><tr><th>Sector</th><th>${key === 'hermeticidad' ? 'Elemento verificado' : 'Tipo de novedad'}</th><th>Observaciones</th><th>Medida correctiva</th><th></th></tr></thead><tbody>${trs}</tbody></table><button type="button" data-senasa-row-add="${key}">Agregar fila</button>`;
}
function senasaSetNested(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = parts[i + 1];
    if (/^\d+$/.test(next)) cur[part] = cur[part] || [];
    else cur[part] = cur[part] || {};
    cur = cur[part];
  }
  cur[parts.at(-1)] = value;
}


function senasaHidratarProductoSeleccionado(seccion = {}) {
  if (!seccion || typeof seccion !== 'object' || !seccion.productoId) return seccion;
  const tecnico = senasaProductoTecnico(seccion.productoId);
  Object.entries(tecnico).forEach(([key, value]) => {
    seccion[key] = value;
  });
  const productoTecnico = tecnico.producto || {};
  seccion.producto = { ...(seccion.producto || {}) };
  Object.entries(productoTecnico).forEach(([key, value]) => {
    seccion.producto[key] = value;
  });
  return seccion;
}
function senasaHidratarProductosDocumento(documento = {}) {
  ['roedores', 'insectosExternos', 'insectosInternos', 'otrasPlagas', 'ejecucion'].forEach((key) => {
    if (documento[key]) senasaHidratarProductoSeleccionado(documento[key]);
  });
  return documento;
}
function senasaSincronizarProductoSeccion(seccion = {}) {
  if (!seccion || typeof seccion !== 'object') return seccion;
  const producto = senasaProductoDatos(seccion);
  if (!producto.id && !producto.nombre) {
    delete seccion.producto;
    seccion.productoNombre = '';
    return seccion;
  }
  seccion.producto = producto;
  seccion.productoId = producto.id;
  seccion.productoNombre = producto.nombre;
  seccion.principioActivo = producto.principioActivo;
  seccion.concentracion = producto.concentracion;
  seccion.habilitacionHabitual = producto.habilitacionHabitual;
  seccion.organismoHabilitante = producto.organismoHabilitante;
  seccion.organismoRegulador = producto.organismoRegulador;
  seccion.tipoRegistro = producto.tipoRegistro;
  seccion.numeroRegistro = producto.numeroRegistro;
  seccion.resolucionSenasa = producto.resolucionSenasa;
  seccion.habilitacionCompleta = senasaHabilitacionCompleta(producto);
  seccion.fechaResolucionSenasa = producto.fechaResolucionSenasa;
  seccion.fechaVencimientoRegistro = producto.fechaVencimientoRegistro;
  seccion.disposicionRegistro = producto.disposicionRegistro;
  seccion.empresaTitularRegistro = producto.empresaTitularRegistro;
  seccion.observacionesRegulatorias = producto.observacionesRegulatorias;
  return seccion;
}
function senasaSincronizarProductosDocumento(documento = {}) {
  ['roedores', 'insectosExternos', 'insectosInternos', 'otrasPlagas', 'ejecucion'].forEach((key) => {
    if (documento[key]) senasaSincronizarProductoSeccion(documento[key]);
  });
  return documento;
}
function recogerSenasaForm() {
  if (!senasaDocumentoActual) senasaDocumentoActual = senasaDocumentoBase('AVISO_MIP');
  const base = { ...senasaDocumentoActual, roedores: { ...(senasaDocumentoActual.roedores || {}), filas: [] }, otrasPlagas: { ...(senasaDocumentoActual.otrasPlagas || {}), filas: [] }, areasExternas: { ...(senasaDocumentoActual.areasExternas || {}), filas: [] }, hermeticidad: { ...(senasaDocumentoActual.hermeticidad || {}), filas: [] } };
  $('#senasa-form')?.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => senasaSetNested(base, el.name, el.value));
  base.productosPrevistos = senasaProductosPrevistosDocumento(base);
  if (base.tipoDocumento === 'AVISO_MIP') {
    ['roedores', 'otrasPlagas', 'areasExternas', 'hermeticidad'].forEach((key) => { if (base[key]) delete base[key].filas; });
    senasaHidratarProductosDocumento(base);
    senasaSincronizarProductosDocumento(base);
  } else {
    senasaHidratarProductoSeleccionado(base.ejecucion);
    senasaSincronizarProductoSeccion(base.ejecucion);
  }
  senasaDocumentoActual = base;
  return base;
}
function senasaLinea(label, value, fallback = SENASA_TEXTO_PENDIENTE) { return `<p><strong>${label}:</strong> ${escapeHtmlClient(senasaValor(value, fallback))}</p>`; }
function senasaProductoPreviewHtml(titulo, datos = {}) {
  const producto = senasaProductoDatos(datos);
  return `<div class="senasa-box senasa-producto-doc"><h5>${escapeHtmlClient(titulo)}</h5>${senasaLinea('Producto', producto.nombre)}${senasaLinea('Principio activo', producto.principioActivo)}${senasaLinea('Concentración', producto.concentracion)}${senasaLinea('Organismo habilitante', producto.habilitacionHabitual || producto.organismoHabilitante || producto.organismoRegulador)}${senasaLinea('Tipo de registro', producto.tipoRegistro, SENASA_REGISTRO_PENDIENTE)}${senasaLinea('Número de registro', senasaRegistroValor(producto), SENASA_REGISTRO_PENDIENTE)}${senasaLinea('Disposición', producto.disposicionRegistro, SENASA_REGISTRO_PENDIENTE)}${senasaLinea('Fecha', producto.fechaResolucionSenasa, SENASA_REGISTRO_PENDIENTE)}${senasaLinea('Vencimiento', producto.fechaVencimientoRegistro, SENASA_REGISTRO_PENDIENTE)}${senasaLinea('Titular', producto.empresaTitularRegistro, SENASA_REGISTRO_PENDIENTE)}</div>`;
}
function senasaValorPrimerNoVacio(...values) {
  return values.find((value) => senasaValor(value, '') !== '') || '';
}
function senasaSectoresPreviewHtml(d = {}) {
  const insectosExternosFrecuenciaGrupo1 = senasaValorPrimerNoVacio(d.insectosExternos?.frecuenciaGrupo1, d.insectosExternos?.frecuenciaHoras);
  const insectosExternosObservaciones = senasaValorPrimerNoVacio(d.insectosExternos?.observacionesSectores, d.insectosExternos?.observaciones);
  const insectosInternosTratados = senasaValorPrimerNoVacio(d.insectosInternos?.sectoresTratados, d.insectosInternos?.sectores);
  const insectosInternosCriticos = senasaValorPrimerNoVacio(d.insectosInternos?.sectoresCriticos, d.insectosInternos?.colorSeccionPlano);
  const insectosInternosObservaciones = senasaValorPrimerNoVacio(d.insectosInternos?.observaciones, d.insectosInternos?.metodologia);
  const areasExternasMantenidos = senasaValorPrimerNoVacio(d.areasExternas?.sectoresMantenidos, d.areasExternas?.sectores);
  const areasExternasObservaciones = senasaValorPrimerNoVacio(d.areasExternas?.observaciones, d.areasExternas?.actividades);
  const hermeticidadEvaluados = senasaValorPrimerNoVacio(d.hermeticidad?.sectoresEvaluados, d.hermeticidad?.sectores);
  const hermeticidadObservaciones = senasaValorPrimerNoVacio(d.hermeticidad?.observaciones, d.hermeticidad?.elementos);
  return `<h4>ROEDORES</h4><div class="senasa-box">${senasaLinea('Frecuencia de verificación / reposición', d.roedores?.frecuenciaVerificacion)}${senasaLinea('Frecuencia grupo 1', d.roedores?.frecuenciaGrupo1)}${senasaLinea('Sectores grupo 1', d.roedores?.sectoresGrupo1)}${senasaLinea('Frecuencia grupo 2', d.roedores?.frecuenciaGrupo2)}${senasaLinea('Sectores grupo 2', d.roedores?.sectoresGrupo2)}</div><h4>INSECTOS EXTERNOS</h4><div class="senasa-box">${senasaLinea('Frecuencia grupo 1', insectosExternosFrecuenciaGrupo1)}${senasaLinea('Sectores grupo 1', d.insectosExternos?.sectoresGrupo1)}${senasaLinea('Frecuencia grupo 2', d.insectosExternos?.frecuenciaGrupo2)}${senasaLinea('Sectores grupo 2', d.insectosExternos?.sectoresGrupo2)}${senasaLinea('Observaciones de sectores', insectosExternosObservaciones)}</div><h4>INSECTOS INTERNOS</h4><div class="senasa-box">${senasaLinea('Sectores internos tratados', insectosInternosTratados)}${senasaLinea('Sectores críticos', insectosInternosCriticos)}${senasaLinea('Observaciones', insectosInternosObservaciones)}</div><h4>ÁREAS EXTERNAS</h4><div class="senasa-box">${senasaLinea('Sectores mantenidos', areasExternasMantenidos)}${senasaLinea('Sectores críticos', d.areasExternas?.sectoresCriticos)}${senasaLinea('Observaciones', areasExternasObservaciones)}</div><h4>HERMETICIDAD</h4><div class="senasa-box">${senasaLinea('Sectores evaluados', hermeticidadEvaluados)}${senasaLinea('Observaciones', hermeticidadObservaciones)}</div>`;
}
function renderSenasaPreview() {
  const d = recogerSenasaForm();
  const esAviso = d.tipoDocumento === 'AVISO_MIP';
  const preview = $('#senasa-preview');
  if (!preview) return;
  const titulo = esAviso ? 'PLANILLA DE AVISO' : 'INFORME';
  const subtitulo = esAviso ? 'PROGRAMA DE ACTIVIDADES MIP' : 'CONTROL DE PLAGAS';
  const cliente = d.cliente || {}, est = d.establecimiento || {};
  const roedoresTabla = !esAviso ? `<table><thead><tr><th>Casilla Nº</th><th>Vivos</th><th>Muertos</th><th>Materia fecal</th><th>Consumo cebo</th><th>Observaciones</th><th>Medida Correctiva</th></tr></thead><tbody>${(d.roedores?.filas || []).map(r=>`<tr><td>${escapeHtmlClient(r.casilla || '')}</td><td>${escapeHtmlClient(r.roedoresVivos || '')}</td><td>${escapeHtmlClient(r.roedoresMuertos || '')}</td><td>${escapeHtmlClient(r.materiaFecal || '')}</td><td>${escapeHtmlClient(r.consumoCebo || '')}</td><td>${escapeHtmlClient(r.observaciones || '')}</td><td>${escapeHtmlClient(r.medidaCorrectiva || '')}</td></tr>`).join('')}</tbody></table>` : '';
  const avisoVinculado = d.avisoVinculadoId ? `Aviso MIP vinculado #${d.avisoVinculadoId}` : 'Sin aviso vinculado';
  const productosPrevistosPreview = renderSenasaProductosPrevistosTabla({ productosPrevistos: senasaProductosPrevistosDocumento(d) });
  preview.innerHTML = `<div class="senasa-doc-title"><h2>${titulo}</h2><h3>${subtitulo}</h3><b>CIRCULAR Nº ${escapeHtmlClient(d.numeroCircular || '........')}</b></div>
    <p class="senasa-fecha">FECHA DE RECEPCIÓN: ${escapeHtmlClient(d.fechaRecepcion || '__/__/20__')}</p>
    <h4>ESTABLECIMIENTO</h4><div class="senasa-box"><p>Establecimiento Nº Oficial <b>${escapeHtmlClient(est.establecimientoOficial || '')}</b> &nbsp; Razón Social <b>${escapeHtmlClient(cliente.nombre || '')}</b></p><p>Domicilio: <b>${escapeHtmlClient(cliente.domicilio || '')}</b> &nbsp; Tel/Fax: <b>${escapeHtmlClient(cliente.telefono || '')}</b></p><p>Localidad: <b>${escapeHtmlClient(cliente.localidad || '')}</b> &nbsp; Dpto/Partido: <b>${escapeHtmlClient(est.departamentoPartido || '')}</b> &nbsp; Provincia: <b>${escapeHtmlClient(cliente.provincia || '')}</b></p><p>Supervisor: <b>${escapeHtmlClient(est.supervisor || '')}</b> &nbsp; Responsable por el S.I.V. <b>${escapeHtmlClient(est.responsableSiv || '')}</b></p></div>
    ${esAviso ? `<h4>PLANIFICACIÓN TÉCNICA</h4><div class="senasa-box">${senasaLinea('Periodo comprendido entre', `${d.periodoDesde || ''} y ${d.periodoHasta || ''}`)}${senasaLinea('Frecuencia general', d.planificacion?.frecuenciaGeneral)}${senasaLinea('Horarios previstos', d.planificacion?.horariosPrevistos)}${senasaLinea('Tipo de control', d.planificacion?.tipoControl)}${senasaLinea('Metodología', d.planificacion?.metodologia)}${senasaLinea('Cronograma', d.planificacion?.cronograma)}${senasaLinea('Criterios de control', d.planificacion?.criteriosControl)}</div><h4>PRODUCTOS A APLICAR</h4>${productosPrevistosPreview}<h4>FRECUENCIAS Y SECTORES</h4>${senasaSectoresPreviewHtml(d)}` : `<h4>EJECUCIÓN REAL</h4><div class="senasa-box">${senasaLinea('Aviso vinculado', avisoVinculado, '')}${senasaLinea('Fecha real', d.fechaActividad)}${senasaLinea('Hora real', d.horaActividad)}${senasaLinea('Sectores recorridos', d.ejecucion?.sectoresRecorridos)}${senasaLinea('Casillas revisadas', d.ejecucion?.casillasRevisadas)}${senasaLinea('Trampas revisadas', d.ejecucion?.trampasRevisadas)}${senasaLinea('Actividad detectada / hallazgos', d.ejecucion?.actividadDetectada)}${senasaLinea('Productos utilizados', d.ejecucion?.productosUtilizados)}${senasaProductoPreviewHtml('Producto utilizado', d.ejecucion)}${senasaLinea('Observaciones', d.ejecucion?.observaciones)}${senasaLinea('Medidas correctivas', d.ejecucion?.medidasCorrectivas)}</div><h4>ROEDORES</h4>${roedoresTabla}<h4>VERIFICACIÓN</h4><div class="senasa-box">${senasaLinea('Acompañamiento', `${d.verificacion?.fechaAcompanamiento || ''} de ${d.verificacion?.horaDesde || ''} a ${d.verificacion?.horaHasta || ''}`)}${senasaLinea('Incrementar actividades', d.verificacion?.incrementarActividades)}${senasaLinea('Observaciones finales', d.verificacion?.observacionesFinales)}</div>`}
    <div class="senasa-firmas"><span>Responsable Técnico MIP</span><span>Recibido SIV</span></div>`;
  $('#senasa-editable').value = JSON.stringify(d, null, 2);
}
async function cargarSenasa() {
  const data = await api('/api/senasa/bootstrap');
  senasaClientes = data.clientes || [];
  senasaProductos = (data.productos || []).filter(productoEsSenasaMip);
  senasaResoluciones = data.resoluciones || [];
  senasaDocumentos = data.documentos || [];
  senasaPlantillas = data.plantillas || [];
  if (!senasaDocumentoActual) senasaDocumentoActual = senasaDocumentoBase('AVISO_MIP');
  renderSenasaResolucionForm();
  renderSenasaListas();
  renderSenasaForm();
}
function imprimirSenasaVistaPrevia() {
  renderSenasaPreview();
  setMsg('Use Imprimir / Guardar como PDF. Se genera desde el mismo HTML visible en la vista previa SENASA.', 'info');
  window.print();
}
async function guardarSenasaDocumento(esPlantilla = false) {
  const d = recogerSenasaForm();
  const nombrePlantilla = esPlantilla ? prompt('Nombre de la plantilla', `${d.cliente?.nombre || 'Cliente'} — ${d.tipoDocumento === 'AVISO_MIP' ? 'Roedores mensual' : 'Control integral'}`) : null;
  if (esPlantilla && !nombrePlantilla) return;
  if (d.clienteId) await api(`/api/senasa/clientes/${d.clienteId}/config`, { method: 'PUT', body: JSON.stringify({ ...(d.establecimiento || {}), localidad: d.cliente?.localidad || '', provincia: d.cliente?.provincia || '', observaciones: d.cliente?.observaciones || '' }) });
  const payload = { tipoDocumento: d.tipoDocumento, clienteId: d.clienteId || null, numeroCircular: d.numeroCircular, fechaRecepcion: d.fechaRecepcion || null, periodoDesde: d.periodoDesde || null, periodoHasta: d.periodoHasta || null, datosJson: d, esPlantilla, nombrePlantilla };
  const url = d.id && !esPlantilla ? `/api/senasa/documentos/${d.id}` : '/api/senasa/documentos';
  const saved = await api(url, { method: d.id && !esPlantilla ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  if (!esPlantilla) senasaDocumentoActual = { ...senasaDocumentoActual, ...saved.datosJson, id: saved.id };
  await cargarSenasa();
  setMsg(esPlantilla ? 'Plantilla SENASA guardada' : 'Documento SENASA guardado', 'success');
}
async function abrirSenasaDocumento(id, desdePlantilla = false) {
  const doc = await api(`/api/senasa/documentos/${id}`);
  senasaDocumentoActual = { ...senasaDocumentoBase(doc.tipoDocumento), ...(doc.datosJson || {}), id: desdePlantilla ? null : doc.id, tipoDocumento: doc.tipoDocumento };
  activarSenasaTab(doc.tipoDocumento === 'AVISO_MIP' ? 'avisos' : 'informes');
  renderSenasaForm();
  setMsg(desdePlantilla ? 'Plantilla cargada para nuevo documento' : 'Documento SENASA reabierto', 'info');
}

function activarSenasaTab(tab = 'avisos') {
  document.querySelectorAll('[data-senasa-tab]').forEach((btn) => btn.classList.toggle('activo', btn.dataset.senasaTab === tab));
  document.querySelectorAll('[data-senasa-panel]').forEach((panel) => { panel.hidden = panel.dataset.senasaPanel !== tab; });
}
document.querySelectorAll('[data-senasa-tab]').forEach((btn) => btn.addEventListener('click', () => activarSenasaTab(btn.dataset.senasaTab)));
$('#senasa-btn-nuevo-aviso')?.addEventListener('click', () => { senasaDocumentoActual = senasaDocumentoBase('AVISO_MIP'); senasaPasoMipActual = 1; activarSenasaTab('avisos'); renderSenasaForm(); });
$('#senasa-btn-nuevo-informe')?.addEventListener('click', () => { senasaDocumentoActual = senasaDocumentoBase('INFORME_CONTROL_PLAGAS'); activarSenasaTab('informes'); renderSenasaForm(); });
$('#senasa-btn-guardar')?.addEventListener('click', () => guardarSenasaDocumento(false).catch((e) => setMsg(e.message, 'error')));
$('#senasa-btn-plantilla')?.addEventListener('click', () => guardarSenasaDocumento(true).catch((e) => setMsg(e.message, 'error')));
$('#senasa-btn-imprimir')?.addEventListener('click', imprimirSenasaVistaPrevia);
async function generarSenasaPdfDesdeVista() {
  const d = recogerSenasaForm();
  const error = d.tipoDocumento === 'AVISO_MIP' ? senasaValidarAvisoMip(d) : '';
  if (error) {
    setMsg(error, 'error');
    senasaPasoMipActual = error.includes('producto') ? 3 : error.includes('periodo') ? 2 : 1;
    renderSenasaForm();
    return;
  }
  if (!senasaDocumentoActual?.id) await guardarSenasaDocumento(false);
  imprimirSenasaVistaPrevia();
}
$('#senasa-btn-pdf')?.addEventListener('click', () => generarSenasaPdfDesdeVista().catch((e) => setMsg(e.message, 'error')));
$('#senasa-btn-copiar')?.addEventListener('click', async () => { await navigator.clipboard.writeText($('#senasa-editable').value || ''); setMsg('Formato editable copiado'); });

document.querySelectorAll('[data-senasa-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.senasaAction;
    if (action === 'guardar') guardarSenasaDocumento(false).catch((e) => setMsg(e.message, 'error'));
    if (action === 'plantilla') guardarSenasaDocumento(true).catch((e) => setMsg(e.message, 'error'));
    if (action === 'imprimir') imprimirSenasaVistaPrevia();
    if (action === 'pdf') $('#senasa-btn-pdf')?.click();
  });
});

$('#senasa-btn-resolucion')?.addEventListener('click', async () => {
  const productoId = $('#senasa-res-producto').value;
  const producto = senasaProductos.find(p => String(p.id) === String(productoId));
  await api('/api/senasa/resoluciones', { method: 'POST', body: JSON.stringify({ productoId: productoId || null, productoNombre: $('#senasa-res-producto-nombre').value || producto?.nombre || '', principioActivo: $('#senasa-res-principio').value, resolucionNumero: $('#senasa-res-numero').value, fechaResolucion: $('#senasa-res-fecha').value || null, observaciones: $('#senasa-res-observaciones').value }) });
  await cargarSenasa(); setMsg('Resolución SENASA guardada');
});
$('#senasa-form')?.addEventListener('input', (e) => {
  const filtro = e.target.closest('[data-senasa-producto-filtro]');
  if (filtro) {
    senasaFiltrosProductos[filtro.dataset.senasaProductoFiltro] = filtro.value || '';
    recogerSenasaForm();
    renderSenasaForm();
    return;
  }
  if (e.target?.matches('[data-senasa-producto-previsto-select]')) { senasaProductoPrevistoSeleccionado = e.target.value || ''; renderSenasaForm(); return; }
  if (e.target?.matches('[name]')) renderSenasaPreview();
});
$('#senasa-form')?.addEventListener('change', (e) => {
  const previstoSel = e.target.closest('[data-senasa-producto-previsto-select]');
  if (previstoSel) { senasaProductoPrevistoSeleccionado = previstoSel.value || ''; renderSenasaForm(); return; }
  recogerSenasaForm();
  const clienteSel = e.target.closest('[data-senasa-cliente]');
  if (clienteSel) { senasaAplicarCliente(clienteSel.value); renderSenasaForm(); return; }
  const prodSel = e.target.closest('[data-senasa-producto-select]');
  if (prodSel) {
    const basePath = prodSel.name.replace(/\.productoId$/, '');
    const limpio = prodSel.value ? senasaProductoTecnico(prodSel.value) : { producto: {}, productoNombre: '', principioActivo: '', concentracion: '', habilitacionHabitual: '', organismoHabilitante: '', organismoRegulador: '', tipoRegistro: '', numeroRegistro: '', resolucionSenasa: '', fechaResolucionSenasa: '', fechaVencimientoRegistro: '', disposicionRegistro: '', empresaTitularRegistro: '', observacionesRegulatorias: '' };
    Object.assign(senasaDocumentoActual[basePath] ||= {}, limpio, { productoId: prodSel.value });
    if (!prodSel.value) delete senasaDocumentoActual[basePath].producto;
    senasaSincronizarProductoSeccion(senasaDocumentoActual[basePath]);
    renderSenasaForm();
    return;
  }
  const resSel = e.target.closest('[data-senasa-resolucion-select]');
  if (resSel) { const basePath = resSel.name.replace(/\.resolucionId$/, ''); Object.assign(senasaDocumentoActual[basePath] ||= {}, senasaResolucionTecnica(resSel.value), { resolucionId: resSel.value }); renderSenasaForm(); return; }
  if (e.target.name === 'tipoDocumento') { senasaDocumentoActual.tipoDocumento = e.target.value; senasaPasoMipActual = 1; renderSenasaForm(); return; }
  renderSenasaPreview();
});
$('#senasa-form')?.addEventListener('click', (e) => {
  const paso = e.target.closest('[data-senasa-paso]');
  if (paso) { recogerSenasaForm(); senasaPasoMipActual = Number(paso.dataset.senasaPaso) || 1; renderSenasaForm(); return; }
  const addPrevisto = e.target.closest('[data-senasa-producto-previsto-add]');
  if (addPrevisto) {
    recogerSenasaForm();
    const item = senasaProductoPrevistoDesdeProductoId(senasaProductoPrevistoSeleccionado);
    if (!item) { setMsg('Seleccione un producto MIP registrado antes de agregarlo.', 'error'); return; }
    const firmaNueva = [item.productoNombre, item.principioActivo, item.concentracion, item.habilitacionCompleta].join('|');
    const existe = senasaProductosPrevistosDocumento(senasaDocumentoActual).some((p) => [p.productoNombre || p.producto?.nombre, p.principioActivo, p.concentracion, senasaHabilitacionCompleta(p)].join('|') === firmaNueva);
    if (!existe) (senasaDocumentoActual.productosPrevistos ||= []).push(item);
    senasaProductoPrevistoSeleccionado = '';
    renderSenasaForm();
    setMsg(existe ? 'El producto ya estaba agregado.' : 'Producto MIP agregado con habilitación completa.', existe ? 'info' : 'success');
    return;
  }
  const remPrevisto = e.target.closest('[data-senasa-producto-previsto-remove]');
  if (remPrevisto) { recogerSenasaForm(); const idx = Number(remPrevisto.dataset.senasaProductoPrevistoRemove); (senasaDocumentoActual.productosPrevistos ||= []).splice(idx, 1); renderSenasaForm(); return; }
  const generarPdf = e.target.closest('[data-senasa-generar-pdf]');
  if (generarPdf) { $('#senasa-btn-pdf')?.click(); return; }
  const add = e.target.closest('[data-senasa-row-add]');
  if (add) { recogerSenasaForm(); const key = add.dataset.senasaRowAdd; (senasaDocumentoActual[key].filas ||= []).push({}); renderSenasaForm(); return; }
  const rem = e.target.closest('[data-senasa-row-remove]');
  if (rem) { recogerSenasaForm(); const [key, idx] = rem.dataset.senasaRowRemove.split(':'); senasaDocumentoActual[key].filas.splice(Number(idx), 1); renderSenasaForm(); }
});


function senasaProductoPayloadDesdePrompt(producto = {}) {
  const nombreComercial = prompt('Producto comercial', producto.nombreComercial || producto.nombre || '');
  if (nombreComercial === null) return null;
  const principioActivo = prompt('Principio activo / droga', producto.principioActivo || '');
  if (principioActivo === null) return null;
  const concentracion = prompt('Concentración', producto.concentracion || '');
  if (concentracion === null) return null;
  const organismoHabilitante = prompt('Organismo habilitante (ANMAT o SENASA)', producto.organismoHabilitante || producto.habilitacionHabitual || producto.organismoRegulador || 'ANMAT');
  if (organismoHabilitante === null) return null;
  const tipoRegistro = prompt('Tipo de registro (RNPUD, RNE, SENASA, etc.)', producto.tipoRegistro || 'RNPUD');
  if (tipoRegistro === null) return null;
  const numeroRegistro = prompt('Número de registro / habilitación', producto.numeroRegistro || '');
  if (numeroRegistro === null) return null;
  const disposicionRegistro = prompt('Disposición', producto.disposicionRegistro || '');
  if (disposicionRegistro === null) return null;
  const empresaTitularRegistro = prompt('Titular', producto.empresaTitularRegistro || '');
  if (empresaTitularRegistro === null) return null;
  const fechaVencimientoRegistro = prompt('Vencimiento del registro (AAAA-MM-DD)', senasaFecha(producto.fechaVencimientoRegistro));
  if (fechaVencimientoRegistro === null) return null;
  const usoPrincipal = prompt('Uso principal', producto.usoPrincipal || 'MIP');
  if (usoPrincipal === null) return null;
  return { nombreComercial, principioActivo, concentracion, organismoHabilitante, tipoRegistro, numeroRegistro, disposicionRegistro, fechaVencimientoRegistro: fechaVencimientoRegistro || null, empresaTitularRegistro, usoPrincipal };
}
$('#senasa-productos-tabla')?.addEventListener('click', async (e) => {
  const nuevo = e.target.closest('[data-senasa-producto-nuevo]');
  const detalle = e.target.closest('[data-senasa-producto-detalle]');
  const editar = e.target.closest('[data-senasa-producto-editar]');
  const eliminar = e.target.closest('[data-senasa-producto-eliminar]');
  const id = detalle?.dataset.senasaProductoDetalle || editar?.dataset.senasaProductoEditar || eliminar?.dataset.senasaProductoEliminar;
  try {
    if (nuevo) {
      const payload = senasaProductoPayloadDesdePrompt({});
      if (!payload) return;
      await api('/api/mip/productos', { method: 'POST', body: JSON.stringify(payload) });
      await cargarSenasa();
      setMsg('Producto MIP creado', 'success');
      return;
    }
    if (!id) return;
    const producto = senasaProductos.find((p) => String(p.id) === String(id));
    if (!producto) return;
    if (eliminar) {
      if (!confirm(`Dar de baja lógica el producto ${producto.nombre || producto.nombreComercial}? No se borran reportes históricos.`)) return;
      await api(`/api/mip/productos/${id}`, { method: 'DELETE' });
      await cargarSenasa();
      setMsg('Producto MIP dado de baja lógica', 'success');
      return;
    }
    if (editar) {
      const payload = senasaProductoPayloadDesdePrompt(producto);
      if (!payload) return;
      await api(`/api/mip/productos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      await cargarSenasa();
      setMsg('Producto MIP actualizado', 'success');
      return;
    }
    const resumen = [
      `Producto: ${senasaValor(producto.nombre || producto.nombreComercial)}`,
      `Principio activo: ${senasaValor(producto.principioActivo)}`,
      `Concentración: ${senasaValor(producto.concentracion)}`,
      `Organismo habilitante: ${senasaValor(producto.organismoHabilitante || producto.habilitacionHabitual || producto.organismoRegulador)}`,
      `Tipo registro: ${senasaValor(producto.tipoRegistro)}`,
      `Número registro: ${senasaRegistroValor(producto)}`,
      `Disposición: ${senasaValor(producto.disposicionRegistro)}`,
      `Vencimiento: ${senasaValor(senasaFecha(producto.fechaVencimientoRegistro))}`,
      `Estado documental: ${senasaProductoEstado(producto)}`
    ].join(' · ');
    setMsg(resumen, 'info');
  } catch (err) {
    setMsg(err.message, 'error');
  }
});
['#senasa-documentos', '#senasa-avisos', '#senasa-informes'].forEach((selector) => {
  $(selector)?.addEventListener('click', async (e) => {
    const imprimir = e.target.closest('[data-senasa-imprimir]');
    if (imprimir) {
      try {
        await abrirSenasaDocumento(imprimir.dataset.senasaImprimir);
        await generarSenasaPdfDesdeVista();
      } catch (err) {
        setMsg(err.message, 'error');
      }
      return;
    }
    const b = e.target.closest('[data-senasa-abrir]');
    if (b) abrirSenasaDocumento(b.dataset.senasaAbrir).catch(err => setMsg(err.message, 'error'));
  });
});
$('#senasa-plantillas')?.addEventListener('click', (e) => { const b = e.target.closest('[data-senasa-plantilla]'); if (b) abrirSenasaDocumento(b.dataset.senasaPlantilla, true).catch(err => setMsg(err.message, 'error')); });
$('#senasa-resoluciones')?.addEventListener('click', async (e) => { const b = e.target.closest('[data-senasa-res-eliminar]'); if (!b) return; await api(`/api/senasa/resoluciones/${b.dataset.senasaResEliminar}`, { method: 'DELETE' }); await cargarSenasa(); });

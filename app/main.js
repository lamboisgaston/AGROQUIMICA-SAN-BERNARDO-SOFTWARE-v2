const $ = (s) => document.querySelector(s);
const money = (v) => '$' + Number(v || 0).toFixed(2);

let ventaId = null;
let venta = null;
let listasComerciales = [];
let productosListaComercial = [];
let productos = [];
let resultadosProductosVisibles = [];
let indiceProductoSeleccionado = -1;
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
      <div class="producto-meta">Precio USD: <strong>${money(p.precioUsd || 0)}</strong> · Precio final: <strong>${money(p.precioFinal || 0)}</strong></div>
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
      <div class="producto-titulo">${p.nombre || '-'}</div>
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
  if (!q) {
    resultadosProductosVisibles = [];
    indiceProductoSeleccionado = -1;
    $('#resultados-productos').innerHTML = '<div class="item">Sin resultados</div>';
    return;
  }
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
      : await buscarProductos(q);
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

function renderCarrito() {
  const items = venta?.items || [];
  $('#carrito').innerHTML = items.length
    ? items.map(i => `<tr><td>${i.producto.nombre}</td><td>${money(i.precioUnitario)}</td><td><button data-accion="menos" data-producto="${i.productoId}">-</button> ${i.cantidad} <button data-accion="mas" data-producto="${i.productoId}">+</button></td><td>${money(i.subtotal)}</td></tr>`).join('')
    : '<tr><td colspan="4">Sin productos</td></tr>';

  const subtotal = Number((venta?.items || []).reduce((acc, i) => acc + Number(i.subtotal || 0), 0));
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

function renderPanelCuentaCorriente(cuenta) {
  cuentaCorrienteMostrada = cuenta;
  $('#cc-cliente-activo').textContent = cuenta?.persona
    ? `Tel: ${cuenta.persona.telefono || '-'} | ${cuenta.persona.nombre || '-'} | ${cuenta.persona.cuitDni || '-'} | Compras: ${Number(cuenta.persona.cantidadCompras || 0)} | Total comprado: ${money(cuenta.persona.totalComprado || 0)}`
    : 'Ninguno';
  const saldo = cuenta?.saldo || 0;
  $('#cc-saldo').textContent = money(saldo);
  aplicarEstadoSaldo('#cc-saldo', saldo);
  $('#cc-movimientos').innerHTML = (cuenta?.movimientos || []).length
    ? cuenta.movimientos.map(m => `<div class="item item-movimiento"><span>${new Date(m.createdAt).toLocaleString('es-AR')}</span><strong class="${m.tipo === 'DEBITO' ? 'mov-debe' : 'mov-haber'}">${m.tipo === 'DEBITO' ? 'DEBE' : 'HABER'}</strong><span>${money(m.monto)}</span><span>${m.descripcion || '-'}</span></div>`).join('')
    : '<div class="item">Sin movimientos</div>';
}

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
    const desc = it.descuentoTipo === 'PORCENTAJE' ? base * (Number(it.descuentoValor || 0) / 100) : Number(it.descuentoValor || 0);
    return { ...it, subtotal: Math.max(0, base - desc) };
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
    ? `<table style="width:100%;margin-top:8px;"><thead><tr><th>Producto</th><th>Precio unitario</th><th>Cantidad</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>${
      presupuestoItems.map(it => `<tr>
        <td>${it.nombre}</td>
        <td>${money(it.precioUnitario)}</td>
        <td><button data-pres-menos="${it.productoId}">-</button> ${it.cantidad} <button data-pres-mas="${it.productoId}">+</button></td>
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
function normalizarProvinciaTerritorial(p) {
  const PROVINCIAS_ARG = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
    'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ];
  const aliases = { 'CAPITAL FEDERAL': 'CABA', 'CIUDAD AUTONOMA DE BUENOS AIRES': 'CABA', 'CIUDAD AUTÓNOMA DE BUENOS AIRES': 'CABA' };
  const normalizarTxt = (v) => String(v || '').trim();
  const fuente = [p?.persona?.provincia, p?.provincia, p?.observaciones, JSON.stringify(p?.metadata || {}), JSON.stringify(p || {})]
    .map(normalizarTxt)
    .find(Boolean) || '';
  const fuenteMay = fuente.toUpperCase();
  let provincia = PROVINCIAS_ARG.find((prov) => fuenteMay.includes(prov.toUpperCase()))
    || Object.keys(aliases).find((a) => fuenteMay.includes(a));
  if (aliases[provincia]) provincia = aliases[provincia];
  const corregida = !provincia;
  return { provincia: provincia || 'Salta', corregida };
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
  const fuente = [p?.persona?.localidad, p?.persona?.ciudad, p?.localidad, p?.ciudad, p?.observaciones, JSON.stringify(p?.persona?.metadata || {}), JSON.stringify(p?.metadata || {}), JSON.stringify(p || {})]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' | ');
  const m = fuente.match(/(Ciudad\/Localidad|Localidad|Ciudad)\s*:\s*([^|]+)/i);
  return (m?.[2] || p?.persona?.localidad || p?.persona?.ciudad || p?.localidad || p?.ciudad || '-').trim();
}
function renderPanelTerritorialSemillasYa() {
  const contProvincias = $('#pres-provincias');
  const contOps = $('#pres-operaciones-provincia');
  const contDetalle = $('#pres-detalle-solicitud');
  if (!contProvincias || !contOps || !contDetalle) return;
  const PROVINCIAS_ARG = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
    'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ];
  const agrupado = PROVINCIAS_ARG.reduce((acc, prov) => ({ ...acc, [prov]: [] }), {});
  solicitudesTerritoriales.forEach((s) => {
    const infoProv = normalizarProvinciaTerritorial(s);
    if (!agrupado[infoProv.provincia]) agrupado[infoProv.provincia] = [];
    agrupado[infoProv.provincia].push({ ...s, _provinciaCorregida: infoProv.corregida });
  });
  const provincias = PROVINCIAS_ARG;
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
  renderProductos();
  renderProductosAdmin();
  await loadCategoriasProducto();
  renderStockProductos();
  renderBuscadorRemitoProductos();
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
const HOME_MODULES_BASE = ['clientes','clientes-semillasya','productos','productos-precampania','categorias','presupuestos','presupuestos-semillasya','pedidos','ventas','caja','cuenta-corriente','proveedores','stock','remitos','reportes','eliminados','estado-sistema'];
const ROLE_MODULES = {
  ADMINISTRADOR_GENERAL: [...HOME_MODULES_BASE],
  GERENTE: [...HOME_MODULES_BASE],
  MOSTRADOR: [...HOME_MODULES_BASE],
  CAJA: [...HOME_MODULES_BASE]
};
let activeRole = null;
let activeRoleName = '';

function renderUsuarioActivo() {
  const el = $('#usuario-activo');
  if (!el) return;
  el.textContent = activeRole ? `Usuario activo: ${activeRoleName} | ${activeRole}` : 'Usuario activo: - | -';
}

function applyRoleModules() {
  const allowed = new Set(ROLE_MODULES[activeRole] || []);
  document.querySelectorAll('[data-module-card]').forEach((card) => {
    card.classList.toggle('hidden', !allowed.has(card.dataset.moduleCard));
  });
}

function seleccionarRol(role, roleName) {
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
  $('#role-selector')?.classList.remove('hidden');
}
async function abrirModulo(modulo) {
  if (!activeRole) return;
  const roleSelector = $('#role-selector');
  const home = $('#home-dashboard');
  const appShell = document.querySelectorAll('.app-shell');
  const modulos = document.querySelectorAll('[data-modulo]');
  if (!home) return;
  roleSelector?.classList.add('hidden');
  home.classList.add('hidden');
  appShell.forEach((el) => el.classList.remove('hidden'));
  modulos.forEach((el) => {
    const grupos = String(el.dataset.modulo || '').split(/\s+/).filter(Boolean);
    el.classList.toggle('hidden', !grupos.includes(modulo));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (modulo === 'cuenta-corriente') {
    await loadResumenCuentaCorriente();
  }
  if (modulo === 'productos-precampania') {
    await loadProductosPrecampania();
  }
  if (modulo === 'presupuestos' || modulo === 'presupuestos-semillasya') {
    const esSemillasYa = modulo === 'presupuestos-semillasya';
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
      tituloModulo.textContent = '11) Operaciones territoriales SemillasYa';
      if (tituloListado) tituloListado.textContent = 'Solicitudes y cotizaciones SemillasYa';
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
  $('#pre-costo-compra').value = '0';
  $('#pre-porcentaje-flete').value = '0';
  $('#pre-porcentaje-margen').value = '0';
  $('#pre-precio-final').value = '0';
  $('#pre-visible').value = 'false';
  if (precampaniaContextoCarga.cultivo) $('#pre-cultivo').value = precampaniaContextoCarga.cultivo;
  if (precampaniaContextoCarga.semillero) $('#pre-semillero').value = precampaniaContextoCarga.semillero;
  calcularPreviewPrecampania();
}

function calcularPreviewPrecampania() {
  const costoBase = Number($('#pre-costo-compra')?.value || 0);
  const porcentajeFlete = Number($('#pre-porcentaje-flete')?.value || 0);
  const porcentajeMargen = Number($('#pre-porcentaje-margen')?.value || 0);

  const flete = costoBase * (porcentajeFlete / 100);
  const subtotal = costoBase + flete;
  const margen = subtotal * (porcentajeMargen / 100);
  const precioFinal = subtotal + margen;

  if ($('#pre-precio-final')) $('#pre-precio-final').value = String(Number.isFinite(precioFinal) ? Number(precioFinal.toFixed(2)) : 0);
  if ($('#pre-calc-base')) $('#pre-calc-base').textContent = money(costoBase || 0);
  if ($('#pre-calc-flete')) $('#pre-calc-flete').textContent = money(flete || 0);
  if ($('#pre-calc-final')) $('#pre-calc-final').textContent = money(precioFinal || 0);
  if ($('#pre-calc-margen')) $('#pre-calc-margen').textContent = `${Number.isFinite(porcentajeMargen) ? porcentajeMargen : 0}%`;
}

function renderSemillerosPrecampania() {
  const selCultivoForm = $('#pre-cultivo');
  const selCultivoFiltro = $('#pre-filtro-cultivo');
  if (selCultivoForm) {
    selCultivoForm.innerHTML = `<option value="">Seleccionar cultivo</option>${precampaniaCultivos.map((c) => `<option value="${c}">${c}</option>`).join('')}`;
    if (precampaniaContextoCarga.cultivo) selCultivoForm.value = precampaniaContextoCarga.cultivo;
  }
  if (selCultivoFiltro) {
    selCultivoFiltro.innerHTML = `<option value="TODOS">Todos los cultivos</option>${precampaniaCultivos.map((c) => `<option value="${c}">${c}</option>`).join('')}`;
  }
  const selForm = $('#pre-semillero');
  const selFiltro = $('#pre-filtro-semillero');
  if (selForm) {
    selForm.innerHTML = precampaniaSemilleros.map((s) => `<option value="${s}">${s}</option>`).join('');
    if (precampaniaContextoCarga.semillero) selForm.value = precampaniaContextoCarga.semillero;
  }
  if (selFiltro) {
    selFiltro.innerHTML = `<option value="TODOS">Todos los semilleros</option>${precampaniaSemilleros.map((s) => `<option value="${s}">${s}</option>`).join('')}`;
  }
}

function renderProductosPrecampania() {
  const q = ($('#pre-buscar')?.value || '').trim().toLowerCase();
  const semilleroFiltro = $('#pre-filtro-semillero')?.value || 'TODOS';
  const cultivoFiltro = $('#pre-filtro-cultivo')?.value || 'TODOS';
  const categoriaFiltro = ($('#pre-filtro-categoria')?.value || '').trim().toLowerCase();
  const lista = precampaniaProductos.filter((p) => {
    const matchQ = !q || [p.nombre, p.semilleroLaboratorio, p.cultivo, p.categoria, p.presentacionEnvase].some((v) => String(v || '').toLowerCase().includes(q));
    const matchSem = semilleroFiltro === 'TODOS' || p.semilleroLaboratorio === semilleroFiltro;
    const matchCultivo = cultivoFiltro === 'TODOS' || (p.cultivo || 'Otro') === cultivoFiltro;
    const matchCat = !categoriaFiltro || String(p.categoria || '').toLowerCase().includes(categoriaFiltro);
    return matchQ && matchSem && matchCultivo && matchCat;
  });
  const agrupado = new Map();
  lista.forEach((p) => {
    const key = p.cultivo || 'Sin cultivo';
    if (!agrupado.has(key)) agrupado.set(key, []);
    agrupado.get(key).push(p);
  });
  $('#pre-lista').innerHTML = lista.length
    ? Array.from(agrupado.entries()).map(([cultivo, items]) => `<div class="item"><strong>${cultivo.toUpperCase()}</strong></div>${items.map((p) => `<div class="item">- <strong>${p.nombre}</strong> | ${p.semilleroLaboratorio} | ${p.presentacionEnvase || '-'} | Precio ERP: ${money(p.precioVentaFinal || 0)} | Visible en SemillasYa: ${p.visibleEnSemillasYa ? 'Sí' : 'No'} <button data-pre-editar="${p.id}">Editar</button> <button data-pre-toggle-visible="${p.id}">${p.visibleEnSemillasYa ? 'Ocultar' : 'Mostrar'} en SemillasYa</button> <button data-pre-duplicar-mostrador="${p.id}">Duplicar a Mostrador</button> <button data-pre-eliminar="${p.id}">Desactivar</button></div>`).join('')}`).join('')
    : '<div class="item">Sin productos precampaña.</div>';
}

async function loadProductosPrecampania() {
  const data = await api('/api/productos-precampania');
  precampaniaSemilleros = Array.isArray(data?.semilleros) ? data.semilleros : [];
  precampaniaCultivos = Array.isArray(data?.cultivos) ? data.cultivos : [];
  precampaniaProductos = Array.isArray(data?.productos) ? data.productos : [];
  renderSemillerosPrecampania();
  renderProductosPrecampania();
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
  const roleSelector = $('#role-selector');
  const home = $('#home-dashboard');
  const appShell = document.querySelectorAll('.app-shell');
  const modulos = document.querySelectorAll('[data-modulo]');
  if (!home) return;
  if (!activeRole) {
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-abrir-modulo]').forEach((btn) => {
  btn.addEventListener('click', () => abrirModulo(btn.dataset.abrirModulo));
});
document.querySelectorAll('[data-select-role]').forEach((btn) => {
  btn.addEventListener('click', () => seleccionarRol(btn.dataset.selectRole, btn.dataset.roleName || btn.dataset.selectRole));
});
$('#btn-cambiar-usuario')?.addEventListener('click', cambiarUsuario);
$('#btn-volver-inicio')?.addEventListener('click', volverInicio);
const savedRole = localStorage.getItem(ROLE_STORAGE_KEY);
const savedRoleName = localStorage.getItem(ROLE_NAME_STORAGE_KEY);
if (savedRole && ROLE_MODULES[savedRole]) {
  activeRole = savedRole;
  activeRoleName = savedRoleName || savedRole;
  renderUsuarioActivo();
  applyRoleModules();
}
volverInicio();

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
$('#pre-filtro-cultivo')?.addEventListener('change', renderProductosPrecampania);
$('#pre-filtro-categoria')?.addEventListener('input', renderProductosPrecampania);
$('#btn-precampania-nuevo')?.addEventListener('click', resetFormularioPrecampania);
$('#pre-cultivo')?.addEventListener('change', (e) => { precampaniaContextoCarga.cultivo = e.target.value; });
$('#pre-semillero')?.addEventListener('change', (e) => { precampaniaContextoCarga.semillero = e.target.value; });
$('#pre-categoria')?.addEventListener('input', (e) => { precampaniaContextoCarga.categoria = e.target.value; });
['pre-costo-compra', 'pre-porcentaje-flete', 'pre-porcentaje-margen']
  .forEach((id) => {
    $(id)?.addEventListener('input', calcularPreviewPrecampania);
    $(id)?.addEventListener('change', calcularPreviewPrecampania);
  });
$('#pre-lista')?.addEventListener('click', async (e) => {
  const editar = e.target.closest('button[data-pre-editar]');
  if (editar) {
    const id = Number(editar.dataset.preEditar);
    const p = precampaniaProductos.find((x) => x.id === id);
    if (!p) return;
    $('#pre-id').value = String(p.id);
    $('#pre-nombre').value = p.nombre || '';
    $('#pre-cultivo').value = p.cultivo || '';
    if (!$('#pre-cultivo').value && precampaniaCultivos.includes('Otro')) $('#pre-cultivo').value = 'Otro';
    $('#pre-semillero').value = p.semilleroLaboratorio || '';
    $('#pre-categoria').value = p.categoria || '';
    $('#pre-envase').value = p.presentacionEnvase || '';
    $('#pre-descripcion').value = p.descripcion || '';
    $('#pre-costo-compra').value = p.costoCompra == null ? '0' : String(p.costoCompra);
    $('#pre-porcentaje-flete').value = p.porcentajeFlete == null ? '0' : String(p.porcentajeFlete);
    $('#pre-porcentaje-margen').value = p.porcentajeMargen == null ? '0' : String(p.porcentajeMargen);
    $('#pre-precio-final').value = p.precioVentaFinal == null ? '0' : String(p.precioVentaFinal);
    $('#pre-visible').value = p.visibleEnSemillasYa ? 'true' : 'false';
    calcularPreviewPrecampania();
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
    setMsg('Producto precampaña duplicado', 'info');
    return;
  }
  const toggleVisible = e.target.closest('button[data-pre-toggle-visible]');
  const duplicarPre = e.target.closest('[data-pre-duplicar-mostrador]');
  if (duplicarPre) {
    await api(`/api/productos-precampania/${Number(duplicarPre.dataset.preDuplicarMostrador)}/duplicar-mostrador`, { method: 'POST', body: '{}' });
    setMsg('Producto duplicado a mostrador', 'ok');
  }
  if (toggleVisible) {
    const id = Number(toggleVisible.dataset.preToggleVisible);
    const p = precampaniaProductos.find((x) => x.id === id);
    if (!p) return;
    await api(`/api/productos-precampania/${id}`, { method: 'PUT', body: JSON.stringify({ ...p, visibleEnSemillasYa: !p.visibleEnSemillasYa }) });
    await loadProductosPrecampania();
    setMsg('Visibilidad en SemillasYa actualizada', 'info');
    return;
  }
  const eliminar = e.target.closest('button[data-pre-eliminar]');
  if (!eliminar) return;
  const id = Number(eliminar.dataset.preEliminar);
  await api(`/api/productos-precampania/${id}`, { method: 'DELETE' });
  await loadProductosPrecampania();
  setMsg('Producto precampaña desactivado', 'info');
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
    costoCompra: Number($('#pre-costo-compra').value || 0),
    porcentajeFlete: Number($('#pre-porcentaje-flete').value || 0),
    porcentajeMargen: Number($('#pre-porcentaje-margen').value || 0),
    usaPrecioManual: false,
    precioManual: '',
    precioInternoManual: '',
    visibleEnSemillasYa: $('#pre-visible').value === 'true'
  };
  if (!payload.nombre) return setMsg('Nombre obligatorio', 'warning');
  if (!String(payload.cultivo || '').trim()) return setMsg('Cultivo obligatorio', 'warning');
  if (id) {
    await api(`/api/productos-precampania/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    setMsg('Producto precampaña actualizado', 'info');
  } else {
    await api('/api/productos-precampania', { method: 'POST', body: JSON.stringify(payload) });
    setMsg('Producto precampaña creado', 'info');
  }
  resetFormularioPrecampania();
  await loadProductosPrecampania();
});

calcularPreviewPrecampania();

$('#buscar-producto').addEventListener('input', renderProductos);
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

$('#carrito').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-producto]');
  if (!b || !ventaId) return;
  const productoId = Number(b.dataset.producto);
  const item = (venta.items || []).find(i => i.productoId === productoId);
  if (!item) return;
  const cantidad = b.dataset.accion === 'mas' ? item.cantidad + 1 : item.cantidad - 1;
  try {
    await api(`/mostrador/ventas/${ventaId}/items/${productoId}`, { method: 'PUT', body: JSON.stringify({ cantidad: Math.max(0, cantidad) }) });
    await refreshVenta();
    await loadCaja20();
  } catch (err) { setMsg(err.message); }
});

$('#descuento').addEventListener('input', renderCarrito);
$('#descuento-tipo').addEventListener('change', renderCarrito);
$('#ajuste-redondeo')?.addEventListener('input', renderCarrito);
$('#ajuste-mas')?.addEventListener('click', () => { $('#ajuste-redondeo').value = (Number($('#ajuste-redondeo').value || 0) + 1).toFixed(2); renderCarrito(); });
$('#ajuste-menos')?.addEventListener('click', () => { $('#ajuste-redondeo').value = (Number($('#ajuste-redondeo').value || 0) - 1).toFixed(2); renderCarrito(); });
document.querySelectorAll('.btn-redondeo').forEach((btn) => btn.addEventListener('click', () => {
  const base = Number(btn.dataset.redondeo || 100);
  const subtotal = Number((venta?.items || []).reduce((acc, i) => acc + Number(i.subtotal || 0), 0));
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
    setMsg(`✅ Venta #${ventaCerrada.id} creada correctamente y enviada a caja`);
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
  const [pendientes, resumen, cobradas] = await Promise.all([
    api('/caja/ventas'),
    api('/caja/resumen'),
    api('/ventas/cobradas-recientes')
  ]);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = money(value || 0);
  };

  setText('resumen-total', resumen.totalGeneral || resumen.totalVendido || 0);
  setText('resumen-efectivo', resumen.efectivo || 0);
  setText('resumen-transferencia', resumen.transferencia || 0);
  setText('resumen-tarjeta', resumen.tarjeta || 0);
  setText('resumen-cuenta-corriente', resumen.cuentaCorriente || 0);

  const cajaReal = Number(resumen.efectivo || 0) + Number(resumen.transferencia || 0) + Number(resumen.tarjeta || 0);
  setText('resumen-caja-real', cajaReal);

  const pendientesEl = document.getElementById('pendientes');
  if (pendientesEl) {
    pendientesEl.innerHTML = pendientes.length
      ? pendientes.map(v => `
        <div class="item">
          <h3>${v.persona?.nombre || 'Consumidor final'}</h3>
          <p><strong>Total:</strong> ${money(v.total)}</p>
          <p><strong>Condición prevista:</strong> ${v.condicionPagoPrevista || 'Sin definir'}</p>
          <p><strong>Venta:</strong> #${v.id}</p>
          <div class="action-row">
            <button data-caja20-cobrar="${v.id}" data-medio="EFECTIVO">Efectivo</button>
            <button data-caja20-cobrar="${v.id}" data-medio="TRANSFERENCIA">Transferencia</button>
            <button data-caja20-cobrar="${v.id}" data-medio="CUENTA_CORRIENTE">Cuenta corriente</button>
          </div>
        </div>
      `).join('')
      : '<div class="item">No hay ventas pendientes de cobro.</div>';
  }

  const cobradasEl = document.getElementById('cobradas-recientes');
  if (cobradasEl) {
    const cobradasOrdenadas = [...cobradas].sort((a, b) => {
      const fechaA = new Date(a.cobradaAt || a.updatedAt || a.createdAt || 0).getTime();
      const fechaB = new Date(b.cobradaAt || b.updatedAt || b.createdAt || 0).getTime();
      if (fechaA !== fechaB) return fechaB - fechaA;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    cobradasEl.innerHTML = cobradas.length
      ? `<div class="cobradas-lista-compacta">${cobradasOrdenadas.map(v => `
        <div class="item item-compacto">
          <strong>#${v.id}</strong> · ${v.persona?.nombre || 'Consumidor final'} · ${v.medioPago || 'Sin medio'} · ${money(v.total)}
        </div>
      `).join('')}</div>`
      : '<div class="item">Todavía no hay ventas cobradas recientes.</div>';
  }

  await loadCierresCaja();
}

let cierreCajaPendiente = null;

async function cerrarCajaDesdeCaja20() {
  const fechaCaja = $('#caja-fecha')?.value || undefined;
  const turno = $('#caja-turno')?.value || 'DIARIO';
  const resumen = await api('/caja/resumen' + (fechaCaja ? `?fecha=${encodeURIComponent(fechaCaja)}&turno=${encodeURIComponent(turno)}` : `?turno=${encodeURIComponent(turno)}`));
  const operaciones = Number(resumen.cantidadVentasCobradas || resumen.cantidadOperaciones || 0);
  const efectivo = Number(resumen.efectivo || 0);
  const transferencia = Number(resumen.transferencia || 0);
  const tarjeta = Number(resumen.tarjeta || 0);
  const cuentaCorriente = Number(resumen.cuentaCorriente || 0);
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
      proveedorIds
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
      const nuevo = { productoId: id, nombre: prod.nombre, precioUnitario: Number(prod.precioPesosCalculado || prod.precioFinalPesos || 0), cantidad: 1, descuentoTipo: 'NINGUNO', descuentoValor: 0, subtotal: Number(prod.precioPesosCalculado || prod.precioFinalPesos || 0) };
      console.log('Producto agregado al presupuesto:', prod);
      presupuestoItems.push(nuevo);
    }
  }
  if (menos && it) { it.cantidad -= 1; if (it.cantidad <= 0) presupuestoItems = presupuestoItems.filter(x => x.productoId !== id); }
  if (quitar) presupuestoItems = presupuestoItems.filter(x => x.productoId !== id);
  console.log('Items presupuesto:', presupuestoItems);
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
    const creado = await api('/presupuestos', { method: 'POST', body: JSON.stringify({ tipoDestinatario: presupuestoTipoDestinatario, clienteId: presupuestoTipoDestinatario === 'EXISTENTE' ? presupuestoClienteId : null, nombreLibre: presupuestoTipoDestinatario === 'LIBRE' ? presupuestoNombreLibre : null, items: presupuestoItems.map(({ productoId, cantidad, precioUnitario, descuentoTipo, descuentoValor }) => ({ productoId, cantidad, precioUnitario, descuentoTipo, descuentoValor })), descuentoTipo: 'PORCENTAJE', descuentoValor, ajusteRedondeo, condicionPagoPrevista, observaciones: $('#pres-observaciones').value, validez: $('#pres-validez').value, aliasTransferencia: $('#pres-alias').value, datosBancarios: $('#pres-banco').value, origen: presupuestoModuloActivo === 'SEMILLASYA' ? 'SEMILLASYA' : 'MOSTRADOR', tipoOperacion: presupuestoModuloActivo === 'SEMILLASYA' ? 'PRECAMPAÑA' : 'MOSTRADOR' }) });
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

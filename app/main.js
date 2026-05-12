const $ = (s) => document.querySelector(s);
const money = (v) => '$' + Number(v || 0).toFixed(2);

let ventaId = null;
let venta = null;
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
let filtroProductosPresupuesto = '';
let productosPresupuestoVisibles = [];

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });

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
  const precio = money(p.precioPesosCalculado || p.precioVentaPesos || p.precioFinalPesos || 0);
  const stock = Number(p.stock ?? 0);
  return `<div class="item producto-card ${seleccionado ? 'item-seleccionado' : ''}">
    <div class="producto-media">${imagenHtml}</div>
    <div class="producto-info">
      <div class="producto-titulo">${p.nombre || '-'}</div>
      <div class="producto-meta">Categorías: <strong>${(p.categorias || []).map((c) => c.nombre).join(', ') || p.categoria || '-'}</strong></div>
      <div class="producto-meta">Marca: <strong>${p.marca || '-'}</strong> · Unidad: <strong>${p.unidad || '-'}</strong></div>
      <div class="producto-meta">Precio: <strong>${precio}</strong> · Stock: <strong>${stock}</strong></div>
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
    ? personas.slice(0, 20).map((p) => `<div class="item"><strong>${p.nombre || '-'}</strong> | Tel: ${p.telefono || '-'} | CUIT: ${p.cuitDni || '-'} | Mail: ${p.mail || '-'} <button data-persona="${p.id}">Seleccionar cliente</button></div>`).join('')
    : '<div class="item">No se encontraron clientes</div>';
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
    const lista = await buscarProductos(q);
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
  if (!ventaId) {
    const v = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
    ventaId = v.id;
  }
  if (!productoId) return setMsg('Producto inválido');
  try {
    const producto = resultadosProductosVisibles.find((p) => Number(p.id) === Number(productoId)) || productos.find((p) => Number(p.id) === Number(productoId));
    console.log('Producto agregado al carrito:', producto || { id: productoId });
    await api(`/mostrador/ventas/${ventaId}/items`, { method: 'POST', body: JSON.stringify({ productoId, cantidad: 1 }) });
    await refreshVenta();
    await loadCaja();
    await loadResumenCaja();
    $('#buscar-producto').value = '';
    indiceProductoSeleccionado = -1;
    renderProductos();
    $('#buscar-producto').focus();
  } catch (err) {
    console.error('[mostrador][carrito] error al agregar producto', { productoId, error: err });
    setMsg(`Error al agregar producto: ${err.message}`);
  }
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
  const resumen = await api('/caja/resumen' + query);
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
  const cierres = await api('/caja/cierres');
  const container = $('#cierres-caja');

  if (!cierres.length) {
    container.innerHTML = '<div class="item">Sin cierres</div>';
    return;
  }

  container.innerHTML = cierres.map(c => `
    <div class="item">
      <strong>${c.fechaCaja || new Date(c.fecha).toLocaleDateString()}</strong>
      | Total ${money(c.totalGeneral)}
      | Efectivo ${money(c.totalEfectivo)}
      | Transferencia ${money(c.totalTransferencia)}
      | Tarjeta ${money(c.totalTarjeta)}
      | Cta Cte ${money(c.totalCuentaCorriente)}
      <button class="btn-ver-cierre" data-fecha="${c.fechaCaja}">Ver este día</button>
      <button class="btn-eliminar-cierre" data-id="${c.id}">Eliminar cierre de prueba</button>
    </div>
  `).join('');


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
  const ventas = await api('/caja/ventas');
  const ventasRecientesCobradas = await api('/ventas/cobradas-recientes');
  $('#pendientes').innerHTML = ventas.length
    ? ventas.map(v => {
      const tieneCondicionPrevista = Boolean(v.condicionPagoPrevista);
      const bloquePrevisto = tieneCondicionPrevista
        ? `<strong>Previsto: ${v.condicionPagoPrevista}</strong>`
        : '<strong>Previsto: -</strong>';
      return `<div class="item">Venta #${v.id} | ${v.persona?.nombre || 'Consumidor final'} | ${bloquePrevisto} | Total: ${money(v.total)} | <label>Estado cobro real: <select id="estado-cobro-${v.id}">${getEstadoCobroOptions()}</select></label>${v.personaId ? '' : ' <small>Cuenta corriente solo para clientes registrados</small>'} <button class="btn-cobrar" data-id="${v.id}" data-condicion-prevista="${v.condicionPagoPrevista || ''}">Confirmar en caja</button></div>`;
    }).join('')
    : 'No hay ventas pendientes';

  const recientesHtml = ventasRecientesCobradas.length
    ? ventasRecientesCobradas.map(v => `<div class="item">Venta #${v.id} | ${v.persona?.nombre || 'Consumidor final'} | ${money(v.total)} <button class="btn-ver-ticket" data-id="${v.id}">Ver ticket</button></div>`).join('')
    : '<div class="item">Sin ventas cobradas recientes</div>';

  $('#pendientes').innerHTML += `<h3>Ventas cobradas recientes</h3>${recientesHtml}`;

  document.querySelectorAll('.btn-cobrar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ventaId = btn.dataset.id;
      const seleccionCaja = document.querySelector(`#estado-cobro-${ventaId}`)?.value || 'EFECTIVO';
      const mediosPagoPermitidos = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
      const estadoCobroReal = mediosPagoPermitidos.includes(seleccionCaja)
        ? 'PAGADO'
        : seleccionCaja;
      const formaPago = mediosPagoPermitidos.includes(seleccionCaja)
        ? seleccionCaja
        : undefined;
      const medioPagoReal = formaPago;
      const prevista = btn.dataset.condicionPrevista || '';
      const payload = {
        estadoCobroReal,
        medioPagoReal,
        formaPago
      };

      console.error('[caja] payload enviado para confirmar venta', { ventaId, payload, prevista });

      try {
        const res = await fetch(`/caja/cobrar/${ventaId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('Respuesta:', data);

        if (!res.ok) {
          const backendError = data?.error || data?.message || 'Error desconocido';
          alert('Error al cobrar: ' + backendError);
          setMsg(`❌ ${backendError}`, 'error');
          return;
        }

        alert('Venta confirmada en caja');
        setMsg(`✅ Venta #${data.id} confirmada en caja. <button class=\"btn-ver-ticket-inline\" data-id=\"${data.id}\">Ver ticket</button>`);
        await loadCaja();
        const ticketBtn = document.querySelector('.btn-ver-ticket-inline');
        if (ticketBtn) {
          ticketBtn.addEventListener('click', () => {
            window.open(`/ventas/${ticketBtn.dataset.id}/ticket`, '_blank', 'noopener,noreferrer');
          });
        }

      } catch (err) {
        console.error(err);
        alert('Error de conexión');
      }
    });
  });

  document.querySelectorAll('.btn-ver-ticket').forEach(btn => {
    btn.addEventListener('click', () => {
      window.open(`/ventas/${btn.dataset.id}/ticket`, '_blank', 'noopener,noreferrer');
    });
  });
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
    ? lista.map(p => renderProductoCard(p, { accion: 'data-editar-producto', accionLabel: 'Editar', accionClass: 'btn-accion-editar', mostrarCosto: true, proveedoresTexto: ((p.proveedores || []).map(pp => pp.proveedor?.razonSocial).filter(Boolean).join(', ') || '-') , extraBotones: `<button class="btn-accion-precio" data-editar-producto="${p.id}">Cambiar precio</button>` })).join('')
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
  const descuentoPorcentaje = Math.max(0, Number($('#pres-descuento')?.value || 0));
  const importeDescontado = subtotal * (descuentoPorcentaje / 100);
  const ajusteRedondeo = Number($('#pres-ajuste-redondeo')?.value || 0);
  const total = Math.max(0, subtotal - importeDescontado + ajusteRedondeo);
  const descuentoBloque = $('#pres-descuento-bloque');
  const descuentoInput = $('#pres-descuento');
  const msgDescuento = $('#pres-descuento-msg');
  const condicion = $('#pres-condicion-pago-prevista')?.value || '';
  const descuentoHabilitado = presupuestoItems.length > 0 && (presupuestoTipoDestinatario === 'EXISTENTE');
  if (descuentoBloque) descuentoBloque.style.display = presupuestoItems.length ? 'block' : 'none';
  if (descuentoInput) descuentoInput.disabled = !descuentoHabilitado;
  if (msgDescuento) msgDescuento.textContent = (!presupuestoItems.length || descuentoHabilitado)
    ? ''
    : 'Para aplicar descuento debe seleccionar o dar de alta un cliente.';
  if (!descuentoHabilitado && descuentoInput) descuentoInput.value = '0';
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

function armarMensajeWhatsappPresupuesto(presupuestoId, total) {
  return `Hola, te compartimos el presupuesto #${presupuestoId} de Agroquímica San Bernardo. Total: ${money(total)}. Adjuntamos el PDF del presupuesto.`;
}

async function loadPresupuestos() {
  const lista = await api('/presupuestos');
  $('#pres-lista').innerHTML = lista.map(p => {
    const telefonoCliente = normalizarTelefonoWhatsapp(p.persona?.telefono || p.persona?.telefonoPrincipal || '');
    const puedeWhatsapp = Boolean(telefonoCliente);
    return `<div class="item">#${p.id} | ${p.persona?.nombre || p.nombreLibre || (p.tipoDestinatario === 'A_QUIEN_CORRESPONDA' ? 'A quien corresponda' : 'Sin destinatario')} | ${p.estado} | ${money(p.total)} <a class="btn-link" href="/presupuestos/${p.id}/imprimir" target="_blank" rel="noopener noreferrer">Imprimir</a> <button data-pres-pdf="${p.id}">Descargar PDF</button> ${puedeWhatsapp ? `<button data-pres-whatsapp="${p.id}" data-pres-whatsapp-telefono="${telefonoCliente}" data-pres-whatsapp-total="${Number(p.total || 0)}">Enviar WhatsApp</button>` : ''} <button data-pres-aceptar="${p.id}">Aceptar</button> <button data-pres-rechazar="${p.id}">Rechazar</button></div>`;
  }).join('');
}
function renderProveedores() {
  const q = ($('#proveedor-buscar')?.value || '').trim().toLowerCase();
  proveedoresFiltrados = proveedores.filter((pr) => !q || [pr.razonSocial, pr.cuit, pr.contactoComercial].filter(Boolean).join(' ').toLowerCase().includes(q));
  if (proveedorSeleccionadoId && !proveedores.some((pr) => pr.id === proveedorSeleccionadoId)) proveedorSeleccionadoId = null;
  $('#proveedores-lista').innerHTML = proveedoresFiltrados.length
    ? proveedoresFiltrados.map(pr => `<div class="item proveedor-row ${proveedorSeleccionadoId === pr.id ? 'item-seleccionado' : ''}" data-proveedor-select="${pr.id}"><span class="proveedor-meta"><span class="proveedor-id">#${pr.id}</span><b>${pr.razonSocial}</b><small>CUIT: ${pr.cuit || '-'} | Tel: ${pr.telefono || '-'} | Mail: ${pr.mail || '-'}</small></span></div>`).join('')
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
const ROLE_MODULES = {
  ADMINISTRADOR_GENERAL: ['clientes','productos','categorias','presupuestos','ventas','caja','cuenta-corriente','proveedores','stock','remitos','reportes'],
  GERENTE: ['clientes','productos','categorias','presupuestos','ventas','caja','cuenta-corriente','proveedores','stock','remitos','reportes'],
  MOSTRADOR: ['ventas','clientes','productos','categorias','presupuestos','stock'],
  CAJA: ['caja','cuenta-corriente','reportes']
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
    const v = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
    ventaId = v.id;
    await refreshVenta();
    setMsg('Venta creada');
  } catch (e) { setMsg(e.message); }
});

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
    await loadCaja();
    await loadResumenCaja();
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

$('#resultados-clientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-persona]');
  if (!b) return;
  try {
    if (!ventaId) {
      const v = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
      ventaId = v.id;
    }
    console.log('Seleccionado cliente:', b.dataset.persona);
    await api(`/mostrador/ventas/${ventaId}/persona`, { method: 'PUT', body: JSON.stringify({ personaId: Number(b.dataset.persona) }) });
    await refreshVenta();
    setMsg('Cliente seleccionado');
  } catch (err) { setMsg(err.message); }
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
    venta = null;
    $('#venta-activa').textContent = 'Sin venta activa';
    renderCarrito();
    renderClienteActivo();
    await loadCaja();
    await loadResumenCaja();
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

$('#btn-cc-registrar-pago').addEventListener('click', async () => {
  const personaId = cuentaCorrienteMostrada?.personaId;
  if (!personaId) return setMsg('Seleccione un cliente para registrar pago');
  const monto = Number($('#cc-pago-monto').value);
  if (!monto || monto <= 0) return setMsg('Ingrese un monto válido');
  try {
    await api(`/cuenta-corriente/personas/${personaId}/pagos`, { method: 'POST', body: JSON.stringify({ monto }) });
    const cuenta = await cargarCuentaCorrientePersona(personaId);
    renderPanelCuentaCorriente(cuenta);
    await renderCuentaCorrienteClienteActivo();
    setMsg('Pago registrado (HABER) y saldo actualizado');
  } catch (e) { setMsg(e.message); }
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
    await api('/caja/cerrar', { method: 'POST', body: '{}' });
    await loadResumenCaja();
    await loadCierresCaja();
    setMsg('✅ Caja cerrada correctamente');
  } catch (err) {
    setMsg(err.message);
  }
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
  const descuentoPorcentaje = Math.max(0, Number($('#pres-descuento')?.value || 0));
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
    const descuentoValor = Math.max(0, Number($('#pres-descuento').value || 0));
    const ajusteRedondeo = Number($('#pres-ajuste-redondeo').value || 0);
    const condicionPagoPrevista = $('#pres-condicion-pago-prevista').value || null;
    if ((descuentoValor > 0 || ajusteRedondeo !== 0) && !condicionPagoPrevista) throw new Error('Si hay descuento o ajuste de redondeo, debe indicar condicionPagoPrevista');
    const creado = await api('/presupuestos', { method: 'POST', body: JSON.stringify({ tipoDestinatario: presupuestoTipoDestinatario, clienteId: presupuestoTipoDestinatario === 'EXISTENTE' ? presupuestoClienteId : null, nombreLibre: presupuestoTipoDestinatario === 'LIBRE' ? presupuestoNombreLibre : null, items: presupuestoItems.map(({ productoId, cantidad, precioUnitario, descuentoTipo, descuentoValor }) => ({ productoId, cantidad, precioUnitario, descuentoTipo, descuentoValor })), descuentoTipo: 'PORCENTAJE', descuentoValor, ajusteRedondeo, condicionPagoPrevista, observaciones: $('#pres-observaciones').value, validez: $('#pres-validez').value, aliasTransferencia: $('#pres-alias').value, datosBancarios: $('#pres-banco').value }) });
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
    await cargarStockProducto();
    remitoDetalles = [];
    renderRemitoItems();
    setMsg('Remito guardado y stock actualizado');
  } catch (err) { setMsg(err.message); }
});

(async function init() {
  setFechaCajaHoy();
  fechaVentasCobradasSeleccionada = fechaCajaSeleccionada;
  $('#ventas-cobradas-fecha').value = fechaVentasCobradasSeleccionada;
  await loadTipoCambio();
  await loadProveedores();
  await loadProductosAll();
  await loadStockResumen('/stock');
  setModoProducto('AGREGAR');
  renderPresupuestoProductos();
  await loadPresupuestos();
  renderCarrito();
  renderClienteActivo();
  await loadCaja();
  await loadVentasCobradas();
  await loadResumenCaja();
  await loadCierresCaja();
  renderPanelCuentaCorriente(null);
  limpiarFormularioProducto();
  renderRemitoItems();
  $('#buscar-producto').focus();
})();

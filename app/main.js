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
let remitoDetalles = [];
let filtroProductosAdmin = '';
let modoProducto = 'AGREGAR';
let categoriasProducto = [];
let presupuestoClienteId = null;
let presupuestoItems = [];
let filtroProductosPresupuesto = '';
let productosPresupuestoVisibles = [];

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Error ${response.status}`;
    throw new Error(errorMessage);
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


function mostrarErrorBusqueda(containerSelector, error) {
  const container = $(containerSelector);
  if (!container) return;
  container.innerHTML = `<div class="item">Error al buscar: ${error.message}</div>`;
}

async function buscarProductos(query) {
  const q = (query || '').trim();
  console.log('Buscando productos:', q);
  if (!q) return [];
  const res = await fetch(`/productos?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error buscando productos');
  console.log('Resultados productos:', data);
  return (data || []).slice(0, 8);
}

async function buscarPersonas(query) {
  const q = (query || '').trim();
  console.log(`Buscando clientes: ${q}`);
  if (!q) return [];
  return api('/personas/buscar?q=' + encodeURIComponent(q));
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
      ? lista.map((p, idx) => `<div class="item ${idx === indiceProductoSeleccionado ? 'item-seleccionado' : ''}">${p.nombre} | ${money(p.precioPesosCalculado)} | Stock ${p.stock} <button data-producto="${p.id}">Agregar</button></div>`).join('')
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
    setMsg(err.message);
  }
}

function renderCarrito() {
  const items = venta?.items || [];
  $('#carrito').innerHTML = items.length
    ? items.map(i => `<tr><td>${i.producto.nombre}</td><td>${money(i.precioUnitario)}</td><td><button data-accion="menos" data-producto="${i.productoId}">-</button> ${i.cantidad} <button data-accion="mas" data-producto="${i.productoId}">+</button></td><td>${money(i.subtotal)}</td></tr>`).join('')
    : '<tr><td colspan="4">Sin productos</td></tr>';

  const subtotal = Number((venta?.items || []).reduce((acc, i) => acc + Number(i.subtotal || 0), 0));
  const descuento = Math.max(0, Number($('#descuento').value || 0));
  const descuentoTipo = $('#descuento-tipo').value;
  const descuentoAplicado = descuentoTipo === 'PORCENTAJE' ? (subtotal * (descuento / 100)) : descuento;
  const final = Math.max(0, subtotal - descuentoAplicado);
  $('#subtotal').textContent = money(subtotal);
  $('#total').textContent = money(subtotal);
  $('#total-final').textContent = money(final);
}


function aplicarEstadoSaldo(selector, saldo) {
  const el = $(selector);
  if (!el) return;
  el.classList.remove('estado-deuda', 'estado-cero');
  el.classList.add(Number(saldo) > 0 ? 'estado-deuda' : 'estado-cero');
}

function renderClienteActivo() {
  const p = venta?.persona;
  $('#cliente-activo').textContent = p ? `${p.nombre} | ${p.telefono || '-'} | ${p.cuitDni || '-'}` : 'Consumidor final';
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
    ? `${cuenta.persona.nombre} | ${cuenta.persona.telefono} | ${cuenta.persona.cuitDni || '-'}`
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

function getMediosPagoOptions(ventaCaja) {
  const mediosBase = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
  if (ventaCaja?.personaId) mediosBase.push('CUENTA_CORRIENTE');
  return mediosBase.map(m => `<option value="${m}">${m}</option>`).join('');
}

async function loadCaja() {
  const ventas = await api('/caja/ventas');
  const ventasRecientesCobradas = await api('/ventas/cobradas-recientes');
  $('#pendientes').innerHTML = ventas.length
    ? ventas.map(v => `<div class="item">Venta #${v.id} | ${v.persona?.nombre || 'Consumidor final'} | ${money(v.total)} <select id="pago-${v.id}">${getMediosPagoOptions(v)}</select>${v.personaId ? '' : ' <small>Cuenta corriente solo para clientes registrados</small>'} <button class="btn-cobrar" data-id="${v.id}">Cobrar</button></div>`).join('')
    : 'No hay ventas pendientes';

  const recientesHtml = ventasRecientesCobradas.length
    ? ventasRecientesCobradas.map(v => `<div class="item">Venta #${v.id} | ${v.persona?.nombre || 'Consumidor final'} | ${money(v.total)} <button class="btn-ver-ticket" data-id="${v.id}">Ver ticket</button></div>`).join('')
    : '<div class="item">Sin ventas cobradas recientes</div>';

  $('#pendientes').innerHTML += `<h3>Ventas cobradas recientes</h3>${recientesHtml}`;

  document.querySelectorAll('.btn-cobrar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ventaId = btn.dataset.id;
      const select = document.querySelector(`#pago-${ventaId}`);
      const formaPago = select.value;

      console.log('Cobrando venta:', ventaId, formaPago);

      try {
        const res = await fetch(`/caja/cobrar/${ventaId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formaPago })
        });

        const data = await res.json();
        console.log('Respuesta:', data);

        if (!res.ok) {
          alert('Error al cobrar: ' + data.error);
          return;
        }

        alert('Venta cobrada');
        setMsg(`✅ Venta #${data.id} cobrada. <button class="btn-ver-ticket-inline" data-id="${data.id}">Ver ticket</button>`);
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
  $('#prod-categoria').value = '';
  $('#prod-categoria-nueva').value = '';
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

function renderCategoriasProducto(selected = '') {
  const sel = $('#prod-categoria');
  if (!sel) return;
  const opciones = categoriasProducto.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.innerHTML = `<option value="">Seleccione categoría</option>${opciones}`;
  if (selected) sel.value = selected;
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
  const lista = productos.filter(p => !f || p.nombre.toLowerCase().includes(f) || (p.categoria || '').toLowerCase().includes(f) || (p.marca || '').toLowerCase().includes(f));
  container.innerHTML = lista.length
    ? lista.map(p => `<div class="item">${p.nombre} | ${p.categoria} | ${p.marca || '-'} | ${p.unidad || '-'} | Prov: ${(p.proveedores || []).map(pp => pp.proveedor?.nombre).filter(Boolean).join(', ') || '-'} | Compra ${p.monedaCompra || p.monedaCosto} ${money(p.costoCompra ?? p.costoBase)} | Convertido ${money(p.costoCompraPesos)} | Final ${money(p.precioVentaPesos || p.precioFinalPesos)} <button data-editar-producto="${p.id}">Editar</button></div>`).join('')
    : '<div class="item">Sin productos</div>';
}
function renderPresupuestoProductos() {
  const origen = productosPresupuestoVisibles.length ? productosPresupuestoVisibles : productos;
  const lista = origen
    .filter(p => !filtroProductosPresupuesto || p.nombre.toLowerCase().includes(filtroProductosPresupuesto))
    .slice(0, 8);
  presupuestoItems = presupuestoItems.map((it) => {
    const base = Number(it.precioUnitario || 0) * Number(it.cantidad || 0);
    const desc = it.descuentoTipo === 'PORCENTAJE' ? base * (Number(it.descuentoValor || 0) / 100) : Number(it.descuentoValor || 0);
    return { ...it, subtotal: Math.max(0, base - desc) };
  });
  const subtotal = presupuestoItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  const descuentoGeneral = Math.max(0, Number($('#pres-descuento')?.value || 0));
  const total = Math.max(0, subtotal - descuentoGeneral);
  $('#pres-total').textContent = money(total);

  const resultados = lista.map(p => `<div class="item">${p.nombre} | ${money(p.precioPesosCalculado || p.precioFinalPesos)} | Stock ${p.stock} <button data-pres-agregar="${p.id}">Agregar</button></div>`).join('');
  const tabla = presupuestoItems.length
    ? `<table style="width:100%;margin-top:8px;"><thead><tr><th>Producto</th><th>Precio unitario</th><th>Cantidad</th><th>Desc %</th><th>Desc $</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>${
      presupuestoItems.map(it => `<tr>
        <td>${it.nombre}</td>
        <td>${money(it.precioUnitario)}</td>
        <td><button data-pres-menos="${it.productoId}">-</button> ${it.cantidad} <button data-pres-mas="${it.productoId}">+</button></td>
        <td><input type="number" min="0" step="0.01" data-pres-desc-pct="${it.productoId}" value="${it.descuentoTipo === 'PORCENTAJE' ? it.descuentoValor : 0}" /></td>
        <td><input type="number" min="0" step="0.01" data-pres-desc-monto="${it.productoId}" value="${it.descuentoTipo === 'MONTO' ? it.descuentoValor : 0}" /></td>
        <td>${money(it.subtotal)}</td>
        <td><button data-pres-quitar="${it.productoId}">Quitar</button></td>
      </tr>`).join('')
    }</tbody></table>`
    : '<div class="item">Debe agregar al menos un producto</div>';
  $('#pres-productos').innerHTML = `${resultados || '<div class="item">Sin productos encontrados</div>'}${tabla}`;
}
async function loadPresupuestos() {
  const lista = await api('/presupuestos');
  $('#pres-lista').innerHTML = lista.map(p => `<div class="item">#${p.id} | ${p.persona?.nombre} | ${p.estado} | ${money(p.total)} <button data-pres-imprimir="${p.id}">Imprimir</button> <button data-pres-aceptar="${p.id}">Aceptar</button> <button data-pres-rechazar="${p.id}">Rechazar</button></div>`).join('');
}
function renderProveedores() {
  $('#proveedores-lista').innerHTML = proveedores.length
    ? proveedores.map(pr => `<div class="item">${pr.nombre} | ${pr.telefono || '-'} | ${pr.cuit || '-'} </div>`).join('')
    : '<div class="item">Sin proveedores</div>';
  const opt = proveedores.map(pr => `<option value="${pr.id}">${pr.nombre}</option>`);
  const sel = $('#prod-proveedor');
  if (sel) sel.innerHTML = opt.join('');
  const remSel = $('#remito-proveedor');
  if (remSel) renderProveedoresRemito();
}
async function renderProveedoresRemito() {
  const remSel = $('#remito-proveedor');
  if (!remSel) return;
  const q = ($('#remito-buscar-proveedor')?.value || '').trim();
  try {
    const lista = q ? await buscarProveedores(q) : proveedores;
    remSel.innerHTML = '<option value="">Seleccione proveedor</option>' + lista.slice(0, 8).map(pr => `<option value="${pr.id}">${pr.nombre}${pr.cuit ? ` (${pr.cuit})` : ''}</option>`).join('');
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
  $('#stock-actual').textContent = data.stockActual;
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
  categoriasProducto = await api('/productos/categorias');
  renderCategoriasProducto();
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

async function buscarClienteMostrador() {
  const q = $('#buscar-cliente').value.trim();
  if (!q) { $('#resultados-clientes').innerHTML = '<div class="item">Sin resultados</div>'; return; }
  try {
    const personas = await buscarPersonas(q);
    $('#resultados-clientes').innerHTML = personas.length
      ? personas.slice(0, 8).map(p => `<div class="item">${p.nombre} | ${p.telefono || '-'} | ${p.cuitDni || '-'} <button data-persona="${p.id}">Seleccionar cliente</button></div>`).join('')
      : '<div class="item">Sin resultados <button id="btn-crear-desde-busqueda">Crear cliente</button></div>';
  } catch (error) { mostrarErrorBusqueda('#resultados-clientes', error); }
}

$('#btn-buscar-cliente').addEventListener('click', buscarClienteMostrador);
$('#buscar-cliente').addEventListener('input', buscarClienteMostrador);

$('#resultados-clientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-persona]');
  if (!b || !ventaId) return;
  try {
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
  if (!ventaId) return;
  const nombre = $('#nuevo-nombre').value.trim();
  if (!nombre) return setMsg('Nombre obligatorio');
  const telefono = $('#nuevo-telefono').value.trim();
  const cuitDni = $('#nuevo-cuit').value.trim();
  try {
    const persona = await api('/personas', { method: 'POST', body: JSON.stringify({ nombre, telefono, cuitDni, tipo: 'CLIENTE' }) });
    console.log('Seleccionado cliente:', persona.id);
    await api(`/mostrador/ventas/${ventaId}/persona`, { method: 'PUT', body: JSON.stringify({ personaId: persona.id }) });
    await refreshVenta();
    setMsg('Cliente creado y seleccionado');
  } catch (err) { setMsg(err.message); }
});

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
    const descuentoTipo = $('#descuento-tipo').value;
    if (descuentoValor > 0 && !venta?.personaId) {
      return setMsg('Para aplicar descuento, primero debe dar de alta al cliente.');
    }
    const ventaCerrada = await api(`/mostrador/ventas/${ventaId}/cerrar`, { method: 'POST', body: JSON.stringify({ descuentoTipo, descuentoValor }) });
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
    $('#descuento-tipo').value = 'MONTO';
    setMsg(`✅ Venta #${ventaCerrada.id} cerrada correctamente y enviada a caja`);
  } catch (err) {
    console.log('[cerrar-venta] error backend', err);
    setMsg(err.message);
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
      ? personas.map(p => `<div class="item">${p.nombre} | ${p.telefono} | ${p.cuitDni || '-'} <button data-cc-persona="${p.id}">Ver cuenta</button></div>`).join('')
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
    const categoriaSeleccionada = $('#prod-categoria').value.trim();
    const categoriaNueva = $('#prod-categoria-nueva').value.trim();
    const categoria = categoriaSeleccionada || categoriaNueva;

    if (!nombre) return setMsg('El nombre del producto es obligatorio', 'error');
    if (!categoria) return setMsg('La categoría del producto es obligatoria', 'error');

    const body = {
      nombre,
      categoria,
      marca: $('#prod-marca').value.trim(),
      unidad: $('#prod-unidad').value.trim(),
      stock: Number($('#prod-stock').value || 0),
      monedaCompra: normalizarMonedaProducto($('#prod-moneda').value),
      costoCompraOriginal: Number($('#prod-costo').value || 0),
      costoCompra: Number($('#prod-costo').value || 0),
      ivaPorcentaje: Number($('#prod-iva').value || 0),
      fletePorcentaje: Number($('#prod-flete').value || 0),
      margenGananciaPorcentaje: Number($('#prod-ganancia').value || 0),
      proveedorIds: Array.from($('#prod-proveedor').selectedOptions || []).map(o => Number(o.value)).filter(Boolean)
    };

    const id = $('#prod-id').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/productos/${id}` : '/productos';
    console.log('[producto-guardado][frontend] iniciando', { method, url, body, id: id || null });

    btnGuardar.disabled = true;
    setMsg('Guardando...', 'info');

    const productoGuardado = await api(url, { method, body: JSON.stringify(body) });
    console.log('[producto-guardado][frontend] respuesta ok', productoGuardado);

    if (categoriaNueva && !categoriasProducto.includes(categoriaNueva)) {
      categoriasProducto.push(categoriaNueva);
      categoriasProducto = categoriasProducto.sort((a, b) => a.localeCompare(b));
    }

    await loadProductosAll();
    limpiarFormularioProducto();
    setModoProducto('AGREGAR');
    setMsg('✅ Producto guardado', 'success');
  } catch (err) {
    console.error('[producto-guardado][frontend] error', err);
    setMsg(`❌ No se pudo guardar el producto: ${err.message}`, 'error');
  } finally {
    btnGuardar.disabled = false;
  }
});

$('#btn-nuevo-producto').addEventListener('click', limpiarFormularioProducto);
$('#btn-modo-agregar-producto').addEventListener('click', () => setModoProducto('AGREGAR'));
$('#btn-modo-editar-producto').addEventListener('click', () => setModoProducto('EDITAR'));
$('#btn-crear-categoria').addEventListener('click', () => {
  const nueva = ($('#prod-categoria-nueva').value || '').trim();
  if (!nueva) return;
  if (!categoriasProducto.includes(nueva)) categoriasProducto.push(nueva);
  categoriasProducto = categoriasProducto.sort((a,b)=>a.localeCompare(b));
  renderCategoriasProducto(nueva);
  $('#prod-categoria-nueva').value = '';
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
      ? lista.map((p) => `<div class="item">${p.nombre} | ${money(p.precioPesosCalculado || p.precioFinalPesos || 0)} | Stock ${p.stock ?? 0} <button data-editar-producto="${p.id}">Editar</button></div>`).join('')
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
  $('#prod-categoria').value = p.categoria;
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
      .map(p => `<div class="item">${p.nombre} <button data-pres-cliente="${p.id}" data-pres-nombre="${p.nombre}">Seleccionar</button></div>`).join('') || '<div class="item">Sin resultados</div>';
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
$('#pres-productos').addEventListener('input', (e) => {
  const pctInput = e.target.closest('input[data-pres-desc-pct]');
  const montoInput = e.target.closest('input[data-pres-desc-monto]');
  const id = Number(pctInput?.dataset.presDescPct || montoInput?.dataset.presDescMonto || 0);
  if (!id) return;
  const it = presupuestoItems.find(x => x.productoId === id);
  if (!it) return;
  if (pctInput) {
    it.descuentoTipo = Number(pctInput.value || 0) > 0 ? 'PORCENTAJE' : 'NINGUNO';
    it.descuentoValor = Math.max(0, Number(pctInput.value || 0));
  }
  if (montoInput) {
    it.descuentoTipo = Number(montoInput.value || 0) > 0 ? 'MONTO' : 'NINGUNO';
    it.descuentoValor = Math.max(0, Number(montoInput.value || 0));
  }
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
$('#pres-guardar').addEventListener('click', async () => {
  try {
    if (!presupuestoClienteId) throw new Error('Debe seleccionar un cliente para presupuestar');
    if (!presupuestoItems.length) throw new Error('Debe agregar al menos un producto');
    await api('/presupuestos', { method: 'POST', body: JSON.stringify({ clienteId: presupuestoClienteId, items: presupuestoItems.map(({ productoId, cantidad, precioUnitario, descuentoTipo, descuentoValor }) => ({ productoId, cantidad, precioUnitario, descuentoTipo, descuentoValor })), descuentoTipo: 'MONTO', descuentoValor: Number($('#pres-descuento').value || 0), observaciones: $('#pres-observaciones').value, validez: $('#pres-validez').value, aliasTransferencia: $('#pres-alias').value, datosBancarios: $('#pres-banco').value }) });
    presupuestoItems = [];
    presupuestoClienteId = null;
    $('#pres-cliente-activo').textContent = 'Ninguno';
    renderPresupuestoProductos();
    await loadPresupuestos();
    setMsg('Presupuesto guardado');
  } catch (err) { setMsg(err.message); }
});
$('#pres-btn-crear-cliente').addEventListener('click', async () => {
  try {
    const nombre = $('#pres-crear-nombre').value.trim();
    if (!nombre) throw new Error('Nombre de cliente obligatorio');
    const nuevo = await api('/personas', {
      method: 'POST',
      body: JSON.stringify({
        nombre,
        telefono: $('#pres-crear-telefono').value.trim() || null,
        cuitDni: $('#pres-crear-cuitdni').value.trim() || null,
        tipo: 'CLIENTE'
      })
    });
    presupuestoClienteId = nuevo.id;
    $('#pres-cliente-activo').textContent = nuevo.nombre;
    setMsg('Cliente creado y seleccionado');
  } catch (err) { setMsg(err.message); }
});
$('#pres-lista').addEventListener('click', async (e) => {
  const imp = e.target.closest('button[data-pres-imprimir]');
  const ac = e.target.closest('button[data-pres-aceptar]');
  const re = e.target.closest('button[data-pres-rechazar]');
  if (imp) window.open(`/presupuestos/${imp.dataset.presImprimir}/imprimir`, '_blank', 'noopener,noreferrer');
  if (ac) await api(`/presupuestos/${ac.dataset.presAceptar}/aceptar`, { method: 'POST', body: JSON.stringify({ estadoVenta: 'PENDIENTE_CAJA' }) });
  if (re) await api(`/presupuestos/${re.dataset.presRechazar}/rechazar`, { method: 'POST', body: '{}' });
  if (ac || re) await loadPresupuestos();
});

$('#btn-crear-proveedor').addEventListener('click', async () => {
  try {
    await api('/proveedores', {
      method: 'POST',
      body: JSON.stringify({
        nombre: $('#prov-nombre').value.trim(),
        telefono: $('#prov-telefono').value.trim() || null,
        cuit: $('#prov-cuit').value.trim() || null,
        observaciones: $('#prov-observaciones').value.trim() || null
      })
    });
    await loadProveedores();
    setMsg('Proveedor creado');
  } catch (err) { setMsg(err.message); }
});

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
    const nombre = prompt('Nombre del proveedor (obligatorio):')?.trim();
    if (!nombre) return setMsg('Nombre obligatorio');
    const telefono = prompt('Teléfono (opcional):')?.trim() || null;
    const cuit = prompt('CUIT (opcional):')?.trim() || null;
    const observaciones = prompt('Observaciones (opcional):')?.trim() || null;
    const creado = await api('/proveedores', { method: 'POST', body: JSON.stringify({ nombre, telefono, cuit, observaciones }) });
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

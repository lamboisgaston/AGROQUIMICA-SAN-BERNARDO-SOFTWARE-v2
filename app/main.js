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

function setMsg(text) { $('#msg').innerHTML = text; }

function logFlujo(paso, payload) {
  if (payload !== undefined) {
    console.log(`[flujo-venta] ${paso}`, payload);
    return;
  }
  console.log(`[flujo-venta] ${paso}`);
}

function renderProductos() {
  const q = $('#buscar-producto').value.trim().toLowerCase();
  const lista = productos.filter(p => p.stock > 0 && (!q || p.nombre.toLowerCase().includes(q))).slice(0, 20);
  resultadosProductosVisibles = lista;
  if (lista.length === 0) indiceProductoSeleccionado = -1;
  if (lista.length > 0 && (indiceProductoSeleccionado < 0 || indiceProductoSeleccionado >= lista.length)) {
    indiceProductoSeleccionado = 0;
  }

  $('#resultados-productos').innerHTML = lista.length
    ? lista.map((p, idx) => `<div class="item ${idx === indiceProductoSeleccionado ? 'item-seleccionado' : ''}">${p.nombre} | ${money(p.precioPesosCalculado)} | Stock ${p.stock} <button data-producto="${p.id}">Agregar</button></div>`).join('')
    : '<div class="item">Sin resultados</div>';
}

async function agregarProductoAlCarrito(productoId) {
  if (!ventaId) return setMsg('Debe crear una venta');
  if (!productoId) return setMsg('Producto inválido');
  try {
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
  $('#cliente-activo').textContent = p ? `${p.nombre} | ${p.telefono} | ${p.cuitDni || '-'}` : 'Consumidor final';
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
    await agregarProductoAlCarrito(Number(seleccionado.id));
  }
});

$('#resultados-productos').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-producto]');
  if (!b) return;
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

$('#btn-buscar-cliente').addEventListener('click', async () => {
  const q = $('#buscar-cliente').value.trim();
  if (!q) return;
  try {
    const personas = await api('/personas/buscar?q=' + encodeURIComponent(q));
    $('#resultados-clientes').innerHTML = personas.length
      ? personas.map(p => `<div class="item">${p.nombre} | ${p.telefono} | ${p.cuitDni || '-'} <button data-persona="${p.id}">Seleccionar</button></div>`).join('')
      : '<div class="item">Sin resultados</div>';
  } catch (e) { setMsg(e.message); }
});

$('#resultados-clientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-persona]');
  if (!b || !ventaId) return;
  try {
    await api(`/mostrador/ventas/${ventaId}/persona`, { method: 'PUT', body: JSON.stringify({ personaId: Number(b.dataset.persona) }) });
    await refreshVenta();
    setMsg('Cliente seleccionado');
  } catch (err) { setMsg(err.message); }
});

$('#btn-crear-cliente').addEventListener('click', async () => {
  if (!ventaId) return;
  const nombre = $('#nuevo-nombre').value.trim();
  if (!nombre) return setMsg('Nombre obligatorio');
  const telefono = $('#nuevo-telefono').value.trim() || 'N/D';
  const cuitDni = $('#nuevo-cuit').value.trim();
  try {
    const persona = await api('/personas', { method: 'POST', body: JSON.stringify({ nombre, telefono, cuitDni, tipo: 'CLIENTE' }) });
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

(async function init() {
  setFechaCajaHoy();
  fechaVentasCobradasSeleccionada = fechaCajaSeleccionada;
  $('#ventas-cobradas-fecha').value = fechaVentasCobradasSeleccionada;
  productos = await api('/productos');
  renderProductos();
  renderCarrito();
  renderClienteActivo();
  await loadCaja();
  await loadVentasCobradas();
  await loadResumenCaja();
  await loadCierresCaja();
  renderPanelCuentaCorriente(null);
  $('#buscar-producto').focus();
})();

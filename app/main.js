const $ = (s) => document.querySelector(s);
const money = (v) => '$' + Number(v || 0).toFixed(2);

let ventaId = null;
let venta = null;
let productos = [];
let cuentaCorrienteMostrada = null;

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error');
  return data;
}

function setMsg(text) { $('#msg').textContent = text; }

function renderProductos() {
  const q = $('#buscar-producto').value.trim().toLowerCase();
  const lista = productos.filter(p => p.stock > 0 && (!q || p.nombre.toLowerCase().includes(q))).slice(0, 20);
  $('#resultados-productos').innerHTML = lista.length
    ? lista.map(p => `<div class="item">${p.nombre} | ${money(p.precioPesosCalculado)} | Stock ${p.stock} <button data-producto="${p.id}">Agregar</button></div>`).join('')
    : '<div class="item">Sin resultados</div>';
}

function renderCarrito() {
  const items = venta?.items || [];
  $('#carrito').innerHTML = items.length
    ? items.map(i => `<tr><td>${i.producto.nombre}</td><td>${money(i.precioUnitario)}</td><td><button data-accion="menos" data-producto="${i.productoId}">-</button> ${i.cantidad} <button data-accion="mas" data-producto="${i.productoId}">+</button></td><td>${money(i.subtotal)}</td></tr>`).join('')
    : '<tr><td colspan="4">Sin productos</td></tr>';

  const total = Number(venta?.total || 0);
  const descuento = Math.max(0, Number($('#descuento').value || 0));
  const final = Math.max(0, total - descuento);
  $('#total').textContent = money(total);
  $('#total-final').textContent = money(final);
}

function renderClienteActivo() {
  const p = venta?.persona;
  $('#cliente-activo').textContent = p ? `${p.nombre} | ${p.telefono} | ${p.cuitDni || '-'}` : 'Ninguno';
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
    return;
  }
  try {
    const cuenta = await cargarCuentaCorrientePersona(personaId);
    $('#cliente-saldo').textContent = money(cuenta.saldo);
    $('#cliente-deuda').textContent = money(cuenta.saldo);
  } catch (e) {
    setMsg(e.message);
  }
}

function renderPanelCuentaCorriente(cuenta) {
  cuentaCorrienteMostrada = cuenta;
  $('#cc-cliente-activo').textContent = cuenta?.persona
    ? `${cuenta.persona.nombre} | ${cuenta.persona.telefono} | ${cuenta.persona.cuitDni || '-'}`
    : 'Ninguno';
  $('#cc-saldo').textContent = money(cuenta?.saldo || 0);
  $('#cc-movimientos').innerHTML = (cuenta?.movimientos || []).length
    ? cuenta.movimientos.map(m => `<div class="item">${new Date(m.createdAt).toLocaleString()} | ${m.tipo === 'DEBITO' ? 'DEBE' : 'HABER'} | ${money(m.monto)} | ${m.descripcion || '-'}</div>`).join('')
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

async function loadCaja() {
  const ventas = await api('/caja/ventas');
  $('#pendientes').innerHTML = ventas.length
    ? ventas.map(v => `<div class="item">Venta #${v.id} | ${v.persona?.nombre || 'Sin cliente'} | ${money(v.total)} <select id="medio-${v.id}"><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option><option>CUENTA_CORRIENTE</option></select> <button data-cobrar="${v.id}">Cobrar</button></div>`).join('')
    : 'No hay ventas pendientes';
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

$('#resultados-productos').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-producto]');
  if (!b || !ventaId) return;
  try {
    await api(`/mostrador/ventas/${ventaId}/items`, { method: 'POST', body: JSON.stringify({ productoId: Number(b.dataset.producto), cantidad: 1 }) });
    await refreshVenta();
    await loadCaja();
  } catch (err) { setMsg(err.message); }
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
  } catch (err) { setMsg(err.message); }
});

$('#descuento').addEventListener('input', renderCarrito);

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
  if (!ventaId) return setMsg('Primero cree una venta');
  if (!venta?.personaId) return setMsg('No se puede cerrar sin cliente');
  try {
    await api(`/mostrador/ventas/${ventaId}/cerrar`, { method: 'POST', body: '{}' });
    ventaId = null;
    venta = null;
    $('#venta-activa').textContent = 'Sin venta activa';
    renderCarrito();
    renderClienteActivo();
    await loadCaja();
    setMsg('Venta cerrada y enviada a caja');
  } catch (err) { setMsg(err.message); }
});

$('#pendientes').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-cobrar]');
  if (!b) return;
  const id = Number(b.dataset.cobrar);
  const medioPago = document.getElementById(`medio-${id}`).value;
  try {
    await api(`/caja/cobrar/${id}`, { method: 'POST', body: JSON.stringify({ medioPago }) });
    await loadCaja();
    setMsg(medioPago === 'CUENTA_CORRIENTE' ? 'Venta enviada a cuenta corriente (DEBE registrado)' : 'Venta cobrada');
  } catch (err) { setMsg(err.message); }
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

(async function init() {
  productos = await api('/productos');
  renderProductos();
  renderCarrito();
  renderClienteActivo();
  await loadCaja();
  renderPanelCuentaCorriente(null);
})();

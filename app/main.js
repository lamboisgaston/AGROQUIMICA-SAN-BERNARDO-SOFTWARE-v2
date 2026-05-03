const $buscar = document.querySelector('#buscar-cliente');
const $resultados = document.querySelector('#resultados');
const $btnCrear = document.querySelector('#btn-crear');
const $formCrear = document.querySelector('#form-crear');
const $msg = document.querySelector('#msg');
const $btnCerrarVenta = document.querySelector('#btn-cerrar-venta');

const $clienteVacio = document.querySelector('#cliente-activo-vacio');
const $clienteData = document.querySelector('#cliente-activo-data');
const $clienteNombre = document.querySelector('[data-cliente="nombre"]');
const $clienteTelefono = document.querySelector('[data-cliente="telefono"]');
const $clienteCuitDni = document.querySelector('[data-cliente="cuitDni"]');

let clienteSeleccionado = null;
let debounceTimer;

function mostrarCliente(cliente) {
  clienteSeleccionado = cliente;
  $clienteVacio.classList.add('hidden');
  $clienteData.classList.remove('hidden');
  $clienteNombre.textContent = cliente.nombre || '-';
  $clienteTelefono.textContent = cliente.telefono || '-';
  $clienteCuitDni.textContent = cliente.cuitDni || '-';
  $msg.textContent = 'Cliente seleccionado correctamente';
}

function renderResultados(personas, query) {
  $resultados.innerHTML = '';

  if (!query || query.length < 2) {
    $btnCrear.classList.add('hidden');
    return;
  }

  if (personas.length === 0) {
    $resultados.innerHTML = '<p>Sin resultados.</p>';
    $btnCrear.classList.remove('hidden');
    return;
  }

  $btnCrear.classList.add('hidden');
  personas.slice(0, 6).forEach(persona => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'resultado';
    item.innerHTML = `
      <div><b>${persona.nombre || '-'}</b></div>
      <div>Tel: ${persona.telefono || '-'}</div>
      <div>CUIT/DNI: ${persona.cuitDni || '-'}</div>
    `;
    item.addEventListener('click', () => mostrarCliente(persona));
    $resultados.appendChild(item);
  });
}

async function buscarClientes(query) {
  const res = await fetch(`/personas/buscar?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('No se pudo buscar clientes');
  return res.json();
}

$buscar.addEventListener('input', () => {
  const query = $buscar.value.trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const personas = await buscarClientes(query);
      renderResultados(personas, query);
    } catch (error) {
      $msg.textContent = error.message;
    }
  }, 250);
});

$btnCrear.addEventListener('click', () => {
  $formCrear.classList.remove('hidden');
  document.querySelector('#nuevo-nombre').focus();
});

$formCrear.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.querySelector('#nuevo-nombre').value.trim();
  const telefono = document.querySelector('#nuevo-telefono').value.trim();
  const cuitDni = document.querySelector('#nuevo-cuitdni').value.trim();

  try {
    const res = await fetch('/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono: telefono || 'N/D', cuitDni: cuitDni || undefined })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo crear cliente');

    mostrarCliente(data);
    $formCrear.reset();
    $formCrear.classList.add('hidden');
    $btnCrear.classList.add('hidden');
    $resultados.innerHTML = '';
  } catch (error) {
    $msg.textContent = error.message;
  }
});

$btnCerrarVenta.addEventListener('click', async () => {
  if (!clienteSeleccionado) {
    $msg.textContent = 'Debe seleccionar un cliente antes de cerrar la venta';
    return;
  }

  $msg.textContent = 'Cliente validado. Ya se puede cerrar venta.';
});

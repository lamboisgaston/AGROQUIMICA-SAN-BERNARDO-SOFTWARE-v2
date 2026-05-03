const express = require('express');
const { PrismaClient, EstadoVenta } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const usuarios = [
  { usuario: 'admin', password: 'admin123', rol: 'ADMINISTRADOR_GENERAL' },
  { usuario: 'gerente', password: 'gerente123', rol: 'GERENTE' },
  { usuario: 'operador', password: 'operador123', rol: 'MOSTRADOR' }
];

app.get('/', (req, res) => {
  res.json({ mensaje: 'Backend Agroquímica San Bernardo funcionando' });
});

app.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const encontrado = usuarios.find(u => u.usuario === usuario && u.password === password);

  if (!encontrado) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  res.json({
    mensaje: 'Login correcto',
    usuario: encontrado.usuario,
    rol: encontrado.rol
  });
});

async function obtenerTipoCambioActual() {
  const config = await prisma.configuracionGlobal.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tipoCambioActual: 1 }
  });
  return config.tipoCambioActual;
}

function mapearProductoConPrecioPesos(producto, tipoCambioActual) {
  return {
    ...producto,
    precioPesosCalculado: producto.precioUsd * tipoCambioActual
  };
}

app.get('/productos', async (req, res) => {
  const tipoCambioActual = await obtenerTipoCambioActual();
  const productos = await prisma.producto.findMany();
  res.json(productos.map(p => mapearProductoConPrecioPesos(p, tipoCambioActual)));
});

app.post('/productos', async (req, res) => {
  const producto = await prisma.producto.create({ data: req.body });
  const tipoCambioActual = await obtenerTipoCambioActual();
  res.json(mapearProductoConPrecioPesos(producto, tipoCambioActual));
});

app.get('/config/tipo-cambio', async (req, res) => {
  const tipoCambioActual = await obtenerTipoCambioActual();
  res.json({ tipoCambioActual });
});

app.put('/config/tipo-cambio', async (req, res) => {
  const { tipoCambioActual } = req.body;
  if (typeof tipoCambioActual !== 'number' || tipoCambioActual <= 0) {
    return res.status(400).json({ error: 'tipoCambioActual (>0) es obligatorio' });
  }

  const config = await prisma.configuracionGlobal.upsert({
    where: { id: 1 },
    update: { tipoCambioActual },
    create: { id: 1, tipoCambioActual }
  });

  res.json({ tipoCambioActual: config.tipoCambioActual });
});

app.get('/personas', async (req, res) => {
  const personas = await prisma.persona.findMany();
  res.json(personas);
});

app.post('/personas', async (req, res) => {
  const persona = await prisma.persona.create({ data: req.body });
  res.json(persona);
});

app.post('/mostrador/ventas', async (req, res) => {
  const venta = await prisma.venta.create({ data: {} });
  res.status(201).json(venta);
});

app.get('/mostrador/ventas', async (req, res) => {
  const estado = req.query.estado;
  const ventas = await prisma.venta.findMany({
    where: estado ? { estado } : undefined,
    include: { persona: true, items: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(ventas);
});

app.get('/mostrador/ventas/:id', async (req, res) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.id) },
    include: { persona: true, items: { include: { producto: true } } }
  });

  if (!venta) {
    return res.status(404).json({ error: 'Venta no encontrada' });
  }

  res.json(venta);
});

app.post('/mostrador/ventas/:id/items', async (req, res) => {
  const ventaId = Number(req.params.id);
  const { productoId, cantidad } = req.body;

  if (!productoId || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'productoId y cantidad (>0) son obligatorios' });
  }

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se pueden editar ventas en BORRADOR' });
  }

  const producto = await prisma.producto.findUnique({ where: { id: Number(productoId) } });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  const tipoCambioActual = await obtenerTipoCambioActual();
  const precioPesosCalculado = producto.precioUsd * tipoCambioActual;

  const existente = await prisma.ventaItem.findUnique({
    where: { ventaId_productoId: { ventaId, productoId: Number(productoId) } }
  });

  const cantidadFinal = (existente?.cantidad || 0) + Number(cantidad);
  if (cantidadFinal > producto.stock) {
    return res.status(400).json({ error: 'Stock insuficiente para ese producto' });
  }

  await prisma.ventaItem.upsert({
    where: { ventaId_productoId: { ventaId, productoId: Number(productoId) } },
    create: {
      ventaId,
      productoId: Number(productoId),
      cantidad: Number(cantidad),
      precioUnitario: precioPesosCalculado,
      subtotal: precioPesosCalculado * Number(cantidad)
    },
    update: {
      cantidad: cantidadFinal,
      precioUnitario: precioPesosCalculado,
      subtotal: precioPesosCalculado * cantidadFinal
    }
  });

  const items = await prisma.ventaItem.findMany({ where: { ventaId } });
  const total = items.reduce((acc, item) => acc + item.subtotal, 0);
  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { total },
    include: { persona: true, items: true }
  });

  res.json(ventaActualizada);
});

app.put('/mostrador/ventas/:id/persona', async (req, res) => {
  const ventaId = Number(req.params.id);
  const { personaId, nombre, telefono, tipo } = req.body;

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se puede asociar persona a ventas en BORRADOR' });
  }

  let persona;
  if (personaId) {
    persona = await prisma.persona.findUnique({ where: { id: Number(personaId) } });
    if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
  } else {
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Debe enviar personaId o bien nombre y telefono' });
    }
    persona = await prisma.persona.create({
      data: {
        nombre,
        telefono,
        tipo: tipo || 'CONSUMIDOR_FINAL'
      }
    });
  }

  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { personaId: persona.id },
    include: { persona: true, items: true }
  });

  res.json(ventaActualizada);
});

app.post('/mostrador/ventas/:id/cerrar', async (req, res) => {
  const ventaId = Number(req.params.id);

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: true }
  });

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'La venta ya no está en BORRADOR' });
  }
  const nombre = venta.persona?.nombre?.trim();
  const telefono = venta.persona?.telefono?.trim();
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Antes de cerrar la venta debe existir nombre y telefono' });
  }
  if (venta.items.length === 0) {
    return res.status(400).json({ error: 'No se puede cerrar una venta sin productos' });
  }

  await prisma.$transaction(async tx => {
    for (const item of venta.items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto || producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para producto ${item.productoId}`);
      }
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { decrement: item.cantidad } }
      });
    }

    await tx.venta.update({
      where: { id: ventaId },
      data: { estado: EstadoVenta.PENDIENTE_CAJA }
    });
  });

  const ventaCerrada = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaCerrada);
});

app.get('/caja/ventas', async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: { estado: EstadoVenta.PENDIENTE_CAJA },
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'asc' }
  });

  res.json(ventas);
});

app.post('/caja/cobrar/:id', async (req, res) => {
  const ventaId = Number(req.params.id);
  const { medioPago } = req.body || {};
  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.PENDIENTE_CAJA) {
    return res.status(400).json({ error: 'La venta no está pendiente de caja' });
  }

  if (medioPago === 'CUENTA_CORRIENTE') {
    const ventaConPersona = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: { persona: true }
    });

    if (!ventaConPersona?.personaId) {
      return res.status(400).json({ error: 'La venta debe tener una persona para enviarla a cuenta corriente' });
    }

    await prisma.$transaction(async tx => {
      const cuenta = await tx.cuentaCorriente.upsert({
        where: { personaId: ventaConPersona.personaId },
        update: { saldo: { increment: ventaConPersona.total } },
        create: {
          personaId: ventaConPersona.personaId,
          saldo: ventaConPersona.total
        }
      });

      await tx.movimientoCuentaCorriente.create({
        data: {
          cuentaCorrienteId: cuenta.id,
          ventaId: ventaConPersona.id,
          tipo: 'DEBITO',
          monto: ventaConPersona.total,
          descripcion: `Venta #${ventaConPersona.id} enviada a cuenta corriente`
        }
      });

      await tx.venta.update({
        where: { id: ventaId },
        data: { estado: EstadoVenta.COBRADA }
      });
    });
  } else {
    await prisma.venta.update({
      where: { id: ventaId },
      data: { estado: EstadoVenta.COBRADA }
    });
  }

  const ventaCobrada = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaCobrada);
});

app.get('/cuenta-corriente/personas/:personaId', async (req, res) => {
  const personaId = Number(req.params.personaId);
  const cuenta = await prisma.cuentaCorriente.findUnique({
    where: { personaId },
    include: {
      persona: true,
      movimientos: {
        orderBy: { createdAt: 'desc' },
        include: { venta: true }
      }
    }
  });

  if (!cuenta) return res.status(404).json({ error: 'Cuenta corriente no encontrada' });
  res.json(cuenta);
});

app.post('/cuenta-corriente/personas/:personaId/pagos', async (req, res) => {
  const personaId = Number(req.params.personaId);
  const { monto, descripcion } = req.body;

  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'monto (>0) es obligatorio' });
  }

  const cuenta = await prisma.cuentaCorriente.findUnique({ where: { personaId } });
  if (!cuenta) return res.status(404).json({ error: 'Cuenta corriente no encontrada' });
  if (Number(monto) > cuenta.saldo) {
    return res.status(400).json({ error: 'El pago no puede ser mayor al saldo actual' });
  }

  const cuentaActualizada = await prisma.$transaction(async tx => {
    const updated = await tx.cuentaCorriente.update({
      where: { id: cuenta.id },
      data: { saldo: { decrement: Number(monto) } }
    });

    await tx.movimientoCuentaCorriente.create({
      data: {
        cuentaCorrienteId: cuenta.id,
        tipo: 'CREDITO',
        monto: Number(monto),
        descripcion: descripcion || 'Pago de cuenta corriente'
      }
    });

    return updated;
  });

  res.json(cuentaActualizada);
});

app.get('/app', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Panel Inicial - Agroquímica</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #eef2f7; color: #0f172a; }
    .container { max-width: 1280px; margin: 0 auto; padding: 16px; }
    .layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .card { background: #fff; border: 1px solid #dbe2ea; border-radius: 12px; padding: 16px; }
    h1, h2, h3 { margin: 0; }
    h1 { margin-bottom: 12px; }
    h2 { margin-bottom: 12px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .stack { display: grid; gap: 12px; }
    input, select, button { padding: 10px 12px; border: 1px solid #c8d2de; border-radius: 8px; font-size: 16px; color: #0f172a; background: #fff; }
    button { background: #1d4ed8; color: #fff; cursor: pointer; border-color: #1d4ed8; }
    button.success { background: #166534; border-color: #166534; }
    .btn-lg { font-size: 18px; font-weight: 700; padding: 12px 16px; }
    .muted { color: #5b6574; font-size: 13px; }
    .product-search { width: 100%; font-size: 18px; }
    .product-list { max-height: 420px; overflow-y: auto; display: grid; gap: 10px; }
    .product-item { width: 100%; padding: 14px; border: 1px solid #d7dee8; border-radius: 10px; background: #fff; text-align: left; cursor: pointer; display: grid; gap: 4px; }
    .product-item:hover, .product-item:focus { background: #f8fbff; outline: none; border-color: #9fc2ff; }
    .product-name { font-size: 22px; font-weight: 700; display: block; margin-bottom: 8px; }
    .product-price { font-size: 28px; font-weight: 800; color: #111827; display: block; margin-bottom: 6px; }
    .product-stock { color: #475569; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 15px; }
    th, td { border-bottom: 1px solid #e8edf2; padding: 8px 6px; text-align: left; }
    .total-grande { font-size: 42px; font-weight: 800; color: #0b3a91; margin: 0; }
    .caja-lista { display: grid; gap: 10px; }
    .caja-card { border: 1px solid #d7dee8; border-radius: 10px; background: #f8fafc; padding: 12px; display: grid; gap: 10px; }
    .caja-card h3 { font-size: 20px; margin: 0; }
    @media (min-width: 980px) { .layout { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Mostrador y Caja</h1>
    <div class="layout">
      <section class="card">
        <h2>Mostrador</h2>
        <div class="row"><button id="btn-nueva-venta" class="success btn-lg">Nueva venta</button><span id="venta-id" class="muted">Sin venta activa</span></div>
        <div id="bloque-venta" class="stack" style="margin-top:10px; display:none;">
          <div class="stack">
            <h3>Agregar producto</h3>
            <input id="buscador-productos" class="product-search" placeholder="Buscar producto por nombre..." autocomplete="off" />
            <div id="lista-productos-filtrada" class="product-list"></div>
            <p class="muted">Click en un producto para agregar 1 unidad automáticamente.</p>
          </div>

          <div>
            <h3>Cliente</h3>
            <form id="form-persona" class="row">
              <input id="persona-nombre" placeholder="Nombre" required />
              <input id="persona-telefono" placeholder="Teléfono" required />
              <button type="submit" class="btn-lg">Guardar cliente</button>
            </form>
          </div>

          <table id="tabla-items"><thead><tr><th>Producto</th><th>Cant.</th><th>P.Unit.</th><th>Subtotal</th></tr></thead><tbody></tbody></table>
          <p><strong>Total de la venta</strong></p><p class="total-grande">$<span id="venta-total">0.00</span></p>
          <button id="btn-cerrar-venta" class="btn-lg">Cerrar venta</button>
        </div>
      </section>

      <section class="card">
        <h2>Caja</h2>
        <div id="lista-caja" class="caja-lista"></div>
      </section>
    </div>

    <p id="estado" class="muted"></p>
  </div>

  <script>
    let ventaActualId = null;
    let cuentaPersonaIdActual = null;
    let productosCache = [];
    let filtroProductos = '';
    const $ = s => document.querySelector(s);
    const money = v => Number(v || 0).toFixed(2);

    function setEstado(msg) { $('#estado').textContent = msg; }

    async function api(url, options = {}) {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en solicitud');
      return data;
    }

    async function cargarProductos() {
      const productos = await api('/productos');
      productosCache = productos;
      renderListaProductos();
    }



    function obtenerNombreProducto(producto) {
      const nombre = (producto && typeof producto.nombre === 'string') ? producto.nombre.trim() : '';
      if (nombre) return nombre;
      return 'Producto sin nombre';
    }

    function renderListaProductos() {
      const contenedor = $('#lista-productos-filtrada');
      if (!contenedor) return;
      const termino = filtroProductos.trim().toLowerCase();
      const filtrados = productosCache
        .filter(p => p.stock > 0)
        .filter(p => {
          const nombre = obtenerNombreProducto(p).toLowerCase();
          return !termino || nombre.includes(termino);
        })
        .slice(0, 8);

      if (filtrados.length === 0) {
        contenedor.innerHTML = '<p class="muted" style="padding:10px; margin:0;">Sin productos para mostrar.</p>';
        return;
      }

      contenedor.innerHTML = filtrados.map(p =>
        '<button class="product-item" data-producto-id="' + p.id + '">' +
          '<span class="product-name">' + obtenerNombreProducto(p) + '</span>' +
          '<span class="product-price">$ ' + money(p.precioPesosCalculado) + '</span>' +
          '<span class="product-stock">Stock disponible: ' + p.stock + '</span>' +
        '</button>'
      ).join('');
    }

    async function agregarProductoRapido(productoId) {
      if (!ventaActualId) return setEstado('Primero cree una venta.');
      try {
        await api('/mostrador/ventas/' + ventaActualId + '/items', { method: 'POST', body: JSON.stringify({ productoId: Number(productoId), cantidad: 1 }) });
        await Promise.all([refrescarVentaActual(), cargarProductos()]);
        $('#buscador-productos').focus();
      } catch (err) { setEstado(err.message); }
    }
    async function refrescarVentaActual() {
      if (!ventaActualId) return;
      const venta = await api('/mostrador/ventas/' + ventaActualId);
      $('#venta-id').textContent = 'Venta #' + venta.id + ' (' + venta.estado + ')';
      const tbody = $('#tabla-items tbody');
      tbody.innerHTML = '';
      if (!venta.items.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">Todavía no hay productos cargados en esta venta.</td></tr>';
      }
      for (const i of venta.items) {
        const nombre = (i.producto && i.producto.nombre) || ('Producto ' + i.productoId);
        tbody.innerHTML += '<tr><td>' + nombre + '</td><td>' + i.cantidad + '</td><td>$' + money(i.precioUnitario) + '</td><td>$' + money(i.subtotal) + '</td></tr>';
      }
      $('#venta-total').textContent = money(venta.total);
    }

    async function cargarCaja() {
      const ventas = await api('/caja/ventas');
      const contenedor = $('#lista-caja');
      contenedor.innerHTML = '';
      if (!ventas.length) {
        contenedor.innerHTML = '<p class="muted">No hay ventas pendientes.</p>';
        return;
      }
      for (const v of ventas) {
        const card = document.createElement('article');
        card.className = 'caja-card';
        card.innerHTML = '<h3>Venta #' + v.id + '</h3><div><strong>Cliente:</strong> ' + (v.persona ? v.persona.nombre + ' (' + v.persona.telefono + ')' : 'Sin persona') + '</div><div><strong>Total:</strong> $' + money(v.total) + '</div>';
        const acciones = document.createElement('div');
        acciones.className = 'row';
        const select = document.createElement('select');
        select.innerHTML = '<option value="EFECTIVO">Efectivo</option><option value="CUENTA_CORRIENTE">Cuenta corriente</option>';
        const btn = document.createElement('button');
        btn.className = 'btn-lg';
        btn.textContent = 'Cobrar';
        btn.onclick = async () => {
          try {
            await api('/caja/cobrar/' + v.id, { method: 'POST', body: JSON.stringify({ medioPago: select.value }) });
            setEstado('Venta #' + v.id + ' cobrada por ' + select.value + '.');
            await Promise.all([cargarCaja(), cargarProductos()]);
          } catch (e) { setEstado(e.message); }
        };
        acciones.appendChild(select); acciones.appendChild(btn);
        card.appendChild(acciones);
        contenedor.appendChild(card);
      }
    }

    // eventos
    $('#btn-nueva-venta').addEventListener('click', async () => { try { const venta = await api('/mostrador/ventas', { method: 'POST', body: '{}' }); ventaActualId = venta.id; $('#bloque-venta').style.display = 'block'; await refrescarVentaActual(); $('#buscador-productos').focus(); setEstado('Venta #' + venta.id + ' creada.'); } catch (err) { setEstado(err.message); } });
    $('#form-persona').addEventListener('submit', async e => { e.preventDefault(); if (!ventaActualId) return; try { await api('/mostrador/ventas/' + ventaActualId + '/persona', { method: 'PUT', body: JSON.stringify({ nombre: $('#persona-nombre').value, telefono: $('#persona-telefono').value }) }); await refrescarVentaActual(); setEstado('Cliente asociado.'); } catch (err) { setEstado(err.message); } });
    $('#btn-cerrar-venta').addEventListener('click', async () => { if (!ventaActualId) return; try { await api('/mostrador/ventas/' + ventaActualId + '/cerrar', { method: 'POST', body: '{}' }); setEstado('Venta #' + ventaActualId + ' cerrada y enviada a caja.'); ventaActualId = null; $('#bloque-venta').style.display = 'none'; $('#venta-id').textContent = 'Sin venta activa'; $('#tabla-items tbody').innerHTML = ''; $('#venta-total').textContent = '0.00'; await Promise.all([cargarCaja(), cargarProductos()]); } catch (err) { setEstado(err.message); } });

    $('#buscador-productos').addEventListener('input', e => { filtroProductos = e.target.value || ''; renderListaProductos(); });
    $('#lista-productos-filtrada').addEventListener('click', e => { const btn = e.target.closest('[data-producto-id]'); if (!btn) return; agregarProductoRapido(btn.dataset.productoId); });

    (async function init() { try { await Promise.all([cargarProductos(), cargarCaja()]); } catch (e) { setEstado(e.message); } })();
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});

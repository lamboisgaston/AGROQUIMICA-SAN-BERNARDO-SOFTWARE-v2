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

app.get('/productos', async (req, res) => {
  const productos = await prisma.producto.findMany();
  res.json(productos);
});

app.post('/productos', async (req, res) => {
  const producto = await prisma.producto.create({ data: req.body });
  res.json(producto);
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
      precioUnitario: producto.precio,
      subtotal: producto.precio * Number(cantidad)
    },
    update: {
      cantidad: cantidadFinal,
      subtotal: producto.precio * cantidadFinal
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
  if (!venta.persona || !venta.persona.nombre || !venta.persona.telefono) {
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
  <title>Mostrador y Caja</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f8; color: #1f2937; }
    .container { max-width: 1100px; margin: 0 auto; padding: 16px; display: grid; gap: 16px; }
    .card { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
    h1, h2, h3 { margin: 0 0 10px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    input, select, button { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
    button { background: #2563eb; color: white; cursor: pointer; }
    button.success { background: #15803d; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 6px; text-align: left; }
    .muted { color: #6b7280; font-size: 13px; }
    .grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
    @media (min-width: 900px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Mostrador y Caja</h1>

    <div class="grid-2">
      <section class="card">
        <h2>Lista de productos</h2>
        <table id="tabla-productos"><thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th></tr></thead><tbody></tbody></table>
      </section>

      <section class="card">
        <h2>Vista de venta actual</h2>
        <div class="row"><button id="btn-nueva-venta" class="success">Nueva venta</button><span id="venta-id" class="muted">Sin venta activa</span></div>
        <div id="bloque-venta" style="margin-top:10px; display:none;">
          <h3>Agregar producto a venta</h3>
          <form id="form-item" class="row">
            <select id="item-producto" required></select>
            <input id="item-cantidad" type="number" min="1" step="1" placeholder="Cantidad" required />
            <button type="submit">Agregar</button>
          </form>

          <h3>Formulario nombre y teléfono</h3>
          <form id="form-persona" class="row">
            <input id="persona-nombre" placeholder="Nombre" required />
            <input id="persona-telefono" placeholder="Teléfono" required />
            <button type="submit">Guardar cliente</button>
          </form>

          <table id="tabla-items"><thead><tr><th>Producto</th><th>Cant.</th><th>P.Unit.</th><th>Subtotal</th></tr></thead><tbody></tbody></table>
          <p><strong>Total:</strong> $<span id="venta-total">0.00</span></p>
          <button id="btn-cerrar-venta">Cerrar venta</button>
        </div>
      </section>
    </div>

    <section class="card">
      <h2>Sección caja con ventas pendientes</h2>
      <table id="tabla-caja"><thead><tr><th>ID Venta</th><th>Cliente</th><th>Total</th><th>Acción</th></tr></thead><tbody></tbody></table>
    </section>

    <p id="estado" class="muted"></p>
  </div>

  <script>
    let ventaActualId = null;
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
      const tbody = $('#tabla-productos tbody');
      const select = $('#item-producto');
      tbody.innerHTML = '';
      select.innerHTML = '<option value="">Seleccionar producto</option>';

      for (const p of productos) {
        tbody.innerHTML += '<tr><td>' + p.id + '</td><td>' + p.nombre + '</td><td>$' + money(p.precio) + '</td><td>' + p.stock + '</td></tr>';
        select.innerHTML += '<option value="' + p.id + '">' + p.nombre + ' - $' + money(p.precio) + ' (stock ' + p.stock + ')</option>';
      }
    }

    async function refrescarVentaActual() {
      if (!ventaActualId) return;
      const venta = await api('/mostrador/ventas/' + ventaActualId);
      $('#venta-id').textContent = 'Venta #' + venta.id + ' (' + venta.estado + ')';
      const tbody = $('#tabla-items tbody');
      tbody.innerHTML = '';

      for (const i of venta.items) {
        const nombre = (i.producto && i.producto.nombre) || ('Producto ' + i.productoId);
        tbody.innerHTML += '<tr><td>' + nombre + '</td><td>' + i.cantidad + '</td><td>$' + money(i.precioUnitario) + '</td><td>$' + money(i.subtotal) + '</td></tr>';
      }

      $('#venta-total').textContent = money(venta.total);
    }

    async function cargarCaja() {
      const ventas = await api('/caja/ventas');
      const tbody = $('#tabla-caja tbody');
      tbody.innerHTML = '';

      for (const v of ventas) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + v.id + '</td><td>' + (v.persona ? v.persona.nombre + ' (' + v.persona.telefono + ')' : 'Sin persona') + '</td><td>$' + money(v.total) + '</td><td></td>';

        const tdAccion = tr.lastElementChild;
        const btn = document.createElement('button');
        btn.textContent = 'Cobrar';
        btn.onclick = async () => {
          try {
            await api('/caja/cobrar/' + v.id, { method: 'POST', body: '{}' });
            setEstado('Venta #' + v.id + ' cobrada.');
            await Promise.all([cargarCaja(), cargarProductos()]);
          } catch (e) { setEstado(e.message); }
        };

        tdAccion.appendChild(btn);
        tbody.appendChild(tr);
      }
    }

    $('#btn-nueva-venta').addEventListener('click', async () => {
      try {
        const venta = await api('/mostrador/ventas', { method: 'POST', body: '{}' });
        ventaActualId = venta.id;
        $('#bloque-venta').style.display = 'block';
        await refrescarVentaActual();
        setEstado('Venta #' + venta.id + ' creada.');
      } catch (err) { setEstado(err.message); }
    });

    $('#form-item').addEventListener('submit', async e => {
      e.preventDefault();
      if (!ventaActualId) return;
      try {
        await api('/mostrador/ventas/' + ventaActualId + '/items', {
          method: 'POST',
          body: JSON.stringify({ productoId: Number($('#item-producto').value), cantidad: Number($('#item-cantidad').value) })
        });
        $('#item-cantidad').value = '';
        await Promise.all([refrescarVentaActual(), cargarProductos()]);
      } catch (err) { setEstado(err.message); }
    });

    $('#form-persona').addEventListener('submit', async e => {
      e.preventDefault();
      if (!ventaActualId) return;
      try {
        await api('/mostrador/ventas/' + ventaActualId + '/persona', {
          method: 'PUT',
          body: JSON.stringify({ nombre: $('#persona-nombre').value, telefono: $('#persona-telefono').value })
        });
        await refrescarVentaActual();
        setEstado('Cliente asociado.');
      } catch (err) { setEstado(err.message); }
    });

    $('#btn-cerrar-venta').addEventListener('click', async () => {
      if (!ventaActualId) return;
      try {
        await api('/mostrador/ventas/' + ventaActualId + '/cerrar', { method: 'POST', body: '{}' });
        setEstado('Venta #' + ventaActualId + ' cerrada y enviada a caja.');
        ventaActualId = null;
        $('#bloque-venta').style.display = 'none';
        $('#venta-id').textContent = 'Sin venta activa';
        $('#tabla-items tbody').innerHTML = '';
        $('#venta-total').textContent = '0.00';
        await Promise.all([cargarCaja(), cargarProductos()]);
      } catch (err) { setEstado(err.message); }
    });

    (async function init() {
      try {
        await Promise.all([
          cargarProductos(),
          cargarCaja(),
        ]);
      } catch (e) { setEstado(e.message); }
    })();
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});

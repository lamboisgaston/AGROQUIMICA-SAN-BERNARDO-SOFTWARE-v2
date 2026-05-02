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
  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.PENDIENTE_CAJA) {
    return res.status(400).json({ error: 'La venta no está pendiente de caja' });
  }

  const ventaCobrada = await prisma.venta.update({
    where: { id: ventaId },
    data: { estado: EstadoVenta.COBRADA },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaCobrada);
});

app.get('/app', (req, res) => {
  res.json({
    modulo: 'APP',
    estado: 'ok',
    endpoints: {
      mostrador: ['/mostrador/ventas', '/mostrador/ventas/:id/items', '/mostrador/ventas/:id/cerrar'],
      caja: ['/caja/ventas', '/caja/cobrar/:id']
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});

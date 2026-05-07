const express = require('express');
const { PrismaClient, EstadoVenta, MedioPago, TipoMovimientoStock, EstadoPresupuesto } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const TIMEZONE_CAJA = 'America/Argentina/Salta';

function obtenerFechaCajaArgentina(fecha = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_CAJA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(fecha);
}

function parsearFechaCaja(fechaCaja) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCaja)) return null;
  const [y, m, d] = fechaCaja.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function obtenerRangoDiaCaja(fechaCaja) {
  const partes = parsearFechaCaja(fechaCaja);
  if (!partes) return null;

  const inicio = new Date(Date.UTC(partes.y, partes.m - 1, partes.d, 3, 0, 0, 0));
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 1);

  return { inicio, fin };
}

async function calcularResumenCajaDia(fechaCaja = obtenerFechaCajaArgentina()) {
  const rango = obtenerRangoDiaCaja(fechaCaja);
  if (!rango) throw new Error('fecha inválida, use YYYY-MM-DD');
  const { inicio, fin } = rango;
  const [ventas, cierre] = await Promise.all([
    prisma.venta.findMany({
      where: {
        estado: EstadoVenta.COBRADA,
        createdAt: { gte: inicio, lt: fin }
      },
      select: { total: true, medioPago: true }
    }),
    prisma.cierreCajaDiario.findUnique({
      where: { fechaCaja },
      select: { id: true, fecha: true, fechaCaja: true }
    })
  ]);

  const resumen = {
    fechaCaja,
    fecha: inicio.toISOString(),
    EFECTIVO: 0,
    TRANSFERENCIA: 0,
    TARJETA: 0,
    CUENTA_CORRIENTE: 0
  };

  for (const venta of ventas) {
    if (!venta.medioPago) continue;
    resumen[venta.medioPago] += Number(venta.total || 0);
  }

  return {
    ...resumen,
    totalGeneral: resumen.EFECTIVO + resumen.TRANSFERENCIA + resumen.TARJETA + resumen.CUENTA_CORRIENTE,
    estado: cierre ? 'CERRADO' : 'ABIERTO',
    cierre
  };
}



function calcularTotalesConDescuento(items = [], descuentoTipo = null, descuentoValor = 0) {
  const subtotal = items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
  const valor = Math.max(0, Number(descuentoValor || 0));

  let descuentoAplicado = 0;
  if (descuentoTipo === 'PORCENTAJE') {
    descuentoAplicado = subtotal * (valor / 100);
  } else if (descuentoTipo === 'MONTO') {
    descuentoAplicado = valor;
  }

  const total = Math.max(0, subtotal - descuentoAplicado);

  return {
    subtotal,
    descuentoTipo: (descuentoTipo === 'PORCENTAJE' || descuentoTipo === 'MONTO') ? descuentoTipo : null,
    descuentoValor: valor,
    total
  };
}
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
  const calculo = calcularPrecioFinalPesos(producto, tipoCambioActual);
  const monedaCompra = producto.monedaCosto || 'ARS';
  const costoCompra = producto.costoBase ?? 0;
  const costoCompraPesos = monedaCompra === 'USD' ? numeroSeguro(costoCompra) * numeroSeguro(tipoCambioActual, 1) : numeroSeguro(costoCompra);
  const ivaPorcentaje = producto.ivaPorcentaje ?? producto.porcentajeUva ?? producto.ivaMonto ?? 0;
  const fletePorcentaje = producto.fletePorcentaje ?? producto.porcentajeFlete ?? producto.fleteMonto ?? 0;
  const margenGananciaPorcentaje = producto.gananciaPorcentaje ?? producto.porcentajeGanancia ?? 0;
  return {
    ...producto,
    monedaCompra,
    costoCompraOriginal: costoCompra,
    costoCompra,
    costoBasePesos: costoCompraPesos,
    costoCompraPesos,
    ivaPorcentaje,
    fletePorcentaje,
    margenGananciaPorcentaje,
    gananciaPorcentaje: margenGananciaPorcentaje,
    createdAt: producto.createdAt || null,
    updatedAt: producto.updatedAt || null,
    costoTotalPesos: calculo.costoTotalPesos,
    precioVentaPesos: calculo.precioVentaPesos,
    precioFinalPesos: calculo.precioVentaPesos,
    precioPesosCalculado: calculo.precioVentaPesos
  };
}

function numeroSeguro(valor, fallback = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function calcularPrecioFinalPesos(producto = {}, tipoCambioActual = 1) {
  const monedaCosto = producto.monedaCosto || (producto.precioUsd != null ? 'USD' : 'ARS');
  const costoBaseFuente = producto.costoBase ?? producto.precioUsd ?? 0;
  const costoCompraPesos = monedaCosto === 'USD'
    ? numeroSeguro(costoBaseFuente) * numeroSeguro(tipoCambioActual, 1)
    : numeroSeguro(costoBaseFuente);

  const ivaPorcentaje = producto.ivaPorcentaje ?? producto.porcentajeUva ?? producto.ivaMonto ?? 0;
  const fletePorcentaje = producto.fletePorcentaje ?? producto.porcentajeFlete ?? producto.fleteMonto ?? 0;
  const gananciaPorcentaje = producto.gananciaPorcentaje ?? producto.porcentajeGanancia ?? 0;
  const costoConIva = costoCompraPesos * (1 + (numeroSeguro(ivaPorcentaje) / 100));
  const costoConFlete = costoConIva * (1 + (numeroSeguro(fletePorcentaje) / 100));
  const precioVentaPesos = costoConFlete * (1 + (numeroSeguro(gananciaPorcentaje) / 100));
  return {
    costoCompraPesos: Number(numeroSeguro(costoCompraPesos).toFixed(2)),
    costoTotalPesos: Number(numeroSeguro(costoConFlete).toFixed(2)),
    precioVentaPesos: Number(numeroSeguro(precioVentaPesos).toFixed(2))
  };
}

function normalizarPayloadProducto(payload = {}, tipoCambioActual = 1) {
  const monedaBruta = String(payload.monedaCompra ?? payload.monedaCosto ?? '').trim().toUpperCase();
  const monedaCompraPayload = ['USD', 'DOLAR', 'DÓLAR', 'DOLARES', 'DÓLARES'].includes(monedaBruta)
    ? 'USD'
    : ['ARS', 'PESO', 'PESOS'].includes(monedaBruta)
      ? 'ARS'
      : monedaBruta;
  if (monedaCompraPayload !== 'ARS' && monedaCompraPayload !== 'USD') {
    throw new Error('monedaCompra debe ser ARS o USD');
  }
  const monedaCosto = monedaCompraPayload;
  const costoBase = Number(payload.costoCompraOriginal ?? payload.costoCompra ?? payload.costoBase ?? payload.precioUsd ?? 0);
  const productoNormalizado = {
    nombre: String(payload.nombre || '').trim(),
    categoria: String(payload.categoria || '').trim(),
    marca: String(payload.marca || '').trim(),
    unidad: String(payload.unidad || '').trim(),
    stock: Number.isInteger(Number(payload.stock)) ? Number(payload.stock) : 0,
    monedaCosto,
    costoBase,
    precioVenta: 0,
    porcentajeUva: Number(payload.ivaPorcentaje ?? payload.ivaMonto ?? payload.porcentajeUva ?? 0),
    porcentajeFlete: Number(payload.fletePorcentaje ?? payload.fleteMonto ?? payload.porcentajeFlete ?? 0),
    porcentajeGanancia: Number(payload.margenGananciaPorcentaje ?? payload.gananciaPorcentaje ?? payload.porcentajeGanancia ?? 0),
    precioUsd: payload.precioUsd == null ? (monedaCosto === 'USD' ? costoBase : null) : Number(payload.precioUsd)
  };
  const calculo = calcularPrecioFinalPesos(productoNormalizado, tipoCambioActual);
  productoNormalizado.precioFinalPesos = calculo.precioVentaPesos;
  productoNormalizado.precioVenta = calculo.precioVentaPesos;
  return productoNormalizado;
}

function validarPayloadProducto(payload = {}) {
  const obligatorios = [
    ['nombre', payload.nombre],
    ['categoria', payload.categoria],
    ['monedaCompra', payload.monedaCompra ?? payload.monedaCosto],
    ['costoCompraOriginal', payload.costoCompraOriginal ?? payload.costoCompra ?? payload.costoBase],
    ['stock', payload.stock]
  ];
  const faltantes = obligatorios
    .filter(([_, valor]) => valor === undefined || valor === null || String(valor).trim() === '')
    .map(([campo]) => campo);

  if (faltantes.length) {
    return `Faltan campos obligatorios: ${faltantes.join(', ')}`;
  }
  return null;
}

app.get('/productos', async (req, res) => {
  try {
    const tipoCambioActual = await obtenerTipoCambioActual();
    const q = String(req.query.q || '').trim();
    const productos = await prisma.producto.findMany({
      where: q ? {
        OR: [
          { nombre: { contains: q } },
          { categoria: { contains: q } },
          { marca: { contains: q } }
        ]
      } : undefined,
      include: { proveedores: { include: { proveedor: true } } },
      orderBy: { nombre: 'asc' }
    });
    return res.json(productos.map(p => mapearProductoConPrecioPesos(p, tipoCambioActual)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/productos/buscar', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const tipoCambioActual = await obtenerTipoCambioActual();
  const productos = await prisma.producto.findMany({
    where: {
      OR: [
        { nombre: { contains: q } },
        { categoria: { contains: q } },
        { marca: { contains: q } }
      ]
    },
    include: { proveedores: { include: { proveedor: true } } },
    orderBy: { nombre: 'asc' },
    take: 20
  });
  res.json(productos.map(p => mapearProductoConPrecioPesos(p, tipoCambioActual)));
}));

app.post('/productos', asyncHandler(async (req, res) => {
  try {
    console.log('[producto-guardado][backend] POST /productos payload', req.body);
    const errorValidacion = validarPayloadProducto(req.body);
    if (errorValidacion) {
      console.warn('[producto-guardado][backend] POST /productos validacion', { error: errorValidacion, payload: req.body });
      return res.status(400).json({ error: errorValidacion });
    }
    const tipoCambioActual = await obtenerTipoCambioActual();
    const data = normalizarPayloadProducto(req.body, tipoCambioActual);
    console.log('[producto-guardado][backend] POST /productos normalizado', data);
    const proveedorIds = Array.isArray(req.body?.proveedorIds) ? req.body.proveedorIds.map(Number).filter(Number.isInteger) : [];
    const producto = await prisma.producto.create({ data });
    console.log('[producto-guardado][backend] POST /productos creado', { id: producto.id, nombre: producto.nombre });
    if (proveedorIds.length) {
      await prisma.productoProveedor.createMany({ data: proveedorIds.map(proveedorId => ({ productoId: producto.id, proveedorId })), skipDuplicates: true });
    }
    const productoConProveedores = await prisma.producto.findUnique({ where: { id: producto.id }, include: { proveedores: { include: { proveedor: true } } } });
    res.status(201).json(mapearProductoConPrecioPesos(productoConProveedores, tipoCambioActual));
  } catch (error) {
    console.error('[producto-guardado][backend] POST /productos error', { message: error.message, stack: error.stack, payload: req.body });
    throw error;
  }
}));

app.get('/productos/categorias', asyncHandler(async (_req, res) => {
  const rows = await prisma.producto.findMany({
    select: { categoria: true },
    distinct: ['categoria'],
    orderBy: { categoria: 'asc' }
  });
  res.json(rows.map(r => r.categoria).filter(Boolean));
}));

app.put('/productos/:id', asyncHandler(async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    console.log('[producto-guardado][backend] PUT /productos/:id payload', { id, body: req.body });
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const errorValidacion = validarPayloadProducto(req.body);
    if (errorValidacion) {
      console.warn('[producto-guardado][backend] PUT /productos/:id validacion', { error: errorValidacion, payload: req.body });
      return res.status(400).json({ error: errorValidacion });
    }
    const tipoCambioActual = await obtenerTipoCambioActual();
    const existente = await prisma.producto.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ error: 'Producto no encontrado' });

    const data = normalizarPayloadProducto({ ...existente, ...req.body }, tipoCambioActual);
    console.log('[producto-guardado][backend] PUT /productos/:id normalizado', { id, data });
    const proveedorIds = Array.isArray(req.body?.proveedorIds) ? req.body.proveedorIds.map(Number).filter(Number.isInteger) : [];
    await prisma.$transaction(async tx => {
      await tx.producto.update({ where: { id }, data });
      if (Array.isArray(req.body?.proveedorIds)) {
        await tx.productoProveedor.deleteMany({ where: { productoId: id } });
        if (proveedorIds.length) {
          await tx.productoProveedor.createMany({ data: proveedorIds.map(proveedorId => ({ productoId: id, proveedorId })), skipDuplicates: true });
        }
      }
    });
    const producto = await prisma.producto.findUnique({ where: { id }, include: { proveedores: { include: { proveedor: true } } } });
    console.log('[producto-guardado][backend] PUT /productos/:id actualizado', { id: producto?.id, nombre: producto?.nombre });
    res.json(mapearProductoConPrecioPesos(producto, tipoCambioActual));
  } catch (error) {
    console.error('[producto-guardado][backend] PUT /productos/:id error', { message: error.message, stack: error.stack, payload: req.body });
    throw error;
  }
}));

app.get('/proveedores', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const proveedores = await prisma.proveedor.findMany({
    where: q ? {
      OR: [
        { nombre: { contains: q } },
        { cuit: { contains: q } }
      ]
    } : undefined,
    orderBy: { nombre: 'asc' },
    take: q ? 8 : undefined
  });
  res.json(proveedores);
}));

app.post('/proveedores', asyncHandler(async (req, res) => {
  const { nombre, telefono, cuit, observaciones } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'nombre es obligatorio' });
  const proveedor = await prisma.proveedor.create({
    data: { nombre: String(nombre).trim(), telefono: telefono || null, cuit: cuit || null, observaciones: observaciones || null }
  });
  res.status(201).json(proveedor);
}));

app.put('/proveedores/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { nombre, telefono, cuit, observaciones } = req.body || {};
  const proveedor = await prisma.proveedor.update({
    where: { id },
    data: { nombre: String(nombre || '').trim(), telefono: telefono || null, cuit: cuit || null, observaciones: observaciones || null }
  });
  res.json(proveedor);
}));

app.get('/proveedores/:id/productos', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const tipoCambioActual = await obtenerTipoCambioActual();
  const productos = await prisma.producto.findMany({
    where: { proveedores: { some: { proveedorId: id } } },
    orderBy: { nombre: 'asc' },
    include: { proveedores: { include: { proveedor: true } } }
  });
  res.json(productos.map(p => mapearProductoConPrecioPesos(p, tipoCambioActual)));
}));

app.post('/proveedores/:id/productos/:productoId', asyncHandler(async (req, res) => {
  const proveedorId = parsePositiveInt(req.params.id);
  const productoId = parsePositiveInt(req.params.productoId);
  if (!proveedorId || !productoId) return res.status(400).json({ error: 'ids inválidos' });
  const [proveedor, producto] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id: proveedorId } }),
    prisma.producto.findUnique({ where: { id: productoId } })
  ]);
  if (!proveedor || !producto) return res.status(404).json({ error: 'Proveedor o producto no encontrado' });
  await prisma.productoProveedor.create({ data: { proveedorId, productoId } }).catch(() => null);
  res.status(201).json({ ok: true });
}));

app.post('/remitos-proveedor', asyncHandler(async (req, res) => {
  const { proveedorId, numeroRemito, fecha, observaciones, detalles } = req.body || {};
  if (!proveedorId || !numeroRemito || !fecha || !Array.isArray(detalles) || !detalles.length) {
    return res.status(400).json({ error: 'Datos de remito incompletos' });
  }
  const remito = await prisma.$transaction(async tx => {
    const nuevo = await tx.remitoProveedor.create({ data: { proveedorId: Number(proveedorId), numeroRemito: String(numeroRemito), fecha: new Date(fecha), observaciones: observaciones || null } });
    for (const item of detalles) {
      const productoId = Number(item.productoId);
      const cantidad = Number(item.cantidad || 0);
      if (!Number.isInteger(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida');
      const producto = await tx.producto.findUnique({ where: { id: productoId } });
      if (!producto) throw new Error('Producto no encontrado');
      await tx.detalleRemitoProveedor.create({ data: { remitoId: nuevo.id, productoId, cantidad, costoCompra: producto.costoBase || 0, monedaCosto: producto.monedaCosto || 'ARS', ivaPorcentaje: producto.porcentajeUva || 0, fletePorcentaje: producto.porcentajeFlete || 0, gananciaPorcentaje: producto.porcentajeGanancia || 0 } });
      await tx.producto.update({ where: { id: productoId }, data: { stock: producto.stock + cantidad } });
      await tx.movimientoStock.create({ data: { productoId, tipo: TipoMovimientoStock.ENTRADA, cantidad, motivo: `Remito proveedor N°${numeroRemito}` } });
    }
    return nuevo;
  });
  res.status(201).json(remito);
}));

app.get('/remitos-proveedor', asyncHandler(async (req, res) => {
  const proveedorId = req.query.proveedorId ? parsePositiveInt(req.query.proveedorId) : null;
  const remitos = await prisma.remitoProveedor.findMany({
    where: proveedorId ? { proveedorId } : undefined,
    include: {
      proveedor: true,
      detalles: { include: { producto: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(remitos);
}));

app.get('/productos/:id/stock', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  const movimientos = await prisma.movimientoStock.findMany({ where: { productoId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ productoId: id, stockActual: producto.stock, movimientos });
}));

app.post('/productos/:id/stock', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { tipo, cantidad, motivo } = req.body || {};
  const cantidadNum = Number(cantidad);
  if (!Object.values(TipoMovimientoStock).includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
  if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) return res.status(400).json({ error: 'cantidad debe ser entero > 0' });
  if (!motivo || !String(motivo).trim()) return res.status(400).json({ error: 'motivo es obligatorio' });

  const result = await prisma.$transaction(async tx => {
    const producto = await tx.producto.findUnique({ where: { id } });
    if (!producto) throw new Error('Producto no encontrado');
    const delta = tipo === TipoMovimientoStock.ENTRADA ? cantidadNum : -cantidadNum;
    const nuevoStock = tipo === TipoMovimientoStock.AJUSTE ? cantidadNum : producto.stock + delta;
    if (nuevoStock < 0) throw new Error('Stock no puede quedar negativo');
    const actualizado = await tx.producto.update({ where: { id }, data: { stock: nuevoStock } });
    const movimiento = await tx.movimientoStock.create({ data: { productoId: id, tipo, cantidad: cantidadNum, motivo: String(motivo).trim() } });
    return { actualizado, movimiento };
  });
  res.status(201).json({ stockActual: result.actualizado.stock, movimiento: result.movimiento });
}));

app.get('/config/tipo-cambio', asyncHandler(async (req, res) => {
  const tipoCambioActual = await obtenerTipoCambioActual();
  res.json({ tipoCambioActual });
}));

app.put('/config/tipo-cambio', asyncHandler(async (req, res) => {
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
}));

app.get('/personas', asyncHandler(async (req, res) => {
  const personas = await prisma.persona.findMany();
  res.json(personas);
}));

app.post('/personas', asyncHandler(async (req, res) => {
  const { nombre, telefono, cuitDni, tipo } = req.body || {};
  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'nombre es obligatorio' });
  }

  const persona = await prisma.persona.create({
    data: {
      nombre: String(nombre).trim(),
      telefono: telefono ? String(telefono).trim() : null,
      cuitDni: cuitDni || null,
      tipo: tipo || 'CLIENTE'
    }
  });
  res.json(persona);
}));

app.get('/personas/buscar', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  const personas = await prisma.persona.findMany({
    where: {
      OR: [
        { nombre: { contains: q } },
        { telefono: { contains: q } },
        { cuitDni: { contains: q } }
      ]
    },
    take: 20,
    orderBy: { id: 'desc' }
  });

  res.json(personas);
}));

function validarClienteParaPresupuesto(persona) {
  if (!persona) return 'Cliente no encontrado';
  if (!String(persona.nombre || '').trim()) return 'El cliente debe tener nombre completo';
  if (String(persona.tipo || '').toUpperCase() === 'CONSUMIDOR_FINAL') return 'No se puede presupuestar a Consumidor Final';
  return null;
}

app.get('/presupuestos', asyncHandler(async (_req, res) => {
  const presupuestos = await prisma.presupuesto.findMany({
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(presupuestos);
}));

app.get('/presupuestos/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const p = await prisma.presupuesto.findUnique({ where: { id }, include: { persona: true, items: { include: { producto: true } } } });
  if (!p) return res.status(404).json({ error: 'Presupuesto no encontrado' });
  res.json(p);
}));

async function guardarPresupuesto(req, res, id = null) {
  const { clienteId, items, descuentoTipo, descuentoValor, observaciones, validez, aliasTransferencia, datosBancarios, estado } = req.body || {};
  const personaId = parsePositiveInt(clienteId);
  if (!personaId) return res.status(400).json({ error: 'clienteId es obligatorio' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Debe incluir productos' });
  const persona = await prisma.persona.findUnique({ where: { id: personaId } });
  const errorCliente = validarClienteParaPresupuesto(persona);
  if (errorCliente) return res.status(400).json({ error: errorCliente });

  const tipoCambioActual = await obtenerTipoCambioActual();
  const itemsCalculados = [];
  for (const item of items) {
    const productoId = parsePositiveInt(item.productoId);
    const cantidad = parsePositiveInt(item.cantidad);
    if (!productoId || !cantidad) return res.status(400).json({ error: 'productoId y cantidad son obligatorios' });
    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto) return res.status(404).json({ error: `Producto ${productoId} no encontrado` });
    const precioUnitario = calcularPrecioFinalPesos(producto, tipoCambioActual).precioVentaPesos;
    itemsCalculados.push({ productoId, cantidad, precioUnitario, subtotal: Number((precioUnitario * cantidad).toFixed(2)) });
  }
  const totales = calcularTotalesConDescuento(itemsCalculados, descuentoTipo || null, descuentoValor || 0);
  const payload = {
    personaId,
    subtotal: totales.subtotal,
    descuentoTipo: totales.descuentoTipo,
    descuentoValor: totales.descuentoValor,
    total: totales.total,
    observaciones: observaciones || null,
    validez: validez || null,
    aliasTransferencia: aliasTransferencia || null,
    datosBancarios: datosBancarios || null,
    estado: Object.values(EstadoPresupuesto).includes(estado) ? estado : EstadoPresupuesto.BORRADOR
  };
  const saved = await prisma.$transaction(async tx => {
    const pres = id ? await tx.presupuesto.update({ where: { id }, data: payload }) : await tx.presupuesto.create({ data: payload });
    if (id) await tx.presupuestoItem.deleteMany({ where: { presupuestoId: id } });
    await tx.presupuestoItem.createMany({ data: itemsCalculados.map(i => ({ ...i, presupuestoId: pres.id })) });
    return tx.presupuesto.findUnique({ where: { id: pres.id }, include: { persona: true, items: { include: { producto: true } } } });
  });
  return res.status(id ? 200 : 201).json(saved);
}

app.post('/presupuestos', asyncHandler(async (req, res) => guardarPresupuesto(req, res)));
app.put('/presupuestos/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  return guardarPresupuesto(req, res, id);
}));
app.post('/presupuestos/:id/aceptar', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const estadoVenta = req.body?.estadoVenta === 'BORRADOR' ? EstadoVenta.BORRADOR : EstadoVenta.PENDIENTE_CAJA;
  const p = await prisma.presupuesto.findUnique({ where: { id }, include: { items: true } });
  if (!p) return res.status(404).json({ error: 'Presupuesto no encontrado' });
  const venta = await prisma.$transaction(async tx => {
    await tx.presupuesto.update({ where: { id }, data: { estado: EstadoPresupuesto.ACEPTADO } });
    const v = await tx.venta.create({ data: { personaId: p.personaId, estado: estadoVenta, subtotal: p.subtotal, descuentoTipo: p.descuentoTipo, descuentoValor: p.descuentoValor, total: p.total } });
    if (p.items.length) await tx.ventaItem.createMany({ data: p.items.map(i => ({ ventaId: v.id, productoId: i.productoId, cantidad: i.cantidad, precioUnitario: i.precioUnitario, subtotal: i.subtotal })) });
    return v;
  });
  res.json({ ok: true, ventaId: venta.id });
}));
app.post('/presupuestos/:id/rechazar', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  await prisma.presupuesto.update({ where: { id }, data: { estado: EstadoPresupuesto.RECHAZADO } });
  res.json({ ok: true });
}));
app.get('/presupuestos/:id/imprimir', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const p = await prisma.presupuesto.findUnique({ where: { id }, include: { persona: true, items: { include: { producto: true } } } });
  if (!p) return res.status(404).send('No encontrado');
  const moneda = (n) => '$' + Number(n || 0).toFixed(2);
  const fecha = new Date(p.createdAt).toLocaleDateString('es-AR');
  const rows = p.items.map(i => `<tr><td>${escapeHtml(i.producto.nombre)}</td><td style="text-align:center">${i.cantidad}</td><td style="text-align:right">${moneda(i.precioUnitario)}</td><td style="text-align:right">${moneda(i.subtotal)}</td></tr>`).join('');
  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Presupuesto #${p.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color:#111; }
    .wrap { max-width: 900px; margin:0 auto; }
    .head { display:flex; justify-content:space-between; border-bottom:2px solid #222; padding-bottom:10px; }
    table { width:100%; border-collapse: collapse; margin-top:16px; }
    th, td { border:1px solid #ccc; padding:8px; }
    th { background:#f2f2f2; }
    .tot { margin-top:12px; text-align:right; }
    .box { margin-top:16px; border:1px solid #ccc; padding:10px; border-radius:6px; }
    .print { margin-top:18px; }
    @media print { .print { display:none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>Agroquímica y Fumigaciones San Bernardo</h1>
        <div>Dirección: Chile 1455</div>
      </div>
      <div>
        <strong>Presupuesto #${p.id}</strong><br/>
        Fecha: ${fecha}<br/>
        Estado: ${escapeHtml(p.estado)}
      </div>
    </div>
    <div class="box">
      <strong>Cliente:</strong> ${escapeHtml(p.persona?.nombre || '-')}<br/>
      <strong>Teléfono:</strong> ${escapeHtml(p.persona?.telefono || '-')}<br/>
      <strong>CUIT/DNI:</strong> ${escapeHtml(p.persona?.cuitDni || '-')}
    </div>
    <table>
      <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot">
      Subtotal: <strong>${moneda(p.subtotal)}</strong><br/>
      Descuento: <strong>${moneda(p.descuentoValor || 0)}</strong><br/>
      Total final: <strong>${moneda(p.total)}</strong>
    </div>
    <div class="box"><strong>Observaciones:</strong> ${escapeHtml(p.observaciones || '-')}</div>
    <div class="box"><strong>Validez del presupuesto:</strong> ${escapeHtml(p.validez || '-')}</div>
    <div class="box"><strong>Alias de transferencia:</strong> ${escapeHtml(p.aliasTransferencia || '-')}<br/><strong>Datos bancarios:</strong> ${escapeHtml(p.datosBancarios || '-')}</div>
    <button class="print" onclick="window.print()">Imprimir</button>
  </div>
</body>
</html>`);
}));

app.post('/mostrador/ventas', asyncHandler(async (req, res) => {
  const venta = await prisma.venta.create({ data: {} });
  res.status(201).json(venta);
}));

app.get('/mostrador/ventas/:id', asyncHandler(async (req, res) => {
  const ventaId = parsePositiveInt(req.params.id);
  if (!ventaId) return res.status(400).json({ error: 'id de venta inválido' });

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  if (!venta) {
    return res.status(404).json({ error: 'Venta no encontrada' });
  }

  res.json(venta);
}));

app.post('/mostrador/ventas/:id/items', asyncHandler(async (req, res) => {
  const ventaId = parsePositiveInt(req.params.id);
  if (!ventaId) return res.status(400).json({ error: 'id de venta inválido' });
  const { productoId, cantidad } = req.body;
  const productoIdParsed = parsePositiveInt(productoId);
  const cantidadParsed = parsePositiveInt(cantidad);

  if (!productoIdParsed || !cantidadParsed) {
    return res.status(400).json({ error: 'productoId y cantidad (>0) son obligatorios' });
  }

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se pueden editar ventas en BORRADOR' });
  }

  const producto = await prisma.producto.findUnique({ where: { id: productoIdParsed } });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  const tipoCambioActual = await obtenerTipoCambioActual();
  const precioPesosCalculado = calcularPrecioFinalPesos(producto, tipoCambioActual).precioVentaPesos;

  const existente = await prisma.ventaItem.findUnique({
    where: { ventaId_productoId: { ventaId, productoId: productoIdParsed } }
  });

  const cantidadFinal = (existente?.cantidad || 0) + cantidadParsed;
  if (cantidadFinal > producto.stock) {
    return res.status(400).json({ error: 'Stock insuficiente para ese producto' });
  }

  await prisma.ventaItem.upsert({
    where: { ventaId_productoId: { ventaId, productoId: productoIdParsed } },
    create: {
      ventaId,
      productoId: productoIdParsed,
      cantidad: cantidadParsed,
      precioUnitario: precioPesosCalculado,
      subtotal: precioPesosCalculado * cantidadParsed
    },
    update: {
      cantidad: cantidadFinal,
      precioUnitario: precioPesosCalculado,
      subtotal: precioPesosCalculado * cantidadFinal
    }
  });

  const items = await prisma.ventaItem.findMany({ where: { ventaId } });
  const ventaConDescuento = await prisma.venta.findUnique({ where: { id: ventaId }, select: { descuentoTipo: true, descuentoValor: true } });
  const totales = calcularTotalesConDescuento(items, ventaConDescuento?.descuentoTipo, ventaConDescuento?.descuentoValor);
  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { total: totales.total, subtotal: totales.subtotal },
    include: { persona: true, items: true }
  });

  res.json(ventaActualizada);
}));


app.put('/mostrador/ventas/:id/items/:productoId', asyncHandler(async (req, res) => {
  const ventaId = parsePositiveInt(req.params.id);
  const productoId = parsePositiveInt(req.params.productoId);
  const { cantidad } = req.body || {};
  if (!ventaId || !productoId) return res.status(400).json({ error: 'id inválido' });

  if (!Number.isInteger(cantidad) || cantidad < 0) {
    return res.status(400).json({ error: 'cantidad debe ser entero >= 0' });
  }

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se pueden editar ventas en BORRADOR' });
  }

  const existente = await prisma.ventaItem.findUnique({
    where: { ventaId_productoId: { ventaId, productoId } }
  });
  if (!existente) return res.status(404).json({ error: 'Item no encontrado en la venta' });

  if (cantidad === 0) {
    await prisma.ventaItem.delete({ where: { id: existente.id } });
  } else {
    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (cantidad > producto.stock) {
      return res.status(400).json({ error: 'Stock insuficiente para ese producto' });
    }

    await prisma.ventaItem.update({
      where: { id: existente.id },
      data: { cantidad, subtotal: existente.precioUnitario * cantidad }
    });
  }

  const items = await prisma.ventaItem.findMany({ where: { ventaId } });
  const ventaConDescuento = await prisma.venta.findUnique({ where: { id: ventaId }, select: { descuentoTipo: true, descuentoValor: true } });
  const totales = calcularTotalesConDescuento(items, ventaConDescuento?.descuentoTipo, ventaConDescuento?.descuentoValor);
  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { total: totales.total, subtotal: totales.subtotal },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaActualizada);
}));

app.put('/mostrador/ventas/:id/persona', asyncHandler(async (req, res) => {
  const ventaId = parsePositiveInt(req.params.id);
  if (!ventaId) return res.status(400).json({ error: 'id de venta inválido' });
  const { personaId, nombre, telefono, tipo, cuitDni } = req.body;

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se puede asociar persona a ventas en BORRADOR' });
  }

  let persona;
  if (personaId) {
    const personaIdParsed = parsePositiveInt(personaId);
    if (!personaIdParsed) return res.status(400).json({ error: 'personaId inválido' });
    persona = await prisma.persona.findUnique({ where: { id: personaIdParsed } });
    if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
  } else {
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'Debe enviar personaId o bien nombre completo' });
    }
    persona = await prisma.persona.create({
      data: {
        nombre: String(nombre).trim(),
        telefono: telefono ? String(telefono).trim() : null,
        cuitDni: cuitDni ? String(cuitDni).trim() : null,
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
}));

app.post('/mostrador/ventas/:id/cerrar', asyncHandler(async (req, res) => {
  const ventaId = parsePositiveInt(req.params.id);
  const { descuentoTipo, descuentoValor } = req.body || {};
  if (!ventaId) return res.status(400).json({ error: 'id de venta inválido' });

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: true }
  });

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'La venta ya no está en BORRADOR' });
  }
  if (venta.items.length === 0) {
    return res.status(400).json({ error: 'No se puede cerrar una venta sin productos' });
  }

  if (descuentoTipo && !['PORCENTAJE', 'MONTO'].includes(descuentoTipo)) {
    return res.status(400).json({ error: 'descuentoTipo inválido' });
  }

  if (Number(descuentoValor || 0) > 0 && !venta.personaId) {
    return res.status(400).json({ error: 'Para aplicar descuento, primero debe dar de alta al cliente.' });
  }

  const totales = calcularTotalesConDescuento(venta.items, descuentoTipo || null, descuentoValor || 0);

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
      await tx.movimientoStock.create({
        data: { productoId: item.productoId, tipo: TipoMovimientoStock.SALIDA, cantidad: item.cantidad, motivo: `Venta #${ventaId}` }
      });
    }

    await tx.venta.update({
      where: { id: ventaId },
      data: {
        estado: EstadoVenta.PENDIENTE_CAJA,
        subtotal: totales.subtotal,
        descuentoTipo: totales.descuentoTipo,
        descuentoValor: totales.descuentoValor,
        total: totales.total
      }
    });
  });

  const ventaCerrada = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaCerrada);
}));

app.get('/caja/ventas', asyncHandler(async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: { estado: EstadoVenta.PENDIENTE_CAJA },
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'asc' }
  });

  res.json(ventas);
}));

app.post('/caja/cobrar/:id', async (req, res) => {
  try {
    const ventaId = parsePositiveInt(req.params.id);
    if (!ventaId) return res.status(400).json({ error: 'id de venta inválido' });

    const { formaPago, medioPago } = req.body || {};
    console.log('Venta a cobrar:', ventaId);
    console.log('Forma de pago:', formaPago);

    const pago = formaPago || medioPago;
    if (!pago) {
      return res.status(400).json({ error: 'formaPago inválida' });
    }

    const venta = await prisma.venta.findUnique({ where: { id: ventaId } });

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.estado !== EstadoVenta.PENDIENTE_CAJA) {
      return res.status(400).json({ error: 'La venta no está pendiente de caja' });
    }

    if (pago === 'CUENTA_CORRIENTE') {
      if (!venta.personaId) {
        return res.status(400).json({ error: 'Cuenta corriente solo para clientes registrados' });
      }

      await prisma.$transaction(async tx => {
        const cuenta = await tx.cuentaCorriente.upsert({
          where: { personaId: venta.personaId },
          update: { saldo: { increment: venta.total } },
          create: {
            personaId: venta.personaId,
            saldo: venta.total
          }
        });

        await tx.movimientoCuentaCorriente.create({
          data: {
            cuentaCorrienteId: cuenta.id,
            ventaId,
            tipo: 'DEBITO',
            monto: venta.total,
            descripcion: `Venta #${ventaId} enviada a cuenta corriente`
          }
        });

        await tx.venta.update({
          where: { id: ventaId },
          data: { estado: EstadoVenta.COBRADA, medioPago: 'CUENTA_CORRIENTE' }
        });
      });
    } else {
      const mediosPermitidos = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
      if (!mediosPermitidos.includes(pago)) {
        return res.status(400).json({ error: 'formaPago inválida' });
      }

      await prisma.venta.update({
        where: { id: ventaId },
        data: { estado: EstadoVenta.COBRADA, medioPago: pago }
      });
    }

    const ventaCobrada = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: { persona: true, items: { include: { producto: true } } }
    });

    if (!ventaCobrada) {
      throw new Error('Error al actualizar estado de la venta');
    }

    return res.json(ventaCobrada);
  } catch (error) {
    console.error('Error al cobrar:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/ventas/cobradas-recientes', asyncHandler(async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: { estado: EstadoVenta.COBRADA },
    include: { persona: true },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });

  res.json(ventas);
}));

app.get('/ventas/cobradas', asyncHandler(async (req, res) => {
  const fecha = String(req.query.fecha || '').trim();
  const fechaConsulta = fecha || obtenerFechaCajaArgentina();
  const rango = obtenerRangoDiaCaja(fechaConsulta);
  if (!rango) {
    return res.status(400).json({ error: 'fecha inválida, use YYYY-MM-DD' });
  }

  const ventas = await prisma.venta.findMany({
    where: {
      estado: EstadoVenta.COBRADA,
      updatedAt: { gte: rango.inicio, lt: rango.fin }
    },
    include: {
      persona: { select: { nombre: true } },
      items: {
        select: {
          id: true,
          productoId: true,
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          producto: { select: { nombre: true } }
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  res.json(ventas.map(v => ({
    id: v.id,
    fechaCobro: v.updatedAt,
    cliente: v.persona?.nombre || 'Consumidor final',
    total: v.total,
    medioPago: v.medioPago,
    items: v.items.map(item => ({
      id: item.id,
      productoId: item.productoId,
      producto: item.producto?.nombre || 'Producto',
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal
    }))
  })));
}));

app.get('/ventas/:id/ticket', asyncHandler(async (req, res) => {
  const ventaId = parsePositiveInt(req.params.id);
  if (!ventaId) return res.status(400).send('id de venta inválido');

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  if (!venta) return res.status(404).send('Venta no encontrada');
  if (venta.estado !== EstadoVenta.COBRADA) {
    return res.status(400).send('Solo se puede generar ticket para ventas cobradas');
  }

  const negocio = 'Agroquímica y Fumigaciones San Bernardo';
  const cliente = venta.persona?.nombre || 'Consumidor final';
  const fecha = new Date(venta.updatedAt || venta.createdAt).toLocaleString('es-AR');
  const medioPago = venta.medioPago || '-';
  const rows = (venta.items || []).map(item => `
    <tr>
      <td>${escapeHtml(item.producto?.nombre || 'Producto')}</td>
      <td>${item.cantidad}</td>
      <td>$${Number(item.subtotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Ticket Venta #${venta.id}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 16px; max-width: 420px; }
      h1 { margin: 0 0 8px; font-size: 18px; }
      p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border-bottom: 1px solid #ddd; padding: 6px; text-align: left; }
      .total { font-size: 16px; margin-top: 10px; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(negocio)}</h1>
    <p><strong>Fecha:</strong> ${escapeHtml(fecha)}</p>
    <p><strong>Número de venta:</strong> #${venta.id}</p>
    <p><strong>Cliente:</strong> ${escapeHtml(cliente)}</p>
    <table>
      <thead>
        <tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="3">Sin productos</td></tr>'}
      </tbody>
    </table>
    <p><strong>Subtotal:</strong> $${Number(venta.subtotal || venta.total || 0).toFixed(2)}</p>
    <p><strong>Descuento:</strong> ${venta.descuentoTipo ? `${escapeHtml(venta.descuentoTipo)} ${Number(venta.descuentoValor || 0).toFixed(2)}` : 'Sin descuento'}</p>
    <p class="total"><strong>Total final:</strong> $${Number(venta.total || 0).toFixed(2)}</p>
    <p><strong>Medio de pago:</strong> ${escapeHtml(medioPago)}</p>
    <button onclick="window.print()">Imprimir</button>
  </body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

app.get('/caja/resumen', asyncHandler(async (req, res) => {
  const fechaCaja = String(req.query.fecha || obtenerFechaCajaArgentina());
  if (!parsearFechaCaja(fechaCaja)) {
    return res.status(400).json({ error: 'fecha inválida, use YYYY-MM-DD' });
  }
  const resumen = await calcularResumenCajaDia(fechaCaja);
  res.json(resumen);
}));

app.post('/caja/cerrar', asyncHandler(async (req, res) => {
  const fechaCaja = obtenerFechaCajaArgentina();
  const rango = obtenerRangoDiaCaja(fechaCaja);
  const inicio = rango.inicio;

  const existente = await prisma.cierreCajaDiario.findUnique({
    where: { fechaCaja }
  });

  if (existente) {
    return res.status(400).json({ error: 'La caja del día ya fue cerrada' });
  }

  const resumen = await calcularResumenCajaDia(fechaCaja);

  const cierre = await prisma.cierreCajaDiario.create({
    data: {
      fecha: inicio,
      fechaCaja,
      totalEfectivo: resumen.EFECTIVO,
      totalTransferencia: resumen.TRANSFERENCIA,
      totalTarjeta: resumen.TARJETA,
      totalCuentaCorriente: resumen.CUENTA_CORRIENTE,
      totalGeneral: resumen.totalGeneral
    }
  });

  res.status(201).json(cierre);
}));


app.get('/caja/cierres', asyncHandler(async (req, res) => {
  const cierres = await prisma.cierreCajaDiario.findMany({
    orderBy: [{ fechaCaja: 'desc' }, { fecha: 'desc' }]
  });

  const cierresConFechaVisible = cierres.map(cierre => ({
    ...cierre,
    fechaCaja: cierre.fechaCaja || obtenerFechaCajaArgentina(cierre.fecha)
  }));

  res.json(cierresConFechaVisible);
}));

app.delete('/caja/cierres/:id', asyncHandler(async (req, res) => {
  const cierreId = parsePositiveInt(req.params.id);
  if (!cierreId) return res.status(400).json({ error: 'id de cierre inválido' });

  const cierre = await prisma.cierreCajaDiario.findUnique({ where: { id: cierreId } });
  if (!cierre) return res.status(404).json({ error: 'Cierre no encontrado' });

  await prisma.cierreCajaDiario.delete({ where: { id: cierreId } });

  res.json({ ok: true, mensaje: 'Cierre eliminado (solo registro de prueba)' });
}));

app.get('/cuenta-corriente/personas/:personaId', asyncHandler(async (req, res) => {
  const personaId = parsePositiveInt(req.params.personaId);
  if (!personaId) return res.status(400).json({ error: 'personaId inválido' });
  const persona = await prisma.persona.findUnique({ where: { id: personaId } });
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });

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

  if (!cuenta) {
    return res.json({
      id: null,
      personaId: persona.id,
      persona,
      saldo: 0,
      movimientos: []
    });
  }
  res.json(cuenta);
}));

app.post('/cuenta-corriente/personas/:personaId/pagos', asyncHandler(async (req, res) => {
  const personaId = parsePositiveInt(req.params.personaId);
  if (!personaId) return res.status(400).json({ error: 'personaId inválido' });
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
}));

app.use((err, req, res, next) => {
  console.error('[backend-error]', { method: req.method, path: req.path, message: err.message, stack: err.stack });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.get('/app', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'app', 'index.html'));
});

app.use('/app', express.static(require('path').join(__dirname, 'app')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});

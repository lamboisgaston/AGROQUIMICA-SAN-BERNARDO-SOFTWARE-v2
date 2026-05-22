const express = require('express');
const { PrismaClient, EstadoVenta, MedioPago, TipoMovimientoStock, EstadoPresupuesto, TipoDestinatarioPresupuesto, CondicionPagoPrevista, TurnoCaja, TipoPedido, EstadoPedido, TipoOperacionVenta, TipoReglaComercial } = require('@prisma/client');
const PDFDocument = require('pdfkit');

const app = express();
const prisma = new PrismaClient();
const DATABASE_URL_EFECTIVA = process.env.DATABASE_URL || 'file:./dev.db';
console.log(`[db] Prisma DATABASE_URL efectiva: ${DATABASE_URL_EFECTIVA}`);

app.use(express.json());
app.use('/semillasya/api', (req, _res, next) => {
  req.url = req.url.replace(/^\/api/, '');
  next();
});


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



function normalizarTelefono(valor) {
  return String(valor || '').replace(/\D+/g, '');
}
function parseJsonSafe(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function armarMensajeWhatsAppSemillasYaInterno({ presupuestoId, nombre, pais, provincia, localidad, items }) {
  const resumenItems = items.slice(0, 6).map((it) => `${it.nombreProducto} x ${it.cantidad}`).join(', ');
  const extra = items.length > 6 ? ` (+${items.length - 6} más)` : '';
  return [
    `Nueva solicitud SemillasYa #${presupuestoId}`,
    `Cliente: ${nombre}`,
    `País: ${pais || 'No informado'}`,
    `Provincia: ${provincia || 'No informada'}`,
    `Localidad: ${localidad || 'No informada'}`,
    `Ítems: ${resumenItems || 'Sin ítems'}${extra}`
  ].join(' | ');
}

function formatMoney(value) {
  return '$' + Number(value || 0).toFixed(2);
}

function enumValuesSafe(enumObj) {
  return enumObj && typeof enumObj === 'object' ? Object.values(enumObj) : [];
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

async function calcularResumenCajaDia(fechaCaja = obtenerFechaCajaArgentina(), turno = "DIARIO") {
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
    prisma.cierreCajaDiario.findFirst({
      where: { fechaCaja, turno },
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
    turno,
    totalGeneral: resumen.EFECTIVO + resumen.TRANSFERENCIA + resumen.TARJETA + resumen.CUENTA_CORRIENTE,
    estado: cierre ? 'CERRADO' : 'ABIERTO',
    cierre
  };
}





const ROLES_DIAGNOSTICO = new Set(['ADMINISTRADOR_GENERAL', 'GERENTE']);

function requireDiagnosticoRole(req, res, next) {
  const rol = obtenerRolRequest(req);
  if (!ROLES_DIAGNOSTICO.has(rol)) return res.status(403).json({ error: 'Rol no autorizado para diagnóstico del sistema' });
  req.userRole = rol;
  next();
}

const ROLES_CIERRE_CAJA = new Set(['ADMINISTRADOR_GENERAL', 'GERENTE', 'CAJA']);

function obtenerRolRequest(req) {
  return String(req.headers['x-user-role'] || req.body?.rol || req.query?.rol || '').trim().toUpperCase();
}

function requireCajaRole(req, res, next) {
  const rol = obtenerRolRequest(req);
  if (!ROLES_CIERRE_CAJA.has(rol)) return res.status(403).json({ error: 'Rol no autorizado para operaciones de caja' });
  req.userRole = rol;
  next();
}

function normalizarTurnoCaja(turno) {
  const t = String(turno || 'DIARIO').trim().toUpperCase();
  return ['MANANA', 'TARDE', 'NOCHE', 'DIARIO'].includes(t) ? t : null;
}
function calcularTotalesConDescuento(items = [], descuentoTipo = null, descuentoValor = 0, ajusteRedondeo = 0) {
  const subtotal = items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
  const valor = Math.max(0, Number(descuentoValor || 0));

  let descuentoAplicado = 0;
  if (descuentoTipo === 'PORCENTAJE') {
    descuentoAplicado = subtotal * (valor / 100);
  } else if (descuentoTipo === 'MONTO') {
    descuentoAplicado = valor;
  }

  const ajuste = Number(ajusteRedondeo || 0);
  const total = Math.max(0, subtotal - descuentoAplicado + ajuste);

  return {
    subtotal,
    descuentoTipo: (descuentoTipo === 'PORCENTAJE' || descuentoTipo === 'MONTO') ? descuentoTipo : null,
    descuentoValor: valor,
    ajusteRedondeo: ajuste,
    total
  };
}

function aplicarReglasComerciales(base, reglas = []) {
  let precio = Number(base || 0);
  const detalle = [];
  for (const regla of reglas.sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))) {
    const valor = Number(regla.valor || 0);
    const delta = precio * (valor / 100);
    if (regla.tipo === TipoReglaComercial.DESCUENTO_PORCENTAJE || regla.tipo === TipoReglaComercial.BONIFICACION_PORCENTAJE) precio -= delta;
    else precio += delta;
    detalle.push({ reglaId: regla.id, nombre: regla.nombre, tipo: regla.tipo, valor, precioParcial: precio });
  }
  return { precioFinal: Math.max(0, precio), detalle };
}
const usuarios = [
  { usuario: 'admin', password: 'admin123', rol: 'ADMINISTRADOR_GENERAL' },
  { usuario: 'gerente', password: 'gerente123', rol: 'GERENTE' },
  { usuario: 'operador', password: 'operador123', rol: 'MOSTRADOR' }
];
const registrosEliminados = [];
const PASSWORD_ELIMINACION = '12345';

app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'app', 'index.html'));
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


app.get('/api/estado-sistema', process.env.NODE_ENV === 'production' ? requireDiagnosticoRole : (_req, _res, next) => next(), asyncHandler(async (_req, res) => {
  const inicioLectura = new Date();
  const hayMovimientoCaja = Boolean(prisma.movimientoCaja);
  const alertasOperativas = {
    productosSinCategoria: null,
    productosSinPrecio: null,
    productosConStockBajo: null,
    ventasPendientes: null,
    presupuestosRecientes: null,
    ultimaVenta: null,
    ultimoPresupuesto: null
  };
  const auditoriaDatos = {
    productosSinCategoria: null,
    productosSinPrecio: null,
    productosSinCosto: null,
    productosSinImagen: null,
    productosDuplicados: [],
    clientesDuplicados: [],
    ventasBorradorAntiguas: null,
    presupuestosPendientes: null
  };

  try {
    const modeloProductoDisponible = Boolean(prisma.producto);
    const modeloPersonaDisponible = Boolean(prisma.persona);
    const modeloVentaDisponible = Boolean(prisma.venta);
    const modeloPresupuestoDisponible = Boolean(prisma.presupuesto);

    let productos = null;
    let personas = null;
    let ventas = null;
    let presupuestos = null;
    let movimientosCaja = hayMovimientoCaja ? null : null;

    if (modeloProductoDisponible) {
      try {
        productos = await prisma.producto.count({ where: { eliminado: false } });
      } catch (_error) {
        productos = null;
      }
    }

    if (modeloPersonaDisponible) {
      try {
        personas = await prisma.persona.count({ where: { eliminado: false } });
      } catch (_error) {
        personas = null;
      }
    }

    if (modeloVentaDisponible) {
      try {
        ventas = await prisma.venta.count();
      } catch (_error) {
        ventas = null;
      }
    }

    if (modeloPresupuestoDisponible) {
      try {
        presupuestos = await prisma.presupuesto.count();
      } catch (_error) {
        presupuestos = null;
      }
    }

    if (hayMovimientoCaja) {
      try {
        movimientosCaja = await prisma.movimientoCaja.count();
      } catch (_error) {
        movimientosCaja = null;
      }
    }

    if (modeloProductoDisponible) {
      try {
        alertasOperativas.productosSinCategoria = await prisma.producto.count({
          where: {
            eliminado: false,
            OR: [
              { categoria: null },
              { categoria: '' }
            ]
          }
        });
      } catch (_error) {
        alertasOperativas.productosSinCategoria = null;
      }

      try {
        alertasOperativas.productosSinPrecio = await prisma.producto.count({
          where: {
            eliminado: false,
            OR: [
              { precioVenta: null },
              { precioVenta: { lte: 0 } }
            ]
          }
        });
      } catch (_error) {
        alertasOperativas.productosSinPrecio = null;
      }

      try {
        const productosConStock = await prisma.producto.findMany({
          where: { eliminado: false },
          select: { stock: true, stockMinimo: true }
        });
        alertasOperativas.productosConStockBajo = productosConStock.filter((item) => {
          const stock = Number(item.stock ?? 0);
          const stockMinimo = Number(item.stockMinimo ?? 0);
          return stock <= stockMinimo;
        }).length;
      } catch (_error) {
        alertasOperativas.productosConStockBajo = null;
      }
    }

    if (modeloVentaDisponible) {
      try {
        alertasOperativas.ventasPendientes = await prisma.venta.count({
          where: { estado: { not: 'COBRADA' } }
        });
      } catch (_error) {
        alertasOperativas.ventasPendientes = null;
      }

      try {
        const ultimaVenta = await prisma.venta.findFirst({
          orderBy: { createdAt: 'desc' }
        });
        alertasOperativas.ultimaVenta = ultimaVenta
          ? {
              id: ultimaVenta.id,
              estado: ultimaVenta.estado ?? null,
              total: ultimaVenta.total ?? null,
              createdAt: ultimaVenta.createdAt ?? null
            }
          : null;
      } catch (_error) {
        alertasOperativas.ultimaVenta = null;
      }
    }

    if (modeloPresupuestoDisponible) {
      try {
        const desde = new Date();
        desde.setDate(desde.getDate() - 7);
        alertasOperativas.presupuestosRecientes = await prisma.presupuesto.count({
          where: { createdAt: { gte: desde } }
        });
      } catch (_error) {
        alertasOperativas.presupuestosRecientes = null;
      }

      try {
        const ultimoPresupuesto = await prisma.presupuesto.findFirst({
          orderBy: { createdAt: 'desc' }
        });
        alertasOperativas.ultimoPresupuesto = ultimoPresupuesto
          ? {
              id: ultimoPresupuesto.id,
              estado: ultimoPresupuesto.estado ?? null,
              total: ultimoPresupuesto.total ?? null,
              createdAt: ultimoPresupuesto.createdAt ?? null
            }
          : null;
      } catch (_error) {
        alertasOperativas.ultimoPresupuesto = null;
      }
    }

    if (modeloProductoDisponible) {
      try {
        auditoriaDatos.productosSinCategoria = await prisma.producto.count({
          where: {
            eliminado: false,
            OR: [
              { categoria: null },
              { categoria: '' }
            ]
          }
        });
      } catch (_error) {
        auditoriaDatos.productosSinCategoria = null;
      }

      try {
        auditoriaDatos.productosSinPrecio = await prisma.producto.count({
          where: {
            eliminado: false,
            OR: [
              { precioVenta: null },
              { precioVenta: { lte: 0 } }
            ]
          }
        });
      } catch (_error) {
        auditoriaDatos.productosSinPrecio = null;
      }

      try {
        try {
          auditoriaDatos.productosSinCosto = await prisma.producto.count({
            where: {
              eliminado: false,
              OR: [
                { costoBase: null },
                { costoBase: { lte: 0 } }
              ]
            }
          });
        } catch (_errorCostoBase) {
          auditoriaDatos.productosSinCosto = await prisma.producto.count({
            where: {
              eliminado: false,
              OR: [
                { precioUsd: null },
                { precioUsd: { lte: 0 } }
              ]
            }
          });
        }
      } catch (_error) {
        auditoriaDatos.productosSinCosto = null;
      }

      try {
        try {
          auditoriaDatos.productosSinImagen = await prisma.producto.count({
            where: {
              eliminado: false,
              OR: [
                { imagenUrl: null },
                { imagenUrl: '' },
                { imagen: null },
                { imagen: '' }
              ]
            }
          });
        } catch (_errorImagenCompleta) {
          auditoriaDatos.productosSinImagen = await prisma.producto.count({
            where: {
              eliminado: false,
              OR: [
                { imagenUrl: null },
                { imagenUrl: '' }
              ]
            }
          });
        }
      } catch (_error) {
        auditoriaDatos.productosSinImagen = null;
      }

      try {
        const productos = await prisma.producto.findMany({
          where: { eliminado: false },
          select: { id: true, nombre: true, codigo: true }
        });
        const mapaProductos = new Map();
        for (const item of productos) {
          const clave = String(item.codigo || item.nombre || '').trim().toLowerCase();
          if (!clave) continue;
          if (!mapaProductos.has(clave)) mapaProductos.set(clave, []);
          mapaProductos.get(clave).push({ id: item.id, nombre: item.nombre ?? null, codigo: item.codigo ?? null });
        }
        auditoriaDatos.productosDuplicados = Array.from(mapaProductos.values())
          .filter((grupo) => grupo.length > 1)
          .slice(0, 20);
      } catch (_error) {
        auditoriaDatos.productosDuplicados = [];
      }
    }

    if (modeloPersonaDisponible) {
      try {
        const clientes = await prisma.persona.findMany({
          where: { eliminado: false },
          select: { id: true, nombre: true, documento: true, cuit: true }
        });
        const mapaClientes = new Map();
        for (const item of clientes) {
          const clave = String(item.documento || item.cuit || item.nombre || '').trim().toLowerCase();
          if (!clave) continue;
          if (!mapaClientes.has(clave)) mapaClientes.set(clave, []);
          mapaClientes.get(clave).push({ id: item.id, nombre: item.nombre ?? null, documento: item.documento ?? null, cuit: item.cuit ?? null });
        }
        auditoriaDatos.clientesDuplicados = Array.from(mapaClientes.values())
          .filter((grupo) => grupo.length > 1)
          .slice(0, 20);
      } catch (_error) {
        auditoriaDatos.clientesDuplicados = [];
      }
    }

    if (modeloVentaDisponible) {
      try {
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        auditoriaDatos.ventasBorradorAntiguas = await prisma.venta.count({
          where: {
            estado: 'BORRADOR',
            createdAt: { lt: hace30Dias }
          }
        });
      } catch (_error) {
        auditoriaDatos.ventasBorradorAntiguas = null;
      }
    }

    if (modeloPresupuestoDisponible) {
      try {
        auditoriaDatos.presupuestosPendientes = await prisma.presupuesto.count({
          where: { estado: { in: ['PENDIENTE', 'PENDIENTE_APROBACION'] } }
        });
      } catch (_error) {
        auditoriaDatos.presupuestosPendientes = null;
      }
    }

    return res.json({
      sistema: 'Agroquímica San Bernardo',
      estadoBaseDatos: 'OK',
      baseDatos: {
        conectada: true,
        proveedor: 'Prisma'
      },
      conteos: {
        productos,
        personasClientes: personas,
        ventas,
        presupuestos,
        movimientosCaja
      },
      modelos: {
        movimientoCajaDisponible: hayMovimientoCaja
      },
      alertasOperativas,
      auditoriaDatos: {},
      auditoriaDatos,
      ultimaLectura: new Date().toISOString(),
      duracionLecturaMs: Date.now() - inicioLectura.getTime()
    });
  } catch (error) {
    return res.status(503).json({
      sistema: 'Agroquímica San Bernardo',
      estadoBaseDatos: 'ERROR',
      baseDatos: {
        conectada: false,
        proveedor: 'Prisma',
        detalle: error.message || String(error)
      },
      conteos: {
        productos: null,
        personasClientes: null,
        ventas: null,
        presupuestos: null,
        movimientosCaja: hayMovimientoCaja ? null : null
      },
      modelos: {
        movimientoCajaDisponible: hayMovimientoCaja
      },
      auditoriaDatos: {
        productosSinCategoria: null,
        productosSinPrecio: null,
        productosSinCosto: null,
        productosSinImagen: null,
        productosDuplicados: [],
        clientesDuplicados: [],
        ventasBorradorAntiguas: null,
        presupuestosPendientes: null
      },
      ultimaLectura: new Date().toISOString(),
      duracionLecturaMs: Date.now() - inicioLectura.getTime()
    });
  }
}));

app.get('/eliminados', asyncHandler(async (_req, res) => {
  const [clientes, productos, proveedores] = await Promise.all([
    prisma.persona.findMany({ where: { eliminado: true }, orderBy: { eliminadoAt: 'desc' } }),
    prisma.producto.findMany({ where: { eliminado: true }, orderBy: { eliminadoAt: 'desc' } }),
    prisma.proveedor.findMany({ where: { eliminado: true }, orderBy: { eliminadoAt: 'desc' } })
  ]);
  res.json({
    registros: [
      ...clientes.map((item) => ({ tipo: 'CLIENTE', id: item.id, nombre: item.nombre, fecha: item.eliminadoAt, eliminadoPor: item.eliminadoPor, motivo: item.motivoEliminacion })),
      ...productos.map((item) => ({ tipo: 'PRODUCTO', id: item.id, nombre: item.nombre, fecha: item.eliminadoAt, eliminadoPor: item.eliminadoPor, motivo: item.motivoEliminacion })),
      ...proveedores.map((item) => ({ tipo: 'PROVEEDOR', id: item.id, nombre: item.razonSocial, fecha: item.eliminadoAt, eliminadoPor: item.eliminadoPor, motivo: item.motivoEliminacion }))
    ]
  });
}));

function validarPasswordEliminacion(password) {
  return String(password || '') === PASSWORD_ELIMINACION;
}

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
  const precioDirecto = producto.precioPesosCalculado ?? producto.precioVentaPesos ?? producto.precioFinalPesos ?? producto.precioVenta ?? producto.precio;
  if (Number(precioDirecto) > 0) {
    const precio = Number(numeroSeguro(precioDirecto).toFixed(2));
    return {
      costoCompraPesos: precio,
      costoTotalPesos: precio,
      precioVentaPesos: precio
    };
  }

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


function obtenerCategoriaDelegate() {
  const delegate = prisma.categoria;
  if (!delegate) {
    const error = new Error('El modelo Prisma "Categoria" no está disponible en Prisma Client. Ejecutá "npx prisma generate" y reiniciá el servidor.');
    error.status = 500;
    throw error;
  }
  return delegate;
}


function calcularPrecioProductoPrecampania(producto = {}) {
  const usaPrecioManual = Boolean(producto.usaPrecioManual);
  const precioManual = numeroSeguro(producto.precioManual ?? producto.precioInternoManual ?? 0);
  if (usaPrecioManual) {
    return Number(precioManual.toFixed(2));
  }
  const monedaCompra = String(producto.monedaCompra || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS';
  const costoCompra = numeroSeguro(producto.costoCompra ?? 0);
  const tipoCambio = numeroSeguro(producto.tipoCambio, 1);
  const porcentajeFlete = numeroSeguro(producto.porcentajeFlete ?? 0);
  const porcentajeIva = numeroSeguro(producto.porcentajeIva ?? 0);
  const porcentajeMargen = numeroSeguro(producto.porcentajeMargen ?? 0);

  const base = monedaCompra === 'USD' ? (costoCompra * tipoCambio) : costoCompra;
  const baseConFlete = base * (1 + (porcentajeFlete / 100));
  const baseConIva = baseConFlete * (1 + (porcentajeIva / 100));
  const final = baseConIva * (1 + (porcentajeMargen / 100));
  return Number(numeroSeguro(final).toFixed(2));
}

function normalizarPayloadProductoPrecampania(payload = {}) {
  const moneda = String(payload.monedaCompra || 'ARS').trim().toUpperCase();
  const monedaCompra = moneda === 'USD' ? 'USD' : 'ARS';
  const usaPrecioManual = Boolean(payload.usaPrecioManual);
  const precioManual = payload.precioManual == null || payload.precioManual === '' ? null : Number(payload.precioManual);
  const base = {
    nombre: String(payload.nombre || '').trim(),
    semilleroLaboratorio: String(payload.semilleroLaboratorio || '').trim(),
    categoria: String(payload.categoria || '').trim(),
    presentacionEnvase: String(payload.presentacionEnvase || '').trim(),
    descripcion: String(payload.descripcion || '').trim(),
    precioInternoManual: payload.precioInternoManual == null || payload.precioInternoManual === '' ? null : Number(payload.precioInternoManual),
    monedaCompra,
    costoCompra: Number(payload.costoCompra || 0),
    tipoCambio: Number(payload.tipoCambio || 1),
    porcentajeFlete: Number(payload.porcentajeFlete || 0),
    porcentajeIva: Number(payload.porcentajeIva || 0),
    porcentajeMargen: Number(payload.porcentajeMargen || 0),
    precioManual,
    usaPrecioManual,
    estado: ['DISPONIBLE','CONSULTAR','AGOTADO'].includes(String(payload.estado || '')) ? payload.estado : 'CONSULTAR',
    publicadoWeb: Boolean(payload.publicadoWeb),
    visibleEnSemillasYa: Boolean(payload.visibleEnSemillasYa)
  };
  if (base.visibleEnSemillasYa) {
    base.publicadoWeb = true;
  }
  base.precioVentaFinal = calcularPrecioProductoPrecampania(base);
  if (base.usaPrecioManual && base.precioInternoManual == null && base.precioManual != null) {
    base.precioInternoManual = base.precioManual;
  }
  return base;
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
  const categoriaIds = Array.isArray(payload.categoriaIds) ? payload.categoriaIds : [];
  const obligatorios = [
    ['nombre', payload.nombre],
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
  if (payload.__requiereCategoria && !categoriaIds.length) {
    return 'Debe seleccionar al menos una categoría';
  }
  return null;
}

function parseCategoriaIds(raw = []) {
  return [...new Set((Array.isArray(raw) ? raw : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function construirFiltroBusquedaProductos(q = '') {
  const termino = String(q || '').trim();
  if (!termino) return undefined;
  const idBuscado = Number(termino);
  const or = [
    { nombre: { contains: termino } },
    { categoria: { contains: termino } },
    { marca: { contains: termino } }
  ];
  if (Number.isInteger(idBuscado) && idBuscado > 0) {
    or.push({ id: idBuscado });
  }
  return { OR: or };
}

app.get('/productos', async (req, res) => {
  try {
    const tipoCambioActual = await obtenerTipoCambioActual();
    const q = String(req.query.q || '').trim();
    const productos = await prisma.producto.findMany({
      where: { ...(construirFiltroBusquedaProductos(q) || {}), eliminado: false, activo: true },
      include: { proveedores: { include: { proveedor: true } }, categorias: true },
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
    where: { ...(construirFiltroBusquedaProductos(q) || {}), eliminado: false, activo: true },
      include: { proveedores: { include: { proveedor: true } }, categorias: true },
    orderBy: { nombre: 'asc' },
    take: 20
  });
  res.json(productos.map(p => mapearProductoConPrecioPesos(p, tipoCambioActual)));
}));

app.post('/productos', asyncHandler(async (req, res) => {
  try {
    const { id: _idIgnorado, ...payloadSinId } = req.body || {};
    console.log('[producto-guardado][backend] POST /productos payload', payloadSinId);
    const totalCategoriasActivas = await obtenerCategoriaDelegate().count({ where: { activo: true } });
    const errorValidacion = validarPayloadProducto({ ...payloadSinId, __requiereCategoria: totalCategoriasActivas > 0 });
    if (errorValidacion) {
      console.warn('[producto-guardado][backend] POST /productos validacion', { error: errorValidacion, payload: req.body });
      return res.status(400).json({ error: errorValidacion });
    }
    const tipoCambioActual = await obtenerTipoCambioActual();
    const categoriaIds = parseCategoriaIds(payloadSinId?.categoriaIds);
    const categorias = await obtenerCategoriaDelegate().findMany({ where: { id: { in: categoriaIds }, activo: true } });
    if (categorias.length !== categoriaIds.length) return res.status(400).json({ error: 'Una o más categorías no existen o están inactivas' });
    const data = normalizarPayloadProducto({ ...payloadSinId, categoria: categorias.map((c) => c.nombre).join(', ') }, tipoCambioActual);
    console.log('[producto-guardado][backend] POST /productos normalizado', data);
    const proveedorIds = Array.isArray(payloadSinId?.proveedorIds) ? Array.from(new Set(payloadSinId.proveedorIds.map(Number).filter(Number.isInteger))) : [];
    const producto = await prisma.producto.create({ data: { ...data, categorias: { connect: categoriaIds.map((id) => ({ id })) } } });
    console.log('[producto-guardado][backend] POST /productos creado', { id: producto.id, nombre: producto.nombre });
    if (proveedorIds.length) {
      await prisma.productoProveedor.createMany({ data: proveedorIds.map(proveedorId => ({ productoId: producto.id, proveedorId })) });
    }
    const productoConProveedores = await prisma.producto.findUnique({ where: { id: producto.id }, include: { proveedores: { include: { proveedor: true } }, categorias: true } });
    res.status(201).json(mapearProductoConPrecioPesos(productoConProveedores, tipoCambioActual));
  } catch (error) {
    console.error('[producto-guardado][backend] POST /productos error', { message: error.message, stack: error.stack, payload: req.body });
    throw error;
  }
}));

app.get('/categorias', asyncHandler(async (_req, res) => {
  const categorias = await obtenerCategoriaDelegate().findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
  res.json(categorias);
}));

app.post('/categorias', asyncHandler(async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const descripcion = String(req.body?.descripcion || '').trim() || null;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  const existente = await obtenerCategoriaDelegate().findUnique({ where: { nombre } });
  if (existente) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
  const creada = await obtenerCategoriaDelegate().create({ data: { nombre, descripcion } });
  res.status(201).json(creada);
}));

app.put('/categorias/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const nombre = req.body?.nombre == null ? undefined : String(req.body.nombre).trim();
  const descripcion = req.body?.descripcion == null ? undefined : (String(req.body.descripcion).trim() || null);
  const activo = req.body?.activo == null ? undefined : Boolean(req.body.activo);
  if (nombre !== undefined && !nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  const actualizada = await obtenerCategoriaDelegate().update({
    where: { id },
    data: { ...(nombre !== undefined ? { nombre } : {}), ...(descripcion !== undefined ? { descripcion } : {}), ...(activo !== undefined ? { activo } : {}) }
  });
  res.json(actualizada);
}));

app.put('/productos/:id', asyncHandler(async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    console.log('[producto-guardado][backend] PUT /productos/:id payload', { id, body: req.body });
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const totalCategoriasActivas = await obtenerCategoriaDelegate().count({ where: { activo: true } });
    const errorValidacion = validarPayloadProducto({ ...req.body, __requiereCategoria: totalCategoriasActivas > 0 });
    if (errorValidacion) {
      console.warn('[producto-guardado][backend] PUT /productos/:id validacion', { error: errorValidacion, payload: req.body });
      return res.status(400).json({ error: errorValidacion });
    }
    const tipoCambioActual = await obtenerTipoCambioActual();
    const existente = await prisma.producto.findUnique({ where: { id }, include: { categorias: true } });
    if (!existente) return res.status(404).json({ error: 'Producto no encontrado' });

    const categoriaIds = parseCategoriaIds(req.body?.categoriaIds);
    const categorias = await obtenerCategoriaDelegate().findMany({ where: { id: { in: categoriaIds }, activo: true } });
    if (categorias.length !== categoriaIds.length) return res.status(400).json({ error: 'Una o más categorías no existen o están inactivas' });
    const data = normalizarPayloadProducto({ ...existente, ...req.body, categoria: categorias.map((c) => c.nombre).join(', ') }, tipoCambioActual);
    console.log('[producto-guardado][backend] PUT /productos/:id normalizado', { id, data });
    const proveedorIds = Array.isArray(req.body?.proveedorIds) ? Array.from(new Set(req.body.proveedorIds.map(Number).filter(Number.isInteger))) : [];
    await prisma.$transaction(async tx => {
      await tx.producto.update({ where: { id }, data: { ...data, categorias: { set: categoriaIds.map((cid) => ({ id: cid })) } } });
      if (Array.isArray(req.body?.proveedorIds)) {
        await tx.productoProveedor.deleteMany({ where: { productoId: id } });
        if (proveedorIds.length) {
          await tx.productoProveedor.createMany({ data: proveedorIds.map(proveedorId => ({ productoId: id, proveedorId })) });
        }
      }
    });
    const producto = await prisma.producto.findUnique({ where: { id }, include: { proveedores: { include: { proveedor: true } }, categorias: true } });
    console.log('[producto-guardado][backend] PUT /productos/:id actualizado', { id: producto?.id, nombre: producto?.nombre });
    res.json(mapearProductoConPrecioPesos(producto, tipoCambioActual));
  } catch (error) {
    console.error('[producto-guardado][backend] PUT /productos/:id error', { message: error.message, stack: error.stack, payload: req.body });
    throw error;
  }
}));

app.delete('/productos/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { password, motivo } = req.body || {};
  if (!validarPasswordEliminacion(password)) return res.status(401).json({ error: 'Contraseña incorrecta para eliminar' });
  const existente = await prisma.producto.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: 'Producto no encontrado' });
  await prisma.producto.update({ where: { id }, data: { eliminado: true, activo: false, eliminadoAt: new Date(), eliminadoPor: req.headers['x-usuario'] || 'sistema', motivoEliminacion: String(motivo || '').trim() || null } });
  res.json({ ok: true });
}));

app.get('/proveedores', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const proveedores = await prisma.proveedor.findMany({
    where: q ? {
      eliminado: false,
      activo: true,
      OR: [
        { razonSocial: { contains: q } },
        { cuit: { contains: q } },
        { contactoComercial: { contains: q } },
        { telefono: { contains: q } },
        { mail: { contains: q } }
      ]
    } : { eliminado: false, activo: true },
    select: { id: true, razonSocial: true, cuit: true, telefono: true, mail: true, direccion: true, contactoComercial: true, observaciones: true },
    orderBy: { razonSocial: 'asc' },
    take: q ? 50 : undefined
  });
  res.json(proveedores);
}));

app.post('/proveedores', asyncHandler(async (req, res) => {
  const { razonSocial, telefono, cuit, mail, direccion, contactoComercial, observaciones } = req.body || {};
  if (!razonSocial || !String(razonSocial).trim()) return res.status(400).json({ error: 'razonSocial es obligatorio' });
  const proveedor = await prisma.proveedor.create({
    data: { razonSocial: String(razonSocial).trim(), telefono: telefono || null, cuit: cuit || null, mail: mail || null, direccion: direccion || null, contactoComercial: contactoComercial || null, observaciones: observaciones || null }
  });
  res.status(201).json(proveedor);
}));

app.put('/proveedores/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { razonSocial, telefono, cuit, mail, direccion, contactoComercial, observaciones } = req.body || {};
  const proveedor = await prisma.proveedor.update({
    where: { id },
    data: { razonSocial: String(razonSocial || '').trim(), telefono: telefono || null, cuit: cuit || null, mail: mail || null, direccion: direccion || null, contactoComercial: contactoComercial || null, observaciones: observaciones || null }
  });
  res.json(proveedor);
}));

app.delete('/proveedores/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { password, motivo } = req.body || {};
  if (!validarPasswordEliminacion(password)) return res.status(401).json({ error: 'Contraseña incorrecta para eliminar' });
  const existente = await prisma.proveedor.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: 'Proveedor no encontrado' });
  await prisma.proveedor.update({ where: { id }, data: { eliminado: true, activo: false, eliminadoAt: new Date(), eliminadoPor: req.headers['x-usuario'] || 'sistema', motivoEliminacion: String(motivo || '').trim() || null } });
  res.json({ ok: true });
}));

app.post('/eliminados/restaurar', asyncHandler(async (req, res) => {
  const tipo = String(req.body?.tipo || '').toUpperCase();
  const id = parsePositiveInt(req.body?.id);
  if (!id || !['CLIENTE', 'PRODUCTO', 'PROVEEDOR'].includes(tipo)) return res.status(400).json({ error: 'tipo o id inválido' });
  const data = { eliminado: false, activo: true, eliminadoAt: null, eliminadoPor: null, motivoEliminacion: null };
  if (tipo === 'CLIENTE') await prisma.persona.update({ where: { id }, data });
  if (tipo === 'PRODUCTO') await prisma.producto.update({ where: { id }, data });
  if (tipo === 'PROVEEDOR') await prisma.proveedor.update({ where: { id }, data });
  res.json({ ok: true });
}));

app.get('/proveedores/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const proveedor = await prisma.proveedor.findUnique({
    where: { id },
    select: { id: true, razonSocial: true, cuit: true, telefono: true, mail: true, direccion: true, contactoComercial: true, observaciones: true }
  });
  if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(proveedor);
}));

app.get('/proveedores/:id/productos', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const q = String(req.query.q || '').trim();
  const tipoCambioActual = await obtenerTipoCambioActual();
  const productos = await prisma.producto.findMany({
    where: {
      eliminado: false,
      activo: true,
      proveedores: { some: { proveedorId: id } },
      ...(q ? { OR: [{ nombre: { contains: q } }, { categoria: { contains: q } }, { marca: { contains: q } }] } : {})
    },
    orderBy: { nombre: 'asc' },
    include: { proveedores: { include: { proveedor: true } } }
  });
  const costos = await prisma.detalleRemitoProveedor.findMany({
    where: { remito: { proveedorId: id } },
    orderBy: [{ id: 'desc' }]
  });
  const ultimoCostoPorProducto = new Map();
  costos.forEach((c) => {
    if (!ultimoCostoPorProducto.has(c.productoId)) ultimoCostoPorProducto.set(c.productoId, c);
  });
  res.json(productos.map((p) => {
    const base = mapearProductoConPrecioPesos(p, tipoCambioActual);
    const ultimo = ultimoCostoPorProducto.get(p.id);
    return {
      ...base,
      ultimoCosto: ultimo?.costoCompra ?? null,
      monedaUltimoCosto: ultimo?.monedaCosto ?? null
    };
  }));
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

app.delete('/proveedores/:id/productos/:productoId', asyncHandler(async (req, res) => {
  const proveedorId = parsePositiveInt(req.params.id);
  const productoId = parsePositiveInt(req.params.productoId);
  if (!proveedorId || !productoId) return res.status(400).json({ error: 'ids inválidos' });
  await prisma.productoProveedor.deleteMany({ where: { proveedorId, productoId } });
  res.json({ ok: true });
}));

app.get('/productos/:id/proveedores', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const producto = await prisma.producto.findUnique({ where: { id }, include: { proveedores: { include: { proveedor: true } } } });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json((producto.proveedores || []).map(p => p.proveedor));
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
  const estado = producto.stock === 0 ? 'SIN_STOCK' : producto.stock <= Number(producto.stockMinimo || 0) ? 'BAJO_STOCK' : 'STOCK_NORMAL';
  res.json({ productoId: id, cantidadActual: producto.stock, stockMinimo: producto.stockMinimo || 0, unidad: producto.unidad || 'UN', ultimaActualizacion: producto.ultimaActualizacionStock, estado, movimientos });
}));

app.post('/productos/:id/stock', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { tipo, cantidad, motivo, stockMinimo } = req.body || {};
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
    const actualizado = await tx.producto.update({ where: { id }, data: { stock: nuevoStock, stockMinimo: Number.isInteger(Number(stockMinimo)) ? Number(stockMinimo) : undefined, ultimaActualizacionStock: new Date() } });
    const movimiento = await tx.movimientoStock.create({ data: { productoId: id, tipo, cantidad: cantidadNum, motivo: String(motivo).trim() } });
    return { actualizado, movimiento };
  });
  res.status(201).json({ cantidadActual: result.actualizado.stock, stockMinimo: result.actualizado.stockMinimo || 0, ultimaActualizacion: result.actualizado.ultimaActualizacionStock, movimiento: result.movimiento });
}));

app.get('/stock', asyncHandler(async (_req, res) => {
  const productos = await prisma.producto.findMany({ where: { eliminado: false, activo: true }, include: { proveedores: true }, orderBy: { nombre: 'asc' } });
  res.json(productos.map(p => ({
    productoId: p.id,
    productoNombre: p.nombre,
    cantidadActual: p.stock,
    stockMinimo: p.stockMinimo || 0,
    unidad: p.unidad || 'UN',
    ultimaActualizacion: p.ultimaActualizacionStock,
    estado: p.stock === 0 ? 'SIN_STOCK' : p.stock <= Number(p.stockMinimo || 0) ? 'BAJO_STOCK' : 'STOCK_NORMAL',
    proveedores: p.proveedores.length
  })));
}));

app.get('/stock/bajo', asyncHandler(async (_req, res) => {
  const productos = await prisma.producto.findMany({ where: { stock: { gt: 0 }, eliminado: false, activo: true }, include: { proveedores: true }, orderBy: { nombre: 'asc' } });
  res.json(productos.filter(p => p.stock <= Number(p.stockMinimo || 0)).map(p => ({ productoId: p.id, productoNombre: p.nombre, cantidadActual: p.stock, stockMinimo: p.stockMinimo || 0, unidad: p.unidad || 'UN', estado: 'BAJO_STOCK' })));
}));

app.get('/stock/sin-proveedor', asyncHandler(async (_req, res) => {
  const productos = await prisma.producto.findMany({ where: { proveedores: { none: {} }, eliminado: false, activo: true }, orderBy: { nombre: 'asc' } });
  res.json(productos.map(p => ({ productoId: p.id, productoNombre: p.nombre, cantidadActual: p.stock, stockMinimo: p.stockMinimo || 0, unidad: p.unidad || 'UN' })));
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


async function buscarClientesConEstadisticas(query = '', origen = 'MOSTRADOR') {
  const q = String(query || '').trim();
  const origenUpper = String(origen || 'MOSTRADOR').trim().toUpperCase();
  const whereOrigen = origenUpper === 'TODOS'
    ? {}
    : origenUpper === 'SEMILLASYA'
      ? { origenCliente: 'SEMILLASYA' }
      : { NOT: { origenCliente: 'SEMILLASYA' } };
  const whereBase = { eliminado: false, activo: true, tipo: 'CLIENTE', ...whereOrigen };
  const where = q ? {
    ...whereBase,
    OR: [
      { nombre: { contains: q } },
      { telefono: { contains: q } },
      { cuitDni: { contains: q } },
      { mail: { contains: q } }
    ]
  } : whereBase;

  const personas = await prisma.persona.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ nombre: 'asc' }, { id: 'desc' }],
    take: q ? 50 : 200
  });

  const stats = await prisma.venta.groupBy({
    by: ['personaId'],
    where: { estado: EstadoVenta.COBRADA, personaId: { in: personas.map((p) => p.id) } },
    _count: { _all: true },
    _sum: { total: true }
  });
  const statsByPersona = new Map(stats.map((s) => [s.personaId, { cantidadCompras: s._count._all, totalComprado: Number(s._sum.total || 0) }]));

  return personas.map((p) => ({ ...p, ...(statsByPersona.get(p.id) || { cantidadCompras: 0, totalComprado: 0 }) }));
}

app.get('/clientes', asyncHandler(async (req, res) => {
  const clientes = await buscarClientesConEstadisticas(req.query.q || '', req.query.origen || 'MOSTRADOR');
  res.json(clientes);
}));

app.get('/clientes/semillasya', asyncHandler(async (_req, res) => {
  const clientes = await prisma.persona.findMany({
    where: { eliminado: false, activo: true, tipo: 'CLIENTE', origenCliente: 'SEMILLASYA' },
    orderBy: [{ id: 'desc' }]
  });
  const personaIds = clientes.map((c) => c.id);
  const solicitudes = personaIds.length
    ? await prisma.presupuesto.groupBy({
      by: ['personaId'],
      where: { personaId: { in: personaIds }, origen: 'SEMILLASYA' },
      _count: { _all: true }
    })
    : [];
  const solicitudesMap = new Map(solicitudes.map((s) => [s.personaId, s._count._all]));
  res.json(clientes.map((c) => {
    const meta = parseJsonSafe(c.metadata);
    return {
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      provincia: meta.provincia || null,
      localidad: meta.ciudad || meta.localidad || null,
      fechaAlta: c.id,
      solicitudes: solicitudesMap.get(c.id) || 0
    };
  }));
}));

app.delete('/clientes/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { password, motivo } = req.body || {};
  if (!validarPasswordEliminacion(password)) return res.status(401).json({ error: 'Contraseña incorrecta para eliminar' });
  const existente = await prisma.persona.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: 'Cliente no encontrado' });
  await prisma.persona.update({ where: { id }, data: { eliminado: true, activo: false, eliminadoAt: new Date(), eliminadoPor: req.headers['x-usuario'] || 'sistema', motivoEliminacion: String(motivo || '').trim() || null } });
  res.json({ ok: true });
}));

app.get('/personas', asyncHandler(async (req, res) => {
  const personas = await prisma.persona.findMany({ where: { eliminado: false, activo: true, tipo: 'CLIENTE' } });
  const stats = await prisma.venta.groupBy({
    by: ['personaId'],
    where: { estado: EstadoVenta.COBRADA, personaId: { not: null } },
    _count: { _all: true },
    _sum: { total: true }
  });
  const statsByPersona = new Map(stats.map((s) => [s.personaId, { cantidadCompras: s._count._all, totalComprado: Number(s._sum.total || 0) }]));
  res.json(personas.map((p) => ({ ...p, ...(statsByPersona.get(p.id) || { cantidadCompras: 0, totalComprado: 0 }) })));
}));

app.post('/personas', asyncHandler(async (req, res) => {
  const { nombre, telefono, cuitDni, tipo, tipoCliente, razonSocial, cuit, mail, telefonoPrincipal, telefonoEmergencia, direccion, contactoComercial, observaciones } = req.body || {};
  const tipoClienteFinal = String(tipoCliente || 'PERSONAL').trim().toUpperCase() === 'EMPRESA' ? 'EMPRESA' : 'PERSONAL';
  const nombreFinal = String(tipoClienteFinal === 'EMPRESA' ? (razonSocial || nombre || '') : (nombre || razonSocial || '')).trim();
  const telefonoFinal = String(telefonoPrincipal || telefono || telefonoEmergencia || '').trim();
  const cuitFinal = String(cuit || cuitDni || '').trim();
  const mailFinal = String(mail || '').trim();

  if (tipoClienteFinal === 'PERSONAL' && !telefonoFinal) return res.status(400).json({ error: 'Para cliente PERSONAL, telefono es obligatorio' });
  if (tipoClienteFinal === 'EMPRESA') {
    if (!nombreFinal || !cuitFinal || !telefonoFinal || !mailFinal) return res.status(400).json({ error: 'Para cliente EMPRESA, razonSocial, cuit, telefono y mail son obligatorios' });
  }

  let advertenciaDuplicado = null;
  if (tipoClienteFinal === 'PERSONAL' && telefonoFinal) {
    const duplicado = await prisma.persona.findFirst({ where: { tipoCliente: 'PERSONAL', telefono: telefonoFinal } });
    if (duplicado) {
      advertenciaDuplicado = 'Ya existe un cliente PERSONAL con el mismo telefono';
      return res.json({ ...duplicado, advertenciaDuplicado, reutilizado: true });
    }
  }
  if (tipoClienteFinal === 'EMPRESA' && cuitFinal) {
    const duplicado = await prisma.persona.findFirst({ where: { tipoCliente: 'EMPRESA', cuitDni: cuitFinal } });
    if (duplicado) advertenciaDuplicado = 'Ya existe un cliente EMPRESA con el mismo CUIT';
  }

  const persona = await prisma.persona.create({
    data: {
      nombre: nombreFinal,
      telefono: telefonoFinal || null,
      cuitDni: cuitFinal || null,
      tipo: tipo || 'CLIENTE',
      tipoCliente: tipoClienteFinal,
      origenCliente: 'MOSTRADOR',
      mail: mailFinal || null,
      direccion: direccion ? String(direccion).trim() : null,
      contactoComercial: contactoComercial ? String(contactoComercial).trim() : null,
      observaciones: observaciones ? String(observaciones).trim() : null,
      telefonoEmergencia: telefonoEmergencia ? String(telefonoEmergencia).trim() : null
    }
  });
  res.json({ ...persona, advertenciaDuplicado });
}));

app.get('/personas/buscar', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const personas = await buscarClientesConEstadisticas(q);
  res.json(personas);
}));

function validarClienteParaPresupuesto(persona) {
  if (!persona) return 'Cliente no encontrado';
  if (!String(persona.nombre || '').trim()) return 'El cliente debe tener nombre completo';
  if (String(persona.tipo || '').toUpperCase() === 'CONSUMIDOR_FINAL') return 'No se puede presupuestar a Consumidor Final';
  return null;
}

app.get('/presupuestos', asyncHandler(async (req, res) => {
  const tipoOperacion = String(req.query?.tipoOperacion || '').toUpperCase();
  const origen = String(req.query?.origen || '').toUpperCase();
  const where = {};
  if (tipoOperacion) where.tipoOperacion = tipoOperacion;
  if (origen === 'MOSTRADOR') where.origen = 'MOSTRADOR';
  if (origen === 'SEMILLASYA' || origen === 'PRECAMPAÑA' || origen === 'PRECAMPANIA') where.origen = 'SEMILLASYA';
  const presupuestos = await prisma.presupuesto.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(presupuestos);
}));

app.get('/api/presupuestos', asyncHandler(async (req, res) => {
  const tipoOperacion = String(req.query?.tipoOperacion || '').toUpperCase();
  const origen = String(req.query?.origen || '').toUpperCase();
  const where = {};
  if (tipoOperacion) where.tipoOperacion = tipoOperacion;
  if (origen === 'MOSTRADOR') where.origen = 'MOSTRADOR';
  if (origen === 'SEMILLASYA' || origen === 'PRECAMPAÑA' || origen === 'PRECAMPANIA') where.origen = 'SEMILLASYA';
  const presupuestos = await prisma.presupuesto.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(presupuestos);
}));

app.get('/api/presupuestos/mostrador', asyncHandler(async (req, res) => {
  const tipoOperacion = String(req.query?.tipoOperacion || '').toUpperCase();
  const where = { origen: 'MOSTRADOR' };
  if (tipoOperacion) where.tipoOperacion = tipoOperacion;
  const presupuestos = await prisma.presupuesto.findMany({
    where,
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(presupuestos);
}));

app.get('/api/presupuestos/semillasya', asyncHandler(async (req, res) => {
  const tipoOperacion = String(req.query?.tipoOperacion || '').toUpperCase();
  const where = { origen: 'SEMILLASYA' };
  if (tipoOperacion) where.tipoOperacion = tipoOperacion;
  const presupuestos = await prisma.presupuesto.findMany({
    where,
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
  const { clienteId, personaId: personaIdBody, nombreLibre, tipoDestinatario, items, descuentoTipo, descuentoValor, ajusteRedondeo, observaciones, validez, aliasTransferencia, datosBancarios, estado, origen, tipoOperacion } = req.body || {};
  const tipo = Object.values(TipoDestinatarioPresupuesto).includes(tipoDestinatario) ? tipoDestinatario : TipoDestinatarioPresupuesto.EXISTENTE;
  const personaId = parsePositiveInt(clienteId ?? personaIdBody);
  const nombreLibreLimpio = String(nombreLibre || '').trim();

  let persona = null;
  if (tipo === TipoDestinatarioPresupuesto.EXISTENTE) {
    if (!personaId) return res.status(400).json({ error: 'clienteId es obligatorio para destinatario existente' });
    persona = await prisma.persona.findUnique({ where: { id: personaId } });
    const errorCliente = validarClienteParaPresupuesto(persona);
    if (errorCliente) return res.status(400).json({ error: errorCliente });
  }

  if (tipo === TipoDestinatarioPresupuesto.LIBRE && !nombreLibreLimpio) {
    return res.status(400).json({ error: 'nombreLibre es obligatorio para presupuesto libre' });
  }

  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Debe incluir productos' });
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
  const totales = calcularTotalesConDescuento(itemsCalculados, descuentoTipo || null, descuentoValor || 0, ajusteRedondeo || 0);
  const payload = {
    personaId: tipo === TipoDestinatarioPresupuesto.EXISTENTE ? personaId : null,
    nombreLibre: tipo === TipoDestinatarioPresupuesto.LIBRE ? nombreLibreLimpio : (tipo === TipoDestinatarioPresupuesto.A_QUIEN_CORRESPONDA ? 'A quien corresponda' : null),
    tipoDestinatario: tipo,
    subtotal: totales.subtotal,
    descuentoTipo: totales.descuentoTipo,
    descuentoValor: totales.descuentoValor,
    ajusteRedondeo: totales.ajusteRedondeo,
    total: totales.total,
    observaciones: observaciones || null,
    validez: validez || null,
    aliasTransferencia: aliasTransferencia || null,
    datosBancarios: datosBancarios || null,
    estado: Object.values(EstadoPresupuesto).includes(estado) ? estado : EstadoPresupuesto.BORRADOR,
    origen: origen === 'SEMILLASYA' ? 'SEMILLASYA' : 'MOSTRADOR',
    tipoOperacion: tipoOperacion === 'PRECAMPAÑA' ? 'PRECAMPAÑA' : 'MOSTRADOR'
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

app.post('/presupuestos/:id/dar-alta-persona', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });

  const presupuesto = await prisma.presupuesto.findUnique({ where: { id } });
  if (!presupuesto) return res.status(404).json({ error: 'Presupuesto no encontrado' });

  const campos = ['razonSocial', 'cuit', 'mail', 'telefonoPrincipal', 'telefonoEmergencia'];
  const faltantes = campos.filter((campo) => !String(req.body?.[campo] || '').trim());
  if (faltantes.length) {
    return res.status(400).json({ error: `Faltan campos obligatorios: ${faltantes.join(', ')}` });
  }

  const persona = await prisma.persona.create({
    data: {
      nombre: String(req.body.razonSocial).trim(),
      cuitDni: String(req.body.cuit).trim(),
      telefono: String(req.body.telefonoPrincipal).trim(),
      tipo: 'CLIENTE'
    }
  });

  const actualizado = await prisma.presupuesto.update({
    where: { id },
    data: {
      personaId: persona.id,
      tipoDestinatario: TipoDestinatarioPresupuesto.EXISTENTE,
      nombreLibre: null
    },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json({ presupuesto: actualizado, persona, contacto: { mail: String(req.body.mail).trim(), telefonoEmergencia: String(req.body.telefonoEmergencia).trim() } });
}));


app.get('/pedidos', asyncHandler(async (_req, res) => {
  const pedidos = await prisma.pedido.findMany({
    include: { proveedor: true, items: { include: { producto: true } } },
    orderBy: { id: 'desc' }
  });
  res.json(pedidos);
}));

app.post('/pedidos', asyncHandler(async (req, res) => {
  const { proveedorId, fecha, tipoPedido, observaciones, estado, items = [] } = req.body || {};
  if (!proveedorId) return res.status(400).json({ error: 'proveedorId es obligatorio' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Debe agregar al menos un producto' });
  const tiposPedido = enumValuesSafe(TipoPedido);
  const estadosPedido = enumValuesSafe(EstadoPedido);
  const tipoPedidoNormalizado = tiposPedido.includes(tipoPedido) ? tipoPedido : (TipoPedido?.SOLICITUD_PRESUPUESTO || 'SOLICITUD_PRESUPUESTO');
  const estadoPedido = estadosPedido.includes(estado) ? estado : (EstadoPedido?.BORRADOR || 'BORRADOR');
  const proveedor = await prisma.proveedor.findUnique({ where: { id: Number(proveedorId) } });
  if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const itemInvalido = items.find((i) => (
    !Number.isInteger(Number(i?.productoId))
    || String(i?.nombre || '').trim() === ''
    || !Number.isFinite(Number(i?.cantidad))
    || Number(i?.cantidad) <= 0
    || String(i?.unidad || '').trim() === ''
  ));
  if (itemInvalido) return res.status(400).json({ error: 'Cada item debe incluir productoId, nombre, cantidad y unidad válidos' });

  const pedido = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.pedido.create({
      data: {
        proveedorId: Number(proveedorId),
        fecha: fecha ? new Date(fecha) : new Date(),
        tipo: tipoPedidoNormalizado,
        observaciones: (observaciones || '').trim() || null,
        estado: estadoPedido
      }
    });
    for (const i of items) {
      await tx.pedidoItem.create({
        data: {
          pedidoId: nuevo.id,
          productoId: Number(i.productoId),
          cantidad: Number(i.cantidad || 0),
          unidad: String(i.unidad || '').trim() || 'UN'
        }
      });
    }
    return tx.pedido.findUnique({ where: { id: nuevo.id }, include: { proveedor: true, items: { include: { producto: true } } } });
  });
  res.status(201).json(pedido);
}));

app.get('/pedidos/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { proveedor: true, items: { include: { producto: true } } }
  });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(pedido);
}));

app.get('/pedidos/:id/imprimir', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const p = await prisma.pedido.findUnique({ where: { id }, include: { proveedor: true, items: { include: { producto: true } } } });
  if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
  const textoPrincipal = p.tipo === 'SOLICITUD_PRESUPUESTO'
    ? 'Solicitamos presupuesto de los siguientes productos/insumos'
    : 'Confirmamos orden de pedido y solicitamos envío de los siguientes productos/insumos';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${p.id}</title></head><body>
  <h2>Pedido #${p.id}</h2><p><strong>Proveedor:</strong> ${escapeHtml(p.proveedor?.razonSocial || '-')}</p>
  <p><strong>Fecha:</strong> ${new Date(p.fecha).toLocaleDateString('es-AR')}</p>
  <p><strong>Estado:</strong> ${escapeHtml(p.estado)}</p><p>${textoPrincipal}</p>
  <table border="1" cellpadding="6" cellspacing="0"><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th></tr>
  ${p.items.map((it)=>`<tr><td>${escapeHtml(it.producto?.nombre || '-')}</td><td>${it.cantidad}</td><td>${escapeHtml(it.unidad || '-')}</td></tr>`).join('')}
  </table><p><strong>Observaciones:</strong> ${escapeHtml(p.observaciones || '-')}</p></body></html>`);
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
  const moneda = formatMoney;
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
    .institutional-signature { margin-top:4px; color:#334155; font-size:11px; line-height:1.25; }
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
        <div class="institutional-signature">www.hubya.tech</div>
        <div>Dirección: Chile 1455</div>
      </div>
      <div>
        <strong>Presupuesto #${p.id}</strong><br/>
        Fecha: ${fecha}<br/>
        Estado: ${escapeHtml(p.estado)}
      </div>
    </div>
    <div class="box">
      <strong>Cliente:</strong> ${escapeHtml(p.persona?.nombre || p.nombreLibre || (p.tipoDestinatario === 'A_QUIEN_CORRESPONDA' ? 'A quien corresponda' : '-'))}<br/>
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

app.get('/pedidos/:id/pdf', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const p = await prisma.pedido.findUnique({ where: { id }, include: { proveedor: true, items: { include: { producto: true } } } });
  if (!p) return res.status(404).send('No encontrado');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="pedido-${p.id}.pdf"`);
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.pipe(res);

  const fecha = new Date(p.fecha || p.createdAt).toLocaleDateString('es-AR');
  doc.font('Helvetica-Bold').fontSize(18).text(`Pedido #${p.id}`);
  doc.moveDown(0.3).font('Helvetica').fontSize(11);
  doc.text(`Proveedor: ${p.proveedor?.razonSocial || '-'}`);
  doc.text(`Fecha: ${fecha}`);
  doc.text(`Tipo: ${p.tipo || '-'}`);
  doc.text(`Estado: ${p.estado || '-'}`);
  doc.moveDown(0.7);

  doc.font('Helvetica-Bold').text('Producto', 48, doc.y, { width: 260 });
  doc.text('Cantidad', 320, doc.y - 14, { width: 80, align: 'right' });
  doc.text('Unidad', 410, doc.y - 14, { width: 90, align: 'right' });
  doc.moveDown(0.2).strokeColor('#999').lineWidth(0.8).moveTo(48, doc.y).lineTo(548, doc.y).stroke();
  doc.moveDown(0.4).font('Helvetica');

  (p.items || []).forEach((it) => {
    doc.text(it.producto?.nombre || `#${it.productoId}`, 48, doc.y, { width: 260 });
    doc.text(String(Number(it.cantidad || 0)), 320, doc.y - 14, { width: 80, align: 'right' });
    doc.text(String(it.unidad || '-'), 410, doc.y - 14, { width: 90, align: 'right' });
    doc.moveDown(0.4);
  });

  doc.moveDown(0.8).font('Helvetica-Bold').text('Observaciones: ', { continued: true }).font('Helvetica').text(p.observaciones || '-');
  doc.end();
}));



app.get('/presupuestos/:id/pdf', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });

  const p = await prisma.presupuesto.findUnique({
    where: { id },
    include: { persona: true, items: { include: { producto: true } } }
  });

  if (!p) return res.status(404).send('No encontrado');

  const fecha = new Date(p.createdAt).toLocaleDateString('es-AR');
  const cliente = p.persona?.nombre || p.nombreLibre || (p.tipoDestinatario === 'A_QUIEN_CORRESPONDA' ? 'A quien corresponda' : '-');
  const descuento = Number(p.descuentoValor || 0);
  const redondeo = Number(p.ajusteRedondeo || 0);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="presupuesto-${p.id}.pdf"`);

  const margin = 48;
  const bottomMargin = 48;
  const doc = new PDFDocument({ margin, size: 'A4' });
  doc.pipe(res);

  const getBounds = () => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const top = doc.page.margins.top;
    const bottom = doc.page.height - bottomMargin;
    return { left, right, top, bottom, width: right - left };
  };

  const drawBox = (y, h) => {
    const { left, width } = getBounds();
    doc.roundedRect(left, y, width, h, 6).lineWidth(1).strokeColor('#bdbdbd').stroke();
  };

  const drawPageHeader = () => {
    const { left, right, width, top } = getBounds();
    doc.rect(left, top, width, 84).fill('#f6f6f6');
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(16).text('Agroquímica San Bernardo', left + 12, top + 12, { width: width * 0.55 });
    doc.fontSize(11).text('Ingeniería Lambois', left + 12, top + 32, { width: width * 0.55 });
    const esPre = p.tipoOperacion === 'PRECAMPAÑA' || p.origen === 'SEMILLASYA';
    doc.fillColor('#334155').font('Helvetica').fontSize(11).text(esPre ? 'SemillasYa' : 'Agroquímica San Bernardo', left + 12, top + 46, { width: width * 0.55 });
    doc.fontSize(9).text('Plataformas HUBYA', left + 12, top + 60, { width: width * 0.55 });
    doc.text('www.hubya.tech', left + 12, top + 72, { width: width * 0.55 });
    doc.fillColor('#111');
    doc.font('Helvetica').fontSize(11).text(`Presupuesto #${p.id}`, right - 170, top + 12, { width: 160, align: 'right' });
    doc.text(`Fecha: ${fecha}`, right - 170, top + 28, { width: 160, align: 'right' });
    doc.text(`Estado: ${p.estado}`, right - 170, top + 44, { width: 160, align: 'right' });
    return top + 98;
  };

  const ensureSpace = (y, needed, drawTableHeader) => {
    const { bottom } = getBounds();
    if (y + needed <= bottom) return y;
    doc.addPage();
    const nextY = drawPageHeader();
    return drawTableHeader ? drawTableHeader(nextY) : nextY;
  };

  let y = drawPageHeader();

  drawBox(y, 72);
  const { left, right } = getBounds();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text('Destinatario', left + 10, y + 10);
  doc.font('Helvetica').fontSize(10)
    .text(`Cliente: ${cliente}`, left + 10, y + 28)
    .text(`Teléfono: ${p.persona?.telefono || '-'}`, left + 10, y + 42)
    .text(`CUIT/DNI: ${p.persona?.cuitDni || '-'}`, left + 10, y + 56);

  y += 88;

  const tableStartX = left;
  const tableWidth = right - left;
  const colWidths = { producto: Math.round(tableWidth * 0.56), cantidad: 62, precio: 96, subtotal: 96 };
  const colX = {
    producto: tableStartX + 8,
    cantidad: tableStartX + colWidths.producto,
    precio: tableStartX + colWidths.producto + colWidths.cantidad,
    subtotal: tableStartX + colWidths.producto + colWidths.cantidad + colWidths.precio
  };

  const drawItemsHeader = (startY) => {
    doc.rect(tableStartX, startY, tableWidth, 24).fill('#efefef');
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(10)
      .text('Producto', colX.producto, startY + 7, { width: colWidths.producto - 10 })
      .text('Cant.', colX.cantidad, startY + 7, { width: colWidths.cantidad, align: 'center' })
      .text('Precio unitario', colX.precio, startY + 7, { width: colWidths.precio - 8, align: 'right' })
      .text('Subtotal', colX.subtotal, startY + 7, { width: colWidths.subtotal - 8, align: 'right' });
    return startY + 24;
  };

  y = drawItemsHeader(y);
  const tableTop = y - 24;
  doc.font('Helvetica').fontSize(10);

  p.items.forEach((item, index) => {
    const nombreProducto = item.producto?.nombre || 'Producto';
    const productoHeight = doc.heightOfString(nombreProducto, { width: colWidths.producto - 10, align: 'left' });
    const rowHeight = Math.max(22, Math.ceil(productoHeight) + 10);

    y = ensureSpace(y, rowHeight + 2, drawItemsHeader);

    if (index % 2 === 0) {
      doc.rect(tableStartX, y, tableWidth, rowHeight).fill('#fafafa');
    }

    doc.fillColor('#111')
      .text(nombreProducto, colX.producto, y + 5, { width: colWidths.producto - 10, lineBreak: true })
      .text(String(item.cantidad), colX.cantidad, y + 5, { width: colWidths.cantidad, align: 'center' })
      .text(formatMoney(item.precioUnitario), colX.precio, y + 5, { width: colWidths.precio - 8, align: 'right' })
      .text(formatMoney(item.subtotal), colX.subtotal, y + 5, { width: colWidths.subtotal - 8, align: 'right' });

    y += rowHeight;
  });

  doc.rect(tableStartX, tableTop, tableWidth, y - tableTop).lineWidth(1).strokeColor('#d3d3d3').stroke();

  y += 16;
  y = ensureSpace(y, 90);
  const totalsWidth = Math.min(260, tableWidth);
  const totalsX = right - totalsWidth;
  drawBox(y, 86);
  doc.font('Helvetica').fontSize(10)
    .text('Subtotal:', totalsX, y + 10, { width: 120, align: 'right' })
    .text(formatMoney(p.subtotal), totalsX + 124, y + 10, { width: totalsWidth - 124 - 8, align: 'right' })
    .text('Descuento:', totalsX, y + 28, { width: 120, align: 'right' })
    .text(formatMoney(descuento), totalsX + 124, y + 28, { width: totalsWidth - 124 - 8, align: 'right' })
    .text('Redondeo:', totalsX, y + 46, { width: 120, align: 'right' })
    .text(formatMoney(redondeo), totalsX + 124, y + 46, { width: totalsWidth - 124 - 8, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL: ${formatMoney(p.total)}`, totalsX, y + 64, { width: totalsWidth - 8, align: 'right' });

  y += 102;
  const bloques = [
    ['Observaciones', p.observaciones || '-'],
    ['Validez del presupuesto', p.validez || '-'],
    ['Condición de pago', `Alias: ${p.aliasTransferencia || '-'} | Datos bancarios: ${p.datosBancarios || '-'}`]
  ];

  bloques.forEach(([titulo, contenido]) => {
    const contentWidth = right - left - 132;
    const contentHeight = doc.heightOfString(String(contenido), { width: contentWidth, lineBreak: true });
    const blockHeight = Math.max(42, Math.ceil(contentHeight) + 18);
    y = ensureSpace(y, blockHeight + 8);
    drawBox(y, blockHeight);
    doc.font('Helvetica-Bold').fontSize(10).text(`${titulo}:`, left + 10, y + 9, { width: 105 });
    doc.font('Helvetica').fontSize(10).text(String(contenido), left + 120, y + 9, { width: contentWidth, lineBreak: true });
    y += blockHeight + 8;
  });

  doc.fontSize(9).fillColor('#555').text('Documento comercial emitido por Agroquímica San Bernardo - Ingeniería Lambois.', left, doc.page.height - 40, { width: right - left, align: 'center' });

  doc.end();
}));

app.post('/mostrador/ventas', asyncHandler(async (req, res) => {
  const tipoOperacion = req.body?.tipoOperacion === TipoOperacionVenta.PRECAMPAÑA ? TipoOperacionVenta.PRECAMPAÑA : TipoOperacionVenta.MOSTRADOR;
  const listaComercialId = tipoOperacion === TipoOperacionVenta.PRECAMPAÑA ? parsePositiveInt(req.body?.listaComercialId) : null;
  const venta = await prisma.venta.create({ data: { tipoOperacion, listaComercialId } });
  res.status(201).json(venta);
}));

app.get('/api/listas-comerciales', asyncHandler(async (_req, res) => {
  const listas = await prisma.listaComercial.findMany({ include: { empresaComercial: true, reglas: true }, orderBy: { updatedAt: 'desc' } });
  res.json(listas);
}));

app.post('/api/listas-comerciales', asyncHandler(async (req, res) => {
  const { empresaComercialId, empresa, nombre, codigo, moneda, vigenteDesde, vigenteHasta, reglas = [] } = req.body || {};
  let empresaId = parsePositiveInt(empresaComercialId);
  if (!empresaId) {
    if (!empresa?.nombre) return res.status(400).json({ error: 'empresaComercialId o empresa.nombre es obligatorio' });
    const creada = await prisma.empresaComercial.create({ data: { nombre: String(empresa.nombre).trim(), tipo: empresa.tipo || 'LABORATORIO' } });
    empresaId = creada.id;
  }
  const lista = await prisma.listaComercial.create({
    data: {
      empresaComercialId: empresaId, nombre: String(nombre || '').trim(), codigo: codigo || null, moneda: moneda || 'ARS',
      vigenteDesde: vigenteDesde ? new Date(vigenteDesde) : null, vigenteHasta: vigenteHasta ? new Date(vigenteHasta) : null,
      reglas: { create: Array.isArray(reglas) ? reglas.map((r, idx) => ({ nombre: r.nombre || `Regla ${idx + 1}`, tipo: r.tipo || TipoReglaComercial.DESCUENTO_PORCENTAJE, valor: Number(r.valor || 0), orden: Number(r.orden || idx) })) : [] }
    }, include: { reglas: true, empresaComercial: true }
  });
  res.status(201).json(lista);
}));

app.get('/api/listas-comerciales/:id/productos', asyncHandler(async (req, res) => {
  const listaComercialId = parsePositiveInt(req.params.id);
  if (!listaComercialId) return res.status(400).json({ error: 'id inválido' });
  const productos = await prisma.productoListaComercial.findMany({ where: { listaComercialId, activo: true }, orderBy: { createdAt: 'asc' } });
  res.json(productos);
}));

const SEMILLEROS_PRECAMPAÑA = ['Guasch', 'CAPS', 'Garden', 'Gasty', 'Chuchuy', 'Florensa', 'Picasso'];

app.get('/api/productos-precampania', asyncHandler(async (req, res) => {
  const productos = await prisma.productoPrecampania.findMany({ where: { activo: true }, orderBy: { createdAt: 'desc' } });
  res.json({ semilleros: SEMILLEROS_PRECAMPAÑA, productos });
}));

app.post('/api/productos-precampania', asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const semillero = String(payload.semilleroLaboratorio || '').trim();
  if (!SEMILLEROS_PRECAMPAÑA.includes(semillero)) return res.status(400).json({ error: 'semillero/laboratorio inválido' });
  const data = normalizarPayloadProductoPrecampania(payload);
  const creado = await prisma.productoPrecampania.create({ data: { ...data, semilleroLaboratorio: semillero } });
  res.status(201).json(creado);
}));

app.put('/api/productos-precampania/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const payload = req.body || {};
  const semillero = String(payload.semilleroLaboratorio || '').trim();
  if (!SEMILLEROS_PRECAMPAÑA.includes(semillero)) return res.status(400).json({ error: 'semillero/laboratorio inválido' });
  const data = normalizarPayloadProductoPrecampania(payload);
  const actualizado = await prisma.productoPrecampania.update({ where: { id }, data: { ...data, semilleroLaboratorio: semillero } });
  res.json(actualizado);
}));


app.post('/api/productos-precampania/:id/duplicar-mostrador', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const pre = await prisma.productoPrecampania.findUnique({ where: { id } });
  if (!pre || !pre.activo) return res.status(404).json({ error: 'Producto precampaña no encontrado' });
  const precio = Number(pre.usaPrecioManual ? (pre.precioManual ?? pre.precioVentaFinal) : pre.precioVentaFinal || 0);
  const creado = await prisma.producto.create({ data: {
    nombre: pre.nombre,
    categoria: pre.categoria || 'SEMILLASYA',
    marca: pre.semilleroLaboratorio || 'SEMILLASYA',
    unidad: pre.presentacionEnvase || '',
    precioVenta: precio,
    precioFinalPesos: precio,
    observaciones: `Creado desde ProductoPrecampania ID ${pre.id} / SemillasYa`,
    stock: 0
  } });
  res.status(201).json(creado);
}));

app.delete('/api/productos-precampania/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  await prisma.productoPrecampania.update({ where: { id }, data: { activo: false } });
  res.json({ ok: true });
}));

app.get('/api/semillasya/productos', asyncHandler(async (_req, res) => {
  const productos = await prisma.productoPrecampania.findMany({
    where: { activo: true, visibleEnSemillasYa: true, semilleroLaboratorio: { in: SEMILLEROS_PRECAMPAÑA } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, semilleroLaboratorio: true, categoria: true, presentacionEnvase: true, descripcion: true }
  });
  res.json(productos);
}));

app.get('/api/semillasya/catalogo', asyncHandler(async (_req, res) => {
  const productos = await prisma.productoPrecampania.findMany({
    where: { activo: true, visibleEnSemillasYa: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, semilleroLaboratorio: true, categoria: true, presentacionEnvase: true, descripcion: true }
  });
  res.json(productos);
}));

app.get('/api/semillasya/debug', asyncHandler(async (_req, res) => {
  const [totalPrecampania, visiblesEnSemillasYa, porSemilleroRaw, ultimosProductos] = await Promise.all([
    prisma.productoPrecampania.count({ where: { activo: true } }),
    prisma.productoPrecampania.count({ where: { activo: true, visibleEnSemillasYa: true } }),
    prisma.productoPrecampania.groupBy({ by: ['semilleroLaboratorio'], where: { activo: true }, _count: { _all: true } }),
    prisma.productoPrecampania.findMany({
      where: { activo: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, nombre: true, semilleroLaboratorio: true, visibleEnSemillasYa: true, createdAt: true }
    })
  ]);

  res.json({
    ok: true,
    fecha: new Date().toISOString(),
    productosPrecampania: {
      total: totalPrecampania,
      visiblesEnSemillasYa
    },
    cantidadPorSemillero: porSemilleroRaw.map((item) => ({
      semillero: item.semilleroLaboratorio || 'SIN_SEMILLERO',
      cantidad: item._count._all
    })),
    ultimos5ProductosPrecampania: ultimosProductos,
    endpoints: {
      productosPrecampaniaGet: '/api/productos-precampania',
      productosPrecampaniaPost: '/api/productos-precampania',
      semillasYaCatalogoGet: '/api/semillasya/catalogo',
      semillasYaClientePost: '/api/semillasya/cliente',
      status: 'OK'
    }
  });
}));

app.post('/api/listas-comerciales/:id/productos', asyncHandler(async (req, res) => {
  const listaComercialId = parsePositiveInt(req.params.id);
  if (!listaComercialId) return res.status(400).json({ error: 'id inválido' });
  const payload = req.body || {};
  const creado = await prisma.productoListaComercial.create({ data: { listaComercialId, nombreProducto: String(payload.nombreProducto || '').trim(), skuExterno: payload.skuExterno || null, unidad: payload.unidad || null, precioNeto: Number(payload.precioNeto || 0), precioSugeridoPublico: payload.precioSugeridoPublico == null ? null : Number(payload.precioSugeridoPublico), descuentoPorcentaje: Number(payload.descuentoPorcentaje || 0), bonificacionPorcentaje: Number(payload.bonificacionPorcentaje || 0), ivaPorcentaje: Number(payload.ivaPorcentaje ?? 21), fletePorcentaje: Number(payload.fletePorcentaje || 0), margenPorcentaje: Number(payload.margenPorcentaje || 0), financiacionPorcentaje: Number(payload.financiacionPorcentaje || 0), moneda: payload.moneda || 'ARS' } });
  res.status(201).json(creado);
}));

app.post('/api/precios-precampaña/calcular', asyncHandler(async (req, res) => {
  const { listaComercialId, productoListaComercialId } = req.body || {};
  const listaId = parsePositiveInt(listaComercialId);
  const productoId = parsePositiveInt(productoListaComercialId);
  if (!listaId || !productoId) return res.status(400).json({ error: 'listaComercialId y productoListaComercialId son obligatorios' });
  const [producto, reglas] = await Promise.all([
    prisma.productoListaComercial.findFirst({ where: { id: productoId, listaComercialId: listaId } }),
    prisma.reglaComercialLista.findMany({ where: { listaComercialId: listaId, activa: true } })
  ]);
  if (!producto) return res.status(404).json({ error: 'Producto de lista no encontrado' });
  const precioBase = producto.precioNeto > 0 ? Number(producto.precioNeto) : Number(producto.precioSugeridoPublico || 0);
  const calculo = aplicarReglasComerciales(precioBase, reglas);
  res.json({ precioBase, reglasAplicadas: calculo.detalle, precioFinal: calculo.precioFinal, moneda: producto.moneda });
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
  const ventaConDescuento = await prisma.venta.findUnique({ where: { id: ventaId }, select: { descuentoTipo: true, descuentoValor: true, ajusteRedondeo: true } });
  const totales = calcularTotalesConDescuento(items, ventaConDescuento?.descuentoTipo, ventaConDescuento?.descuentoValor, ventaConDescuento?.ajusteRedondeo);
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
    await prisma.ventaItem.update({
      where: { id: existente.id },
      data: { cantidad, subtotal: existente.precioUnitario * cantidad }
    });
  }

  const items = await prisma.ventaItem.findMany({ where: { ventaId } });
  const ventaConDescuento = await prisma.venta.findUnique({ where: { id: ventaId }, select: { descuentoTipo: true, descuentoValor: true, ajusteRedondeo: true } });
  const totales = calcularTotalesConDescuento(items, ventaConDescuento?.descuentoTipo, ventaConDescuento?.descuentoValor, ventaConDescuento?.ajusteRedondeo);
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
  const { personaId, nombre, telefono, tipo, cuitDni, mail } = req.body;

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se puede asociar persona a ventas en BORRADOR' });
  }

  let persona;
  if (personaId === null) {
    const venta = await prisma.venta.update({
      where: { id: ventaId },
      data: { personaId: null },
      include: { persona: true }
    });
    return res.json(venta);
  }

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
        tipo: tipo || 'CONSUMIDOR_FINAL',
        mail: mail ? String(mail).trim() : null
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

app.post('/mostrador/ventas/:id/cerrar', async (req, res) => {
  console.log('CERRAR VENTA BODY', req.body);
  console.log('CERRAR VENTA ID', req.params.id);

  try {
    const ventaId = parsePositiveInt(req.params.id);
    const { personaId, descuentoTipo, descuentoValor, ajusteRedondeo, condicionPagoPrevista, totalFinal } = req.body || {};
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

    const personaIdValido = Number.isInteger(Number(venta.personaId)) && Number(venta.personaId) > 0;
    const hayDescuento = Number(descuentoValor || 0) > 0;

    if (hayDescuento && !personaIdValido) {
      return res.status(400).json({ error: 'Para aplicar descuento debe seleccionar un cliente real.' });
    }

    if (condicionPagoPrevista && !Object.values(CondicionPagoPrevista).includes(condicionPagoPrevista)) {
      return res.status(400).json({ error: 'condicionPagoPrevista inválida' });
    }

    if (hayDescuento && !condicionPagoPrevista) {
      return res.status(400).json({ error: 'Si hay descuento, condicionPagoPrevista es obligatoria' });
    }

    const personaIdBody = personaId === undefined || personaId === null || Number(personaId) === 0 ? null : Number(personaId);
    const personaIdVenta = venta.personaId ? Number(venta.personaId) : null;
    if (personaIdBody !== null && personaIdBody !== personaIdVenta) {
      return res.status(400).json({ error: 'personaId no coincide con la venta activa' });
    }

    const totales = calcularTotalesConDescuento(venta.items, descuentoTipo || null, descuentoValor || 0, ajusteRedondeo || 0);
    if (totalFinal !== undefined && Math.abs(Number(totalFinal) - Number(totales.total)) > 0.01) {
      return res.status(400).json({ error: 'totalFinal no coincide con el total calculado' });
    }

    await prisma.$transaction(async tx => {
      for (const item of venta.items) {
        const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
        if (!producto) {
          throw new Error(`Producto inexistente ${item.productoId}`);
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
          ajusteRedondeo: totales.ajusteRedondeo,
          total: totales.total,
          condicionPagoPrevista: condicionPagoPrevista || null
        }
      });
    });

    const ventaCerrada = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: { persona: true, items: { include: { producto: true } } }
    });

    res.json(ventaCerrada);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

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

    const { formaPago, medioPago, medioPagoReal, estadoCobro, estadoCobroReal } = req.body || {};
    const estadoCobroNormalizado = estadoCobroReal || estadoCobro || 'PAGADO';
    const estadosValidos = ['PAGADO', 'EN_ESPERA_DE_PAGO', 'CUENTA_CORRIENTE', 'CANCELADO'];
    if (!estadosValidos.includes(estadoCobroNormalizado)) {
      return res.status(400).json({ error: 'estadoCobroReal inválido' });
    }

    console.error('[caja/cobrar] payload recibido', {
      ventaId,
      estadoCobroReal: estadoCobroNormalizado,
      formaPago,
      medioPago,
      medioPagoReal
    });

    const venta = await prisma.venta.findUnique({ where: { id: ventaId } });

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.estado !== EstadoVenta.PENDIENTE_CAJA) {
      return res.status(400).json({ error: 'La venta no está pendiente de caja' });
    }

    if (estadoCobroNormalizado === 'EN_ESPERA_DE_PAGO') {
      return res.status(200).json({ ...venta, estadoCobro: estadoCobroNormalizado, mensaje: 'Venta marcada en espera de pago' });
    }

    if (estadoCobroNormalizado === 'CANCELADO') {
      const ventaCancelada = await prisma.venta.update({
        where: { id: ventaId },
        data: { estado: EstadoVenta.BORRADOR, medioPago: null }
      });
      return res.status(200).json({ ...ventaCancelada, estadoCobro: estadoCobroNormalizado });
    }

    const pago = estadoCobroNormalizado === 'CUENTA_CORRIENTE'
      ? 'CUENTA_CORRIENTE'
      : (medioPagoReal || formaPago || medioPago || venta.condicionPagoPrevista || null);
    if (!pago) {
      return res.status(400).json({ error: 'formaPago inválida' });
    }

    if (pago === 'CUENTA_CORRIENTE') {
      if (!venta.personaId) {
        return res.status(400).json({ error: 'No se puede enviar a cuenta corriente una venta sin cliente.' });
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
      .institutional-signature { margin: 0 0 8px; color: #334155; font-size: 11px; line-height: 1.25; }
      p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border-bottom: 1px solid #ddd; padding: 6px; text-align: left; }
      .total { font-size: 16px; margin-top: 10px; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(negocio)}</h1>
    <p class="institutional-signature">www.hubya.tech</p>
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

app.get('/caja/resumen', requireCajaRole, asyncHandler(async (req, res) => {
  const fechaCaja = String(req.query.fecha || obtenerFechaCajaArgentina());
  if (!parsearFechaCaja(fechaCaja)) {
    return res.status(400).json({ error: 'fecha inválida, use YYYY-MM-DD' });
  }
  const turno = normalizarTurnoCaja(req.query.turno || 'DIARIO');
  if (!turno) return res.status(400).json({ error: 'turno inválido' });
  const resumen = await calcularResumenCajaDia(fechaCaja, turno);
  res.json(resumen);
}));

app.post('/caja/cerrar', requireCajaRole, asyncHandler(async (req, res) => {
  const fechaCaja = String(req.body?.fechaCaja || obtenerFechaCajaArgentina());
  if (!parsearFechaCaja(fechaCaja)) {
    return res.status(400).json({ error: 'fechaCaja inválida, use YYYY-MM-DD' });
  }
  const turno = normalizarTurnoCaja(req.body?.turno || 'DIARIO');
  if (!turno) return res.status(400).json({ error: 'turno inválido' });
  const rango = obtenerRangoDiaCaja(fechaCaja);
  const inicio = rango.inicio;

  const existente = await prisma.cierreCajaDiario.findFirst({
    where: { fechaCaja, turno }
  });

  if (existente) {
    return res.status(400).json({ error: 'La caja para ese día/turno ya fue cerrada' });
  }

  const resumen = await calcularResumenCajaDia(fechaCaja, turno);

  const cierre = await prisma.cierreCajaDiario.create({
    data: {
      fecha: inicio,
      fechaCaja,
      turno,
      cerradoPorRol: req.userRole || 'SIN_ROL',
      totalEfectivo: resumen.EFECTIVO,
      totalTransferencia: resumen.TRANSFERENCIA,
      totalTarjeta: resumen.TARJETA,
      totalCuentaCorriente: resumen.CUENTA_CORRIENTE,
      totalGeneral: resumen.totalGeneral
    }
  });

  res.status(201).json(cierre);
}));


app.get('/caja/cierres', requireCajaRole, asyncHandler(async (req, res) => {
  const turno = normalizarTurnoCaja(req.query.turno || 'DIARIO');
  if (!turno) return res.status(400).json({ error: 'turno inválido' });
  const cierres = await prisma.cierreCajaDiario.findMany({
    where: { turno },
    orderBy: [{ fechaCaja: 'desc' }, { createdAt: 'desc' }]
  });

  const cierresConFechaVisible = cierres.map(cierre => ({
    ...cierre,
    fechaCaja: cierre.fechaCaja || obtenerFechaCajaArgentina(cierre.fecha)
  }));

  res.json(cierresConFechaVisible);
}));

app.delete('/caja/cierres/:id', requireCajaRole, asyncHandler(async (req, res) => {
  const cierreId = parsePositiveInt(req.params.id);
  if (!cierreId) return res.status(400).json({ error: 'id de cierre inválido' });

  const cierre = await prisma.cierreCajaDiario.findUnique({ where: { id: cierreId } });
  if (!cierre) return res.status(404).json({ error: 'Cierre no encontrado' });

  await prisma.cierreCajaDiario.delete({ where: { id: cierreId } });
  registrosEliminados.unshift({
    tipo: 'CIERRE_CAJA',
    nombre: `Cierre de caja ${cierre.fechaCaja || cierre.id}`,
    fecha: new Date().toISOString(),
    eliminadoPor: req.body?.eliminadoPor || req.headers['x-usuario'] || 'sistema',
    motivo: 'Eliminación manual desde módulo Caja'
  });

  res.json({ ok: true, mensaje: 'Cierre eliminado (solo registro de prueba)' });
}));

app.get('/cuenta-corriente/personas/:personaId', asyncHandler(async (req, res) => {
  const personaId = parsePositiveInt(req.params.personaId);
  if (!personaId) return res.status(400).json({ error: 'personaId inválido' });
  const persona = await prisma.persona.findUnique({ where: { id: personaId } });
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
  const comprasStats = await prisma.venta.aggregate({
    where: { personaId, estado: EstadoVenta.COBRADA },
    _count: { _all: true },
    _sum: { total: true }
  });
  const personaConStats = {
    ...persona,
    cantidadCompras: comprasStats._count._all || 0,
    totalComprado: Number(comprasStats._sum.total || 0)
  };

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
      persona: personaConStats,
      saldo: 0,
      movimientos: []
    });
  }
  res.json({ ...cuenta, persona: { ...cuenta.persona, cantidadCompras: comprasStats._count._all || 0, totalComprado: Number(comprasStats._sum.total || 0) } });
}));

app.get('/cuenta-corriente/resumen', asyncHandler(async (req, res) => {
  const cuentas = await prisma.cuentaCorriente.findMany({
    include: {
      persona: true,
      movimientos: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true }
      }
    }
  });

  const cuentasByPersona = new Map(cuentas.map((c) => [c.personaId, c]));
  const ventasCc = await prisma.venta.findMany({
    where: { medioPago: 'CUENTA_CORRIENTE', personaId: { not: null } },
    include: { persona: true },
    orderBy: { updatedAt: 'desc' }
  });

  const resumenMap = new Map();

  const ensureEntry = (personaId, persona) => {
    if (!resumenMap.has(personaId)) {
      resumenMap.set(personaId, {
        personaId,
        clienteId: personaId,
        nombre: persona?.nombre || 'Sin nombre',
        telefono: persona?.telefono || null,
        deudaTotal: 0,
        movimientosPendientes: 0,
        ultimoMovimientoAt: null
      });
    }
    return resumenMap.get(personaId);
  };

  for (const cuenta of cuentas) {
    const item = ensureEntry(cuenta.personaId, cuenta.persona);
    item.deudaTotal = Number(cuenta.saldo || 0);
    item.movimientosPendientes = cuenta.movimientos.length;
    item.ultimoMovimientoAt = cuenta.movimientos[0]?.createdAt || null;
  }

  for (const venta of ventasCc) {
    const personaId = Number(venta.personaId);
    if (!personaId) continue;
    if (cuentasByPersona.has(personaId)) continue;
    const item = ensureEntry(personaId, venta.persona);
    item.deudaTotal += Number(venta.total || 0);
    item.movimientosPendientes += 1;
    if (!item.ultimoMovimientoAt || new Date(venta.updatedAt) > new Date(item.ultimoMovimientoAt)) {
      item.ultimoMovimientoAt = venta.updatedAt;
    }
  }

  const resumen = Array.from(resumenMap.values())
    .filter((item) => Number(item.deudaTotal) > 0)
    .sort((a, b) => Number(a.deudaTotal) - Number(b.deudaTotal));

  res.json(resumen);
}));

app.post('/cuenta-corriente/personas/:personaId/pagos', asyncHandler(async (req, res) => {
  const personaId = parsePositiveInt(req.params.personaId);
  if (!personaId) return res.status(400).json({ error: 'personaId inválido' });
  const { monto, medioPago, fecha, observacion } = req.body;

  if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'monto (>0) es obligatorio' });
  if (!['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'].includes(String(medioPago || ''))) return res.status(400).json({ error: 'medioPago inválido' });
  if (!fecha) return res.status(400).json({ error: 'fecha es obligatoria' });

  const cuenta = await prisma.cuentaCorriente.findUnique({ where: { personaId }, include: { persona: true } });
  if (!cuenta) return res.status(404).json({ error: 'Cuenta corriente no encontrada' });
  if (Number(monto) > cuenta.saldo) return res.status(400).json({ error: 'El pago no puede ser mayor al saldo actual' });

  const saldoAnterior = Number(cuenta.saldo);
  const cuentaActualizada = await prisma.$transaction(async tx => {
    const updated = await tx.cuentaCorriente.update({ where: { id: cuenta.id }, data: { saldo: { decrement: Number(monto) } } });
    const movimiento = await tx.movimientoCuentaCorriente.create({
      data: { cuentaCorrienteId: cuenta.id, tipo: 'CREDITO', monto: Number(monto), descripcion: observacion || 'Pago de cuenta corriente' }
    });
    const recibo = await tx.reciboPagoCuentaCorriente.create({
      data: {
        movimientoId: movimiento.id,
        personaId,
        montoPagado: Number(monto),
        medioPago,
        fechaPago: new Date(fecha),
        observacion: observacion || null,
        saldoAnterior,
        saldoPosterior: Number(updated.saldo)
      }
    });
    return { updated, recibo };
  });

  res.json({ ...cuentaActualizada.updated, recibo: { id: cuentaActualizada.recibo.id, personaNombre: cuenta.persona?.nombre || 'Cliente', monto: cuentaActualizada.recibo.montoPagado, medioPago: cuentaActualizada.recibo.medioPago, fechaPago: cuentaActualizada.recibo.fechaPago, saldoAnterior: cuentaActualizada.recibo.saldoAnterior, saldoPosterior: cuentaActualizada.recibo.saldoPosterior } });
}));

async function obtenerReciboCc(reciboId) {
  return prisma.reciboPagoCuentaCorriente.findUnique({ where: { id: reciboId }, include: { persona: true } });
}

function htmlReciboCc(recibo, forPrint = false) {
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"/><title>Recibo #${recibo.id}</title><style>body{font-family:Arial,sans-serif;margin:16px;max-width:460px;}p{margin:4px 0;}@media print{button{display:none;}}</style></head><body><h2>Recibo de pago #${recibo.id}</h2><p><strong>Persona:</strong> ${escapeHtml(recibo.persona?.nombre || '-')}</p><p><strong>Monto pagado:</strong> $${Number(recibo.montoPagado).toFixed(2)}</p><p><strong>Medio de pago:</strong> ${escapeHtml(recibo.medioPago)}</p><p><strong>Fecha:</strong> ${new Date(recibo.fechaPago).toLocaleString('es-AR')}</p><p><strong>Saldo anterior:</strong> $${Number(recibo.saldoAnterior).toFixed(2)}</p><p><strong>Saldo posterior:</strong> $${Number(recibo.saldoPosterior).toFixed(2)}</p><p><strong>Observación:</strong> ${escapeHtml(recibo.observacion || '-')}</p>${forPrint ? '<script>window.print()</script>' : '<button onclick="window.print()">Imprimir</button>'}</body></html>`;
}

app.get('/cuenta-corriente/recibos/:reciboId/ver', asyncHandler(async (req, res) => {
  const reciboId = parsePositiveInt(req.params.reciboId);
  const recibo = await obtenerReciboCc(reciboId);
  if (!recibo) return res.status(404).send('Recibo no encontrado');
  res.set('Content-Type', 'text/html; charset=utf-8').send(htmlReciboCc(recibo, false));
}));

app.get('/cuenta-corriente/recibos/:reciboId/imprimir', asyncHandler(async (req, res) => {
  const reciboId = parsePositiveInt(req.params.reciboId);
  const recibo = await obtenerReciboCc(reciboId);
  if (!recibo) return res.status(404).send('Recibo no encontrado');
  res.set('Content-Type', 'text/html; charset=utf-8').send(htmlReciboCc(recibo, true));
}));

app.get('/cuenta-corriente/recibos/:reciboId/whatsapp', asyncHandler(async (req, res) => {
  const reciboId = parsePositiveInt(req.params.reciboId);
  const recibo = await obtenerReciboCc(reciboId);
  if (!recibo) return res.status(404).send('Recibo no encontrado');
  const msg = `Recibo #${recibo.id} - ${recibo.persona?.nombre || 'Cliente'} | Pago: $${Number(recibo.montoPagado).toFixed(2)} | Medio: ${recibo.medioPago} | Fecha: ${new Date(recibo.fechaPago).toLocaleDateString('es-AR')} | Saldo anterior: $${Number(recibo.saldoAnterior).toFixed(2)} | Saldo posterior: $${Number(recibo.saldoPosterior).toFixed(2)}`;
  res.redirect(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}));

app.use((err, req, res, next) => {
  console.error('[backend-error]', { method: req.method, path: req.path, message: err.message, stack: err.stack });
  if (res.headersSent) return next(err);
  const esRutaCaja = req.path.startsWith('/caja');
  const esErrorPrisma = typeof err?.name === 'string' && err.name.startsWith('Prisma');
  const mensaje = (esRutaCaja && esErrorPrisma)
    ? 'Error interno al procesar la caja'
    : (err.message || 'Error interno del servidor');
  const response = { error: mensaje, path: req.path, method: req.method };
  if (process.env.NODE_ENV !== 'production') response.stack = err.stack;
  res.status(500).json(response);
});



app.post('/api/semillasya/solicitud', asyncHandler(async (req, res) => {
  const { personaId, nombre, telefono, pais, provincia, ciudad, localidad, observaciones, items } = req.body || {};

  const nombreLimpio = String(nombre || '').trim();
  const telefonoLimpio = normalizarTelefono(telefono);
  const paisLimpio = String(pais || '').trim();
  const provinciaLimpia = String(provincia || '').trim();
  const ciudadLimpia = String(ciudad || localidad || '').trim();
  const observacionesLimpias = String(observaciones || '').trim();
  const itemsEntrada = Array.isArray(items) ? items : [];

  if (!nombreLimpio) return res.status(400).json({ error: 'nombre es obligatorio' });
  if (!telefonoLimpio) return res.status(400).json({ error: 'telefono es obligatorio' });
  if (!paisLimpio) return res.status(400).json({ error: 'pais es obligatorio' });
  if (!provinciaLimpia) return res.status(400).json({ error: 'provincia es obligatoria' });
  if (!itemsEntrada.length) return res.status(400).json({ error: 'Debe incluir al menos un item' });

  const ids = itemsEntrada.map((it) => parsePositiveInt(it.productoPrecampaniaId)).filter(Boolean);
  if (ids.length !== itemsEntrada.length) return res.status(400).json({ error: 'productoPrecampaniaId inválido en items' });

  const cantidades = itemsEntrada.map((it) => parsePositiveInt(it.cantidad)).filter(Boolean);
  if (cantidades.length !== itemsEntrada.length) return res.status(400).json({ error: 'cantidad inválida en items' });

  const productosLista = await prisma.productoPrecampania.findMany({
    where: { id: { in: ids }, activo: true, visibleEnSemillasYa: true }
  });
  const productosById = new Map(productosLista.map((p) => [p.id, p]));
  const faltantes = ids.filter((id) => !productosById.has(id));
  if (faltantes.length) return res.status(400).json({ error: `Productos de precampaña no encontrados: ${faltantes.join(', ')}` });

  const resultado = await prisma.$transaction(async (tx) => {
    let personaExistente = null;
    if (parsePositiveInt(personaId)) {
      personaExistente = await tx.persona.findFirst({ where: { id: parsePositiveInt(personaId), eliminado: false } });
    }
    if (!personaExistente) {
      personaExistente = await tx.persona.findFirst({ where: { telefono: telefonoLimpio, eliminado: false } });
    }
    const observacionesPersona = [
      paisLimpio ? `País: ${paisLimpio}` : null,
      provinciaLimpia ? `Provincia: ${provinciaLimpia}` : null,
      ciudadLimpia ? `Ciudad/Localidad: ${ciudadLimpia}` : null,
      'Origen: SEMILLASYA_WEB',
      observacionesLimpias ? `Obs: ${observacionesLimpias}` : null
    ].filter(Boolean).join(' | ');

    const persona = personaExistente
      ? await tx.persona.update({ where: { id: personaExistente.id }, data: { nombre: nombreLimpio, telefono: telefonoLimpio, tipo: 'CLIENTE', observaciones: observacionesPersona } })
      : await tx.persona.create({ data: { nombre: nombreLimpio, telefono: telefonoLimpio, tipo: 'CLIENTE', observaciones: observacionesPersona } });

    const itemsCalculados = [];
    for (let i = 0; i < itemsEntrada.length; i += 1) {
      const item = itemsEntrada[i];
      const productoLista = productosById.get(parsePositiveInt(item.productoPrecampaniaId));
      const cantidad = parsePositiveInt(item.cantidad);
      const precioUnitario = Number(productoLista.precioVentaFinal || 0);

      const productoERP = await tx.producto.findFirst({ where: { nombre: productoLista.nombre, unidad: productoLista.presentacionEnvase || '', eliminado: false } });
      if (!productoERP) {
        throw new Error(`No existe producto mostrador para ${productoLista.nombre}. Duplicar desde Precampaña primero.`);
      }

      itemsCalculados.push({
        productoId: productoERP.id,
        cantidad,
        precioUnitario,
        subtotal: precioUnitario * cantidad,
        nombreProducto: productoLista.nombre
      });
    }

    const subtotal = itemsCalculados.reduce((acc, it) => acc + it.subtotal, 0);
    const presupuesto = await tx.presupuesto.create({
      data: {
        personaId: persona.id,
        tipoDestinatario: TipoDestinatarioPresupuesto.EXISTENTE,
        estado: enumValuesSafe(EstadoPresupuesto).includes('WEB_SOLICITADO') ? 'WEB_SOLICITADO' : EstadoPresupuesto.BORRADOR,
        subtotal,
        total: subtotal,
        origen: 'SEMILLASYA',
        tipoOperacion: 'PRECAMPAÑA',
        observaciones: [
          'Solicitud originada en SEMILLASYA_WEB',
          paisLimpio ? `País: ${paisLimpio}` : null,
          provinciaLimpia ? `Provincia: ${provinciaLimpia}` : null,
          ciudadLimpia ? `Ciudad/Localidad: ${ciudadLimpia}` : null,
          observacionesLimpias ? `Observaciones: ${observacionesLimpias}` : null
        ].filter(Boolean).join(' | ')
      }
    });

    await tx.presupuestoItem.createMany({
      data: itemsCalculados.map((it) => ({ presupuestoId: presupuesto.id, productoId: it.productoId, cantidad: it.cantidad, precioUnitario: it.precioUnitario, subtotal: it.subtotal }))
    });

    return { persona, presupuesto, itemsCalculados };
  });

  const mensajeInterno = armarMensajeWhatsAppSemillasYaInterno({
    presupuestoId: resultado.presupuesto.id,
    nombre: nombreLimpio,
    pais: paisLimpio,
    provincia: provinciaLimpia,
    ciudad: ciudadLimpia,
    localidad: ciudadLimpia,
    items: resultado.itemsCalculados
  });

  res.status(201).json({
    ok: true,
    personaId: resultado.persona.id,
    presupuestoId: resultado.presupuesto.id,
    mensaje: 'Solicitud recibida. Te vamos a responder por WhatsApp.',
    whatsappInterno: { mensaje: mensajeInterno }
  });
}));

app.get('/semillasya', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'app', 'semillasya.html'));
});

app.use('/semillasya', express.static(require('path').join(__dirname, 'app')));

app.post('/api/semillasya/cliente', asyncHandler(async (req, res) => {
  const { nombre, telefono, pais, provincia, ciudad, localidad } = req.body || {};
  const nombreLimpio = String(nombre || '').trim();
  const telefonoLimpio = normalizarTelefono(telefono);
  const paisLimpio = String(pais || '').trim();
  const provinciaLimpia = String(provincia || '').trim();
  const ciudadLimpia = String(ciudad || localidad || '').trim();

  if (!nombreLimpio) return res.status(400).json({ error: 'nombre es obligatorio' });
  if (!telefonoLimpio) return res.status(400).json({ error: 'telefono es obligatorio' });
  if (!paisLimpio) return res.status(400).json({ error: 'pais es obligatorio' });
  if (!provinciaLimpia) return res.status(400).json({ error: 'provincia es obligatoria' });
  if (!ciudadLimpia) return res.status(400).json({ error: 'ciudad/localidad es obligatoria' });

  const observacionesPersona = [
    `País: ${paisLimpio}`,
    `Provincia: ${provinciaLimpia}`,
    `Ciudad/Localidad: ${ciudadLimpia}`,
    'Origen: SEMILLASYA_WEB'
  ].join(' | ');

  const metadata = JSON.stringify({ origenCliente: 'SEMILLASYA', tipoCliente: 'CLIENTE_WEB', pais: paisLimpio, provincia: provinciaLimpia, ciudad: ciudadLimpia, localidad: ciudadLimpia });
  const personaExistente = await prisma.persona.findFirst({ where: { telefono: telefonoLimpio, eliminado: false } });
  const persona = personaExistente
    ? await prisma.persona.update({
      where: { id: personaExistente.id },
      data: { nombre: nombreLimpio, telefono: telefonoLimpio, tipo: 'CLIENTE', origenCliente: 'SEMILLASYA', observaciones: observacionesPersona, metadata }
    })
    : await prisma.persona.create({
      data: { nombre: nombreLimpio, telefono: telefonoLimpio, tipo: 'CLIENTE', tipoCliente: 'PERSONAL', origenCliente: 'SEMILLASYA', observaciones: observacionesPersona, metadata }
    });

  res.status(201).json({
    ok: true,
    personaId: persona.id,
    nombre: persona.nombre,
    telefono: persona.telefono,
    pais: paisLimpio,
    provincia: provinciaLimpia,
    ciudad: ciudadLimpia,
    localidad: ciudadLimpia
  });
}));

app.post('/api/semillasya/ingreso', asyncHandler(async (req, res) => {
  req.body = req.body || {};
  return await (async () => {
    const { nombre, telefono, pais, provincia, ciudad, localidad } = req.body || {};
    const nombreLimpio = String(nombre || '').trim();
    const telefonoLimpio = normalizarTelefono(telefono);
    const paisLimpio = String(pais || '').trim();
    const provinciaLimpia = String(provincia || '').trim();
    const ciudadLimpia = String(ciudad || localidad || '').trim();

    if (!nombreLimpio) return res.status(400).json({ error: 'nombre es obligatorio' });
    if (!telefonoLimpio) return res.status(400).json({ error: 'telefono es obligatorio' });
    if (!paisLimpio) return res.status(400).json({ error: 'pais es obligatorio' });
    if (!provinciaLimpia) return res.status(400).json({ error: 'provincia es obligatoria' });
    if (!ciudadLimpia) return res.status(400).json({ error: 'ciudad/localidad es obligatoria' });

    const observacionesPersona = [
      `País: ${paisLimpio}`,
      `Provincia: ${provinciaLimpia}`,
      `Ciudad/Localidad: ${ciudadLimpia}`,
      'Origen: SEMILLASYA_WEB'
    ].join(' | ');

    const metadata = JSON.stringify({ origenCliente: 'SEMILLASYA', tipoCliente: 'CLIENTE_WEB', pais: paisLimpio, provincia: provinciaLimpia, ciudad: ciudadLimpia, localidad: ciudadLimpia });
    const personaExistente = await prisma.persona.findFirst({ where: { telefono: telefonoLimpio, eliminado: false } });
    const persona = personaExistente
      ? await prisma.persona.update({
        where: { id: personaExistente.id },
        data: { nombre: nombreLimpio, telefono: telefonoLimpio, tipo: 'CLIENTE', origenCliente: 'SEMILLASYA', observaciones: observacionesPersona, metadata }
      })
      : await prisma.persona.create({
        data: { nombre: nombreLimpio, telefono: telefonoLimpio, tipo: 'CLIENTE', tipoCliente: 'PERSONAL', origenCliente: 'SEMILLASYA', observaciones: observacionesPersona, metadata }
      });

    return res.status(201).json({ ok: true, personaId: persona.id });
  })();
}));

app.get('/app', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'app', 'index.html'));
});

app.use('/app', express.static(require('path').join(__dirname, 'app')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const CATEGORIA_MOSTRADOR_DEFAULT = 'SIN CATEGORÍA';
const PROVEEDOR_MOSTRADOR_DEFAULT = 'SIN PROVEEDOR';

async function obtenerCategoriaMostradorDefault(client) {
  return client.categoria.upsert({
    where: { nombre: CATEGORIA_MOSTRADOR_DEFAULT },
    update: { activo: true },
    create: {
      nombre: CATEGORIA_MOSTRADOR_DEFAULT,
      descripcion: 'Categoría automática para productos de Mostrador sin categoría asignada.',
      activo: true
    }
  });
}

async function obtenerProveedorMostradorDefault(client) {
  const existente = await client.proveedor.findFirst({ where: { razonSocial: PROVEEDOR_MOSTRADOR_DEFAULT } });
  if (existente) {
    if (!existente.activo || existente.eliminado) {
      return client.proveedor.update({
        where: { id: existente.id },
        data: { activo: true, eliminado: false, eliminadoAt: null, eliminadoPor: null, motivoEliminacion: null }
      });
    }
    return existente;
  }
  return client.proveedor.create({
    data: {
      razonSocial: PROVEEDOR_MOSTRADOR_DEFAULT,
      observaciones: 'Proveedor automático para productos de Mostrador sin proveedor asignado.',
      activo: true,
      eliminado: false
    }
  });
}

async function normalizarProductosMostrador(client) {
  const [categoriaDefault, proveedorDefault, productos] = await Promise.all([
    obtenerCategoriaMostradorDefault(client),
    obtenerProveedorMostradorDefault(client),
    client.producto.findMany({
      where: { eliminado: false },
      include: { categorias: true, proveedores: true }
    })
  ]);

  let corregidosCategoria = 0;
  let corregidosProveedor = 0;

  for (const producto of productos) {
    const sinCategoriaTexto = !String(producto.categoria || '').trim();
    const sinCategoriaRelacion = !(producto.categorias || []).length;
    const sinProveedor = !(producto.proveedores || []).length;
    const data = {};

    if (sinCategoriaTexto || sinCategoriaRelacion) {
      corregidosCategoria += 1;
      data.categoria = sinCategoriaTexto ? CATEGORIA_MOSTRADOR_DEFAULT : producto.categoria;
      data.categorias = sinCategoriaRelacion ? { connect: [{ id: categoriaDefault.id }] } : undefined;
    }

    if (Object.keys(data).length) {
      await client.producto.update({ where: { id: producto.id }, data });
    }

    if (sinProveedor) {
      corregidosProveedor += 1;
      await client.productoProveedor.create({ data: { productoId: producto.id, proveedorId: proveedorDefault.id } }).catch(() => null);
    }
  }

  return {
    productosAnalizados: productos.length,
    sinCategoriaCorregidos: corregidosCategoria,
    sinProveedorCorregidos: corregidosProveedor
  };
}

normalizarProductosMostrador(prisma)
  .then((resultado) => {
    console.log(`Productos analizados: ${resultado.productosAnalizados}`);
    console.log(`Sin categoría corregidos: ${resultado.sinCategoriaCorregidos}`);
    console.log(`Sin proveedor corregidos: ${resultado.sinProveedorCorregidos}`);
  })
  .catch((error) => {
    console.error('[normalizar-productos-mostrador] Error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

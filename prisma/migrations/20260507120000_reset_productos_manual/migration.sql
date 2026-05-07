-- Reinicio limpio del módulo de productos: elimina catálogo y datos dependientes.
DELETE FROM "DetalleRemitoProveedor";
DELETE FROM "MovimientoStock";
DELETE FROM "ProductoProveedor";
DELETE FROM "PresupuestoItem";
DELETE FROM "VentaItem";
DELETE FROM "Producto";

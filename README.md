# AGROQUIMICA-SAN-BERNARDO-SOFTWARE-v2

Backend con Express + Prisma + SQLite.

## Módulo de ventas mostrador

### Flujo
1. Crear venta en borrador: `POST /mostrador/ventas`
2. Agregar productos: `POST /mostrador/ventas/:id/items`
3. Asociar persona (opcional al inicio): `PUT /mostrador/ventas/:id/persona`
4. Cerrar venta: `POST /mostrador/ventas/:id/cerrar`

### Reglas implementadas
- Mostrador puede armar venta con productos.
- Puede cargar productos primero y persona después.
- Antes de cerrar, la venta debe tener persona con nombre y teléfono.
- Al cerrar, la venta pasa a `PENDIENTE_CAJA`.
- No existe endpoint de cobro en mostrador (cobro queda para caja en otro módulo).

### Endpoints útiles
- `GET /mostrador/ventas?estado=PENDIENTE_CAJA` para listar ventas (opcionalmente filtradas por estado).
- `GET /mostrador/ventas/:id` para consultar detalle de una venta.

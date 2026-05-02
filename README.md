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
- `GET /mostrador/ventas/:id` para consultar detalle de una venta.

## Cuenta corriente

- Para enviar una venta a cuenta corriente al cobrar en caja:
  - `POST /caja/cobrar/:id` con body `{ "medioPago": "CUENTA_CORRIENTE" }`.
- Consultar cuenta corriente de una persona:
  - `GET /cuenta-corriente/personas/:personaId`
- Registrar pago de cuenta corriente:
  - `POST /cuenta-corriente/personas/:personaId/pagos` con body `{ "monto": 1000, "descripcion": "Pago parcial" }`

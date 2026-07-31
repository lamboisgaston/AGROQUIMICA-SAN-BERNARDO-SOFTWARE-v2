# PROYECTO_ESTADO_ACTUAL

## Proyecto
Agroquímica San Bernardo - Sistema operativo comercial.

Fecha de actualización de este documento: **2026-05-15 (UTC)**.

---

## 1) Arquitectura actual

### Stack y runtime
- **Backend:** Node.js + Express.
- **ORM/DB:** Prisma + SQLite (`prisma/dev.db`).
- **Frontend:** SPA liviana en HTML/CSS/JS nativo (`app/index.html`, `app/main.js`, `app/styles.css`).
- **Integración:** frontend y backend conviven en el mismo servicio (API REST + archivos estáticos).

### Patrón general
- Backend monolítico en `server.js`, con endpoints por dominio funcional (productos, stock, remitos, mostrador, caja, cuenta corriente, presupuestos, clientes/proveedores, configuración).
- Persistencia centralizada en modelos Prisma con relaciones explícitas para:
  - ventas + items,
  - cuenta corriente + movimientos,
  - proveedores + productos (N:N),
  - remitos proveedor + detalle remito,
  - presupuestos + items.
- Lógica de negocio crítica embebida en backend:
  - cálculo de precios finales en pesos según moneda, IVA, flete y margen,
  - cálculo de totales de venta/presupuesto con descuento y ajuste de redondeo,
  - transición de estados operativos (BORRADOR → PENDIENTE_CAJA → COBRADA).

### Estado de madurez arquitectónica
- **Funcional para operación diaria** en entorno local/codespace.
- **Sin separación en capas** estrictas (controlador/servicio/repositorio), lo que acelera cambios pero aumenta acoplamiento.
- **Sin autenticación robusta**: login simple con usuarios hardcodeados (útil para operación interna, no apto despliegue público sin endurecimiento).

---

## 2) Módulos funcionando (estado real)

## Inicio / navegación
- Selector de rol y acceso a módulos según permisos frontend.
- Navegación por bloques de módulo con control de visibilidad.

## Clientes (Personas)
- Alta de persona personal/empresa.
- Soporte de `tipoCliente` (`PERSONAL` / `EMPRESA`) en datos.
- Asociación de persona a venta y a presupuesto.

## Productos
- ABM manual de productos con campos comerciales y de costo.
- Soporte de costo en `ARS` o `USD`.
- Cálculo dinámico de precio final en pesos desde backend.
- Búsqueda por nombre/categoría/marca/id.

## Proveedores
- ABM de proveedor.
- Asociación/desasociación proveedor-producto.
- Vista de productos vinculados por proveedor.

## Stock
- Consulta stock por producto.
- Registro de movimientos `ENTRADA`, `SALIDA`, `AJUSTE`.
- Gestión de `stockMinimo` y alertas de estado (`SIN_STOCK`, `BAJO_STOCK`, `STOCK_NORMAL`).
- Vistas operativas:
  - stock general,
  - stock bajo,
  - productos sin proveedor.

## Remitos de proveedor
- Alta de remito con proveedor + detalles por producto.
- Al guardar remito:
  - incrementa stock,
  - registra movimiento de stock trazable.
- Listado de remitos con filtro por proveedor.

## Mostrador (ventas)
- Creación de venta borrador.
- Agregado/edición de ítems por producto.
- Asociación de cliente opcional al inicio.
- Cierre de venta con:
  - descuento (tipo/valor),
  - ajuste de redondeo,
  - condición de pago prevista.
- Al cerrar:
  - descuenta stock,
  - pasa venta a `PENDIENTE_CAJA`.

## Caja
- Lista ventas pendientes + recientes cobradas.
- Confirmación de cobro con estado real (efectivo/transferencia/tarjeta/cuenta corriente).
- Resumen diario de caja por medio de pago.
- Cierre diario de caja con `fechaCaja` (timezone operativa argentina configurada).
- Historial de cierres + opción de eliminar cierre (operación administrativa).

## Cuenta corriente
- Consulta cuenta de cliente (`saldo`, movimientos, métricas de compra).
- Envío de venta a cuenta corriente al cobrar en caja.
- Registro de pagos parciales o totales a la cuenta.
- Validación para evitar pagos mayores al saldo.

## Presupuestos
- Alta/edición/listado.
- Destinatario:
  - cliente existente,
  - nombre libre,
  - “a quien corresponda”.
- Ítems con totales y descuentos/ajustes.
- Estados: BORRADOR / ENVIADO / ACEPTADO / RECHAZADO / VENCIDO.
- Impresión HTML de presupuesto.
- Flujo de aceptación/rechazo.
- Opción de dar de alta persona desde presupuesto cuando aplica.

---

## 3) Problemas resueltos recientemente (reflejado por migraciones y lógica activa)

1. **Desacople proveedor-stock y normalización de relaciones**
   - Se consolidó relación N:N `ProductoProveedor` y se reforzó trazabilidad de abastecimiento por remitos.

2. **Precio de productos más consistente**
   - Se estabilizó cálculo por moneda + IVA + flete + margen.
   - El frontend consume precio calculado en pesos ya normalizado por backend.

3. **Mejoras en flujo mostrador → caja**
   - Se incorporaron `ajusteRedondeo` y `condicionPagoPrevista` para cerrar venta con más contexto comercial.
   - Se validó obligatoriedad de condición prevista cuando hay descuento/ajuste.

4. **Correcciones de presupuestos**
   - Se agregaron y ajustaron campos de redondeo, condición prevista y destinatario libre.
   - Mejor convergencia entre datos de presupuesto y su presentación/impresión.

5. **Caja diaria más controlada**
   - Se formalizó `CierreCajaDiario` con fecha de caja local y resumen por medio de pago.
   - Prevención de doble cierre para la misma fecha.

6. **Tipificación comercial de clientes**
   - Se incorporó `tipoCliente` (PERSONAL/EMPRESA), útil para reglas de formularios y operación comercial.

---

## 4) Cambios importantes de lógica (vigentes)

## Precios
- El precio final de venta en pesos ya no depende de cálculo aislado del frontend.
- Se parte de `costoBase` + `monedaCosto` y se aplica:
  1) tipo de cambio (si USD),
  2) IVA,
  3) flete,
  4) margen de ganancia.

## Cierre de venta
- La venta puede iniciarse sin cliente.
- Si hay descuento o ajuste de redondeo, se vuelve obligatorio:
  - cliente asociado,
  - condición de pago prevista.
- Al cerrar, el stock se decrementa y la venta queda pendiente de caja.

## Cobro en caja
- Caja define el medio real final de cobro.
- Si el medio es cuenta corriente:
  - exige cliente,
  - genera/actualiza cuenta corriente,
  - crea movimiento DEBITO por el importe.

## Presupuestos
- Admite destinatario existente, libre o “a quien corresponda”.
- Maneja descuento y ajuste de redondeo con control de condición de pago prevista cuando corresponde.

## Stock
- Todo ajuste operativo relevante debe quedar con movimiento de stock (manual o por remito).
- Se prioriza trazabilidad sobre simplicidad del update directo.

---

## 5) Sistema de roles (estado actual de implementación)

## Roles implementados
- `ADMINISTRADOR_GENERAL`
- `GERENTE`
- `MOSTRADOR`
- `CAJA` (definido en frontend para visibilidad de módulos)

## Fuente de verdad actual
- Backend login simple con usuarios hardcodeados:
  - admin / gerente / operador.
- Frontend persiste rol activo en `localStorage` y filtra módulos visibles.

## Permisos funcionales por rol (frontend)
- **ADMINISTRADOR_GENERAL / GERENTE:** acceso completo operativo.
- **MOSTRADOR:** foco en ventas/clientes/productos/presupuestos/stock.
- **CAJA:** foco en caja/cuenta corriente/reportes.

## Advertencia
- Es un control de interfaz, no un RBAC robusto de backend por endpoint.
- Para endurecer seguridad futura: JWT/sesiones + middleware de autorización por ruta.

---

## 6) Mejoras visuales frontend (vigentes)

- Organización modular por secciones visibles/ocultas según rol.
- Carrito y resumen de mostrador con:
  - subtotal,
  - descuento,
  - ajuste de redondeo,
  - total final,
  - alertas de stock negativo.
- Vista de caja con estado del día, resumen por medios y ventas recientes.
- Panel de cuenta corriente con estado visual de saldo y movimientos DEBE/HABER.
- Pantalla de stock con clasificación visual por estado (normal, bajo, sin stock).
- Pantalla de remitos con carga de ítems editable antes de confirmar.
- Listados de presupuestos y productos con datos comerciales ampliados (marca, unidad, proveedores, costos convertidos).

---

## 7) Flujo operativo actual (end-to-end recomendado)

1. **Alta/mantenimiento de maestros**
   - Cargar productos con costos y parámetros de precio.
   - Cargar/actualizar proveedores y asociarlos a productos.
   - Configurar tipo de cambio cuando aplique.

2. **Abastecimiento**
   - Registrar remitos de proveedor para ingreso real de mercadería.
   - Verificar impacto en stock.

3. **Venta mostrador**
   - Crear venta borrador.
   - Agregar productos.
   - Asociar cliente si habrá descuento/ajuste o eventual cuenta corriente.
   - Cerrar venta y enviar a caja.

4. **Cobro en caja**
   - Tomar venta pendiente.
   - Confirmar medio de pago real.
   - Si cuenta corriente, validar cliente y saldo posterior.

5. **Control diario**
   - Revisar resumen de caja del día.
   - Ejecutar cierre diario una vez validados importes.

6. **Gestión comercial complementaria**
   - Emitir presupuestos.
   - Aceptar/rechazar según respuesta del cliente.
   - Convertir contacto libre en persona cuando haga falta seguimiento.

---

## 8) Pendientes importantes

1. **Seguridad/autenticación real**
   - Migrar login hardcodeado a usuarios persistidos + hash de contraseñas + control de permisos backend.

2. **Separación de capas backend**
   - Extraer servicios por dominio (ventas, caja, stock, presupuestos) para bajar complejidad de `server.js`.

3. **Validaciones más estrictas y uniformes**
   - Homogeneizar validación de payloads (esquemas centralizados) para evitar reglas dispersas.

4. **Auditoría operativa**
   - Agregar bitácora de eventos críticos (cierre caja, edición de ventas, eliminación de cierres, etc.).

5. **Reportes**
   - Consolidar reportes de margen, rotación y deuda por cliente/proveedor.

6. **Pruebas automáticas**
   - Hoy no hay suite de tests visible consolidada; priorizar tests de integración de flujos críticos.

7. **Hardening de concurrencia/consistencia**
   - Revisar escenarios simultáneos de edición/cobro para evitar estados inconsistentes.

---

## 9) Recomendaciones para próxima sesión

1. **Prioridad alta: seguridad mínima productiva**
   - Implementar autenticación persistida y middleware de autorización por endpoint.
   - Mantener roles actuales pero con enforcement backend real.

2. **Prioridad alta: modularización de backend**
   - Dividir `server.js` por routers y servicios sin cambiar comportamiento.
   - Objetivo: facilitar mantenimiento sin romper operación.

3. **Prioridad media: robustecer caja**
   - Bloqueo/permiso explícito para eliminar cierres.
   - Trazabilidad de reaperturas/correcciones.

4. **Prioridad media: presupuesto ↔ venta**
   - Evaluar flujo de conversión de presupuesto aceptado a venta borrador para ahorrar carga manual.

5. **Prioridad media: calidad de datos**
   - Estandarizar catálogos (unidad, categorías, marcas) y limpiar duplicados.

6. **Prioridad técnica transversal**
   - Incorporar pruebas de humo automáticas para:
     - cerrar venta,
     - cobrar en caja,
     - enviar a cuenta corriente,
     - crear remito y verificar impacto en stock.

7. **Práctica operativa recomendada**
   - Mantener este archivo actualizado al final de cada bloque de cambios funcionales.
   - Si se toca lógica de negocio, documentar siempre “qué cambió”, “por qué”, y “cómo impacta el flujo diario”.

---

## 10) Nota de alcance de esta actualización

- Esta actualización modifica **solo documentación**.
- No se realizaron cambios de backend ni de base de datos en este ciclo.

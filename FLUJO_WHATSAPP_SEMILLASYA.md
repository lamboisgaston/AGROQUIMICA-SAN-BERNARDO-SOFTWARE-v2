# Flujo de cotización asistida por WhatsApp — SemillasYa

## Objetivo
Definir un flujo **estructurado/manual** para que el canal WhatsApp funcione como:
1) alta de cliente,
2) conversación guiada,
3) armado de solicitud,
4) auditoría interna,
5) emisión final de presupuesto.

Actor comercial:
- **Ing. Alejandro Pablo Lambois** (asistente comercial / futuro agente IA).

---

## 1) Entrada pública (SemillasYa)

### Botón principal
- Label: **“Cotizar con Ing. Alejandro”**.
- Acción: abrir WhatsApp con mensaje precargado:
  - `Hola Ing. Alejandro, quiero cotizar semillas por SemillasYa.`

### Consideración funcional
- WhatsApp debe tratarse como **canal de inicio transaccional**, no solo contacto externo.

---

## 2) Guion de primeras preguntas (chat asistido)

Orden recomendado para capturar datos mínimos:
1. Nombre completo
2. Provincia
3. Ciudad / Localidad
4. WhatsApp de contacto
5. Cultivo que necesita
6. Superficie o cantidad aproximada
7. Fecha estimada de siembra
8. Observaciones

### Validaciones mínimas
- Campos obligatorios: nombre, provincia, ciudad/localidad, WhatsApp, cultivo.
- Cantidad/superficie: aceptar texto libre inicial (ej: “40 ha”, “120 bolsas”).
- Fecha de siembra: aceptar rango aproximado (ej: “segunda quincena de agosto”).

---

## 3) Alta/recuperación de cliente SemillasYa

### Si el cliente no existe
Crear Cliente con:
- `origenCliente = SEMILLASYA`
- `nombre`
- `telefono` (WhatsApp)
- `provincia`
- `ciudad`/`localidad`

### Si el cliente ya existe
- Reutilizar ficha actual.
- Asociar nueva interacción como nueva solicitud vinculada al mismo cliente.

### Regla de unicidad sugerida
- Priorizar match por teléfono normalizado de WhatsApp.

---

## 4) Pedido asistido (registro interno)

Crear una **Solicitud SemillasYa** con:
- cliente
- provincia
- ciudad
- cultivo
- productos sugeridos/solicitados
- cantidades
- observaciones
- `estado = NUEVA_SOLICITUD_ASISTIDA`
- `origen = WHATSAPP_ASISTIDO`

### Nota
- Esta entidad representa una **solicitud preliminar**, no un presupuesto final.

---

## 5) Auditoría obligatoria previa a presupuesto

La solicitud debe quedar como:
- **“Solicitud asistida pendiente de auditoría”**

Checklist de auditoría (operador / Ing. Alejandro):
- Productos
- Cantidades
- Precios
- Disponibilidad
- Flete
- Margen

Luego de aprobar auditoría:
1. Convertir solicitud en Presupuesto SemillasYa.
2. Enviar presupuesto al cliente por WhatsApp.

---

## 6) ERP SemillasYa: nueva vista operativa

Agregar pantalla: **“Solicitudes asistidas”**.

### Columnas mínimas
- Cliente
- Provincia
- Ciudad
- Cultivo
- Estado
- Origen (`WHATSAPP_ASISTIDO`)

### Acciones por fila
- Botón: **“Convertir en presupuesto”**
- Botón: **“Enviar interacción WhatsApp”**

### Filtros sugeridos
- Estado
- Provincia
- Cultivo
- Fecha de alta
- Responsable comercial

---

## 7) Alcance explícitamente excluido

No tocar en esta etapa:
- productos mostrador
- caja
- ventas
- cuenta corriente
- presupuestos mostrador

---

## 8) Estrategia de implementación por etapas

### Etapa 1 (ahora) — Estructurado/manual
- Preparar datos de cliente y solicitud.
- Definir estados y origen.
- Crear pantalla “Solicitudes asistidas”.
- Habilitar acciones manuales de auditoría/conversión/envío.

### Etapa 2 (posterior) — Asistencia inteligente
- Reemplazar guion fijo por agente IA conversacional.
- Sugerencia automática de productos, cantidades y alternativas.
- Priorización comercial por probabilidad de cierre.

---

## Criterios de aceptación (MVP manual)

1. Un usuario puede iniciar conversación por botón WhatsApp con mensaje prellenado.
2. Se capturan los 8 datos del guion inicial.
3. Se crea o reutiliza cliente SemillasYa.
4. Se crea solicitud con estado `NUEVA_SOLICITUD_ASISTIDA` y origen `WHATSAPP_ASISTIDO`.
5. La solicitud aparece en vista ERP “Solicitudes asistidas”.
6. No existe emisión automática de presupuesto final sin auditoría.
7. Un operador puede convertir manualmente y enviar interacción por WhatsApp.

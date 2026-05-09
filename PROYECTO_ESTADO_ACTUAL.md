# PROYECTO_ESTADO_ACTUAL

## Proyecto
Agroquímica San Bernardo - Sistema operativo comercial

## Stack
- Node.js
- Express
- Prisma
- SQLite
- Frontend HTML/CSS/JS
- GitHub Codespaces

## Módulos actuales
- Inicio
- Clientes
- Productos
- Mostrador
- Caja
- Presupuestos
- Proveedores
- Stock
- Cuenta corriente
- Remitos

## Reglas principales

### Clientes
- PERSONAL: nombre + teléfono obligatorio
- EMPRESA: razón social + CUIT + mail + teléfono obligatorio

### Mostrador
- Venta sin cliente permitida
- Cliente obligatorio si hay descuento
- Stock negativo permitido
- La venta pasa a Caja

### Caja
- Cobrar en:
  - efectivo
  - transferencia
  - tarjeta
- Cuenta corriente solo con cliente registrado

## Regla de trabajo
- No mergear PR
- Trabajar desde Codespace
- Probar primero con npm run dev
- Después:
  git add .
  git commit
  git push

## Comandos importantes

npm run dev

fuser -k 3000/tcp || true

git status

git add .

git commit -m "mensaje"

git pull --rebase origin main

git push origin main

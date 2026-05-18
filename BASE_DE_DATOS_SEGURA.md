# Base de datos segura - Agroquímica San Bernardo

## Objetivo
Separar código y datos para que cambios de versión no destruyan información real.

## Principios operativos
1. **La aplicación siempre usa `DATABASE_URL`** definido en el entorno.
2. **No usar comandos con reset** sobre base real.
3. **Siempre generar backup manual antes de operaciones sensibles**.

## Scripts npm disponibles
- `npm run db:status`  
  Muestra `DATABASE_URL`, ruta de archivo SQLite resuelta y metadata del archivo.

- `npm run db:backup`  
  Genera copia manual en `scripts/backups/backup-<timestamp>.sqlite`.

- `npm run db:restore -- <ruta_backup.sqlite>`  
  Restaura la base **sobre el archivo real de `DATABASE_URL`**.
  - Requiere confirmación explícita:
    ```bash
    CONFIRM_DB_RESTORE=YES npm run db:restore -- scripts/backups/backup-AAAA-MM-DDTHH-mm-ss-sssZ.sqlite
    ```

## Advertencias
- `db:restore` muestra una advertencia clara porque sobrescribe datos de la base actual.
- `prisma/seed.js` no hace reset ni borra tablas; solo realiza operaciones idempotentes.

## Volver a un tag sin perder datos
Flujo sugerido:

1. Guardar backup de la base actual:
   ```bash
   npm run db:backup
   ```
2. Cambiar de versión de código:
   ```bash
   git checkout <tag>
   ```
3. Verificar a qué DB apunta ese tag:
   ```bash
   npm run db:status
   ```
4. Si se necesita compatibilidad de esquema, aplicar migraciones seguras (sin reset):
   ```bash
   npm run prisma:migrate:safe
   ```
5. Iniciar sistema:
   ```bash
   npm run start
   ```

> Recomendación: mantener `DATABASE_URL` fuera del repositorio (archivo `.env` local del servidor) para preservar la separación código/datos entre tags.

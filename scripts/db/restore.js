const fs = require('fs');
const path = require('path');
const { ensureFileExists, readDatabaseUrl, resolveSqlitePath, warnDangerous } = require('./utils');

function main() {
  const backupInput = process.argv[2];
  if (!backupInput) {
    throw new Error('Uso: npm run db:restore -- <ruta_del_backup.sqlite>');
  }

  const databaseUrl = readDatabaseUrl();
  const dbPath = resolveSqlitePath(databaseUrl);
  const backupPath = path.resolve(process.cwd(), backupInput);

  warnDangerous('RESTORE de base de datos');
  console.warn(`⚠️  Backup origen: ${backupPath}`);
  console.warn(`⚠️  Base destino: ${dbPath}`);

  if (process.env.CONFIRM_DB_RESTORE !== 'YES') {
    throw new Error('Operación cancelada. Setear CONFIRM_DB_RESTORE=YES para continuar.');
  }

  ensureFileExists(backupPath, 'Backup');
  ensureFileExists(path.dirname(dbPath), 'Directorio de base de datos');

  const tempPath = `${dbPath}.restore-tmp`;
  fs.copyFileSync(backupPath, tempPath);
  fs.renameSync(tempPath, dbPath);

  console.log('✅ Restore completado');
  console.log(`- Backup usado: ${backupPath}`);
  console.log(`- Base restaurada: ${dbPath}`);
  console.log(`- DATABASE_URL: ${databaseUrl}`);
}

main();

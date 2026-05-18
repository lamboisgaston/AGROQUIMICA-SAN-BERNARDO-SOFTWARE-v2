const fs = require('fs');
const path = require('path');
const { readDatabaseUrl, resolveSqlitePath } = require('./utils');

function main() {
  const databaseUrl = readDatabaseUrl();
  const dbPath = resolveSqlitePath(databaseUrl);
  const exists = fs.existsSync(dbPath);

  console.log('Estado de base de datos (solo lectura):');
  console.log(`- DATABASE_URL: ${databaseUrl}`);
  console.log(`- Ruta resuelta: ${dbPath}`);
  console.log(`- Existe archivo: ${exists ? 'sí' : 'no'}`);

  if (exists) {
    const stats = fs.statSync(dbPath);
    console.log(`- Tamaño: ${stats.size} bytes`);
    console.log(`- Última modificación: ${stats.mtime.toISOString()}`);
  }

  const backupsDir = path.resolve(process.cwd(), 'scripts/backups');
  console.log(`- Carpeta backups: ${backupsDir}`);
}

main();

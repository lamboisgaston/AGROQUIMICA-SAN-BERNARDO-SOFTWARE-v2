const fs = require('fs');
const path = require('path');
const { readDatabaseUrl, resolveSqlitePath } = require('./utils');

function main() {
  const databaseUrl = readDatabaseUrl();
  const dbPath = resolveSqlitePath(databaseUrl);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`No se puede hacer backup: no existe DB en ${dbPath}`);
  }

  const backupsDir = path.resolve(process.cwd(), 'scripts/backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[.:]/g, '-');
  const backupName = `backup-${stamp}.sqlite`;
  const backupPath = path.join(backupsDir, backupName);

  fs.copyFileSync(dbPath, backupPath);

  console.log('✅ Backup completado');
  console.log(`- Origen: ${dbPath}`);
  console.log(`- Destino: ${backupPath}`);
  console.log(`- DATABASE_URL: ${databaseUrl}`);
}

main();

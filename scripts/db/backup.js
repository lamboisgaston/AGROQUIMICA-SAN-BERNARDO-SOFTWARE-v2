const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parsePostgresDatabaseUrl, readDatabaseUrl } = require('./utils');

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildBackupStamp(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}-${hours}${minutes}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function main() {
  const databaseUrl = readDatabaseUrl();
  const { databaseName } = parsePostgresDatabaseUrl(databaseUrl);

  const backupsDir = path.resolve(process.cwd(), 'backups/postgres');
  fs.mkdirSync(backupsDir, { recursive: true });

  const now = new Date();
  const backupName = `backup-${buildBackupStamp(now)}.sql`;
  const backupPath = path.join(backupsDir, backupName);

  const result = spawnSync('pg_dump', ['--format=plain', '--file', backupPath, databaseUrl], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    throw new Error(`No se pudo ejecutar pg_dump: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`pg_dump falló con código ${result.status}: ${result.stderr.trim()}`);
  }

  const stats = fs.statSync(backupPath);

  console.log('✅ Backup PostgreSQL completado');
  console.log(`- Base: ${databaseName}`);
  console.log(`- Fecha: ${now.toISOString()}`);
  console.log(`- Path: ${backupPath}`);
  console.log(`- Tamaño: ${formatBytes(stats.size)} (${stats.size} bytes)`);
  console.log('- Éxito: sí');
}

main();

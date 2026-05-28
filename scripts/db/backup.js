const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parsePostgresDatabaseUrl, readDatabaseUrl } = require('./utils');

const SERVER_VERSION_MISMATCH_PATTERN = /server version[\s\S]*pg_dump version|server version mismatch/i;

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

function removeFileIfExists(filePath) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch (error) {
    throw new Error(`No se pudo limpiar el archivo temporal ${filePath}: ${error.message}`);
  }
}

function isServerVersionMismatch(result) {
  return SERVER_VERSION_MISMATCH_PATTERN.test(result.stderr || '');
}

function runDump(command, args, outputPath) {
  const outputFd = fs.openSync(outputPath, 'w');

  try {
    return spawnSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', outputFd, 'pipe']
    });
  } finally {
    fs.closeSync(outputFd);
  }
}

function runLocalPgDump(databaseUrl, outputPath) {
  return runDump('pg_dump', ['--format=plain', databaseUrl], outputPath);
}

function runDockerPgDump(databaseUrl, outputPath) {
  return runDump('docker', ['run', '--rm', 'postgres:18', 'pg_dump', databaseUrl], outputPath);
}

function describeFailure(toolName, result) {
  if (result.error) {
    return `No se pudo ejecutar ${toolName}: ${result.error.message}`;
  }

  return `${toolName} falló con código ${result.status}: ${(result.stderr || '').trim()}`;
}

function createBackup(databaseUrl, backupPath) {
  const tempPath = `${backupPath}.tmp`;
  removeFileIfExists(tempPath);

  const localResult = runLocalPgDump(databaseUrl, tempPath);

  if (!localResult.error && localResult.status === 0) {
    fs.renameSync(tempPath, backupPath);
    return { method: 'pg_dump local' };
  }

  removeFileIfExists(tempPath);

  if (!isServerVersionMismatch(localResult)) {
    throw new Error(describeFailure('pg_dump', localResult));
  }

  console.warn('⚠️ pg_dump local falló por mismatch de versión; reintentando con Docker (postgres:18).');

  const dockerResult = runDockerPgDump(databaseUrl, tempPath);

  if (dockerResult.error || dockerResult.status !== 0) {
    removeFileIfExists(tempPath);
    throw new Error(describeFailure('docker run --rm postgres:18 pg_dump', dockerResult));
  }

  fs.renameSync(tempPath, backupPath);
  return { method: 'Docker postgres:18' };
}

function main() {
  const databaseUrl = readDatabaseUrl();
  const { databaseName } = parsePostgresDatabaseUrl(databaseUrl);

  const backupsDir = path.resolve(process.cwd(), 'backups/postgres');
  fs.mkdirSync(backupsDir, { recursive: true });

  const now = new Date();
  const backupName = `backup-${buildBackupStamp(now)}.sql`;
  const backupPath = path.join(backupsDir, backupName);

  const { method } = createBackup(databaseUrl, backupPath);
  const stats = fs.statSync(backupPath);

  console.log('✅ Backup PostgreSQL completado');
  console.log(`- Base: ${databaseName}`);
  console.log(`- Fecha: ${now.toISOString()}`);
  console.log(`- Método: ${method}`);
  console.log(`- Path: ${backupPath}`);
  console.log(`- Tamaño: ${formatBytes(stats.size)} (${stats.size} bytes)`);
  console.log('- Éxito: sí');
}

main();

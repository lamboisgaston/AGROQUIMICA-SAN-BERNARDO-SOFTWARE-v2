#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const backupDir = path.join(projectRoot, 'backups', 'postgres');
const databaseUrl = process.env.DATABASE_URL;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}-${hours}${minutes}`;
}

function describeDatabase(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || '(sin nombre)';
    const username = parsed.username ? decodeURIComponent(parsed.username) : '(sin usuario)';
    const host = parsed.hostname || '(sin host)';
    const port = parsed.port ? `:${parsed.port}` : '';

    return `${databaseName} @ ${host}${port} (usuario: ${username})`;
  } catch (error) {
    return 'DATABASE_URL configurada (no se pudo parsear para mostrar detalles)';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function removePartialBackup(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`No se pudo eliminar el backup parcial: ${error.message}`);
  }
}

async function run() {
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL no está configurada.');
    process.exit(1);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const fileName = `backup-${timestamp}.sql`;
  const outputPath = path.join(backupDir, fileName);

  console.log('Iniciando backup PostgreSQL...');
  console.log(`Base utilizada: ${describeDatabase(databaseUrl)}`);
  console.log(`Fecha: ${now.toISOString()}`);
  console.log(`Path del backup: ${outputPath}`);

  const pgDumpArgs = [
    '--dbname',
    databaseUrl,
    '--file',
    outputPath,
    '--format',
    'plain',
    '--no-owner',
    '--no-privileges',
  ];

  const child = spawn('pg_dump', pgDumpArgs, {
    stdio: ['ignore', 'inherit', 'pipe'],
    env: {
      ...process.env,
      PGSSLMODE: process.env.PGSSLMODE || 'require',
    },
  });

  let stderr = '';

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', (error) => {
    removePartialBackup(outputPath);

    if (error.code === 'ENOENT') {
      console.error('ERROR: pg_dump no está instalado o no está disponible en el PATH.');
      console.error('Instalá las herramientas cliente de PostgreSQL para poder generar el backup.');
    } else {
      console.error(`ERROR al ejecutar pg_dump: ${error.message}`);
    }

    process.exit(1);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      removePartialBackup(outputPath);
      console.error(`ERROR: pg_dump finalizó con código ${code}.`);
      if (stderr.trim()) {
        console.error(stderr.trim());
      }
      process.exit(code || 1);
    }

    const stats = fs.statSync(outputPath);

    console.log(`Tamaño archivo: ${formatBytes(stats.size)}`);
    console.log('Backup exitoso.');
    console.log('Restauración futura preparada: usar psql con este archivo .sql (no se ejecutó ninguna restauración).');
  });
}

run().catch((error) => {
  console.error(`ERROR inesperado: ${error.message}`);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');

function readDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL no está definido.');
  }
  return dbUrl;
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error(`DATABASE_URL no es SQLite (valor actual: ${databaseUrl}).`);
  }

  const rawPath = databaseUrl.replace(/^file:/, '');
  if (!rawPath) {
    throw new Error('DATABASE_URL SQLite inválido: ruta vacía.');
  }

  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);
}

function warnDangerous(operation) {
  console.warn('==============================================');
  console.warn('⚠️  OPERACIÓN POTENCIALMENTE PELIGROSA');
  console.warn(`⚠️  Acción: ${operation}`);
  console.warn('⚠️  Se trabajará sobre la DB real de DATABASE_URL.');
  console.warn('==============================================');
}

function ensureFileExists(filePath, name) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${name} no existe en: ${filePath}`);
  }
}

module.exports = {
  ensureFileExists,
  readDatabaseUrl,
  resolveSqlitePath,
  warnDangerous
};

const fs = require('fs');

function readDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL no está definido.');
  }
  return dbUrl;
}

function parsePostgresDatabaseUrl(databaseUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch (error) {
    throw new Error('DATABASE_URL PostgreSQL inválido.');
  }

  if (!['postgresql:', 'postgres:'].includes(parsedUrl.protocol)) {
    throw new Error('DATABASE_URL debe ser PostgreSQL Railway (postgresql:// o postgres://).');
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  if (!databaseName) {
    throw new Error('DATABASE_URL PostgreSQL inválido: falta el nombre de la base.');
  }

  return {
    databaseName,
    url: databaseUrl
  };
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
  parsePostgresDatabaseUrl,
  readDatabaseUrl,
  warnDangerous
};

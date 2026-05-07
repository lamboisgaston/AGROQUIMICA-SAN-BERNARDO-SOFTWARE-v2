const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, 'import_productos.py');
const args = process.argv.length > 2 ? [scriptPath, process.argv[2]] : [scriptPath];
const result = spawnSync('python3', args, { stdio: 'inherit' });

if (result.error) {
  console.error('No se pudo ejecutar el importador de productos:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

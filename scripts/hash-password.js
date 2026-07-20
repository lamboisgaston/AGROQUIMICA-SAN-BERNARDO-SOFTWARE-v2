// Genera el hash bcrypt de una contraseña para usar en variables de entorno.
// Uso: node scripts/hash-password.js "miContraseñaNueva"
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/hash-password.js "miContraseñaNueva"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nHash generado (copialo a la variable de entorno correspondiente):\n');
console.log(hash);
console.log('');

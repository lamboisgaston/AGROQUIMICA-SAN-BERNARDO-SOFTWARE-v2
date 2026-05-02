const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const USUARIOS = [
  { username: 'admin', password: 'admin123' },
  { username: 'operador', password: 'operador123' }
];

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const valido = USUARIOS.find(
    (u) => u.username === username && u.password === password
  );

  if (!valido) {
    return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
  }

  return res.json({ ok: true, mensaje: 'Login correcto' });
});

app.get('/productos', async (req, res) => {
  const productos = await prisma.producto.findMany({ orderBy: { id: 'asc' } });
  res.json(productos);
});

app.post('/productos', async (req, res) => {
  const { nombre, precio, descripcion } = req.body;

  if (!nombre || typeof precio !== 'number') {
    return res.status(400).json({ mensaje: 'nombre y precio(number) son obligatorios' });
  }

  const nuevo = await prisma.producto.create({
    data: { nombre, precio, descripcion }
  });

  res.status(201).json(nuevo);
});

app.get('/personas', async (req, res) => {
  const personas = await prisma.persona.findMany({ orderBy: { id: 'asc' } });
  res.json(personas);
});

app.post('/personas', async (req, res) => {
  const { nombre, email, telefono } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ mensaje: 'nombre y email son obligatorios' });
  }

  try {
    const nueva = await prisma.persona.create({
      data: { nombre, email, telefono }
    });
    return res.status(201).json(nueva);
  } catch (error) {
    return res.status(400).json({ mensaje: 'No se pudo crear persona', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ estado: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const r = require('express').Router();
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { getWorld } = require('../lib/city');
const { enviarEmailConfirmacion } = require('../lib/email');
const wrap = require('../wrap');

// --- REGISTRO LOCAL ---
r.post('/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const emailTrim = String(email).trim().toLowerCase();
  const existe = await User.findOne({ email: emailTrim });
  if (existe) return res.status(400).json({ error: 'El email ya está registrado' });

  // Cifrar la contraseña con bcrypt (seguridad obligatoria)
  const hashedPassword = await bcrypt.hash(password, 10);
  const key = Date.now().toString();

  // El primer usuario registrado o si se especifica puede ser admin, por defecto 'user'
  const totalUsuarios = await User.countDocuments();
  const role = totalUsuarios === 0 ? 'admin' : 'user';

  const newUser = await User.create({
    name: name ? String(name).trim() : 'Usuario',
    email: emailTrim,
    password: hashedPassword,
    role,
    confirmed: false, // Requiere confirmación por correo
    key
  });

  // Crear el mundo inicial para este usuario
  await getWorld(newUser._id, newUser.scenario);

  // Enviar correo de confirmación
  try {
    await enviarEmailConfirmacion(emailTrim, key);
  } catch (err) {
    console.error('Error al enviar correo:', err);
  }

  res.json({ mensaje: 'Usuario registrado. Revisa tu correo para confirmar la cuenta.' });
}));

// --- CONFIRMAR CUENTA POR CORREO ---
r.get('/confirmar/:email/:key', wrap(async (req, res) => {
  const { email, key } = req.params;
  const user = await User.findOne({ email, key, confirmed: false });

  if (!user) return res.status(400).json({ error: 'Enlace de confirmación no válido o ya utilizado' });

  user.confirmed = true;
  user.key = ''; // Limpiamos la clave
  await user.save();

  res.send('<h2>¡Cuenta confirmada con éxito! Ya puedes iniciar sesión en la aplicación.</h2>');
}));

// --- INICIO DE SESIÓN ---
r.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (!user) return res.status(400).json({ error: 'Credenciales incorrectas' });

  // Comprobar si ha confirmado la cuenta por correo
  if (!user.confirmed) return res.status(403).json({ error: 'Debes confirmar tu cuenta mediante el correo electrónico antes de iniciar sesión' });

  // Verificar contraseña con bcrypt
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) return res.status(400).json({ error: 'Credenciales incorrectas' });

  // La aplicación usa actualmente un único usuario activo en app.locals.
  // Mantenerlo aquí hace que las siguientes peticiones utilicen la cuenta autenticada.
  appLocalUserId = user._id; // O asignarlo a req.session / app.locals

  res.json({ 
    mensaje: 'Inicio de sesión correcto', 
    user: { id: user._id, name: user.name, email: user.email, role: user.role } 
  });
}));

module.exports = r;
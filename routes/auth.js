const r = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const { getWorld } = require('../lib/city');
const { enviarEmailConfirmacion, emailConfigurado } = require('../lib/email');
const { verificarSesion, iniciarSesion, cerrarSesion } = require('../middleware/auth');
const wrap = require('../wrap');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limite = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Prueba de nuevo en unos minutos.' } });
const publico = u => ({ id: u._id, name: u.name, email: u.email, role: u.role });

// --- REGISTRO ---
r.post('/register', limite, wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  const mail = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: 'El email no es válido' });
  if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (await User.exists({ email: mail })) return res.status(400).json({ error: 'El email ya está registrado' });

  // Administrador: el email indicado en ADMIN_EMAIL; si no hay ADMIN_EMAIL, el primer usuario registrado
  const admin = process.env.ADMIN_EMAIL
    ? mail === process.env.ADMIN_EMAIL.trim().toLowerCase()
    : (await User.countDocuments()) === 0;
  const conCorreo = emailConfigurado();
  const key = crypto.randomBytes(24).toString('hex');

  const user = await User.create({
    name: name && String(name).trim() ? String(name).trim().slice(0, 60) : 'Usuario',
    email: mail,
    password: await bcrypt.hash(String(password), 10),
    role: admin ? 'admin' : 'user',
    confirmed: !conCorreo,          // sin correo configurado, la cuenta queda confirmada al instante
    key: conCorreo ? key : ''
  });
  await getWorld(user._id, user.scenario);

  if (!conCorreo) return res.status(201).json({ mensaje: 'Cuenta creada. Ya puedes iniciar sesión.', confirmada: true });
  try { await enviarEmailConfirmacion(mail, key); }
  catch (err) {
    console.error('Error al enviar el correo de confirmación:', err.message);
    await User.deleteOne({ _id: user._id });          // evita cuentas imposibles de confirmar
    return res.status(502).json({ error: 'No se pudo enviar el correo de confirmación. Inténtalo más tarde.' });
  }
  res.status(201).json({ mensaje: 'Cuenta creada. Revisa tu correo para confirmarla.', confirmada: false });
}));

// --- CONFIRMAR CUENTA (enlace del correo) ---
r.get('/confirmar/:email/:key', wrap(async (req, res) => {
  const user = await User.findOne({ email: String(req.params.email).toLowerCase(), key: req.params.key, confirmed: false });
  if (!user || !req.params.key) return res.status(400).send('<h2>Enlace de confirmación no válido o ya utilizado</h2><p><a href="/">Ir a Brote</a></p>');
  user.confirmed = true; user.key = '';
  await user.save();
  res.send('<h2>¡Cuenta confirmada con éxito! 🌱</h2><p><a href="/">Iniciar sesión en Brote</a></p>');
}));

// --- INICIO DE SESIÓN ---
r.post('/login', limite, wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password), user.password)))
    return res.status(400).json({ error: 'Credenciales incorrectas' });
  if (!user.confirmed) return res.status(403).json({ error: 'Debes confirmar tu cuenta con el enlace que te enviamos por correo' });
  iniciarSesion(res, user);
  res.json({ mensaje: 'Inicio de sesión correcto', user: publico(user) });
}));

// --- CERRAR SESIÓN / QUIÉN SOY ---
r.post('/logout', (req, res) => { cerrarSesion(res); res.json({ mensaje: 'Sesión cerrada' }); });
r.get('/me', verificarSesion, (req, res) => res.json({ user: publico(req.user) }));

module.exports = r;

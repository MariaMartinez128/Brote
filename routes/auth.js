const r = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const { getWorld } = require('../lib/world');
const { enviarEmailConfirmacion, enviarEmailReset, emailConfigurado } = require('../lib/email');
const { verificarSesion, iniciarSesion, cerrarSesion } = require('../middleware/auth');
const wrap = require('../wrap');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const enTest = () => process.env.NODE_ENV === 'test';
const limite = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: enTest,
  skipSuccessfulRequests: true, message: { error: 'Demasiados intentos. Prueba de nuevo en unos minutos.' } });
const publico = u => ({ id: u._id, name: u.name, email: u.email, role: u.role });
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

// --- REGISTRO ---
r.post('/register', limite, wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  const mail = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(mail) || mail.length > 120) return res.status(400).json({ error: 'El email no es válido' });
  if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (Buffer.byteLength(String(password)) > 72) return res.status(400).json({ error: 'La contraseña es demasiado larga (máximo 72 caracteres)' });
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
  const user = req.params.key && await User.findOne({ email: String(req.params.email).toLowerCase(), key: req.params.key, confirmed: false });
  if (!user) return res.status(400).send('<h2>Enlace de confirmación no válido o ya utilizado</h2><p><a href="/">Ir a Brote</a></p>');
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
  if (user.active === false) return res.status(403).json({ error: 'Tu cuenta está suspendida. Contacta con el administrador.' });
  user.lastLogin = new Date(); await user.save();
  iniciarSesion(res, user);
  res.json({ mensaje: 'Inicio de sesión correcto', user: publico(user) });
}));

// --- RECUPERAR CONTRASEÑA ---
// Siempre responde lo mismo exista o no el email (no revela qué cuentas hay).
r.post('/forgot', limite, wrap(async (req, res) => {
  if (!emailConfigurado())
    return res.status(503).json({ error: 'El envío de correos no está configurado. Pídele a un administrador que restablezca tu contraseña.' });
  const mail = String(req.body.email || '').trim().toLowerCase();
  const generica = { mensaje: 'Si el correo está registrado, te hemos enviado un enlace para elegir una contraseña nueva.' };
  const user = EMAIL_RE.test(mail) && await User.findOne({ email: mail, confirmed: true, active: true });
  if (!user) return res.json(generica);
  const token = crypto.randomBytes(32).toString('hex');
  user.resetHash = sha(token); user.resetExpires = new Date(Date.now() + 3600 * 1000);
  await user.save();
  try { await enviarEmailReset(user.email, token); } catch (err) { console.error('Error al enviar el correo de recuperación:', err.message); }
  res.json(generica);
}));

r.post('/reset', limite, wrap(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (Buffer.byteLength(String(password)) > 72) return res.status(400).json({ error: 'La contraseña es demasiado larga (máximo 72 caracteres)' });
  const user = await User.findOne({ resetHash: sha(token), resetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: 'El enlace no es válido o ha caducado. Pide uno nuevo.' });
  user.password = await bcrypt.hash(String(password), 10);
  user.resetHash = ''; user.resetExpires = null; user.passwordChangedAt = new Date();
  await user.save();
  res.json({ mensaje: 'Contraseña cambiada. Ya puedes iniciar sesión.' });
}));

// --- CERRAR SESIÓN / QUIÉN SOY ---
r.post('/logout', (req, res) => { cerrarSesion(res); res.json({ mensaje: 'Sesión cerrada' }); });
r.get('/me', verificarSesion, (req, res) => res.json({ user: publico(req.user) }));

module.exports = r;

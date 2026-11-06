const r = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Task, Phrase, MoodLog, Activity, Audit, MOODS } = require('../models');
const { verificarSesion, soloAdmin } = require('../middleware/auth');
const { borrarUsuario, ultimoAdmin, auditar } = require('../lib/accounts');
const wrap = require('../wrap');

// Todas las rutas de este archivo exigen sesión + rol administrador
r.use(verificarSesion, soloAdmin);

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Identificador no válido' });
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cuenta = a => Object.fromEntries(a.map(x => [x._id.toString(), x.n]));

// ---------- USUARIOS ----------

// Listar usuarios con su actividad. ?q= filtra por nombre o email
r.get('/usuarios', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const filtro = q ? { $or: [{ name: new RegExp(esc(q), 'i') }, { email: new RegExp(esc(q), 'i') }] } : {};
  const users = await User.find(filtro, 'name email role confirmed active lastLogin createdAt').sort('createdAt').limit(500).lean();
  const ids = users.map(u => u._id);
  const [tareas, hechas] = await Promise.all([
    Task.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    Activity.aggregate([{ $match: { user: { $in: ids }, kind: 'done' } }, { $group: { _id: '$user', n: { $sum: 1 } } }])
  ]);
  const t = cuenta(tareas), d = cuenta(hechas);
  res.json(users.map(u => ({ ...u, tasks: t[u._id] || 0, done: d[u._id] || 0 })));
}));

// Estadísticas generales de la aplicación
r.get('/stats', wrap(async (req, res) => {
  const hace7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, admins, sinConfirmar, suspendidos, tasks, hechas, sistema, propias, animos, porAnimo, porEscenario, sesiones7] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'admin' }), User.countDocuments({ confirmed: false }),
    User.countDocuments({ active: false }), Task.countDocuments(), Activity.countDocuments({ kind: 'done' }),
    Phrase.countDocuments({ isDefault: true }), Phrase.countDocuments({ isDefault: false }),
    MoodLog.countDocuments({ date: { $gte: hace7 } }),
    MoodLog.aggregate([{ $match: { date: { $gte: hace7 } } }, { $group: { _id: '$mood', n: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$scenario', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Activity.countDocuments({ kind: 'focus', createdAt: { $gte: hace7 } })
  ]);
  res.json({
    usuarios: { total: users, admins, sinConfirmar, suspendidos },
    tareas: { total: tasks, completadas: hechas },
    frases: { sistema, propias },
    animos7dias: { total: animos, porAnimo: Object.fromEntries(porAnimo.map(x => [x._id, x.n])) },
    escenarios: Object.fromEntries(porEscenario.map(x => [x._id, x.n])),
    sesiones7dias: sesiones7
  });
}));

// Cambiar el rol (user <-> admin). Nadie puede quitarse el rol a sí mismo ni dejar la app sin admins.
r.put('/usuarios/:id/rol', validId, wrap(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Rol no válido (user o admin)' });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (u.role === 'admin' && role === 'user' && (u._id.equals(req.user._id) || await ultimoAdmin(u._id)))
    return res.status(400).json({ error: 'No puedes quitarte el rol de administrador a ti mismo ni dejar la app sin administradores' });
  u.role = role; await u.save();
  await auditar(req.user, role === 'admin' ? 'Dio el rol de administrador' : 'Quitó el rol de administrador', u.email);
  res.json({ id: u._id, role: u.role });
}));

// Suspender o reactivar una cuenta (la sesión deja de valer al instante)
r.put('/usuarios/:id/activo', validId, wrap(async (req, res) => {
  if (typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'active debe ser true o false' });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (u._id.equals(req.user._id)) return res.status(400).json({ error: 'No puedes suspender tu propia cuenta' });
  u.active = req.body.active; await u.save();
  await auditar(req.user, u.active ? 'Reactivó la cuenta' : 'Suspendió la cuenta', u.email);
  res.json({ id: u._id, active: u.active });
}));

// Confirmar manualmente una cuenta que no recibió el correo
r.put('/usuarios/:id/confirmar', validId, wrap(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { confirmed: true, key: '' }, { new: true });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  await auditar(req.user, 'Confirmó la cuenta', u.email);
  res.json({ id: u._id, confirmed: true });
}));

// Restablecer la contraseña de un usuario: genera una temporal que se muestra UNA vez al administrador
r.put('/usuarios/:id/password', validId, wrap(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (u._id.equals(req.user._id)) return res.status(400).json({ error: 'Cambia tu propia contraseña desde Configuración' });
  const temporal = crypto.randomBytes(9).toString('base64url');          // 12 caracteres
  u.password = await bcrypt.hash(temporal, 10);
  u.passwordChangedAt = new Date(); u.resetHash = ''; u.resetExpires = null;   // cierra sus sesiones abiertas
  await u.save();
  await auditar(req.user, 'Restableció la contraseña', u.email);
  res.json({ id: u._id, email: u.email, passwordTemporal: temporal });
}));

// Eliminar un usuario de la base de datos junto con TODOS sus datos (solo administrador)
r.delete('/usuarios/:id', validId, wrap(async (req, res) => {
  const { id } = req.params;
  const objetivo = await User.findById(id);
  if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (objetivo._id.equals(req.user._id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde el panel. Hazlo desde Configuración.' });
  if (objetivo.role === 'admin' && await ultimoAdmin(id))
    return res.status(400).json({ error: 'No se puede eliminar al único administrador' });
  await borrarUsuario(id);
  await auditar(req.user, 'Eliminó al usuario y todos sus datos', objetivo.email);
  res.json({ mensaje: 'Usuario eliminado correctamente' });
}));

// ---------- REGISTRO DE ACCIONES ----------
r.get('/auditoria', wrap(async (req, res) => res.json(await Audit.find().sort('-createdAt').limit(30).lean())));

// ---------- FRASES DEL SISTEMA (las que ven todos los usuarios) ----------
r.get('/frases', wrap(async (req, res) => res.json(await Phrase.find({ isDefault: true }).sort('mood createdAt'))));

r.post('/frases', wrap(async (req, res) => {
  const { text, mood } = req.body;
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
  if (!String(text || '').trim()) return res.status(400).json({ error: 'La frase es obligatoria' });
  const p = await Phrase.create({ user: null, isDefault: true, text: String(text).trim(), mood });
  await auditar(req.user, 'Añadió una frase del sistema', p.text.slice(0, 60));
  res.status(201).json(p);
}));

r.delete('/frases/:id', validId, wrap(async (req, res) => {
  const p = await Phrase.findOneAndDelete({ _id: req.params.id, isDefault: true });
  if (!p) return res.status(404).json({ error: 'Frase no encontrada' });
  await auditar(req.user, 'Eliminó una frase del sistema', p.text.slice(0, 60));
  res.status(204).end();
}));

module.exports = r;

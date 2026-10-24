const r = require('express').Router();
const mongoose = require('mongoose');
const { User, Task, WorldState, Phrase, MoodLog, MOODS } = require('../models');
const { verificarSesion, soloAdmin, cerrarSesion } = require('../middleware/auth');
const wrap = require('../wrap');

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Identificador no válido' });
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ultimoAdmin = async id => (await User.countDocuments({ role: 'admin', _id: { $ne: id } })) === 0;

// ---------- USUARIOS (solo administrador) ----------

// Listar usuarios con su actividad. ?q= filtra por nombre o email
r.get('/usuarios', verificarSesion, soloAdmin, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filtro = q ? { $or: [{ name: new RegExp(esc(q), 'i') }, { email: new RegExp(esc(q), 'i') }] } : {};
  const users = await User.find(filtro, 'name email role confirmed active lastLogin createdAt').sort('createdAt').lean();
  const ids = users.map(u => u._id);
  const [tareas, hechas] = await Promise.all([
    Task.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { user: { $in: ids }, status: 'done' } }, { $group: { _id: '$user', n: { $sum: 1 } } }])
  ]);
  const map = a => Object.fromEntries(a.map(x => [x._id.toString(), x.n]));
  const t = map(tareas), d = map(hechas);
  res.json(users.map(u => ({ ...u, tasks: t[u._id] || 0, done: d[u._id] || 0 })));
}));

// Estadísticas generales de la aplicación
r.get('/stats', verificarSesion, soloAdmin, wrap(async (req, res) => {
  const hace7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, admins, sinConfirmar, suspendidos, tasks, hechas, sistema, propias, animos, porAnimo, porEscenario] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'admin' }), User.countDocuments({ confirmed: false }),
    User.countDocuments({ active: false }), Task.countDocuments(), Task.countDocuments({ status: 'done' }),
    Phrase.countDocuments({ isDefault: true }), Phrase.countDocuments({ isDefault: false }),
    MoodLog.countDocuments({ date: { $gte: hace7 } }),
    MoodLog.aggregate([{ $match: { date: { $gte: hace7 } } }, { $group: { _id: '$mood', n: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$scenario', n: { $sum: 1 } } }, { $sort: { n: -1 } }])
  ]);
  res.json({
    usuarios: { total: users, admins, sinConfirmar, suspendidos },
    tareas: { total: tasks, completadas: hechas },
    frases: { sistema, propias },
    animos7dias: { total: animos, porAnimo: Object.fromEntries(porAnimo.map(x => [x._id, x.n])) },
    escenarios: Object.fromEntries(porEscenario.map(x => [x._id, x.n]))
  });
}));

// Cambiar el rol (user <-> admin). Nadie puede quitarse el rol a sí mismo ni dejar la app sin admins.
r.put('/usuarios/:id/rol', verificarSesion, soloAdmin, validId, wrap(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Rol no válido (user o admin)' });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (u.role === 'admin' && role === 'user' && (u._id.equals(req.user._id) || await ultimoAdmin(u._id)))
    return res.status(400).json({ error: 'No puedes quitarte el rol de administrador a ti mismo ni dejar la app sin administradores' });
  u.role = role; await u.save();
  res.json({ id: u._id, role: u.role });
}));

// Suspender o reactivar una cuenta (la sesión deja de valer al instante)
r.put('/usuarios/:id/activo', verificarSesion, soloAdmin, validId, wrap(async (req, res) => {
  if (typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'active debe ser true o false' });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (u._id.equals(req.user._id)) return res.status(400).json({ error: 'No puedes suspender tu propia cuenta' });
  u.active = req.body.active; await u.save();
  res.json({ id: u._id, active: u.active });
}));

// Confirmar manualmente una cuenta que no recibió el correo
r.put('/usuarios/:id/confirmar', verificarSesion, soloAdmin, validId, wrap(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { confirmed: true, key: '' }, { new: true });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: u._id, confirmed: true });
}));

// Eliminar un usuario y todos sus datos. El admin puede borrar a cualquiera; un usuario normal, solo su cuenta.
r.delete('/usuarios/:id', verificarSesion, validId, wrap(async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'admin' && req.user._id.toString() !== id)
    return res.status(403).json({ error: 'No tienes permisos para eliminar este usuario' });
  const objetivo = await User.findById(id);
  if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (objetivo.role === 'admin' && await ultimoAdmin(id))
    return res.status(400).json({ error: 'No se puede eliminar al único administrador' });
  await User.findByIdAndDelete(id);
  await Promise.all([...[Task, WorldState, MoodLog].map(M => M.deleteMany({ user: id })), Phrase.deleteMany({ user: id, isDefault: false })]);
  if (req.user._id.toString() === id) cerrarSesion(res);
  res.json({ mensaje: 'Usuario eliminado correctamente' });
}));

// ---------- FRASES DEL SISTEMA (las que ven todos los usuarios) ----------
r.get('/frases', verificarSesion, soloAdmin, wrap(async (req, res) =>
  res.json(await Phrase.find({ isDefault: true }).sort('mood createdAt'))));

r.post('/frases', verificarSesion, soloAdmin, wrap(async (req, res) => {
  const { text, mood } = req.body;
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
  res.status(201).json(await Phrase.create({ user: null, isDefault: true, text, mood }));
}));

r.delete('/frases/:id', verificarSesion, soloAdmin, validId, wrap(async (req, res) => {
  const p = await Phrase.findOneAndDelete({ _id: req.params.id, isDefault: true });
  if (!p) return res.status(404).json({ error: 'Frase no encontrada' });
  res.status(204).end();
}));

module.exports = r;

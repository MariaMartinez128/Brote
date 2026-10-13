const r = require('express').Router();
const mongoose = require('mongoose');
const { User, Task, WorldState, Phrase, MoodLog } = require('../models');
const { verificarSesion, soloAdmin, cerrarSesion } = require('../middleware/auth');
const wrap = require('../wrap');

// Listar usuarios (solo administrador)
r.get('/usuarios', verificarSesion, soloAdmin, wrap(async (req, res) => {
  res.json(await User.find({}, 'name email role confirmed createdAt').sort('createdAt'));
}));

// Eliminar un usuario y todos sus datos. El admin puede borrar a cualquiera; un usuario normal, solo su cuenta.
r.delete('/usuarios/:id', verificarSesion, wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Identificador no válido' });
  if (req.user.role !== 'admin' && req.user._id.toString() !== id)
    return res.status(403).json({ error: 'No tienes permisos para eliminar este usuario' });
  const u = await User.findByIdAndDelete(id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  await Promise.all([Task, WorldState, MoodLog].map(M => M.deleteMany({ user: id })), Phrase.deleteMany({ user: id, isDefault: false }));
  if (req.user._id.toString() === id) cerrarSesion(res);
  res.json({ mensaje: 'Usuario eliminado correctamente' });
}));

module.exports = r;

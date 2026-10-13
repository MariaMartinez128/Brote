const r = require('express').Router();
const { User } = require('../models');
const { verificarSesion, soloAdmin } = require('../middleware/auth');
const wrap = require('../wrap');

// Listar usuarios (SOLO ADMINISTRADOR)[cite: 84]
r.get('/usuarios', verificarSesion, soloAdmin, wrap(async (req, res) => {
  const usuarios = await User.find({}, 'name email role confirmed createdAt');
  res.json(usuarios);
}));

// Eliminar un usuario (El admin puede borrar a cualquiera, un usuario normal solo su cuenta)[cite: 84]
r.delete('/usuarios/:id', verificarSesion, wrap(async (req, res) => {
  const { id } = req.params;

  // Si no es admin y quiere borrar a otro usuario, se rechaza
  if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
    return res.status(403).json({ error: 'No tienes permisos para eliminar este usuario' });
  }

  await User.findByIdAndDelete(id);
  res.json({ mensaje: 'Usuario eliminado correctamente' });
}));

module.exports = r;
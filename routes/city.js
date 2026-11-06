const r = require('express').Router();
const { getWorld, resetWorld } = require('../lib/world');
const { User } = require('../models');
const conCola = require('../lib/lock');
const wrap = require('../wrap');

// Mundo del escenario activo. El tablero solo cambia completando o fallando tareas (el servidor es la única fuente de verdad).
r.get('/', wrap(async (req, res) => res.json(await getWorld(req.userId))));

// Reinicia el tablero activo. Si estaba lleno cuenta como "mundo completado" (para los logros).
r.post('/reset', wrap(async (req, res) => {
  const w = await conCola(String(req.userId), async () => {
    const u = await User.findById(req.userId, 'scenario');
    return resetWorld(req.userId, u.scenario);
  });
  res.json(w);
}));

module.exports = r;

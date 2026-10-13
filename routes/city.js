const r = require('express').Router();
const { getWorld } = require('../lib/city');
const wrap = require('../wrap');

// Mundo del escenario activo
r.get('/', wrap(async (req, res) => res.json(await getWorld(req.userId))));

// Sustituye el estado del mundo activo (sirve también para reiniciarlo)
r.put('/', wrap(async (req, res) => {
  const { cells, lost } = req.body;
  if (!Array.isArray(cells) || cells.length !== 50 || cells.some(c => typeof c !== 'string'))
    return res.status(400).json({ error: 'cells debe ser un array de 50 textos' });
  if (!Number.isInteger(lost) || lost < 0) return res.status(400).json({ error: 'lost debe ser un entero >= 0' });
  const city = await getWorld(req.userId);
  city.cells = cells; city.lost = lost;
  await city.save();
  res.json(city);
}));
module.exports = r;

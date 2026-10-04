const r = require('express').Router();
const { Phrase, MOODS } = require('../models');
const wrap = require('../wrap');
const mine = req => ({ _id: req.params.id, user: req.userId, isDefault: false });

// Frases personalizadas del usuario (?includeDefaults=true añade las del sistema)
r.get('/', wrap(async (req, res) => {
  const q = req.query.includeDefaults === 'true' ? { $or: [{ user: req.userId }, { isDefault: true }] } : { user: req.userId };
  res.json(await Phrase.find(q).sort('createdAt'));
}));

r.post('/', wrap(async (req, res) => {
  const { text, mood } = req.body;
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
  res.status(201).json(await Phrase.create({ user: req.userId, text, mood }));
}));

r.put('/:id', wrap(async (req, res) => {
  const p = await Phrase.findOne(mine(req));
  if (!p) return res.status(404).json({ error: 'Frase no encontrada' });
  if (req.body.mood !== undefined) {
    if (!MOODS.includes(req.body.mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
    p.mood = req.body.mood;
  }
  if (req.body.text !== undefined) p.text = req.body.text;
  await p.save();
  res.json(p);
}));

r.delete('/:id', wrap(async (req, res) => {
  const p = await Phrase.findOneAndDelete(mine(req));
  if (!p) return res.status(404).json({ error: 'Frase no encontrada' });
  res.status(204).end();
}));
module.exports = r;

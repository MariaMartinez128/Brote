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
  if (!String(text || '').trim()) return res.status(400).json({ error: 'La frase es obligatoria' });
  if (await Phrase.countDocuments({ user: req.userId, isDefault: false }) >= 100)
    return res.status(400).json({ error: 'Has alcanzado el máximo de 100 frases propias' });
  res.status(201).json(await Phrase.create({ user: req.userId, text: String(text).trim(), mood }));
}));

r.put('/:id', wrap(async (req, res) => {
  const p = await Phrase.findOne(mine(req));
  if (!p) return res.status(404).json({ error: 'Frase no encontrada' });
  if (req.body.mood !== undefined) {
    if (!MOODS.includes(req.body.mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
    p.mood = req.body.mood;
  }
  if (req.body.text !== undefined) {
    if (!String(req.body.text).trim()) return res.status(400).json({ error: 'La frase no puede estar vacía' });
    p.text = String(req.body.text).trim();
  }
  await p.save();
  res.json(p);
}));

r.delete('/:id', wrap(async (req, res) => {
  const p = await Phrase.findOneAndDelete(mine(req));
  if (!p) return res.status(404).json({ error: 'Frase no encontrada' });
  res.status(204).end();
}));
module.exports = r;

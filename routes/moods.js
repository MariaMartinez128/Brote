const r = require('express').Router();
const { Phrase, MoodLog, MOODS } = require('../models');
const wrap = require('../wrap');

// Registra el ánimo y devuelve una frase al azar (sistema + personalizadas del usuario)
r.post('/', wrap(async (req, res) => {
  const { mood } = req.body;
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
  const pool = await Phrase.find({ mood, $or: [{ isDefault: true }, { user: req.userId }] });
  const phrase = pool.length ? pool[Math.floor(Math.random() * pool.length)].text : '';
  await MoodLog.create({ user: req.userId, mood, phrase });
  res.status(201).json({ mood, phrase });
}));

// Último ánimo registrado hoy (o null)
r.get('/today', wrap(async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  res.json(await MoodLog.findOne({ user: req.userId, date: { $gte: start } }).sort('-date'));
}));

r.get('/', wrap(async (req, res) => res.json(await MoodLog.find({ user: req.userId }).sort('-date').limit(60))));
module.exports = r;

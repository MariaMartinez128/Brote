const r = require('express').Router();
const { Phrase, MoodLog, MOODS } = require('../models');
const wrap = require('../wrap');

const diaDe = d => new Date(d).toISOString().slice(0, 10);
const inicioHoy = () => { const s = new Date(); s.setHours(0, 0, 0, 0); return s; };

// Elige una frase al azar (sistema + propias del usuario), evitando repetir la última si hay alternativa
async function elegirFrase(userId, mood, evitar = '') {
  const pool = await Phrase.find({ mood, $or: [{ isDefault: true }, { user: userId }] });
  if (!pool.length) return { text: '', own: false };
  const otras = pool.filter(p => p.text !== evitar);
  const p = (otras.length ? otras : pool)[Math.floor(Math.random() * (otras.length || pool.length))];
  return { text: p.text, own: !p.isDefault };
}

// Registra el ánimo y devuelve una frase al azar
r.post('/', wrap(async (req, res) => {
  const { mood } = req.body;
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
  const ultima = await MoodLog.findOne({ user: req.userId, mood }).sort('-date');
  const f = await elegirFrase(req.userId, mood, ultima ? ultima.phrase : '');
  await MoodLog.create({ user: req.userId, mood, phrase: f.text });
  res.status(201).json({ mood, phrase: f.text, own: f.own });
}));

// "Otra frase": cambia la frase del ánimo de hoy sin crear un registro nuevo
r.post('/otra', wrap(async (req, res) => {
  const { mood } = req.body;
  if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Estado de ánimo no válido' });
  const log = await MoodLog.findOne({ user: req.userId, mood, date: { $gte: inicioHoy() } }).sort('-date');
  const f = await elegirFrase(req.userId, mood, log ? log.phrase : '');
  if (log) { log.phrase = f.text; await log.save(); }
  else await MoodLog.create({ user: req.userId, mood, phrase: f.text });
  res.json({ mood, phrase: f.text, own: f.own });
}));

// Último ánimo registrado hoy (o null)
r.get('/today', wrap(async (req, res) =>
  res.json(await MoodLog.findOne({ user: req.userId, date: { $gte: inicioHoy() } }).sort('-date'))));

// Resumen: ánimo de cada uno de los últimos 7 días, racha de días seguidos, frecuencia (30 días) y ánimo más común
r.get('/stats', wrap(async (req, res) => {
  const logs = await MoodLog.find({ user: req.userId, date: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }).sort('date');
  const porDia = {};                                      // el último registro de cada día manda
  logs.forEach(l => { porDia[diaDe(l.date)] = l.mood; });
  const semana = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = diaDe(d);
    semana.push({ date: k, mood: porDia[k] || null });
  }
  let racha = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (porDia[diaDe(d)]) racha++; else if (i > 0) break;   // si hoy aún no has registrado, no rompe la racha
  }
  const conteo = Object.fromEntries(MOODS.map(m => [m, 0]));
  logs.forEach(l => { conteo[l.mood]++; });
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
  res.json({ semana, racha, conteo, masComun: top[1] ? top[0] : null });
}));

r.get('/', wrap(async (req, res) => res.json(await MoodLog.find({ user: req.userId }).sort('-date').limit(60))));
module.exports = r;

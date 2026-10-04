const r = require('express').Router();
const { User } = require('../models');
const wrap = require('../wrap');
const today = () => new Date().toISOString().slice(0, 10);
const out = u => ({ name: u.name, email: u.email, pomodoro: u.pomodoro, sessions: u.sessions.date === today() ? u.sessions.count : 0 });

r.get('/', wrap(async (req, res) => res.json(out(await User.findById(req.userId)))));

r.put('/', wrap(async (req, res) => {
  const u = await User.findById(req.userId);
  const { name, email, pomodoro } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    u.name = String(name).trim();
  }
  if (email !== undefined) u.email = String(email).trim();
  if (pomodoro) {
    for (const k of ['work', 'short', 'long']) {
      if (pomodoro[k] === undefined) continue;
      const v = Number(pomodoro[k]);
      if (!Number.isInteger(v) || v < 1 || v > 180) return res.status(400).json({ error: `Duración no válida: ${k}` });
      u.pomodoro[k] = v;
    }
  }
  await u.save();
  res.json(out(u));
}));

// Suma una sesión Pomodoro completada hoy
r.post('/session', wrap(async (req, res) => {
  const u = await User.findById(req.userId);
  if (u.sessions.date !== today()) { u.sessions.date = today(); u.sessions.count = 0; }
  u.sessions.count += 1;
  await u.save();
  res.json({ count: u.sessions.count });
}));
module.exports = r;

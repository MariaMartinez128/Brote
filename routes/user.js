const r = require('express').Router();
const { User } = require('../models');
const wrap = require('../wrap');
const { SCENARIOS } = require('../lib/scenarios');
const { getWorld } = require('../lib/city');
const today = () => new Date().toISOString().slice(0, 10);
const out = u => ({ name: u.name, email: u.email, role: u.role, scenario: u.scenario, pomodoro: u.pomodoro, sessions: u.sessions.date === today() ? u.sessions.count : 0 });

r.get('/', wrap(async (req, res) => res.json(out(await User.findById(req.userId)))));

r.put('/', wrap(async (req, res) => {
  const u = await User.findById(req.userId);
  const { name, pomodoro } = req.body;   // el email no se puede cambiar (está confirmado por correo)
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    u.name = String(name).trim();
  }
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

// Cambia de escenario; cada uno conserva su progreso
r.put('/scenario', wrap(async (req, res) => {
  const { scenario } = req.body;
  if (!SCENARIOS[scenario]) return res.status(400).json({ error: 'Escenario no válido' });
  const u = await User.findById(req.userId);
  u.scenario = scenario;
  await u.save();
  res.json({ scenario, city: await getWorld(req.userId, scenario) });
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

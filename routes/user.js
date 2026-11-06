const r = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Task, WorldState, Phrase, MoodLog, Activity, MOODS } = require('../models');
const wrap = require('../wrap');
const { SCENARIOS } = require('../lib/scenarios');
const { getWorld } = require('../lib/world');
const { userStats } = require('../lib/stats');
const { borrarUsuario, ultimoAdmin } = require('../lib/accounts');
const { iniciarSesion, cerrarSesion } = require('../middleware/auth');

const hoyEnFoco = async (userId, today) => {
  const s = await Activity.find({ user: userId, kind: 'focus', day: today }, 'minutes').lean();   // pocas filas al día: se suma aquí
  return { sessions: s.length, focusMinutes: s.reduce((t, x) => t + x.minutes, 0) };
};
const out = async (u, today) => ({ name: u.name, email: u.email, role: u.role, scenario: u.scenario, pomodoro: u.pomodoro, ...(await hoyEnFoco(u._id, today)) });

r.get('/', wrap(async (req, res) => res.json(await out(req.user, req.today))));

r.put('/', wrap(async (req, res) => {
  const u = req.user;
  const { name, pomodoro } = req.body;   // el email no se puede cambiar (está confirmado por correo)
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    u.name = String(name).trim().slice(0, 60);
  }
  if (pomodoro) {
    for (const k of ['work', 'short', 'long']) {
      if (pomodoro[k] === undefined) continue;
      const v = Number(pomodoro[k]);
      if (!Number.isInteger(v) || v < 1 || v > 180) return res.status(400).json({ error: `Duración no válida: ${k} (1-180 minutos)` });
      u.pomodoro[k] = v;
    }
  }
  await u.save();
  res.json(await out(u, req.today));
}));

// Cambia de escenario; cada uno conserva su progreso
r.put('/scenario', wrap(async (req, res) => {
  const { scenario } = req.body;
  if (!SCENARIOS[scenario]) return res.status(400).json({ error: 'Escenario no válido' });
  req.user.scenario = scenario;
  await req.user.save();
  res.json({ scenario, city: await getWorld(req.userId, scenario) });
}));

// Registra una sesión Pomodoro de concentración terminada
r.post('/session', wrap(async (req, res) => {
  const minutes = Number(req.body.minutes === undefined ? req.user.pomodoro.work : req.body.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return res.status(400).json({ error: 'Duración no válida (1-180 minutos)' });
  let task = null;
  if (req.body.taskId) {
    task = await Task.findOne({ _id: req.body.taskId, user: req.userId }, '_id');
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    task = task._id;
  }
  await Activity.create({ user: req.userId, kind: 'focus', day: req.today, minutes, task });
  const h = await hoyEnFoco(req.userId, req.today);
  res.status(201).json({ count: h.sessions, focusMinutes: h.focusMinutes });
}));

r.get('/stats', wrap(async (req, res) => res.json(await userStats(req.userId, req.tz, req.today))));

// Cambiar contraseña (pide la actual). Las demás sesiones dejan de valer.
r.put('/password', wrap(async (req, res) => {
  const { current, password } = req.body;
  if (!current || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (String(password).length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  if (Buffer.byteLength(String(password)) > 72) return res.status(400).json({ error: 'La contraseña es demasiado larga (máximo 72 caracteres)' });
  if (!(await bcrypt.compare(String(current), req.user.password))) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  req.user.password = await bcrypt.hash(String(password), 10);
  req.user.passwordChangedAt = new Date();
  await req.user.save();
  iniciarSesion(res, req.user);          // esta sesión sigue abierta con un token nuevo
  res.json({ mensaje: 'Contraseña actualizada' });
}));

// Descarga de todos tus datos (derecho de acceso/portabilidad, RGPD)
r.get('/export', wrap(async (req, res) => {
  const id = req.userId;
  const [tasks, worlds, phrases, moods, activity] = await Promise.all([
    Task.find({ user: id }).lean(), WorldState.find({ user: id }).lean(), Phrase.find({ user: id, isDefault: false }).lean(),
    MoodLog.find({ user: id }).lean(), Activity.find({ user: id }).lean()
  ]);
  const u = req.user;
  res.setHeader('Content-Disposition', 'attachment; filename="brote-mis-datos.json"');
  res.json({ exportadoEl: new Date().toISOString(),
    cuenta: { name: u.name, email: u.email, role: u.role, scenario: u.scenario, pomodoro: u.pomodoro, createdAt: u.createdAt },
    tareas: tasks, mundos: worlds, frasesPropias: phrases, animos: moods, actividad: activity });
}));

// Eliminar mi propia cuenta (pide la contraseña). Se borran también todos mis datos.
r.delete('/', wrap(async (req, res) => {
  if (!(await bcrypt.compare(String(req.body.password || ''), req.user.password))) return res.status(400).json({ error: 'La contraseña no es correcta' });
  if (req.user.role === 'admin' && await ultimoAdmin(req.userId)) return res.status(400).json({ error: 'Eres el único administrador: nombra a otro antes de eliminar tu cuenta' });
  await borrarUsuario(req.userId);
  cerrarSesion(res);
  res.json({ mensaje: 'Cuenta eliminada correctamente' });
}));

module.exports = r;

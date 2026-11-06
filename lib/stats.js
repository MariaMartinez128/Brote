const { Activity, MoodLog, WorldState, Task } = require('../models');
const { addDays, streak, dayIn } = require('./dates');

const XP_TAREA = 10, XP_SESION = 5, XP_NIVEL = 100;
const dayOf = (log, tz) => log.day || dayIn(tz, log.date);

// Estadísticas del usuario: totales, últimos 14 días, nivel/XP, rachas y logros.
// Todo se calcula desde el historial (Activity), así que deshacer una tarea también ajusta el XP.
async function userStats(userId, tz, today) {
  const from = addDays(today, -13);
  const [totals, recent, doneDays, moods, worlds, pending, overdue, minutos] = await Promise.all([
    Activity.aggregate([{ $match: { user: userId } }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
    Activity.find({ user: userId, day: { $gte: from } }, 'kind day minutes').lean(),
    Activity.distinct('day', { user: userId, kind: 'done' }),
    MoodLog.find({ user: userId, date: { $gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } }, 'mood day date').lean(),
    WorldState.find({ user: userId }, 'cells completed').lean(),
    Task.countDocuments({ user: userId, status: 'pending' }),
    Task.countDocuments({ user: userId, status: 'pending', dueDate: { $ne: '', $lt: today } }),
    Activity.aggregate([{ $match: { user: userId, kind: 'focus' } }, { $group: { _id: null, total: { $sum: '$minutes' } } }])
  ]);
  const t = Object.fromEntries(totals.map(x => [x._id, x]));
  const done = t.done ? t.done.n : 0, failed = t.failed ? t.failed.n : 0;
  const sessions = t.focus ? t.focus.n : 0, focusMinutes = minutos.length ? minutos[0].total : 0;

  const dias = [];
  for (let i = 13; i >= 0; i--) dias.push({ date: addDays(today, -i), done: 0, failed: 0, focus: 0 });
  const idx = Object.fromEntries(dias.map((d, i) => [d.date, i]));
  recent.forEach(a => { const d = dias[idx[a.day]]; if (!d) return; if (a.kind === 'focus') d.focus += a.minutes; else d[a.kind] += 1; });

  const moodDays = new Set(moods.map(m => dayOf(m, tz)));
  const conteo = {};
  moods.forEach(m => { if (dayIn(tz, m.date) >= addDays(today, -29)) conteo[m.mood] = (conteo[m.mood] || 0) + 1; });

  const xp = done * XP_TAREA + sessions * XP_SESION;
  const rachaTareas = streak(new Set(doneDays), today), rachaAnimo = streak(moodDays, today);
  const mundosCompletos = worlds.reduce((s, w) => s + (w.completed || 0), 0);
  const escenariosJugados = worlds.filter(w => w.completed || w.cells.some(Boolean)).length;

  const logro = (id, icon, name, desc, value, target) => ({ id, icon, name, desc, value: Math.min(value, target), target, unlocked: value >= target });
  const logros = [
    logro('primera', '🌱', 'Primer brote', 'Completa tu primera tarea', done, 1),
    logro('diez', '🌿', 'Manos a la obra', 'Completa 10 tareas', done, 10),
    logro('cincuenta', '🌳', 'Imparable', 'Completa 50 tareas', done, 50),
    logro('racha3', '🔥', 'Calentando', '3 días seguidos completando tareas', rachaTareas, 3),
    logro('racha7', '🏅', 'Semana perfecta', '7 días seguidos completando tareas', rachaTareas, 7),
    logro('foco', '⏱️', 'Concentrado', 'Termina 10 sesiones Pomodoro', sessions, 10),
    logro('maraton', '🧠', 'Maratón', 'Acumula 600 minutos de concentración', focusMinutes, 600),
    logro('mundo', '🏆', 'Mundo completo', 'Llena un tablero entero', mundosCompletos, 1),
    logro('explorador', '🧭', 'Explorador', 'Juega en 3 escenarios distintos', escenariosJugados, 3),
    logro('animo', '💬', 'Constante contigo', '7 días seguidos registrando tu ánimo', rachaAnimo, 7)
  ];

  return {
    nivel: Math.floor(xp / XP_NIVEL) + 1, xp, xpNivel: xp % XP_NIVEL, xpPorNivel: XP_NIVEL,
    totales: { hechas: done, falladas: failed, sesiones: sessions, minutosFoco: focusMinutes, pendientes: pending, vencidas: overdue, mundosCompletos, escenariosJugados },
    rachas: { tareas: rachaTareas, animo: rachaAnimo },
    dias, animos: conteo, logros
  };
}

module.exports = { userStats, XP_TAREA, XP_SESION, dayOf };

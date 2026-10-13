const { User, WorldState } = require('../models');
const { SCENARIOS } = require('./scenarios');
const where = (cells, pred) => cells.map((c, i) => (pred(c) ? i : -1)).filter(i => i >= 0);
const pick = a => a[Math.floor(Math.random() * a.length)];

// Devuelve el mundo del escenario activo del usuario (lo crea la primera vez).
async function getWorld(userId, scenario) {
  if (!scenario) scenario = (await User.findById(userId)).scenario;
  return WorldState.findOneAndUpdate(
    { user: userId, scenario },
    { $setOnInsert: { cells: Array(50).fill(''), lost: 0 } },
    { upsert: true, new: true }
  );
}

// Aplica al mundo el efecto de pasar una tarea de `prev` a `next`.
// done -> crece algo del escenario según el tipo de tarea; failed -> se pierde algo; al deshacer, se revierte.
async function applyStatus(userId, prev, next, type) {
  const user = await User.findById(userId);
  const theme = SCENARIOS[user.scenario];
  const city = await getWorld(userId, user.scenario);
  const cells = [...city.cells];
  let effect = null;
  if (prev === 'failed') city.lost = Math.max(0, city.lost - 1);
  if (prev === 'done') { const f = where(cells, c => c); if (f.length) cells[f[f.length - 1]] = ''; }
  if (next === 'done') {
    const e = where(cells, c => !c);
    if (e.length) { const i = pick(e); cells[i] = pick(theme.grow[type] || theme.grow.Estudio); effect = { index: i, type: 'pop' }; }
  }
  if (next === 'failed') {
    const f = where(cells, c => c);
    if (f.length) { const i = pick(f); cells[i] = ''; city.lost += 1; effect = { index: i, type: 'boom' }; }
  }
  city.cells = cells;
  await city.save();
  return { city, effect };
}
module.exports = { applyStatus, getWorld };

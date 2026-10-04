const { CityState } = require('../models');
const BUILDINGS = ['🏠', '🏡', '🏪', '🌳', '🏢', '🏫', '⛲', '🏥', '🏬', '🌲'];
const where = (cells, pred) => cells.map((c, i) => (pred(c) ? i : -1)).filter(i => i >= 0);
const pick = a => a[Math.floor(Math.random() * a.length)];

// Aplica a la ciudad el efecto de pasar una tarea de `prev` a `next`.
// done -> construye un edificio; failed -> destruye uno; al deshacer, se revierte.
async function applyStatus(userId, prev, next) {
  const city = await CityState.findOne({ user: userId });
  const cells = [...city.cells];
  let effect = null;
  if (prev === 'failed') city.lost = Math.max(0, city.lost - 1);
  if (prev === 'done') { const f = where(cells, c => c); if (f.length) cells[f[f.length - 1]] = ''; }
  if (next === 'done') {
    const e = where(cells, c => !c);
    if (e.length) { const i = pick(e); cells[i] = pick(BUILDINGS); effect = { index: i, type: 'pop' }; }
  }
  if (next === 'failed') {
    const f = where(cells, c => c);
    if (f.length) { const i = pick(f); cells[i] = ''; city.lost += 1; effect = { index: i, type: 'boom' }; }
  }
  city.cells = cells;
  await city.save();
  return { city, effect };
}
module.exports = { applyStatus };

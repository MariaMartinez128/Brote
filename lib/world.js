const { User, Task, WorldState, Activity } = require('../models');
const { SCENARIOS } = require('./scenarios');

const SIZE = 50;
const empty = () => Array(SIZE).fill('');
const where = (cells, pred) => cells.map((c, i) => (pred(c) ? i : -1)).filter(i => i >= 0);
const pick = a => a[Math.floor(Math.random() * a.length)];

// Devuelve el mundo del escenario indicado (o el activo del usuario). Lo crea la primera vez.
async function getWorld(userId, scenario) {
  if (!scenario) scenario = (await User.findById(userId, 'scenario')).scenario;
  return WorldState.findOneAndUpdate(
    { user: userId, scenario },
    { $setOnInsert: { cells: empty(), lost: 0, completed: 0, rev: 0 } },
    { upsert: true, new: true }
  );
}

// Lectura-modificación-escritura con control de concurrencia optimista: si dos peticiones tocan el mismo
// mundo a la vez (doble clic, dos pestañas) la segunda reintenta en vez de pisar los cambios de la primera.
async function mutate(userId, scenario, fn) {
  for (let i = 0; i < 8; i++) {
    const w = await getWorld(userId, scenario);
    const draft = { cells: [...w.cells], lost: w.lost };
    if (draft.cells.length !== SIZE) draft.cells = [...draft.cells, ...empty()].slice(0, SIZE);
    const result = fn(draft);
    const rev = w.rev || 0;
    const updated = await WorldState.findOneAndUpdate(
      { _id: w._id, rev: rev ? rev : { $in: [0, null] } },
      { $set: { cells: draft.cells, lost: draft.lost }, $inc: { rev: 1 } },
      { new: true }
    );
    if (updated) return { world: updated, result };
  }
  const e = new Error('El mundo se está actualizando, inténtalo de nuevo'); e.status = 409; throw e;
}

// Deshace lo que hizo una tarea al pasar a "hecha": quita exactamente la casilla que creó.
// Si esa casilla ya la había destruido otra tarea fallida, se anula la restauración de esa fallida
// (si no, al deshacer ambas quedaría una casilla "huérfana" que ninguna tarea justifica).
async function undoDone(task, fallbackScenario) {
  const g = task.grown;
  const scenario = (g && g.scenario) || fallbackScenario;
  let destruida = false;
  if (g && g.emoji) {
    const w = await getWorld(task.user, scenario);
    if (w.cells[g.index] !== g.emoji) {
      const r = await Task.updateOne(
        { user: task.user, _id: { $ne: task._id }, 'lostFx.scenario': g.scenario, 'lostFx.index': g.index, 'lostFx.emoji': g.emoji },
        { $set: { 'lostFx.emoji': '' } });
      destruida = r.modifiedCount > 0;
    }
  }
  return mutate(task.user, scenario, d => {
    if (destruida) return;
    if (g && g.emoji) {
      if (d.cells[g.index] === g.emoji) d.cells[g.index] = '';
      else { const i = d.cells.lastIndexOf(g.emoji); if (i >= 0) d.cells[i] = ''; }
    } else {                                   // tareas antiguas sin registro: se quita la última casilla ocupada
      const f = where(d.cells, c => c); if (f.length) d.cells[f[f.length - 1]] = '';
    }
  });
}

// Deshace lo que hizo una tarea al pasar a "fallida": baja el contador y repone lo destruido si el hueco sigue libre.
function undoFailed(task, fallbackScenario) {
  const f = task.lostFx;
  const scenario = (f && f.scenario) || fallbackScenario;
  return mutate(task.user, scenario, d => {
    d.lost = Math.max(0, d.lost - 1);
    if (f && f.index >= 0 && f.emoji && d.cells[f.index] === '') d.cells[f.index] = f.emoji;
  });
}

// Aplica al mundo activo el efecto de que `task` pase a `next` y deshace el del estado anterior.
// Devuelve { world, effect, patch }: patch son los campos de la tarea que hay que guardar.
async function transition(task, next, today) {
  const user = await User.findById(task.user, 'scenario');
  const scenario = user.scenario, theme = SCENARIOS[scenario];
  const prev = task.status;
  const patch = { status: next, statusDay: today, doneAt: next === 'done' ? new Date() : null };
  let effect = null;

  if (prev === 'done') { await undoDone(task, scenario); patch.grown = undefined; await Activity.findOneAndDelete({ user: task.user, task: task._id, kind: 'done' }, { sort: { createdAt: -1 } }); }
  if (prev === 'failed') { await undoFailed(task, scenario); patch.lostFx = undefined; await Activity.findOneAndDelete({ user: task.user, task: task._id, kind: 'failed' }, { sort: { createdAt: -1 } }); }

  if (next === 'done') {
    const { result } = await mutate(task.user, scenario, d => {
      const free = where(d.cells, c => !c);
      if (!free.length) return { full: true };
      const index = pick(free), emoji = pick(theme.grow[task.type] || theme.grow.Estudio);
      d.cells[index] = emoji;
      return { index, emoji, filled: free.length === 1 };       // filled: con esta casilla el tablero queda completo
    });
    if (result.full) effect = { type: 'full' };
    else {
      patch.grown = { scenario, index: result.index, emoji: result.emoji };
      effect = { index: result.index, type: 'pop', completed: result.filled };
    }
    await Activity.create({ user: task.user, kind: 'done', day: today, type: task.type, task: task._id });
  }
  if (next === 'failed') {
    const { result } = await mutate(task.user, scenario, d => {
      const filled = where(d.cells, c => c);
      d.lost += 1;
      if (!filled.length) return { index: -1, emoji: '' };
      const index = pick(filled), emoji = d.cells[index];
      d.cells[index] = '';
      return { index, emoji };
    });
    patch.lostFx = { scenario, index: result.index, emoji: result.emoji };
    effect = result.index >= 0 ? { index: result.index, type: 'boom' } : { type: 'lost' };
    await Activity.create({ user: task.user, kind: 'failed', day: today, type: task.type, task: task._id });
  }
  return { world: await getWorld(task.user, scenario), effect, patch };
}

// Reinicia el mundo activo. Si estaba completo, cuenta como mundo terminado.
async function resetWorld(userId, scenario) {
  const w = await getWorld(userId, scenario);
  const completed = w.cells.every(Boolean);
  return WorldState.findOneAndUpdate({ _id: w._id },
    { $set: { cells: empty(), lost: 0 }, $inc: { rev: 1, completed: completed ? 1 : 0 } }, { new: true });
}

module.exports = { getWorld, transition, resetWorld, SIZE };

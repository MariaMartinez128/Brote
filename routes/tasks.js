const r = require('express').Router();
const { Task, TYPES, STATUS, REPEAT } = require('../models');
const wrap = require('../wrap');
const conCola = require('../lib/lock');
const { transition } = require('../lib/world');
const { isDay } = require('../lib/dates');

const MAX_TAREAS = 500;
const find = req => Task.findOne({ _id: req.params.id, user: req.userId });

// Los hábitos "diarios" vuelven a pendiente cada día (el progreso del mundo se conserva)
const reiniciarDiarias = (userId, today) => Task.updateMany(
  { user: userId, repeat: 'daily', status: { $ne: 'pending' }, statusDay: { $lt: today } },
  { $set: { status: 'pending', doneAt: null }, $unset: { grown: 1, lostFx: 1 } });

// Valida los campos editables; devuelve { error } o { values }
function validar(body, { parcial }) {
  const v = {};
  if (!parcial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return { error: parcial ? 'El título no puede estar vacío' : 'El título es obligatorio' };
    if (title.length > 200) return { error: 'El título no puede superar los 200 caracteres' };
    v.title = title;
  }
  if (body.type !== undefined) { if (!TYPES.includes(body.type)) return { error: 'Tipo no válido (Estudio, Trabajo o Hábito)' }; v.type = body.type; }
  if (body.dueDate !== undefined) { if (body.dueDate !== '' && body.dueDate !== null && !isDay(body.dueDate)) return { error: 'Fecha no válida (AAAA-MM-DD)' }; v.dueDate = body.dueDate || ''; }
  if (body.repeat !== undefined) { if (!REPEAT.includes(body.repeat)) return { error: 'Repetición no válida (none o daily)' }; v.repeat = body.repeat; }
  return { values: v };
}

r.get('/', wrap(async (req, res) => {
  await reiniciarDiarias(req.userId, req.today);
  res.json(await Task.find({ user: req.userId }).sort('createdAt').limit(MAX_TAREAS));
}));

r.post('/', wrap(async (req, res) => {
  const { error, values } = validar(req.body, { parcial: false });
  if (error) return res.status(400).json({ error });
  if (await Task.countDocuments({ user: req.userId }) >= MAX_TAREAS)
    return res.status(400).json({ error: `Has alcanzado el máximo de ${MAX_TAREAS} tareas. Elimina las antiguas.` });
  res.status(201).json(await Task.create({ dueDate: req.today, ...values, user: req.userId }));
}));

// Editar campos y/o cambiar el estado. Si cambia el estado, el mundo se actualiza (y se deshace el efecto anterior).
r.put('/:id', wrap(async (req, res) => {
  const { status } = req.body;
  if (status !== undefined && !STATUS.includes(status)) return res.status(400).json({ error: 'Estado no válido (pending, done o failed)' });
  const { error, values } = validar(req.body, { parcial: true });
  if (error) return res.status(400).json({ error });

  const out = await conCola(String(req.userId), async () => {
    const task = await find(req);
    if (!task) return { code: 404, body: { error: 'Tarea no encontrada' } };
    Object.assign(task, values);
    let city = null, effect = null;
    if (status !== undefined && status !== task.status) {
      const prev = task.status;
      // "Reserva" atómica del cambio de estado: si otra instancia lo cambió a la vez, no se aplica dos veces
      const claimed = await Task.findOneAndUpdate({ _id: task._id, user: req.userId, status: prev }, { $set: { status } });
      if (!claimed) return { code: 409, body: { error: 'La tarea ya había cambiado. Recarga la lista.' } };
      try {
        const t = await transition(task, status, req.today);
        task.set(t.patch); city = t.world; effect = t.effect;
      } catch (e) {
        await Task.updateOne({ _id: task._id }, { $set: { status: prev } });   // no dejar la tarea a medias
        throw e;
      }
    }
    await task.save();
    return { code: 200, body: { task, city, effect } };
  });
  res.status(out.code).json(out.body);
}));

// Eliminar una tarea no toca el mundo: lo que ya ganaste (o perdiste) se queda
r.delete('/:id', wrap(async (req, res) => {
  const t = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.status(204).end();
}));

module.exports = r;

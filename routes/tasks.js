const r = require('express').Router();
const { Task, STATUS } = require('../models');
const wrap = require('../wrap');
const { applyStatus } = require('../lib/city');
const find = req => Task.findOne({ _id: req.params.id, user: req.userId });

r.get('/', wrap(async (req, res) => res.json(await Task.find({ user: req.userId }).sort('createdAt'))));

r.post('/', wrap(async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
  res.status(201).json(await Task.create({ user: req.userId, title, type: req.body.type }));
}));

// Editar título/tipo y/o cambiar el estado. Si cambia el estado se actualiza la ciudad.
r.put('/:id', wrap(async (req, res) => {
  const task = await find(req);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
  const { title, type, status } = req.body;
  if (title !== undefined) {
    if (!String(title).trim()) return res.status(400).json({ error: 'El título no puede estar vacío' });
    task.title = String(title).trim();
  }
  if (type !== undefined) task.type = type;
  let city = null, effect = null;
  if (status !== undefined && status !== task.status) {
    if (!STATUS.includes(status)) return res.status(400).json({ error: 'Estado no válido (pending, done o failed)' });
    ({ city, effect } = await applyStatus(req.userId, task.status, status));
    task.status = status;
  }
  await task.save();
  res.json({ task, city, effect });
}));

r.delete('/:id', wrap(async (req, res) => {
  const t = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.status(204).end();
}));
module.exports = r;

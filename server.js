require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { User, WorldState } = require('./models');
const { getWorld } = require('./lib/city');
const seedPhrases = require('./seed');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res, next) => { req.userId = app.locals.userId; next(); });
app.use('/api/user', require('./routes/user'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/city', require('./routes/city'));
app.use('/api/scenarios', require('./routes/scenarios'));
app.use('/api/phrases', require('./routes/phrases'));
app.use('/api/moods', require('./routes/moods'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(404).json({ error: 'No encontrado' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

// Una sola vez: pasa las ciudades antiguas (colección citystates) al nuevo modelo como escenario 'ciudad'
async function migrateOldCities() {
  const old = mongoose.connection.collection('citystates');
  for (const c of await old.find().toArray()) {
    const done = await WorldState.exists({ user: c.user, scenario: 'ciudad' });
    if (!done) {
      await WorldState.create({ user: c.user, scenario: 'ciudad', cells: c.cells, lost: c.lost || 0 });
      if (c.cells.some(Boolean)) await User.updateOne({ _id: c.user }, { scenario: 'ciudad' });  // si ya tenía ciudad, sigue en ella
    }
  }
}

async function start() {
  if (!process.env.MONGO_URI) { console.error('Falta MONGO_URI (crea el archivo .env a partir de .env.example)'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const user = (await User.findOne()) || (await User.create({}));
  await migrateOldCities();
  await getWorld(user._id, user.scenario);
  app.locals.userId = user._id;
  await seedPhrases();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Brote en http://localhost:${port}`));
}
start().catch(e => { console.error('No se pudo iniciar:', e.message); process.exit(1); });
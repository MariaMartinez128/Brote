require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { User, CityState } = require('./models');
const seedPhrases = require('./seed');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res, next) => { req.userId = app.locals.userId; next(); });
app.use('/api/user', require('./routes/user'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/city', require('./routes/city'));
app.use('/api/phrases', require('./routes/phrases'));
app.use('/api/moods', require('./routes/moods'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(404).json({ error: 'No encontrado' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

async function start() {
  if (!process.env.MONGO_URI) { console.error('Falta MONGO_URI (crea el archivo .env a partir de .env.example)'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const user = (await User.findOne()) || (await User.create({}));
  if (!(await CityState.exists({ user: user._id }))) await CityState.create({ user: user._id });
  app.locals.userId = user._id;
  await seedPhrases();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`CityFocus en http://localhost:${port}`));
}
start().catch(e => { console.error('No se pudo iniciar:', e.message); process.exit(1); });

require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { verificarSesion } = require('./middleware/auth');
const seedPhrases = require('./seed');

const app = express();
app.set('trust proxy', 1);              // Cloud Run / Render van detrás de un proxy HTTPS
app.use(express.json());
app.use(cookieParser());

// Rutas públicas
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));

// Rutas privadas: cada usuario solo ve sus propios datos (req.userId sale de la cookie de sesión)
app.use('/api', verificarSesion);
app.use('/api/user', require('./routes/user'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/city', require('./routes/city'));
app.use('/api/scenarios', require('./routes/scenarios'));
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
  for (const v of ['MONGO_URI', 'JWT_SECRET'])
    if (!process.env[v]) { console.error(`Falta ${v} (revisa el archivo .env o las variables de entorno)`); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  await seedPhrases();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Brote en http://localhost:${port}`));
}
if (require.main === module) start().catch(e => { console.error('No se pudo iniciar:', e.message); process.exit(1); });
module.exports = app;

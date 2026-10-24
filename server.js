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
app.use('/api/admin', require('./routes/admin'));   // cada ruta de admin exige sesión + rol admin

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

// Arranque: se abre el puerto enseguida (Cloud Run lo exige) y la base de datos se conecta en segundo plano.
function start() {
  for (const v of ['MONGO_URI', 'JWT_SECRET'])
    if (!process.env[v]) { console.error(`Falta ${v} (revisa el archivo .env o las variables de entorno)`); process.exit(1); }
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Brote escuchando en puerto ${port}`);
    mongoose.connect(process.env.MONGO_URI)
      .then(() => { console.log('Conectado a MongoDB'); return seedPhrases(); })
      .catch(e => { console.error('Error al conectar con MongoDB:', e.message); process.exit(1); });
  });
}
// Solo arranca si se ejecuta con "node server.js" (los tests importan `app` sin abrir el puerto)
if (require.main === module) start();
module.exports = app;

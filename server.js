require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { verificarSesion } = require('./middleware/auth');
const tz = require('./middleware/tz');
const seedPhrases = require('./seed');

const isProd = process.env.NODE_ENV === 'production';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);              // Cloud Run / Render van detrás de un proxy HTTPS

// Cabeceras de seguridad (CSP: solo scripts propios; las fuentes vienen de Google Fonts)
// Google Identity Services (botón "Continuar con Google") necesita estos orígenes y una ventana emergente
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: { useDefaults: true, directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
    connectSrc: ["'self'", 'https://accounts.google.com/gsi/'], frameSrc: ['https://accounts.google.com/gsi/'],
    imgSrc: ["'self'", 'data:'], objectSrc: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], frameAncestors: ["'none'"], upgradeInsecureRequests: isProd ? [] : null } }
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(tz);                            // req.tz y req.today según la zona horaria que envía el cliente

// Registro mínimo de peticiones a la API (no en los tests)
if (process.env.NODE_ENV !== 'test') app.use('/api', (req, res, next) => {
  const t = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - t}ms`));
  next();
});
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1500, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', message: { error: 'Demasiadas peticiones. Espera un momento.' } }));

// Rutas públicas. /health sirve de sonda para Docker/Cloud Run e informa del estado de MongoDB
app.get('/api/health', (req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ ok: db, db: db ? 'connected' : 'disconnected' });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));   // exige sesión + rol admin en todas sus rutas

// Rutas privadas: cada usuario solo ve sus propios datos (req.userId sale de la cookie de sesión)
app.use('/api', verificarSesion);
app.use('/api/user', require('./routes/user'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/city', require('./routes/city'));
app.use('/api/scenarios', require('./routes/scenarios'));
app.use('/api/phrases', require('./routes/phrases'));
app.use('/api/moods', require('./routes/moods'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1h' : 0 }));

app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(404).json({ error: 'No encontrado' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande' });
  if (err.code === 11000) return res.status(409).json({ error: 'Ese valor ya existe' });     // clave duplicada (p. ej. dos registros a la vez)
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

// Arranque: se abre el puerto enseguida (Cloud Run lo exige) y la base de datos se conecta en segundo plano.
function start() {
  for (const v of ['MONGO_URI', 'JWT_SECRET'])
    if (!process.env[v]) { console.error(`Falta ${v} (revisa el archivo .env o las variables de entorno)`); process.exit(1); }
  if (isProd && process.env.JWT_SECRET.length < 32) console.warn('Aviso: JWT_SECRET es corto; usa al menos 32 caracteres aleatorios.');
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`Brote escuchando en puerto ${port}`);
    mongoose.connect(process.env.MONGO_URI)
      .then(() => { console.log('Conectado a MongoDB'); return seedPhrases(); })
      .catch(e => { console.error('Error al conectar con MongoDB:', e.message); process.exit(1); });
  });
  // Cierre ordenado: Cloud Run envía SIGTERM al parar o reemplazar una instancia
  const cerrar = () => { console.log('Cerrando…'); server.close(() => mongoose.connection.close().finally(() => process.exit(0))); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', cerrar); process.on('SIGINT', cerrar);
}
// Solo arranca si se ejecuta con "node server.js" (los tests importan `app` sin abrir el puerto)
if (require.main === module) start();
module.exports = app;

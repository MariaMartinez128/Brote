const jwt = require('jsonwebtoken');
const { User } = require('../models');

const COOKIE = 'brote_token';
const secret = () => process.env.JWT_SECRET;
const isProd = () => process.env.NODE_ENV === 'production';

// Crea la cookie de sesión (JWT firmado, httpOnly: el JavaScript del navegador no puede leerla)
function iniciarSesion(res, user) {
  const token = jwt.sign({ id: user._id.toString() }, secret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd(), maxAge: 7 * 24 * 3600 * 1000 });
}
const cerrarSesion = res => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: isProd() });

// Exige sesión válida; deja el usuario en req.user y su id en req.userId
async function verificarSesion(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE];
    if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });
    let id;
    try { id = jwt.verify(token, secret()).id; }
    catch { return res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión' }); }
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) { next(err); }
}

// Restringe a administradores (usar después de verificarSesion)
function soloAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
}

module.exports = { verificarSesion, soloAdmin, iniciarSesion, cerrarSesion };

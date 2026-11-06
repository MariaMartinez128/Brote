const jwt = require('jsonwebtoken');
const { User } = require('../models');

const COOKIE = 'brote_token';
const secret = () => process.env.JWT_SECRET;
// La cookie solo viaja por HTTPS en producción. COOKIE_SECURE=false permite probar la imagen Docker en http://localhost
const secure = () => process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';

// Crea la cookie de sesión (JWT firmado, httpOnly: el JavaScript del navegador no puede leerla)
function iniciarSesion(res, user) {
  const token = jwt.sign({ id: user._id.toString() }, secret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secure(), maxAge: 7 * 24 * 3600 * 1000 });
}
const cerrarSesion = res => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: secure() });

// Exige sesión válida; deja el usuario en req.user y su id en req.userId
async function verificarSesion(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE];
    if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });
    let payload;
    try { payload = jwt.verify(token, secret()); }
    catch { return res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión' }); }
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    if (user.active === false) return res.status(403).json({ error: 'Tu cuenta está suspendida' });
    // Si se cambió la contraseña después de emitir este token, la sesión ya no vale
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000)
      return res.status(401).json({ error: 'Tu contraseña cambió. Vuelve a iniciar sesión' });
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

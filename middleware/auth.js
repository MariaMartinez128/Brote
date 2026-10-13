const { User } = require('../models');

// Middleware para verificar si el usuario ha iniciado sesión (simulado o mediante cabecera/sesión)
const verificarSesion = async (req, res, next) => {
  try {
    // Si usas app.locals o una cabecera personalizada para el usuario actual:
    const userId = req.headers['x-user-id'] || req.app.locals.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión.' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    req.user = user; // Adjuntamos el usuario a la petición
    req.userId = user._id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

// Middleware para restringir solo a administradores
const soloAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
  }
};

module.exports = { verificarSesion, soloAdmin };